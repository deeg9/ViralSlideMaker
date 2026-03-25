---
phase: 05-credit-ledger-usage-limits
plan: 01
subsystem: database
tags: [postgres, supabase, rpc, ledger, credits, subscriptions, rls]

requires:
  - phase: 01-foundation-and-auth
    provides: auth.users table, Supabase server client, middleware
  - phase: 02-ai-generation-and-image-rendering
    provides: projects table, generation actions
provides:
  - subscriptions table with tier tracking and Stripe fields
  - credit_transactions ledger table with atomic deduction RPC
  - stripe_events idempotency table (for Phase 6)
  - get_credit_balance and deduct_credits Postgres RPCs
  - Service role admin client for server-side operations
  - Credit types module (SubscriptionTier, CreditStatus, TIER_CREDITS)
  - ensureSubscription lazy bootstrapping for new users
  - Rewritten check-credits module using ledger-based balance
affects: [06-stripe-payments, 07-imagen-generation, dashboard, project-actions]

tech-stack:
  added: [supabase-service-role-client]
  patterns: [ledger-based-credits, atomic-rpc-deduction, for-update-row-lock, lazy-subscription-bootstrap]

key-files:
  created:
    - supabase/migrations/005_credit_system.sql
    - src/lib/supabase/admin.ts
    - src/lib/credits/types.ts
    - src/lib/credits/ensure-subscription.ts
  modified:
    - src/lib/credits/check-credits.ts
    - src/middleware.ts
    - .env.local.example
    - src/app/(dashboard)/dashboard/page.tsx
    - src/app/(dashboard)/project/[id]/actions.ts
    - src/__tests__/credits/check-credits.test.ts

key-decisions:
  - "Credit balance is SUM(amount) from ledger, not project count -- supports multiple credit types"
  - "deduct_credits RPC uses FOR UPDATE row lock for atomic deduction"
  - "Free tier gets 5 credits/month, plus 12, pro 30 via subscription_grant transactions"
  - "Subscription tier stored in subscriptions table, not user_metadata"
  - "stripe_events table created now for Phase 6 idempotency"

patterns-established:
  - "Ledger pattern: all credit changes are rows in credit_transactions with positive/negative amounts"
  - "Admin client: createAdminClient() for service-role operations bypassing RLS"
  - "Lazy bootstrap: ensureSubscription() creates subscription + grant on first access"

requirements-completed: [CRED-01, CRED-03, STRIPE-04]

duration: 4min
completed: 2026-03-25
---

# Phase 5 Plan 1: Credit Ledger Database and Service Layer Summary

**Postgres ledger-based credit system with atomic RPC deductions, subscription tiers, and rewritten service layer replacing project-counting approach**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T16:27:10Z
- **Completed:** 2026-03-25T16:31:12Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Credit ledger schema with subscriptions, credit_transactions, and stripe_events tables with RLS
- Atomic deduct_credits RPC function using FOR UPDATE row lock
- Complete rewrite of check-credits module from project-counting to ledger-based approach
- 14 unit tests all passing with RPC-based mocks

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration + admin client + credit types** - `85febb8` (feat)
2. **Task 2 RED: Failing tests for ledger-based credit system** - `7e1d77d` (test)
3. **Task 2 GREEN: Rewrite credit service to ledger-based RPC system** - `45bf6a1` (feat)
4. **Deviation fix: Update callers for new credit API shape** - `ae6b6cc` (fix)

## Files Created/Modified
- `supabase/migrations/005_credit_system.sql` - 3 tables, 2 RPCs, indexes, RLS policies
- `src/lib/supabase/admin.ts` - Service role Supabase client
- `src/lib/credits/types.ts` - SubscriptionTier, CreditStatus, TIER_CREDITS, FREE_PROJECT_LIMIT
- `src/lib/credits/check-credits.ts` - Rewritten: getUserTier, getCreditBalance, deductCredit, checkCredits, checkProjectLimit
- `src/lib/credits/ensure-subscription.ts` - Lazy subscription + credit grant bootstrapping
- `src/middleware.ts` - Webhook route exclusion for Phase 6
- `.env.local.example` - Added SUPABASE_SERVICE_ROLE_KEY
- `src/app/(dashboard)/dashboard/page.tsx` - Updated for new CreditStatus shape
- `src/app/(dashboard)/project/[id]/actions.ts` - Updated error message for new API
- `src/__tests__/credits/check-credits.test.ts` - 14 tests with RPC mocks

## Decisions Made
- Credit balance is SUM(amount) from ledger -- supports multiple credit types (carousel, imagen, packs)
- deduct_credits RPC uses FOR UPDATE row lock for atomic check-and-deduct
- Free: 5/month, Plus: 12/month, Pro: 30/month via subscription_grant transactions
- Tier stored in subscriptions table (not user_metadata) for Stripe webhook updates
- stripe_events table created now to avoid migration in Phase 6

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated callers for changed CreditStatus API shape**
- **Found during:** Post-task verification
- **Issue:** Dashboard and project actions referenced removed properties (credits.limit, credits.remaining, credits.used) from old checkCredits return type
- **Fix:** Updated dashboard to use balance/tier, updated actions error message
- **Files modified:** src/app/(dashboard)/dashboard/page.tsx, src/app/(dashboard)/project/[id]/actions.ts
- **Verification:** No TypeScript errors, code references valid properties
- **Committed in:** ae6b6cc

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix -- callers would have runtime errors without it. No scope creep.

## Issues Encountered
None.

## User Setup Required
- Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (get from Supabase Dashboard > Settings > API > service_role key)
- Run migration `005_credit_system.sql` against Supabase database

## Next Phase Readiness
- Credit ledger foundation complete for Phase 6 (Stripe payments) and Phase 7 (Imagen)
- stripe_events table ready for webhook idempotency
- ensureSubscription ready to bootstrap users on first credit check

---
*Phase: 05-credit-ledger-usage-limits*
*Completed: 2026-03-25*
