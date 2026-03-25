# Phase 6: Stripe Billing - Research

**Researched:** 2026-03-25
**Domain:** Stripe subscription billing, one-time payments, webhook integration with Next.js 15 / Supabase
**Confidence:** HIGH

## Summary

Phase 6 wires the existing database foundation (subscriptions, credit_transactions, stripe_events tables from Phase 5) to live Stripe billing. The previous phase built the complete credit ledger with atomic RPCs, subscription tier tracking, lazy user bootstrapping, credit display in navbar, and a subscription settings page with placeholder buttons. This phase replaces those placeholders with real Stripe Checkout sessions, Customer Portal redirects, and a webhook handler that is the single source of truth for subscription state.

The implementation requires exactly two new npm packages (`stripe` and `@stripe/stripe-js`), four new environment variables, and one new Route Handler (`/api/webhooks/stripe`). The rest is Server Actions for checkout/portal flows and modifications to the existing subscription page. The webhook handler must use the admin Supabase client (already created in Phase 5) to bypass RLS when writing subscription updates and credit grants. The middleware already excludes `/api/webhooks` from auth.

**Primary recommendation:** Build the webhook handler first (it is the single source of truth), then wire checkout and portal flows, then add credit pack one-time purchases, and finally add upgrade prompts. Test on a deployed Vercel preview -- not just localhost -- before marking complete.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STRIPE-01 | User can subscribe to Pro plan via Stripe Checkout | Server Action creates checkout session with `mode: 'subscription'`, redirects to Stripe-hosted page. Use `metadata.supabase_user_id` to link back. |
| STRIPE-02 | Subscription status syncs to DB via Stripe webhooks (checkout completed, updated, deleted, payment failed) | Route Handler at `/api/webhooks/stripe` with `request.text()` for raw body, `stripe_events` table for idempotency, admin client for RLS bypass. Handle 6 event types. |
| STRIPE-03 | User can manage subscription via Stripe Customer Portal | Server Action creates portal session with `stripe_customer_id` from subscriptions table, redirects user. Portal must be pre-configured in Stripe Dashboard. |
| STRIPE-05 | Free users see contextual upgrade prompts when hitting usage limits | Modify credit check failure paths to return upgrade-eligible flag. Add UpgradePrompt component shown when `balance <= 0 && tier === 'free'`. |
| CRED-04 | User can purchase extra credit packs via Stripe one-time payment | Checkout session with `mode: 'payment'`, handle `checkout.session.completed` where `mode === 'payment'` to grant credits via admin client. |
</phase_requirements>

## Standard Stack

### Core (New Additions Only)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `stripe` | 20.4.1 (verified 2026-03-25) | Server-side Stripe SDK: checkout sessions, portal sessions, webhook signature verification | Industry standard, TypeScript-first, official Stripe package |
| `@stripe/stripe-js` | 8.11.0 (verified 2026-03-25) | Client-side Stripe.js loader for Checkout redirect | Required for `redirectToCheckout()`. Lightweight ~3KB loader, not full SDK |

### Already Available (from Phase 5 / existing)
| Library | Purpose | Relevant To |
|---------|---------|-------------|
| `@supabase/supabase-js` | Admin client for webhook DB writes | Webhook handler uses `createAdminClient()` from `src/lib/supabase/admin.ts` |
| `zod` | Schema validation for webhook payloads | Validate expected shapes before DB writes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stripe Hosted Checkout (redirect) | Stripe Embedded Checkout (iframe) | Embedded keeps user on-site but adds `@stripe/react-stripe-js` dependency and more complex UI. Hosted is simpler, higher conversion, zero PCI scope. Use hosted. |
| Server Action for checkout | API Route for checkout | Server Actions are the standard 2026 pattern for user-initiated flows. Route Handlers are only needed for external callbacks (webhooks). |
| `next-stripe` wrapper | Direct `stripe` SDK | Wrapper libraries go stale and obscure the API. Stripe SDK is excellent. Use directly. |

**Installation:**
```bash
npm install stripe @stripe/stripe-js
```

## Architecture Patterns

### Recommended New Files
```
src/
├── app/
│   ├── api/
│   │   └── webhooks/
│   │       └── stripe/route.ts           # NEW -- webhook handler (Route Handler)
│   ├── (dashboard)/
│   │   └── settings/
│   │       └── subscription/
│   │           ├── page.tsx              # MODIFY -- wire real checkout + portal
│   │           ├── actions.ts            # NEW -- server actions for checkout/portal/credit-pack
│   │           └── manage-subscription-button.tsx  # MODIFY -- call real portal action
├── components/
│   └── subscription/
│       └── upgrade-prompt.tsx            # NEW -- contextual upgrade modal/banner
├── lib/
│   └── stripe/
│       ├── client.ts                     # NEW -- Stripe SDK initialization (server-only)
│       ├── config.ts                     # NEW -- price IDs, tier mapping, plan metadata
│       └── sync-subscription.ts          # NEW -- webhook event handlers (dispatched by type)
```

### Pattern 1: Webhook as Single Source of Truth
**What:** All subscription state changes flow through Stripe webhooks. The app never writes subscription status based on client-side checkout success -- only the webhook handler updates the DB.
**When to use:** Always for Stripe subscriptions.
**Why:** Checkout success redirect is unreliable (user can close browser). Webhooks are guaranteed delivery with retries.

```typescript
// app/api/webhooks/stripe/route.ts
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripeServer } from '@/lib/stripe/client'

export async function POST(request: Request) {
  const body = await request.text()  // MUST be .text(), never .json()
  const signature = request.headers.get('stripe-signature')!
  const stripe = getStripeServer()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body, signature, process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Idempotency check via stripe_events table
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('stripe_events')
    .select('event_id')
    .eq('event_id', event.id)
    .single()

  if (existing) {
    return NextResponse.json({ received: true }) // Already processed
  }

  // Record event BEFORE processing (prevents duplicates on retry)
  await admin.from('stripe_events').insert({
    event_id: event.id,
    event_type: event.type,
  })

  // Dispatch to handler
  await handleStripeEvent(event, admin)

  return NextResponse.json({ received: true })
}
```

### Pattern 2: Server Action for Checkout + Portal
**What:** User-initiated Stripe flows (subscribe, manage, buy credits) use Next.js Server Actions. Stripe-initiated flows (webhooks) use Route Handlers.
**When to use:** Standard 2026 Next.js pattern.

```typescript
// app/(dashboard)/settings/subscription/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStripeServer } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'

export async function createCheckoutSession(priceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const stripe = getStripeServer()

  // Find or create Stripe customer
  const admin = createAdminClient()
  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  let customerId = sub?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    await admin
      .from('subscriptions')
      .update({ stripe_customer_id: customerId })
      .eq('user_id', user.id)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription?canceled=true`,
    metadata: { supabase_user_id: user.id },
  })

  redirect(session.url!)
}

export async function createPortalSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()
  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  if (!sub?.stripe_customer_id) throw new Error('No Stripe customer')

  const stripe = getStripeServer()
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription`,
  })

  redirect(session.url)
}
```

### Pattern 3: Credit Pack as One-Time Payment
**What:** Credit packs use `mode: 'payment'` (not `'subscription'`). The webhook handler distinguishes between subscription and one-time payment checkout completions.
**When to use:** For CRED-04 credit pack purchases.

```typescript
// In the webhook handler:
case 'checkout.session.completed': {
  const session = event.data.object as Stripe.Checkout.Session
  if (session.mode === 'subscription') {
    // Handle new subscription (link customer, update tier)
  } else if (session.mode === 'payment') {
    // Handle credit pack purchase
    const userId = session.metadata?.supabase_user_id
    const creditAmount = getCreditAmountFromPrice(session.amount_total)
    await admin.from('credit_transactions').insert({
      user_id: userId,
      type: 'credit_pack_purchase',
      amount: creditAmount,
      description: 'Credit pack purchase',
      reference_id: session.id,
    })
  }
  break
}
```

### Anti-Patterns to Avoid
- **Trusting checkout success URL for fulfillment:** Never grant access when user lands on `?success=true`. Only the webhook grants access.
- **Creating duplicate Stripe customers:** Always look up existing `stripe_customer_id` from subscriptions table before creating a new customer. The `ensureSubscription` from Phase 5 creates the row but with `stripe_customer_id = null` -- update it on first checkout.
- **Monolithic webhook handler:** Use event-type dispatch from day one. Each event type gets its own handler function in `sync-subscription.ts`.
- **Using anon key in webhook handler:** Webhook requests have no user session. Use `createAdminClient()` (service role) for ALL webhook DB operations.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment page UI | Custom payment form | Stripe Hosted Checkout | PCI compliance, higher conversion, zero UI code |
| Subscription management UI | Custom cancel/upgrade/payment-method pages | Stripe Customer Portal | Handles proration, cancellation flows, payment method updates |
| Webhook signature verification | Custom HMAC verification | `stripe.webhooks.constructEvent()` | Official method handles timing attacks, signature versioning |
| Webhook retry/idempotency | Custom retry logic | `stripe_events` table + Stripe's built-in retry (3 days) | Stripe retries failed deliveries automatically |
| Subscription state machine | Custom status transitions | Stripe webhook events map directly to DB status updates | Stripe manages the state machine; your DB mirrors it |

## Common Pitfalls

### Pitfall 1: Webhook Signature Fails on Vercel
**What goes wrong:** `stripe.webhooks.constructEvent()` throws "No signatures found matching the expected signature." All webhooks silently rejected.
**Why it happens:** Using `request.json()` instead of `request.text()` parses the body, changing it. Signature verification requires the exact raw bytes.
**How to avoid:** Always use `await request.text()` in the webhook Route Handler. Never use `request.json()`. Ensure no middleware intercepts the body.
**Warning signs:** Stripe Dashboard shows all webhook deliveries failing. Users pay but tier never updates.

### Pitfall 2: Duplicate Webhook Processing
**What goes wrong:** Stripe retries on timeout or non-2xx. Same event processes twice, granting double credits or corrupting state.
**Why it happens:** Handler takes too long, Stripe retries. No idempotency check.
**How to avoid:** Check `stripe_events` table before processing. Insert event ID before business logic. Return 200 as fast as possible.
**Warning signs:** Users receive double credits after payment. Stripe shows repeated delivery attempts.

### Pitfall 3: RLS Blocks Webhook Database Writes
**What goes wrong:** Webhook handler tries to update subscriptions table but write silently fails (zero rows affected). No error thrown.
**Why it happens:** Webhook requests have no Supabase auth session. RLS policies require `auth.uid() = user_id`.
**How to avoid:** Use `createAdminClient()` (service role key) for ALL webhook DB writes. Already created in Phase 5 at `src/lib/supabase/admin.ts`.
**Warning signs:** Webhook returns 200 but DB unchanged. Users pay but stay on free tier.

### Pitfall 4: Duplicate Stripe Customers
**What goes wrong:** User subscribes, cancels, re-subscribes. Each time a new Stripe customer is created. Billing history is fragmented, Customer Portal shows incomplete data.
**Why it happens:** Not checking for existing `stripe_customer_id` before calling `stripe.customers.create()`.
**How to avoid:** Always look up `stripe_customer_id` from subscriptions table first. Only create a new customer if null. Pass `customer` param to `checkout.sessions.create()`.
**Warning signs:** Stripe Dashboard shows multiple customers with same email. Customer Portal missing past invoices.

### Pitfall 5: Missing Webhook Events
**What goes wrong:** Only handling `checkout.session.completed` but not renewal, cancellation, or payment failure. User cancels but keeps Pro access. Subscription expires but no credit grant on renewal.
**Why it happens:** Developers test the happy path (new subscription) and ship without handling the full lifecycle.
**How to avoid:** Handle all 6 essential events (listed in Architecture Patterns). Use the "Looks Done But Isn't" checklist from PITFALLS.md.
**Warning signs:** Canceled users still have Pro access. No monthly credit grants after first month.

### Pitfall 6: Stripe Customer Portal Not Configured
**What goes wrong:** `createBillingPortalSession()` works in code but user sees an empty or broken portal page.
**Why it happens:** Portal must be configured in Stripe Dashboard (Settings > Customer Portal) before it works. Features (cancel, update payment, change plan) must be explicitly enabled.
**How to avoid:** Configure portal in Stripe Dashboard BEFORE writing the server action. Test the portal link manually.
**Warning signs:** Users report blank page after clicking "Manage Subscription."

### Pitfall 7: Credit Packs Reset on Subscription Renewal
**What goes wrong:** User buys a 50-credit pack, then monthly renewal resets their balance to the base allowance (e.g., 30 for Pro). Purchased credits disappear.
**Why it happens:** Renewal handler sets balance = monthly_allowance instead of adding monthly_allowance to existing balance.
**How to avoid:** Monthly renewal is an INSERT of a `subscription_grant` transaction row (positive amount), not a balance reset. The ledger pattern (SUM of all transactions) handles this correctly by design -- purchased credit pack rows remain in the ledger. Do NOT implement "reset balance to X" logic.
**Warning signs:** Users report credits vanishing after renewal date.

## Code Examples

### Stripe Server Client Initialization
```typescript
// src/lib/stripe/client.ts
import Stripe from 'stripe'

let stripeInstance: Stripe | null = null

export function getStripeServer(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-12-18.acacia',  // Pin API version
      typescript: true,
    })
  }
  return stripeInstance
}
```

### Stripe Config (Price IDs and Tier Mapping)
```typescript
// src/lib/stripe/config.ts
export const STRIPE_PRICES = {
  plus_monthly: process.env.STRIPE_PRICE_PLUS_MONTHLY!,
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY!,
  credit_pack_10: process.env.STRIPE_PRICE_CREDIT_PACK_10!,
} as const

// Map Stripe price IDs to internal tier names
export function tierFromPriceId(priceId: string): 'plus' | 'pro' | null {
  if (priceId === STRIPE_PRICES.plus_monthly) return 'plus'
  if (priceId === STRIPE_PRICES.pro_monthly) return 'pro'
  return null
}

export const CREDIT_PACK_AMOUNTS: Record<string, number> = {
  [process.env.STRIPE_PRICE_CREDIT_PACK_10!]: 10,
}
```

### Webhook Event Dispatcher
```typescript
// src/lib/stripe/sync-subscription.ts
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { TIER_CREDITS } from '@/lib/credits/types'
import { tierFromPriceId } from './config'

export async function handleStripeEvent(
  event: Stripe.Event,
  admin: SupabaseClient
) {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, admin)
      break
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, admin)
      break
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, admin)
      break
    case 'invoice.paid':
      await handleInvoicePaid(event.data.object as Stripe.Invoice, admin)
      break
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice, admin)
      break
  }
}
```

### Upgrade Prompt Component Pattern
```typescript
// src/components/subscription/upgrade-prompt.tsx
'use client'

import { useRouter } from 'next/navigation'

interface UpgradePromptProps {
  context: 'generation' | 'project_limit' | 'feature_gate'
  currentTier: string
}

export function UpgradePrompt({ context, currentTier }: UpgradePromptProps) {
  const router = useRouter()

  const messages = {
    generation: "You've used all your credits this month.",
    project_limit: "You've reached the free project limit.",
    feature_gate: "This feature is available on Plus and Pro plans.",
  }

  return (
    <div className="bg-[#fadbdb] border border-[#dbc1bc] rounded-xl p-4">
      <p className="text-sm text-[#3d0000] font-medium">{messages[context]}</p>
      <button
        onClick={() => router.push('/settings/subscription')}
        className="mt-2 bg-[#3d0000] text-white px-4 py-2 rounded-lg text-sm"
      >
        Upgrade Now
      </button>
    </div>
  )
}
```

## Environment Variables (New)

```bash
# Stripe keys (server-side only -- NO NEXT_PUBLIC_ prefix for secret key)
STRIPE_SECRET_KEY=sk_test_...           # From Stripe Dashboard > Developers > API keys
STRIPE_WEBHOOK_SECRET=whsec_...         # From Stripe Dashboard > Webhooks > Signing secret

# Stripe publishable key (client-side -- NEXT_PUBLIC_ prefix required)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Stripe Price IDs (configured in Stripe Dashboard > Products)
STRIPE_PRICE_PLUS_MONTHLY=price_...     # Plus plan monthly subscription
STRIPE_PRICE_PRO_MONTHLY=price_...      # Pro plan monthly subscription
STRIPE_PRICE_CREDIT_PACK_10=price_...   # 10-credit pack one-time payment

# Already configured (from Phase 5):
# SUPABASE_SERVICE_ROLE_KEY -- used by createAdminClient() in webhook handler
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# NEXT_PUBLIC_APP_URL -- used for success/cancel/return URLs
```

## Webhook Events to Handle

| Event | Trigger | DB Action |
|-------|---------|-----------|
| `checkout.session.completed` (mode=subscription) | New subscription created | Upsert subscriptions row: set `stripe_customer_id`, `stripe_subscription_id`, tier, status, period dates |
| `checkout.session.completed` (mode=payment) | Credit pack purchased | Insert `credit_pack_purchase` transaction with positive amount |
| `customer.subscription.updated` | Plan change (upgrade/downgrade), renewal period change | Update subscriptions row: tier, status, period dates, `cancel_at_period_end` |
| `customer.subscription.deleted` | Subscription canceled (end of period) | Update subscriptions row: tier='free', status='canceled' |
| `invoice.paid` | Successful payment (initial or renewal) | Insert `subscription_grant` credit transaction for monthly allowance |
| `invoice.payment_failed` | Payment failed on renewal | Update subscriptions row: status='past_due' |

**Critical distinction for `invoice.paid`:** This fires on BOTH initial subscription AND monthly renewals. For initial subscription, the credits may already be granted by `checkout.session.completed`. Use the `stripe_events` idempotency table to prevent double-granting. Alternatively, only grant credits from `invoice.paid` and skip credit grants in `checkout.session.completed`.

## Existing Code That Must Change

| File | Change | Reason |
|------|--------|--------|
| `src/app/(dashboard)/settings/subscription/page.tsx` | Wire plan cards to call `createCheckoutSession(priceId)`. Show current plan as active. Add success/cancel query param handling. | Currently plan cards link to `#` |
| `src/app/(dashboard)/settings/subscription/manage-subscription-button.tsx` | Call `createPortalSession()` server action instead of `window.alert()` | Currently a placeholder alert |
| `src/lib/credits/ensure-subscription.ts` | No change needed -- already creates subscription row with `stripe_customer_id = null`. Phase 6 fills it in on first checkout. | Already correct for lazy bootstrap pattern |
| `src/middleware.ts` | No change needed -- already excludes `/api/webhooks` | Already done in Phase 5 |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| API Route for checkout session | Server Action with `redirect()` | Next.js 15 (2024) | Simpler code, no fetch/POST needed |
| Stripe Checkout redirect | Stripe Embedded Checkout (iframe) | Stripe 2025 | Optional; hosted redirect still works and is simpler |
| `request.body` for webhook | `request.text()` for raw body | Next.js App Router | Required for signature verification |
| Separate webhook endpoint per event | Single endpoint with type dispatch | Always the standard | Simpler routing, single secret |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STRIPE-01 | Checkout session created with correct params | unit | `npx vitest run src/__tests__/stripe/checkout.test.ts -t "creates checkout session"` | Wave 0 |
| STRIPE-02 | Webhook handler processes events idempotently | unit | `npx vitest run src/__tests__/stripe/webhook.test.ts` | Wave 0 |
| STRIPE-02 | Each event type updates DB correctly | unit | `npx vitest run src/__tests__/stripe/sync-subscription.test.ts` | Wave 0 |
| STRIPE-03 | Portal session created with customer ID | unit | `npx vitest run src/__tests__/stripe/portal.test.ts -t "creates portal session"` | Wave 0 |
| STRIPE-05 | Upgrade prompt shown when credits exhausted | unit | `npx vitest run src/__tests__/stripe/upgrade-prompt.test.ts` | Wave 0 |
| CRED-04 | Credit pack purchase grants credits | unit | `npx vitest run src/__tests__/stripe/sync-subscription.test.ts -t "credit pack"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/stripe/webhook.test.ts` -- covers STRIPE-02 (signature verification, idempotency, event dispatch)
- [ ] `src/__tests__/stripe/sync-subscription.test.ts` -- covers STRIPE-02, CRED-04 (each event type handler)
- [ ] `src/__tests__/stripe/checkout.test.ts` -- covers STRIPE-01, STRIPE-03 (checkout + portal session creation)

## Stripe Dashboard Configuration Required (Pre-Implementation)

Before writing code, these Stripe Dashboard tasks must be completed:

1. **Create Products and Prices:** Create "Plus Monthly" and "Pro Monthly" subscription products. Create "Credit Pack (10)" one-time product. Note the `price_...` IDs.
2. **Configure Customer Portal:** Settings > Customer Portal. Enable: cancel subscription, update payment method, switch plans. Set return URL.
3. **Create Webhook Endpoint:** Developers > Webhooks. Add endpoint URL (`https://yourdomain.com/api/webhooks/stripe`). Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Note the `whsec_...` signing secret.
4. **For local development:** Install Stripe CLI. Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` to forward test events.

## Open Questions

1. **Embedded vs Hosted Checkout:**
   - What we know: Stripe now pushes Embedded Checkout (iframe). Hosted Checkout (redirect) still works.
   - What's unclear: Whether the team has a preference.
   - Recommendation: Use Hosted Checkout (redirect). Simpler, no extra dependencies (`@stripe/react-stripe-js`), higher proven conversion. Can migrate to embedded later if needed.

2. **Credit grant timing -- checkout vs invoice:**
   - What we know: Both `checkout.session.completed` and `invoice.paid` fire on new subscription. Could double-grant credits.
   - What's unclear: Best single point to grant credits.
   - Recommendation: Grant monthly credits ONLY from `invoice.paid`. This handles both initial subscription and renewals with one code path. Skip credit grants in `checkout.session.completed` (use it only for linking customer + subscription IDs and setting tier).

3. **Stripe API version pinning:**
   - What we know: Stripe SDK defaults to the latest API version. Pinning prevents breaking changes.
   - Recommendation: Pin to `2025-12-18.acacia` (latest stable as of research date). Update deliberately.

## Sources

### Primary (HIGH confidence)
- [Stripe Webhooks Documentation](https://docs.stripe.com/webhooks) -- event types, signature verification, retry behavior
- [Stripe Checkout Quickstart (Next.js)](https://docs.stripe.com/checkout/quickstart?client=next) -- official Next.js integration guide
- [Stripe Customer Portal Integration](https://docs.stripe.com/customer-management/integrate-customer-portal) -- portal session creation, configuration
- [Stripe Billing Subscription Webhooks](https://docs.stripe.com/billing/subscriptions/webhooks) -- full lifecycle event list
- [stripe npm v20.4.1](https://www.npmjs.com/package/stripe) -- verified current version
- [@stripe/stripe-js npm v8.11.0](https://www.npmjs.com/package/@stripe/stripe-js) -- verified current version

### Secondary (MEDIUM confidence)
- [Stripe + Next.js 15 Complete Guide 2025 (Pedro Alonso)](https://www.pedroalonso.net/blog/stripe-nextjs-complete-guide-2025/) -- Server Actions pattern
- [Ultimate Guide to Stripe + Next.js 2026 (DEV)](https://dev.to/sameer_saleem/the-ultimate-guide-to-stripe-nextjs-2026-edition-2f33) -- Embedded checkout, server-action-first architecture
- [Stripe Webhook in Next.js App Router (Medium)](https://kitson-broadhurst.medium.com/next-js-app-router-stripe-webhook-signature-verification-ea9d59f3593f) -- request.text() pattern
- [Next.js Stripe Webhook Issues (GitHub #60002)](https://github.com/vercel/next.js/issues/60002) -- raw body access in App Router
- [Stripe Webhook Best Practices (Stigg)](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks) -- idempotency patterns

### Tertiary (LOW confidence)
- None -- all critical claims verified against official Stripe docs and npm registry

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Only 2 packages, both official Stripe, versions verified against npm registry
- Architecture: HIGH -- Patterns sourced from official Stripe docs, Vercel subscription starter, and multiple 2025-2026 guides. All aligned.
- Pitfalls: HIGH -- Top pitfalls (raw body, RLS bypass, idempotency) are the most-reported issues with established fixes

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable domain, Stripe SDK versioning is conservative)
