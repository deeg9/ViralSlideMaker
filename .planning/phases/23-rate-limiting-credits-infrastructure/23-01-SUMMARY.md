---
phase: 23-rate-limiting-credits-infrastructure
plan: 01
subsystem: api-infrastructure
tags: [rate-limiting, cors, error-handling, upstash, api]
dependency_graph:
  requires: [22-01]
  provides: [checkRateLimit, apiError, ApiErrorCode, corsHeaders, apiSuccess, withApiAuth-enhanced]
  affects: [all-api-v1-routes]
tech_stack:
  added: ["@upstash/ratelimit", "@upstash/redis"]
  patterns: [sliding-window-rate-limit, lazy-initialization, hoc-middleware-chain]
key_files:
  created:
    - src/lib/api/rate-limit.ts
    - src/lib/api/errors.ts
    - src/lib/api/cors.ts
    - src/lib/api/response.ts
    - src/__tests__/api/rate-limit.test.ts
    - src/__tests__/api/errors.test.ts
    - src/__tests__/api/cors.test.ts
    - src/__tests__/api/with-api-auth.test.ts
  modified:
    - src/lib/api/with-api-auth.ts
    - src/lib/api/auth.ts
    - package.json
    - package-lock.json
decisions:
  - "Upstash sliding window (60 req/min) with 'vsl:rl' prefix for distributed rate limiting"
  - "Wildcard CORS origin (*) is intentional for public Bearer-token API (no cookies)"
  - "Lazy Ratelimit initialization avoids build-time env var errors in serverless"
  - "Auth vs handler errors differentiated by error message content in catch block"
metrics:
  duration: "5m 28s"
  completed: "2026-04-09T00:32:38Z"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 23
  tests_passing: 23
---

# Phase 23 Plan 01: Rate Limiting, Errors, CORS, and Response Infrastructure Summary

Upstash sliding-window rate limiter at 60 req/min per API key, structured error responses matching all 7 OpenAPI error codes, wildcard CORS with exposed custom headers, and enhanced withApiAuth HOC chaining auth -> rate-limit -> credit-balance -> handler -> response-headers.

## What Was Built

### Rate Limiting (rate-limit.ts)
- Upstash `@upstash/ratelimit` with sliding window strategy (60 requests per 1 minute)
- Lazy initialization pattern: `Ratelimit` instance created on first call, not at import time
- Prevents build-time crashes when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are absent
- Redis key prefix `vsl:rl` to namespace within shared Upstash database

### Error Responses (errors.ts)
- `ApiErrorCode` union type matching exactly the 7 codes from OpenAPI spec
- `apiError()` factory returns `NextResponse` with structured `{ error: { code, message } }` body
- CORS headers automatically included on all error responses
- `extraHeaders` parameter for rate-limit-specific headers (Retry-After, etc.)

### CORS Headers (cors.ts)
- Wildcard `Access-Control-Allow-Origin: *` (intentional for Bearer-token public API)
- Methods: GET, POST, PATCH, DELETE, OPTIONS
- Allowed headers: Authorization, Content-Type
- Exposed headers: X-RateLimit-Limit, X-RateLimit-Remaining, x-credits-remaining, x-credits-used, Retry-After

### Success Responses (response.ts)
- `apiSuccess<T>()` generic helper with optional `creditsUsed` header
- CORS/rate-limit headers intentionally NOT set here (HOC responsibility)

### Enhanced withApiAuth HOC (with-api-auth.ts)
- OPTIONS preflight: 204 with CORS, no auth check
- Auth: `authenticateApiKey()` with UNAUTHORIZED error on failure
- Rate limit: `checkRateLimit(keyId)` with 429 + Retry-After on excess
- Credit balance: fetched via `supabase.rpc('get_credit_balance')`, passed as `ctx.creditBalance`
- Response enrichment: CORS + rate-limit + credit headers appended to handler response
- Post-deduction accuracy: `x-credits-remaining = creditBalance - x-credits-used`
- Error boundary: uncaught handler errors return 500 INTERNAL_ERROR (no stack traces)

## Task Commits

| Task | Name | Commit | Test Count |
|------|------|--------|------------|
| 1 | Rate-limit, errors, CORS, response utilities | 245fed7 | 11 |
| 2 | Enhanced withApiAuth HOC | fd4d6db | 12 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Copied auth.ts from phase 22 parallel branch**
- **Found during:** Task 1
- **Issue:** This worktree branched from base commit before phase 22 (auth foundation) was merged. `src/lib/api/auth.ts` did not exist.
- **Fix:** Copied the auth.ts file from the main repo to this worktree so the HOC could import it.
- **Files modified:** src/lib/api/auth.ts
- **Commit:** 245fed7

## Verification

All acceptance criteria passed:
- `slidingWindow` in rate-limit.ts
- `RATE_LIMITED` and `INSUFFICIENT_CREDITS` in errors.ts
- `Access-Control-Expose-Headers` in cors.ts
- `apiSuccess` in response.ts
- `checkRateLimit`, `corsHeaders`, `OPTIONS`, `RATE_LIMITED`, `X-RateLimit-Limit`, `x-credits-remaining`, `creditBalance` all present in with-api-auth.ts
- 23/23 tests passing across 4 test files

## Self-Check: PASSED
