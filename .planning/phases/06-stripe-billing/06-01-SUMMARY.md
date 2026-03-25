---
phase: 06-stripe-billing
plan: 01
subsystem: payments
tags: [stripe, webhooks, subscriptions, credits, next-api-routes]

requires:
  - phase: 05-credit-ledger-usage-limits
    provides: "credit_transactions table, subscriptions table, stripe_events table, admin client, credit types"
provides:
  - "Stripe server SDK singleton (getStripeServer)"
  - "Price ID config mapping (STRIPE_PRICES, tierFromPriceId, CREDIT_PACK_AMOUNTS)"
  - "Webhook route handler at /api/webhooks/stripe with signature verification and idempotency"
  - "Event-dispatched subscription sync handling 5 Stripe event types"
affects: [06-stripe-billing-plan-02, billing-portal, checkout-flow]

tech-stack:
  added: [stripe@20.4.1, "@stripe/stripe-js"]
  patterns: [singleton-stripe-client, webhook-idempotency-via-stripe_events-table, event-type-dispatch]

key-files:
  created:
    - src/lib/stripe/client.ts
    - src/lib/stripe/config.ts
    - src/lib/stripe/sync-subscription.ts
    - src/app/api/webhooks/stripe/route.ts
    - src/__tests__/stripe/webhook.test.ts
    - src/__tests__/stripe/sync-subscription.test.ts
  modified:
    - .env.local.example
    - src/middleware.ts
    - package.json

key-decisions:
  - "Stripe API version pinned to 2026-02-25.clover (matches installed stripe@20.4.1)"
  - "Invoice subscription ID extracted via parent.subscription_details (Stripe v20+ API change)"
  - "Subscription period tracking uses start_date + cancel_at (current_period_start/end removed in Stripe v20)"
  - "Webhook returns 200 even on handler errors to prevent Stripe retry loops on app bugs"

patterns-established:
  - "Stripe client: singleton via module-level variable with getStripeServer()"
  - "Webhook idempotency: insert event_id into stripe_events before processing, skip duplicates"
  - "Event dispatch: switch on event.type in handleStripeEvent for clean separation of handlers"

requirements-completed: [STRIPE-02, CRED-04]

duration: 6min
completed: 2026-03-25
---

# Phase 6 Plan 1: Stripe Webhook and Subscription Sync Summary

**Stripe webhook handler with signature verification, event idempotency, and 5 event-type handlers syncing subscriptions and credit grants via admin client**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-25T22:19:24Z
- **Completed:** 2026-03-25T22:25:39Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Stripe SDK initialized with singleton pattern and pinned API version
- Webhook route at /api/webhooks/stripe with signature verification and stripe_events idempotency
- Subscription sync handlers for checkout.session.completed (subscription + payment), subscription.updated, subscription.deleted, invoice.paid, invoice.payment_failed
- 11 unit tests covering webhook route and all event type handlers

## Task Commits

Each task was committed atomically:

1. **Task 1: Stripe lib modules and webhook Route Handler** - `1188e1a` (feat)
2. **Task 2: Unit tests for webhook handler and sync-subscription** - `2d904fa` (test)

## Files Created/Modified
- `src/lib/stripe/client.ts` - Singleton Stripe server SDK instance
- `src/lib/stripe/config.ts` - Price ID mapping, tier resolution, credit pack amounts
- `src/lib/stripe/sync-subscription.ts` - Event-type-dispatched webhook handlers
- `src/app/api/webhooks/stripe/route.ts` - POST Route Handler for Stripe webhooks
- `src/__tests__/stripe/webhook.test.ts` - Webhook route tests (signature, idempotency, processing)
- `src/__tests__/stripe/sync-subscription.test.ts` - Handler tests for all 5 event types
- `.env.local.example` - Added Stripe env vars (6 new variables)
- `src/middleware.ts` - Added /api/webhooks exclusion from auth middleware
- `src/lib/supabase/admin.ts` - Phase 5 dependency (admin client)
- `src/lib/credits/types.ts` - Phase 5 dependency (credit types)
- `package.json` - Added stripe and @stripe/stripe-js dependencies

## Decisions Made
- Stripe API version pinned to 2026-02-25.clover matching installed stripe@20.4.1 (plan specified older version)
- Invoice subscription ID extracted via `parent.subscription_details.subscription` (Stripe v20+ API change from direct `invoice.subscription`)
- Subscription period tracking uses `start_date` + `cancel_at` since `current_period_start/end` were removed in Stripe v20
- Webhook returns 200 even on handler errors to prevent Stripe retry loops

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Stripe API version mismatch**
- **Found during:** Task 1 (Stripe lib modules)
- **Issue:** Plan specified API version '2025-12-18.acacia' but installed stripe@20.4.1 requires '2026-02-25.clover'
- **Fix:** Updated API version to match installed package
- **Files modified:** src/lib/stripe/client.ts
- **Verification:** npx tsc --noEmit passes
- **Committed in:** 1188e1a

**2. [Rule 1 - Bug] Adapted to Stripe v20 API changes for subscription period and invoice fields**
- **Found during:** Task 1 (sync-subscription handlers)
- **Issue:** `Subscription.current_period_start/end` removed in Stripe v20; `Invoice.subscription` moved to `Invoice.parent.subscription_details.subscription`
- **Fix:** Used `start_date`/`cancel_at` for period tracking; created `getInvoiceSubscriptionId()` helper for v20 invoice parent structure
- **Files modified:** src/lib/stripe/sync-subscription.ts
- **Verification:** npx tsc --noEmit passes, all tests pass
- **Committed in:** 1188e1a

**3. [Rule 2 - Missing Critical] Added webhook exclusion to middleware**
- **Found during:** Task 1 (webhook route)
- **Issue:** Middleware did not exclude /api/webhooks from auth -- Stripe webhook calls would be redirected to login
- **Fix:** Added pathname check for /api/webhooks at top of middleware function
- **Files modified:** src/middleware.ts
- **Verification:** Webhook route accessible without auth
- **Committed in:** 1188e1a

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical)
**Impact on plan:** All auto-fixes necessary for correctness with current Stripe SDK version. No scope creep.

## Issues Encountered
- Vitest vi.mock hoisting caused mock reference errors in webhook.test.ts -- resolved by using module-level const mock objects that both test and route share via closure

## User Setup Required

External services require manual configuration:
- **STRIPE_SECRET_KEY** - Stripe Dashboard > Developers > API keys > Secret key
- **STRIPE_WEBHOOK_SECRET** - Stripe Dashboard > Developers > Webhooks > Signing secret
- **NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY** - Stripe Dashboard > Developers > API keys > Publishable key
- **STRIPE_PRICE_PLUS_MONTHLY** - Stripe Dashboard > Products > Plus Monthly > Price ID
- **STRIPE_PRICE_PRO_MONTHLY** - Stripe Dashboard > Products > Pro Monthly > Price ID
- **STRIPE_PRICE_CREDIT_PACK_10** - Stripe Dashboard > Products > Credit Pack 10 > Price ID

## Next Phase Readiness
- Webhook backend ready for Plan 02 (checkout flow and customer portal)
- All event handlers tested and passing
- Stripe SDK and config modules ready for import by checkout/portal routes

---
*Phase: 06-stripe-billing*
*Completed: 2026-03-25*

## Self-Check: PASSED

All 6 created files verified on disk. Both task commits (1188e1a, 2d904fa) verified in git log.
