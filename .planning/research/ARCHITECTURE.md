# Architecture Research

**Domain:** SaaS monetization and AI image generation for existing carousel creator
**Researched:** 2026-03-24
**Confidence:** HIGH

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Client (Next.js App Router)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐              │
│  │ Slide Editor  │  │ Subscription │  │ Caption Panel │              │
│  │ (existing)    │  │ Page (modify)│  │ (NEW)         │              │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘              │
├─────────┴──────────────────┴──────────────────┴─────────────────────┤
│                   Server Actions + Route Handlers                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ generateCar- │  │ Stripe       │  │ Stripe       │               │
│  │ ousel (mod)  │  │ Actions(NEW) │  │ Webhook(NEW) │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
├─────────┴──────────────────┴──────────────────┴─────────────────────┤
│                        Service Layer (lib/)                          │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐       │
│  │ credits   │ │ imagen    │ │ stripe    │ │ captions      │       │
│  │ (modify)  │ │ (NEW)     │ │ (NEW)     │ │ (NEW)         │       │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └───────┬───────┘       │
├────────┴──────────────┴─────────────┴───────────────┴───────────────┤
│                            Data Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Supabase     │  │ Stripe API   │  │ Google GenAI │               │
│  │ (PostgreSQL  │  │ (payments)   │  │ (Imagen +    │               │
│  │  + Storage)  │  │              │  │  Gemini)     │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | New vs Modified |
|-----------|----------------|-----------------|
| `lib/imagen/` | Generate AI background images via Imagen 4 | **NEW** |
| `lib/stripe/` | Stripe client init, checkout session creation, portal URL | **NEW** |
| `lib/credits/` | Credit balance tracking with DB-backed ledger, deduction, purchase credits | **MODIFY** (currently naive project-count approach) |
| `lib/captions/` | Generate social media captions via Gemini 2.5 Flash | **NEW** |
| `app/api/webhooks/stripe/route.ts` | Receive Stripe webhook events, sync subscription state | **NEW** |
| `app/(dashboard)/settings/subscription/` | Wire up real Stripe Checkout + Customer Portal | **MODIFY** |
| Editor image picker panel | Add "AI Generate" tab alongside Pexels search | **MODIFY** |
| Caption panel component | UI for generating/copying captions post-carousel | **NEW** |

## Recommended New Project Structure

Only showing NEW files and modified areas:

```
src/
├── app/
│   ├── api/
│   │   ├── render/route.ts              # existing
│   │   └── webhooks/
│   │       └── stripe/route.ts          # NEW -- Stripe webhook handler
│   ├── (dashboard)/
│   │   ├── settings/
│   │   │   └── subscription/
│   │   │       ├── page.tsx             # MODIFY -- wire to real Stripe
│   │   │       └── actions.ts           # NEW -- createCheckoutSession, createPortalSession
│   │   └── project/[id]/
│   │       ├── actions.ts               # MODIFY -- add imagen + credit deduction
│   │       └── caption-actions.ts       # NEW -- generate captions
├── components/
│   ├── editor/
│   │   └── image-picker-panel.tsx       # MODIFY -- add AI image tab
│   ├── captions/
│   │   └── caption-panel.tsx            # NEW -- caption generation UI
│   └── subscription/
│       └── credit-display.tsx           # NEW -- credit balance badge
├── lib/
│   ├── imagen/
│   │   └── generate-image.ts            # NEW -- Imagen API wrapper
│   ├── stripe/
│   │   ├── client.ts                    # NEW -- Stripe SDK init (server-side)
│   │   ├── config.ts                    # NEW -- price IDs, plan config
│   │   └── sync-subscription.ts         # NEW -- webhook event handlers
│   ├── captions/
│   │   └── generate-captions.ts         # NEW -- Gemini caption generation
│   └── credits/
│       └── check-credits.ts             # MODIFY -- DB-backed ledger
```

### Structure Rationale

- **`lib/stripe/`:** Isolates all Stripe logic. `client.ts` exports the Stripe instance. `config.ts` maps price IDs to tier names. `sync-subscription.ts` handles webhook event processing. This separation keeps the webhook route handler thin.
- **`lib/imagen/`:** Single-file wrapper because the Imagen API call is straightforward. Uses the same `@google/genai` SDK already installed for Gemini text generation. No new dependency needed.
- **`lib/captions/`:** Separate from `lib/ai/` because caption generation has different prompts, schemas, and is invoked from a different UI flow than slide generation.
- **`app/api/webhooks/stripe/`:** Must be a Route Handler (not a server action) because Stripe sends POST requests to a static URL. This is the only new API route needed.

## Architectural Patterns

### Pattern 1: Credit Ledger (Replace Naive Count)

**What:** Replace the current "count projects this month" credit system with a proper credits table that tracks balance, deductions, and top-ups as individual rows.

**When to use:** Now. The current `check-credits.ts` counts projects with `generation_status != 'draft'` as credit usage. This breaks when you add Imagen (separate cost) and credit pack purchases (top-ups that the current system cannot track).

**Trade-offs:** More database writes per action, but accurate and auditable. Necessary for a billing system.

**Current problem:**
```typescript
// Current approach in check-credits.ts -- cannot handle:
// 1. Multiple credit types (carousel gen vs imagen gen)
// 2. Purchased credit packs (top-ups)
// 3. Different costs per action
const { count } = await supabase
  .from('projects')
  .select('*', { count: 'exact', head: true })
  .neq('generation_status', 'draft')
  .gte('created_at', monthStart)
```

**Replacement approach:**
```typescript
// New: dedicated credit_transactions table with ledger entries
// Rows: "subscription_grant" +30, "carousel_generation" -1,
//        "imagen_generation" -1, "credit_pack" +10

export async function deductCredit(
  userId: string,
  type: CreditActionType,
  referenceId?: string
): Promise<boolean> {
  const supabase = await createServiceClient() // service role for atomicity
  const balance = await getCreditBalance(userId)
  if (balance <= 0) return false

  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type,
    amount: -1,
    description: `${type} usage`,
    reference_id: referenceId,
  })
  return true
}

export async function getCreditBalance(userId: string): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_credit_balance', { p_user_id: userId })
  return data ?? 0
}
```

### Pattern 2: Stripe Webhook as Single Source of Truth

**What:** All subscription state changes flow through Stripe webhooks. The app never writes subscription status based on client-side Checkout success -- only the webhook handler updates the DB.

**When to use:** Always for Stripe subscriptions. The Checkout success redirect is unreliable (user can close browser). Webhooks are guaranteed delivery.

**Trade-offs:** Slight delay (seconds) between payment and access. Acceptable for this use case.

**Key events to handle:**
```typescript
// app/api/webhooks/stripe/route.ts
switch (event.type) {
  case 'checkout.session.completed':
    // Link Stripe customer ID to Supabase user, grant initial credits
    break
  case 'customer.subscription.updated':
    // Tier change -- update subscriptions table
    break
  case 'customer.subscription.deleted':
    // Downgrade to free -- update subscriptions table
    break
  case 'invoice.payment_succeeded':
    // Monthly renewal -- grant new month's credits
    break
}
// For one-time credit pack purchases:
// checkout.session.completed with mode === 'payment'
// -> Add purchased credits to balance
```

### Pattern 3: Server Action for Checkout, Route Handler for Webhook

**What:** Use Next.js server actions to create Stripe Checkout Sessions (user-initiated), but use a Route Handler for the webhook endpoint (Stripe-initiated).

**When to use:** This is the standard 2025/2026 pattern for Stripe + Next.js App Router.

**Trade-offs:** Two different patterns for Stripe communication. This is intentional -- server actions are for user-initiated flows, route handlers are for external service callbacks.

```typescript
// Server Action -- user clicks "Subscribe"
'use server'
export async function createCheckoutSession(priceId: string) {
  const stripe = getStripeClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription?canceled=true`,
    metadata: { supabase_user_id: user!.id },
  })
  redirect(session.url!)
}

// Route Handler -- Stripe calls this
// app/api/webhooks/stripe/route.ts
export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!
  const event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  await handleStripeEvent(event) // delegates to lib/stripe/sync-subscription.ts
  return NextResponse.json({ received: true })
}
```

## Data Flow

### Flow 1: AI Image Generation (Imagen)

```
User clicks "Generate AI Image" in editor image picker
    |
    v
Server Action: generateAIImage(projectId, slideIndex, prompt)
    |
    +-- 1. Check credit balance (credit_transactions table via RPC)
    |       If insufficient -> return error with upgrade prompt
    |
    +-- 2. Deduct credit BEFORE calling API (optimistic deduction)
    |       Insert credit_transaction: { type: 'imagen_generation', amount: -1 }
    |
    +-- 3. Call Imagen API via @google/genai
    |       ai.models.generateImages({
    |         model: 'imagen-4.0-fast-generate-001',
    |         prompt: prompt,
    |         config: { numberOfImages: 1, aspectRatio: '9:16' }
    |       })
    |
    +-- 4. Upload image buffer to Supabase Storage
    |       bucket: 'slide-images', path: '{userId}/{projectId}/{slideIndex}.png'
    |
    +-- 5. Update slide_data JSONB with public URL
    |       slide.background_url = publicUrl
    |       slide.image_source = 'imagen'
    |
    +-- 6. If step 3 fails -> refund credit (insert +1 transaction)
    |
    +-- 7. Return public URL to client
```

**Key detail:** Imagen natively supports `9:16` aspect ratio, which matches the 1080x1920 carousel slide dimensions exactly. Use `imagen-4.0-fast-generate-001` at $0.02/image for cost efficiency -- the quality difference vs standard is minimal for slide backgrounds.

### Flow 2: Stripe Subscription Lifecycle

```
User clicks "Upgrade to Pro" on subscription page
    |
    v
Server Action: createCheckoutSession(priceId)
    |
    +-- 1. Get Supabase user
    +-- 2. Find or create Stripe customer (store stripe_customer_id)
    +-- 3. Create Stripe Checkout Session (mode: 'subscription')
    +-- 4. Redirect to Stripe-hosted Checkout page
            |
            v
        Stripe processes payment
            |
            v
        Stripe POSTs to /api/webhooks/stripe
            |
            v
        Route Handler:
            +-- 1. Verify webhook signature
            +-- 2. Extract subscription details from event
            +-- 3. Upsert row in subscriptions table (tier, status, period)
            +-- 4. Grant monthly credits (insert credit_transaction: +N)
            +-- 5. Return 200 OK

User returns to success URL:
    +-- Page checks subscriptions table for updated tier
    +-- Shows "Subscription active" (or "Processing..." if webhook hasn't fired yet)
```

### Flow 3: Caption Generation

```
User clicks "Generate Captions" (after carousel is complete)
    |
    v
Server Action: generateCaptions(projectId)
    |
    +-- 1. Fetch project slide_data + topic from DB
    +-- 2. Build prompt: "Generate social media captions for a carousel about {topic}
    |      with these slides: {slide summaries}"
    +-- 3. Call Gemini 2.5 Flash via @google/genai (text generation, structured output)
    |       Schema: { tiktok: string, instagram: string, twitter: string }
    +-- 4. Return captions to client (ephemeral, no DB storage needed)
    +-- 5. UI shows copy-to-clipboard for each platform
```

**Key detail:** Caption generation uses Gemini 2.5 Flash text-only. It is very cheap (fractions of a cent). It should NOT consume image/carousel credits. Either make it free for all tiers or give it a separate generous limit. This is a low-friction feature that increases perceived value.

### Flow 4: Monthly Credit Renewal

```
Stripe sends webhook: invoice.payment_succeeded (recurring billing)
    |
    v
Route Handler: /api/webhooks/stripe
    |
    +-- 1. Look up stripe_subscription_id -> find subscription row -> determine tier
    +-- 2. Insert credit_transaction: { type: 'subscription_grant', amount: +tierLimit }
    +-- 3. Return 200 OK
```

Credits do NOT roll over. The monthly grant is a flat amount regardless of remaining balance. This simplifies the system and incentivizes usage.

## New Database Schema

### subscriptions table

```sql
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'plus', 'pro')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription
CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Only the service role (webhook handler) writes to this table
-- No INSERT/UPDATE/DELETE policies for anon/authenticated roles

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at(); -- reuse existing trigger function
```

### credit_transactions table

```sql
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'subscription_grant',
    'carousel_generation',
    'imagen_generation',
    'credit_pack_purchase',
    'refund',
    'admin_adjustment'
  )),
  amount INTEGER NOT NULL, -- positive for grants, negative for usage
  description TEXT,
  reference_id TEXT, -- optional: project_id, stripe_session_id, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX credit_transactions_user_id_idx
  ON public.credit_transactions(user_id);

CREATE INDEX credit_transactions_user_created_idx
  ON public.credit_transactions(user_id, created_at DESC);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own credit history
CREATE POLICY "Users can view their own credits"
  ON public.credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role writes (from server actions and webhooks)

-- Balance calculation via database function
CREATE OR REPLACE FUNCTION public.get_credit_balance(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(amount), 0)::INTEGER
  FROM public.credit_transactions
  WHERE user_id = p_user_id;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;
```

### Supabase Storage bucket

```
Bucket: slide-images (NEW)
  - Public read access (images served via Supabase CDN)
  - Write restricted to authenticated users, scoped to own user_id path
  - Path pattern: {user_id}/{project_id}/{slide_index}.png
  - Max file size: 5MB (Imagen outputs are typically 1-2MB PNGs)
```

### Slide type modification

```typescript
// Add to src/lib/types/slide.ts
export interface Slide {
  hook_text: string
  body_text: string
  image_query: string
  is_cta: boolean
  background_url: string | null
  pexels_photo_id: number | null
  image_source?: 'pexels' | 'imagen' | 'upload' // NEW field
  style_overrides?: SlideStyleOverrides
}
```

## Integration Points

### External Services

| Service | Integration Pattern | Key Config | Cost |
|---------|---------------------|------------|------|
| Google Imagen 4 Fast | `@google/genai` SDK, `ai.models.generateImages()` | `GEMINI_API_KEY` (same key works) | $0.02/image |
| Stripe Subscriptions | `stripe` npm package (NEW), server-side only | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | 2.9% + $0.30/txn |
| Stripe Credit Packs | Same package, `mode: 'payment'` (one-time) | Same keys | Same fee |
| Stripe Customer Portal | `stripe.billingPortal.sessions.create()` | Same keys | Free |
| Gemini 2.5 Flash (captions) | `@google/genai` SDK (existing), `ai.models.generateContent()` | `GEMINI_API_KEY` (same key) | ~$0.001/request |
| Supabase Storage | `@supabase/supabase-js` (existing) | Existing Supabase keys | 1GB free, then $0.021/GB |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Editor --> Imagen | Server action `generateAIImage()` | Returns Supabase Storage public URL, updates slide_data |
| Subscription page --> Stripe | Server action `createCheckoutSession()` | Redirects to Stripe-hosted page |
| Stripe --> App | POST to `/api/webhooks/stripe` | Must verify signature; uses service role Supabase client |
| Webhook --> Credits | Direct function call in same process | `grantMonthlyCredits()` called from webhook handler |
| Webhook --> Subscriptions | Direct function call in same process | `upsertSubscription()` called from webhook handler |
| Caption panel --> Gemini | Server action `generateCaptions()` | Stateless, returns text, no DB write |
| Credit display --> DB | Server component data fetch or server action | Calls `get_credit_balance` RPC |
| Settings page --> Subscription DB | Server component data fetch | Reads `subscriptions` table on page load |

### Existing Code That Must Change

| File | Change | Reason |
|------|--------|--------|
| `src/lib/credits/check-credits.ts` | Full rewrite: use `credit_transactions` table + RPC instead of counting projects | Current approach cannot handle credit packs, imagen deductions, or multiple credit types |
| `src/app/(dashboard)/project/[id]/actions.ts` | Add credit deduction call after successful generation; add Imagen image option | Currently checks credits but never deducts from a ledger |
| `src/app/(dashboard)/settings/subscription/page.tsx` | Wire "Upgrade" buttons to `createCheckoutSession()`, "Manage" to Customer Portal session | Currently shows `window.alert('coming soon')` placeholder |
| `src/components/editor/image-picker-panel.tsx` | Add "AI Generate" tab with prompt input alongside existing Pexels tab | Currently only offers Pexels stock photo search |
| `src/lib/types/slide.ts` | Add `image_source` field to Slide interface | Need to track where each slide image came from |
| `src/middleware.ts` | No change needed | Webhook route at `/api/webhooks/stripe` is already excluded by the existing matcher pattern |

## Environment Variables (New)

```bash
# Stripe (all new)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Stripe Price IDs (configured in Stripe Dashboard)
STRIPE_PRICE_PLUS_MONTHLY=price_...
STRIPE_PRICE_PLUS_YEARLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_CREDIT_PACK_10=price_...

# Supabase Service Role (for webhook handler -- NOT exposed to client)
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Existing -- no changes needed:
# GEMINI_API_KEY -- works for both Gemini text and Imagen image generation
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# PEXELS_API_KEY
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Current monolith is fine. Single Supabase instance. Credit balance RPC is fast with index on user_id. |
| 1k-10k users | Add materialized `balance` column to subscriptions table (updated by trigger on credit_transactions INSERT) to avoid SUM on every check. |
| 10k+ users | Move Imagen calls behind a queue to handle rate limits. Add CDN in front of Supabase Storage. Consider read replicas for Supabase. |

### Scaling Priorities

1. **First bottleneck:** Imagen API rate limits. Google imposes per-minute quotas. Mitigate with optimistic deduction (credit deducted before API call) and retry with exponential backoff.
2. **Second bottleneck:** Credit balance calculation. The SUM aggregation on credit_transactions will slow as rows grow. Fix with a materialized balance column updated via PostgreSQL trigger.

## Anti-Patterns

### Anti-Pattern 1: Storing Subscription Tier in User Metadata

**What people do:** Store `subscription_tier` in `auth.users.user_metadata` (which is what the CURRENT code does in `getUserTier()`).
**Why it's wrong:** User metadata is client-writable and can be spoofed via `supabase.auth.updateUser()`. It has no audit trail and cannot be updated atomically from a webhook (webhooks have no user session). The current implementation at `src/lib/credits/check-credits.ts:19-23` reads from `user?.user_metadata?.subscription_tier`.
**Do this instead:** Create a `subscriptions` table written ONLY by the webhook handler using the Supabase service role client. Read tier from this table in all credit checks.

### Anti-Pattern 2: Trusting Checkout Success URL for Fulfillment

**What people do:** Grant access when the user lands on `?success=true` after Stripe Checkout.
**Why it's wrong:** Users can navigate directly to the success URL. Browser might close before redirect. Checkout success is not a guarantee of payment.
**Do this instead:** Only grant access via webhook. The success page shows "Processing your subscription..." and checks the subscriptions table. If the webhook has not fired yet, show a brief loading state.

### Anti-Pattern 3: Calling Imagen Without Pre-deduction

**What people do:** Call the Imagen API first, then deduct credit on success.
**Why it's wrong:** If a user spam-clicks "generate," multiple API calls fire before any credit is deducted. This can exhaust your API quota and give away free generations.
**Do this instead:** Deduct the credit BEFORE calling Imagen. If Imagen fails, insert a refund credit transaction. This naturally rate-limits per user via their credit balance.

### Anti-Pattern 4: Storing AI Images as Base64 in JSONB

**What people do:** Store the Imagen-generated image bytes directly in the `slide_data` JSONB column.
**Why it's wrong:** JSONB is not designed for large binary blobs. A single image is 1-2MB as base64. It bloats the projects table, slows all queries that touch that row, and makes backups enormous.
**Do this instead:** Upload to Supabase Storage, store the public URL in `slide_data[].background_url` -- the same field already used for Pexels image URLs. This is a drop-in replacement.

## Suggested Build Order

Based on dependency analysis of the four new features:

1. **Database tables + credit ledger rewrite** -- Everything depends on proper credit tracking and subscription state. Create `subscriptions` and `credit_transactions` tables. Rewrite `check-credits.ts` to use the ledger. Create the `get_credit_balance` RPC. This unblocks all other features.

2. **Stripe integration (webhooks + checkout + portal)** -- Subscriptions must work before gating premium features. Create webhook handler, checkout session server actions, customer portal redirect. Wire up the existing subscription settings page. Depends on: subscriptions table from step 1.

3. **Imagen integration** -- Depends on credits (to deduct) and subscriptions (to gate as premium-only). Add the image generation wrapper using existing `@google/genai` SDK. Set up Supabase Storage bucket. Add "AI Generate" tab to the editor image picker. Depends on: credit system from step 1, subscription gating from step 2.

4. **Caption generation** -- Lowest dependency, simplest feature. Uses existing Gemini SDK and patterns. No new tables, no billing impact. Add server action + UI panel. Can be built in parallel with step 3 once step 1 is complete.

```
[Step 1: DB + Credits] -----> [Step 2: Stripe] -----> [Step 3: Imagen]
                          \                               /
                           +----> [Step 4: Captions] ----+
```

## Sources

- [Google Imagen API docs -- generateImages() API, model names, aspect ratios](https://ai.google.dev/gemini-api/docs/imagen) -- HIGH confidence
- [@google/genai npm package v1.46.0](https://www.npmjs.com/package/@google/genai) -- HIGH confidence
- [Imagen 4 GA announcement with pricing](https://developers.googleblog.com/announcing-imagen-4-fast-and-imagen-4-family-generally-available-in-the-gemini-api/) -- HIGH confidence
- [Stripe subscription lifecycle in Next.js 2026](https://dev.to/thekarlesi/stripe-subscription-lifecycle-in-nextjs-the-complete-developer-guide-2026-4l9d) -- MEDIUM confidence
- [Stripe + Next.js 15 complete guide 2025](https://www.pedroalonso.net/blog/stripe-nextjs-complete-guide-2025/) -- MEDIUM confidence
- [Supabase Stripe webhook handling docs](https://supabase.com/docs/guides/functions/examples/stripe-webhooks) -- HIGH confidence
- [Vercel Next.js subscription payments starter](https://vercel.com/templates/next.js/subscription-starter) -- HIGH confidence

---
*Architecture research for: TikTok Carousel Creator v1.1 -- Monetization and AI Images*
*Researched: 2026-03-24*
