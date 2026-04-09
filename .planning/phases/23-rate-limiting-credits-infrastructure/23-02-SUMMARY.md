---
phase: 23-rate-limiting-credits-infrastructure
plan: 02
subsystem: credits-services
tags: [credits, services, admin-client, project-crud]
dependency_graph:
  requires: [23-01]
  provides: [deductCreditAdmin, getCreditBalanceAdmin, listProjects, getProject, createProjectService, deleteProjectService, updateProjectService, generateCarousel]
  affects: [dashboard-actions, api-routes-phase-24-25]
tech_stack:
  added: []
  patterns: [service-layer-extraction, admin-client-injection, ownership-filtering]
key_files:
  created:
    - src/lib/services/projects.ts
    - src/lib/services/carousel.ts
    - src/__tests__/services/projects.test.ts
  modified:
    - src/lib/credits/check-credits.ts
    - src/__tests__/credits/check-credits.test.ts
    - src/app/(dashboard)/dashboard/actions.ts
decisions:
  - Admin credit functions accept SupabaseClient param rather than creating their own client
  - Service functions enforce userId ownership filtering for defense-in-depth with admin client
  - Added auth check to server actions during refactor (was missing -- Rule 2 auto-fix)
  - Carousel service is a stub throwing NotImplemented for Phase 25
metrics:
  duration: 173s
  completed: "2026-04-09T00:38:19Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 3
  tests_added: 11
  tests_total: 39
---

# Phase 23 Plan 02: Admin Credit Functions & Service Extraction Summary

Admin-client credit deduction/balance functions and project CRUD service layer with userId ownership filtering for API route consumption.

## What Was Done

### Task 1: Admin-client credit functions (TDD)

Added `deductCreditAdmin` and `getCreditBalanceAdmin` to `src/lib/credits/check-credits.ts`. Both accept a `SupabaseClient` parameter so API route handlers can pass the admin client (bypassing session cookie requirement). Existing session-based `getCreditBalance` and `deductCredit` remain unchanged.

Key behaviors:
- `deductCreditAdmin` uses atomic `deduct_credits` Postgres RPC (T-23-06 mitigation)
- Returns `true` without RPC call when amount <= 0 (free operations)
- `getCreditBalanceAdmin` returns 0 when RPC returns null
- 5 new tests added, all passing

### Task 2: Project CRUD service extraction

Created `src/lib/services/projects.ts` with five functions: `listProjects`, `getProject`, `createProjectService`, `deleteProjectService`, `updateProjectService`. Every function accepts `(supabase: SupabaseClient, userId: string, ...)` and every query includes `.eq('user_id', userId)` for ownership enforcement even when RLS is bypassed via admin client (T-23-05, T-23-07 mitigations).

Created `src/lib/services/carousel.ts` as a stub for Phase 25 extraction.

Refactored `src/app/(dashboard)/dashboard/actions.ts` to delegate to service functions. Same external interface, internal implementation now reusable.

6 new service tests added, all passing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Auth] Added authentication check to server actions**
- **Found during:** Task 2
- **Issue:** Original server actions did not verify user authentication before DB operations (relied solely on RLS)
- **Fix:** Added `supabase.auth.getUser()` check with throw on unauthenticated in all three server actions
- **Files modified:** `src/app/(dashboard)/dashboard/actions.ts`
- **Commit:** 5d8e59d

## Known Stubs

| File | Line | Reason |
|------|------|--------|
| src/lib/services/carousel.ts | 11 | Intentional stub -- implementation will be extracted from project server action in Phase 25 |

## Threat Mitigations Applied

| Threat ID | Status | Implementation |
|-----------|--------|----------------|
| T-23-05 | Mitigated | Every service function includes `.eq('user_id', userId)` |
| T-23-06 | Mitigated | `deductCreditAdmin` uses atomic `deduct_credits` Postgres RPC |
| T-23-07 | Mitigated | `getProject` filters by both `id` and `user_id` |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 3625720 | feat(23-02): add admin-client credit functions for API routes |
| 2 | 5d8e59d | feat(23-02): extract project CRUD services and carousel stub |

## Self-Check: PASSED

All 6 files verified present. Both commit hashes verified in git log.
