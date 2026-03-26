---
phase: quick
plan: 260326-kzh
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(dashboard)/settings/subscription/page.tsx
  - src/app/(dashboard)/settings/subscription/actions.ts
  - src/lib/credits/check-credits.ts
  - src/lib/stripe/sync-subscription.ts
autonomous: true
must_haves:
  truths:
    - "Subscription page loads without error for users with no subscription row"
    - "Buy Credits button works for users with no prior subscription row"
    - "Upgrade to Pro/Plus button works for users with no prior subscription row"
    - "Stripe checkout.session.completed webhook creates subscription row if none exists"
  artifacts:
    - path: "src/app/(dashboard)/settings/subscription/page.tsx"
      provides: "Subscription page with ensureSubscription call and safe .maybeSingle() query"
    - path: "src/app/(dashboard)/settings/subscription/actions.ts"
      provides: "Server actions with ensureSubscription and .maybeSingle() queries"
    - path: "src/lib/credits/check-credits.ts"
      provides: "getUserTier with .maybeSingle() instead of .single()"
    - path: "src/lib/stripe/sync-subscription.ts"
      provides: "Webhook handlers using .upsert() for checkout completed"
  key_links:
    - from: "subscription/page.tsx"
      to: "ensureSubscription()"
      via: "called before any other DB query"
      pattern: "ensureSubscription\\(user\\.id\\)"
    - from: "subscription/actions.ts"
      to: "ensureSubscription()"
      via: "called at start of getOrCreateStripeCustomer"
      pattern: "ensureSubscription\\(userId\\)"
    - from: "sync-subscription.ts handleCheckoutCompleted"
      to: "subscriptions table"
      via: ".upsert() instead of .update()"
      pattern: "\\.upsert\\("
---

<objective>
Fix Stripe integration crashes caused by `.single()` throwing when no subscription row exists, and `.update()` silently failing when no row matches.

Purpose: Users visiting /settings/subscription or clicking Buy Credits / Upgrade crash with server-side exceptions if they have no subscription record yet.
Output: All four files patched so subscription page and Stripe actions handle missing subscription rows gracefully.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/credits/ensure-subscription.ts
@src/lib/credits/check-credits.ts
@src/app/(dashboard)/settings/subscription/page.tsx
@src/app/(dashboard)/settings/subscription/actions.ts
@src/lib/stripe/sync-subscription.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix subscription page and actions to handle missing subscription rows</name>
  <files>
    src/app/(dashboard)/settings/subscription/page.tsx
    src/app/(dashboard)/settings/subscription/actions.ts
    src/lib/credits/check-credits.ts
  </files>
  <action>
**In `src/app/(dashboard)/settings/subscription/page.tsx`:**
1. Import `ensureSubscription` from `@/lib/credits/ensure-subscription`
2. After the auth check (`if (!user) return null`), call `await ensureSubscription(user.id)` BEFORE calling `getUserTier()` or `getCreditBalance()`. This ensures a subscription row exists.
3. Replace the `.single()` call on lines 76-80 (the stripe_customer_id lookup) with `.maybeSingle()`. The rest of the logic already handles `sub` being null via `!!sub?.stripe_customer_id`.

**In `src/app/(dashboard)/settings/subscription/actions.ts`:**
1. Import `ensureSubscription` from `@/lib/credits/ensure-subscription`
2. In `getOrCreateStripeCustomer()`: call `await ensureSubscription(userId)` at the very start of the function (before the DB query). Then replace `.single()` on line 24 with `.maybeSingle()`.
3. In `getOrCreateStripeCustomer()`: Replace the `.update()` on lines 38-40 (that saves stripe_customer_id) with `.upsert()`:
   ```
   await admin
     .from('subscriptions')
     .upsert({
       user_id: userId,
       stripe_customer_id: customer.id,
       tier: 'free',
       status: 'active',
     }, { onConflict: 'user_id' })
   ```
   This is a belt-and-suspenders fix -- ensureSubscription should have created the row, but upsert guarantees it works even in race conditions.
4. In `createCheckoutSession()`: Replace `.single()` on line 55 with `.maybeSingle()`.
5. In `createPortalSession()`: Replace `.single()` on line 93 with `.maybeSingle()`.

**In `src/lib/credits/check-credits.ts`:**
1. In `getUserTier()`: Replace `.single()` on line 14 with `.maybeSingle()`. The existing `?? 'free'` fallback already handles null correctly.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && npx tsc --noEmit --pretty 2>&1 | head -30</automated>
  </verify>
  <done>
    - All `.single()` calls replaced with `.maybeSingle()` in subscription page, actions, and check-credits
    - `ensureSubscription()` called in subscription page before queries
    - `ensureSubscription()` called in `getOrCreateStripeCustomer()` before queries
    - `.upsert()` used as fallback in `getOrCreateStripeCustomer()` for stripe_customer_id save
    - TypeScript compiles without errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix webhook handler to upsert instead of update</name>
  <files>src/lib/stripe/sync-subscription.ts</files>
  <action>
**In `handleCheckoutCompleted()` for subscription mode (lines 72-82):**
Replace the `.update().eq('user_id', userId)` with `.upsert()`:
```typescript
await admin
  .from('subscriptions')
  .upsert({
    user_id: userId,
    stripe_customer_id: session.customer as string,
    stripe_subscription_id: session.subscription as string,
    tier,
    status: 'active',
    current_period_start: periodStart,
    current_period_end: periodEnd,
  }, { onConflict: 'user_id' })
```
This ensures that if the webhook fires before `ensureSubscription()` created the row (e.g., user paid but row was never created), the subscription is still properly recorded.

**In `handleSubscriptionUpdated()` (line 122):**
Replace `.single()` with `.maybeSingle()`. If no row found, return early (already does via `if (!sub) return`).

**In `handleSubscriptionDeleted()` (line 153):**
Replace `.single()` with `.maybeSingle()`. If no row found, return early (already does via `if (!sub) return`).

**In `handleInvoicePaid()` (line 178):**
Replace `.single()` with `.maybeSingle()`. If no row found, return early (already does via `if (!sub) return`).
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && npx tsc --noEmit --pretty 2>&1 | head -30</automated>
  </verify>
  <done>
    - `handleCheckoutCompleted` uses `.upsert()` so webhook works even without existing subscription row
    - All `.single()` calls in webhook handlers replaced with `.maybeSingle()`
    - TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. `npm run build` completes successfully
3. Manual: Visit /settings/subscription as a user with no subscription row -- page loads without error
4. Manual: Click "Buy Credits" -- redirects to Stripe checkout without error
</verification>

<success_criteria>
- Subscription page loads for all users, including those with no subscription row
- Buy Credits and Upgrade buttons work without server-side exceptions
- Stripe webhook checkout.session.completed creates subscription if none exists
- No `.single()` calls remain in subscription-related queries (all replaced with `.maybeSingle()`)
</success_criteria>

<output>
After completion, create `.planning/quick/260326-kzh-fix-stripe-integration-crashes-on-subscr/260326-kzh-SUMMARY.md`
</output>
