---
phase: 06-stripe-billing
plan: 02
subsystem: billing-ui
tags: [stripe, checkout, portal, credit-packs, upgrade-prompts, server-actions]

requires:
  - phase: 06-stripe-billing
    plan: 01
    provides: "Stripe SDK singleton, price config, webhook handler"
  - phase: 05-credit-ledger-usage-limits
    provides: "credit balance, user tier, project limit checks"
provides:
  - "Server actions for Stripe Checkout (subscription + payment mode)"
  - "Server action for Stripe Customer Portal"
  - "Contextual UpgradePrompt component for free users at limits"
  - "Subscription page with real checkout buttons and credit pack purchase"
affects: [subscription-page, dashboard, generation-form]

tech-stack:
  added: []
  patterns: [server-actions-with-redirect, inline-plan-cards, contextual-upgrade-prompts]

key-files:
  created:
    - src/app/(dashboard)/settings/subscription/actions.ts
    - src/components/subscription/upgrade-prompt.tsx
    - src/__tests__/stripe/checkout.test.ts
  modified:
    - src/app/(dashboard)/settings/subscription/page.tsx
    - src/app/(dashboard)/settings/subscription/manage-subscription-button.tsx
    - src/app/(dashboard)/dashboard/page.tsx
    - src/app/(dashboard)/project/[id]/actions.ts
    - src/components/slides/generation-form.tsx

key-decisions:
  - "Inline plan cards on subscription page instead of shared Pricing component (decoupled from landing page)"
  - "redirect() throws NEXT_REDIRECT in Next.js server actions -- tests catch this as expected throw"
  - "getOrCreateStripeCustomer helper extracted to share between checkout and credit pack flows"
  - "UpgradePrompt is client component using router.push for navigation to subscription page"

requirements-completed: [STRIPE-01, STRIPE-03, STRIPE-05, CRED-04]

duration: 5min
completed: 2026-03-25
---

# Phase 6 Plan 2: Stripe Checkout, Portal, and Upgrade Prompts Summary

**Server actions for Stripe Checkout (subscription and payment mode), Customer Portal, credit pack purchases, and contextual upgrade prompts for free users hitting usage limits**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-25T22:29:52Z
- **Completed:** 2026-03-25T22:34:26Z
- **Tasks:** 3/4 (Task 4 is human-verify checkpoint)
- **Files modified:** 8

## Accomplishments
- Server actions for createCheckoutSession (subscription mode), createPortalSession (billing portal), createCreditPackCheckout (payment mode)
- Subscription page rewritten with inline plan cards, dynamic upgrade buttons based on current tier, success/cancel/credits banners
- Buy Credits section with current balance display
- ManageSubscriptionButton now triggers real Stripe Customer Portal via form action
- UpgradePrompt component with 3 contexts: generation, project_limit, feature_gate
- Dashboard shows upgrade prompts for free users at credit/project limits
- generateCarousel returns upgradeEligible flag on credit check failure
- Generation form shows upgrade prompt when upgradeEligible is true
- 6 unit tests for all 3 server actions (auth, customer creation, redirect)

## Task Commits

Each task was committed atomically:

1. **Task 1: Server actions and subscription page wiring** - `a87fb93` (feat)
2. **Task 2: Upgrade prompt component and usage limit wiring** - `e8e7ee6` (feat)
3. **Task 3: Unit tests for checkout and portal server actions** - `9eb26ba` (test)

## Files Created/Modified
- `src/app/(dashboard)/settings/subscription/actions.ts` - Server actions for Stripe flows
- `src/app/(dashboard)/settings/subscription/page.tsx` - Rewritten with inline plan cards and checkout buttons
- `src/app/(dashboard)/settings/subscription/manage-subscription-button.tsx` - Form action for portal redirect
- `src/components/subscription/upgrade-prompt.tsx` - Contextual upgrade banner component
- `src/app/(dashboard)/dashboard/page.tsx` - Added upgrade prompts for free users
- `src/app/(dashboard)/project/[id]/actions.ts` - Added upgradeEligible to error responses
- `src/components/slides/generation-form.tsx` - Shows upgrade prompt on credit exhaustion
- `src/__tests__/stripe/checkout.test.ts` - 6 tests for server actions

## Decisions Made
- Inline plan cards on subscription page (not shared Pricing component) to keep landing page decoupled
- redirect() throws NEXT_REDIRECT in Next.js -- tests capture this as expected behavior
- Extracted getOrCreateStripeCustomer helper shared by checkout and credit pack flows
- UpgradePrompt uses client-side router.push for navigation

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all data sources are wired to real Stripe API calls and Supabase queries.

---
*Phase: 06-stripe-billing*
*Completed: 2026-03-25 (Tasks 1-3; Task 4 pending human verification)*

## Self-Check: PASSED

All 8 files verified on disk. All 3 task commits (a87fb93, e8e7ee6, 9eb26ba) verified in git log. All 17 stripe tests passing.
