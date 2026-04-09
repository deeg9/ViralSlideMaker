---
phase: 23-rate-limiting-credits-infrastructure
verified: 2026-04-09T00:42:50Z
status: gaps_found
score: 3/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Credit-consuming API endpoints can deduct via admin client without session cookies"
    status: failed
    reason: "deductCreditAdmin and getCreditBalanceAdmin were committed to git HEAD (commit 3625720) but the working directory file src/lib/credits/check-credits.ts has been modified to remove them. The on-disk file is 66 lines and does not export these functions. git diff HEAD confirms the removal."
    artifacts:
      - path: "src/lib/credits/check-credits.ts"
        issue: "Working directory file missing deductCreditAdmin and getCreditBalanceAdmin exports — 35 lines stripped from committed HEAD. File is an uncommitted modification (git status shows modified)."
    missing:
      - "Restore src/lib/credits/check-credits.ts to match HEAD (git checkout HEAD -- src/lib/credits/check-credits.ts)"
  - truth: "API requests exceeding the per-key sliding window limit receive a 429 response with Retry-After header"
    status: failed
    reason: "@upstash/ratelimit and @upstash/redis are declared in package.json and package-lock.json but are not installed in node_modules. The @upstash directory is empty (0 bytes). Rate-limit tests fail with 'Failed to resolve import @upstash/ratelimit'. The implementation code is correct but the dependency is uninstalled."
    artifacts:
      - path: "src/lib/api/rate-limit.ts"
        issue: "Implementation is correct but depends on @upstash/ratelimit which is not installed in node_modules/@upstash/ (directory exists but is empty)"
    missing:
      - "Run npm install to install @upstash/ratelimit and @upstash/redis packages"
---

# Phase 23: Rate Limiting, Credits & Infrastructure Verification Report

**Phase Goal:** API requests are rate limited per key, credit-consuming operations enforce balances, and all responses follow a consistent structured format
**Verified:** 2026-04-09T00:42:50Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | API requests exceeding the per-key sliding window limit receive a 429 response with Retry-After header | FAIL | Implementation correct in with-api-auth.ts (lines 45-52), but @upstash/ratelimit not installed — rate-limit tests fail with import resolution error |
| 2 | All API responses include X-RateLimit-Limit and X-RateLimit-Remaining headers | VERIFIED | with-api-auth.ts lines 73-74 set these headers on every successful response; 12/12 with-api-auth tests pass including "successful response includes X-RateLimit-Limit and X-RateLimit-Remaining headers" |
| 3 | Credit-consuming endpoints deduct via the existing atomic RPC; insufficient credits return 402 with x-credits-remaining header | FAIL | deductCreditAdmin and getCreditBalanceAdmin missing from disk (working directory modified after commit). 5/5 admin credit tests fail with "TypeError: getCreditBalanceAdmin is not a function" |
| 4 | All API responses include x-credits-remaining and x-credits-used headers | VERIFIED | with-api-auth.ts lines 77-79 compute and set x-credits-remaining post-deduction; apiSuccess sets x-credits-used; both verified by passing tests |
| 5 | Error responses use structured JSON with codes matching the OpenAPI spec, and CORS headers are present for cross-origin consumers | VERIFIED | errors.ts exports 7-code ApiErrorCode union type; cors.ts returns wildcard origin with exposed headers; 8/8 errors+cors tests pass |

**Score:** 3/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/api/rate-limit.ts` | Upstash sliding window rate limiter | ORPHANED | File exists and is correct (slidingWindow, lazy init, checkRateLimit export) but @upstash packages uninstalled — unusable at runtime |
| `src/lib/api/errors.ts` | Structured error response factory | VERIFIED | Exports apiError and ApiErrorCode (7 codes). 4/4 tests pass. |
| `src/lib/api/cors.ts` | CORS header utility | VERIFIED | Exports corsHeaders with wildcard origin and all 5 exposed headers. 4/4 tests pass. |
| `src/lib/api/response.ts` | Success response helper with credit headers | VERIFIED | Exports apiSuccess with optional creditsUsed header. Wired into with-api-auth.ts. |
| `src/lib/api/with-api-auth.ts` | Enhanced HOC with rate limiting, CORS, error handling | VERIFIED | All 7 plan patterns present and working (OPTIONS, checkRateLimit, corsHeaders, apiError, X-RateLimit-*, x-credits-remaining, creditBalance). 12/12 tests pass. |
| `src/lib/credits/check-credits.ts` | Admin-client credit functions | STUB | File exists but is missing deductCreditAdmin and getCreditBalanceAdmin. Working directory reverted vs HEAD commit 3625720. |
| `src/lib/services/projects.ts` | Extracted project CRUD service functions | VERIFIED | All 5 functions present (listProjects, getProject, createProjectService, deleteProjectService, updateProjectService) with userId ownership filtering. 6/6 tests pass. |
| `src/lib/services/carousel.ts` | Extracted carousel generation service | VERIFIED (stub) | Intentional stub throwing NotImplemented, as designed for Phase 25. |
| `src/app/(dashboard)/dashboard/actions.ts` | Server actions delegating to services | VERIFIED | Imports from @/lib/services/projects, delegates to createProjectService/deleteProjectService/updateProjectService. Auth check present. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/lib/api/with-api-auth.ts` | `src/lib/api/rate-limit.ts` | checkRateLimit(keyId) | WIRED | Import on line 3, called on line 44 |
| `src/lib/api/with-api-auth.ts` | `src/lib/api/cors.ts` | corsHeaders() | WIRED | Import on line 5, called lines 35, 69 |
| `src/lib/api/with-api-auth.ts` | `src/lib/api/errors.ts` | apiError() | WIRED | Import on line 4, called lines 47, 89, 91 |
| `src/lib/credits/check-credits.ts` | `supabase.rpc('deduct_credits')` | deductCreditAdmin | NOT_WIRED | Functions are missing from disk file |
| `src/lib/services/projects.ts` | `supabase.from('projects')` | All functions accept SupabaseClient + userId | WIRED | All 5 functions query projects table with user_id filter |
| `src/app/(dashboard)/dashboard/actions.ts` | `src/lib/services/projects.ts` | Server actions delegate to service functions | WIRED | Import present line 5-9, delegation on lines 19, 31, 44 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `with-api-auth.ts` | creditBalance | supabase.rpc('get_credit_balance') | Yes — real DB RPC | FLOWING |
| `with-api-auth.ts` | rl (rate limit) | checkRateLimit(keyId) → @upstash/ratelimit | No — packages not installed | DISCONNECTED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CORS headers present on all responses | `npx vitest run src/__tests__/api/cors.test.ts` | 4/4 pass | PASS |
| Error responses use structured JSON | `npx vitest run src/__tests__/api/errors.test.ts` | 4/4 pass | PASS |
| withApiAuth HOC: OPTIONS, rate limit, credit headers | `npx vitest run src/__tests__/api/with-api-auth.test.ts` | 12/12 pass | PASS |
| Rate limit module imports resolve | `npx vitest run src/__tests__/api/rate-limit.test.ts` | 3 FAIL (import error) | FAIL |
| Admin credit functions callable | `npx vitest run src/__tests__/credits/check-credits.test.ts` | 5 FAIL (not a function) | FAIL |
| Project service CRUD functions | `npx vitest run src/__tests__/services/projects.test.ts` | 6/6 pass | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RATE-01 | 23-01 | API requests rate limited per key using Upstash Redis sliding window | BLOCKED | rate-limit.ts implementation correct; @upstash packages not installed in node_modules |
| RATE-02 | 23-01 | Rate limit headers in all responses | SATISFIED | with-api-auth.ts sets X-RateLimit-Limit and X-RateLimit-Remaining on all successful responses |
| RATE-03 | 23-01 | Rate-limited requests return 429 with Retry-After header | BLOCKED | Implementation correct (with-api-auth.ts lines 47-51) but depends on working rate-limit module |
| CRED-01 | 23-02 | Credit-consuming endpoints deduct via existing atomic RPC | BLOCKED | deductCreditAdmin missing from disk; function present in git HEAD but not on filesystem |
| CRED-02 | 23-02 | Insufficient credits return 402 with x-credits-remaining header | BLOCKED | withApiAuth has credit balance logic but deductCreditAdmin not available for endpoint use |
| CRED-03 | 23-02 | All responses include x-credits-remaining and x-credits-used headers | SATISFIED | with-api-auth.ts lines 77-79 compute and set these headers on all responses |
| INFRA-01 | 23-01 | Structured JSON error responses with codes matching OpenAPI spec | SATISFIED | errors.ts exports 7-code ApiErrorCode + apiError factory; verified by tests |
| INFRA-02 | 23-01 | CORS headers for cross-origin browser-based API consumers | SATISFIED | cors.ts returns correct headers; integrated into all error and success responses |
| INFRA-03 | 23-02 | Service extraction — shared logic between server actions and route handlers | SATISFIED | projects.ts and carousel.ts created; dashboard actions delegate to services |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/credits/check-credits.ts` | Working dir | Functions removed from committed code — working directory reverted | BLOCKER | Admin credit deduction unavailable; 5 tests fail; CRED-01, CRED-02 blocked |
| `node_modules/@upstash/` | — | Empty directory — packages declared but not installed | BLOCKER | Rate limiting non-functional at runtime; RATE-01, RATE-03 blocked |
| `src/lib/services/carousel.ts` | 11 | `throw new Error('Not implemented')` | INFO | Intentional stub for Phase 25 — documented in plan and summary |

### Human Verification Required

None — all verification completed programmatically.

### Gaps Summary

Two gaps block goal achievement for Phase 23:

**Gap 1: @upstash packages not installed in node_modules**
The `@upstash/ratelimit` and `@upstash/redis` packages are correctly declared in `package.json` (added in commit 245fed7) and registered in `package-lock.json`, but `node_modules/@upstash/` is empty (0 bytes). Running the rate-limit tests produces `Failed to resolve import "@upstash/ratelimit"`. The rate limiting implementation in `rate-limit.ts` and `with-api-auth.ts` is correct and well-tested (using mocks), but the actual runtime dependency is absent. **Fix: run `npm install` in the project root.**

**Gap 2: check-credits.ts working directory corrupted — admin functions missing**
Commit `3625720` correctly added `deductCreditAdmin` and `getCreditBalanceAdmin` to `src/lib/credits/check-credits.ts`. However, `git status` shows this file as modified, and `git diff HEAD` confirms 35 lines have been removed from the working copy including both admin functions. The on-disk file is 66 lines; the HEAD commit has 96 lines. The test file correctly imports these functions, causing 5 test failures (`TypeError: getCreditBalanceAdmin is not a function`). **Fix: restore the file with `git checkout HEAD -- src/lib/credits/check-credits.ts`.**

Both gaps are likely artifacts of working-directory management (worktree merge + `npm install` not run after checkout). The committed code is correct; the working directory state is inconsistent.

---

_Verified: 2026-04-09T00:42:50Z_
_Verifier: Claude (gsd-verifier)_
