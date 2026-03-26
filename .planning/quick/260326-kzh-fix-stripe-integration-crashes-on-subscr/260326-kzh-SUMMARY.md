---
phase: quick
plan: 260326-kzh
subsystem: payments
tags: [stripe, supabase, subscriptions, error-handling]

requires:
  - phase: none
    provides: existing Stripe integration with subscription CRUD
provides:
  - "Crash-free subscription page for users without subscription rows"
  - "Webhook handlers that create subscription rows via upsert"
affects: [settings, stripe-webhooks, credits]

tech-stack:
  added: []
  patterns: [maybeSingle for optional row lookups, upsert for idempotent row creation, ensureSubscription guard pattern]

key-files:
  created: []
  modified:
    - src/app/(dashboard)/settings/subscription/page.tsx
    - src/app/(dashboard)/settings/subscription/actions.ts
    - src/lib/credits/check-credits.ts
    - src/lib/stripe/sync-subscription.ts

key-decisions:
  - "Used .maybeSingle() universally instead of .single() for all subscription lookups"
  - "Used .upsert() with onConflict user_id as belt-and-suspenders alongside ensureSubscription"

patterns-established:
  - "ensureSubscription guard: call before any subscription-dependent DB queries in user-facing pages/actions"
  - "maybeSingle for optional rows: never use .single() for lookups that may return zero rows"

requirements-completed: []

duration: 2min
completed: 2026-03-26
---

# Quick Task 260326-kzh: Fix Stripe Integration Crashes Summary

**Replaced .single() with .maybeSingle() and added ensureSubscription guards to prevent crashes for users without subscription rows**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-26T22:11:27Z
- **Completed:** 2026-03-26T22:13:07Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Subscription page no longer crashes for users with no subscription row
- Buy Credits and Upgrade buttons work for first-time users
- Stripe webhook checkout.session.completed creates subscription via upsert even if no row exists
- All webhook handlers gracefully handle missing subscription rows

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix subscription page and actions to handle missing subscription rows** - `607d1ce` (fix)
2. **Task 2: Fix webhook handler to upsert instead of update** - `80bd33e` (fix)

## Files Created/Modified
- `src/app/(dashboard)/settings/subscription/page.tsx` - Added ensureSubscription call, .single() to .maybeSingle()
- `src/app/(dashboard)/settings/subscription/actions.ts` - Added ensureSubscription import/call, .single() to .maybeSingle(), .update() to .upsert()
- `src/lib/credits/check-credits.ts` - getUserTier .single() to .maybeSingle()
- `src/lib/stripe/sync-subscription.ts` - handleCheckoutCompleted .update() to .upsert(), all handlers .single() to .maybeSingle()

## Decisions Made
- Used .maybeSingle() universally for all subscription lookups -- .single() throws when zero rows match, which is expected for new users
- Used .upsert() with onConflict: 'user_id' as belt-and-suspenders alongside ensureSubscription to handle race conditions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Known Stubs
None.

## User Setup Required
None - no external service configuration required.

---
*Quick task: 260326-kzh*
*Completed: 2026-03-26*
