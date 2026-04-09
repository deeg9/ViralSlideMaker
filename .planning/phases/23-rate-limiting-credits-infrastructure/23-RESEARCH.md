# Phase 23: Rate Limiting, Credits & Infrastructure - Research

**Researched:** 2026-04-08
**Domain:** API middleware infrastructure (rate limiting, credit enforcement, error formatting, CORS)
**Confidence:** HIGH

## Summary

This phase builds the middleware layer between Phase 22's `withApiAuth` HOC and the endpoint logic in Phases 24-25. Three distinct concerns must be addressed: (1) distributed rate limiting via Upstash Redis sliding window, replacing the current in-memory rate limiter at `src/lib/rate-limit.ts`; (2) credit enforcement for API routes using the existing `deduct_credits` Postgres RPC but adapted for the admin client context; (3) structured error responses, CORS headers, and service extraction so server action logic is reusable by API route handlers.

The codebase already has all the foundational pieces: `withApiAuth` in `src/lib/api/with-api-auth.ts` provides auth + admin client, the OpenAPI spec in `src/lib/api/openapi.ts` defines the exact error codes and header schema, and `src/lib/credits/check-credits.ts` has the credit deduction RPC. The main work is integrating rate limiting into the HOC, adding credit/rate-limit headers to all responses, creating error response helpers, adding CORS, and extracting project CRUD + carousel generation from server actions into shared services.

**Primary recommendation:** Extend `withApiAuth` to become `withApi` -- a composable HOC that chains auth, rate limiting, CORS headers, credit headers, and structured error formatting. Keep it as a single wrapper to avoid middleware ordering bugs.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RATE-01 | API requests rate limited per key using Upstash Redis sliding window | @upstash/ratelimit v2.0.8 + @upstash/redis v1.37.0 with slidingWindow strategy, keyed by api_key_id |
| RATE-02 | Rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining) in all responses | Upstash limit() returns `{ limit, remaining, reset }` -- map directly to headers |
| RATE-03 | Rate-limited requests return 429 with Retry-After header | Compute Retry-After from `reset` timestamp returned by limit() |
| CRED-01 | Credit-consuming endpoints deduct via existing atomic RPC | Use `deduct_credits` RPC via admin client (not session-based createClient) |
| CRED-02 | Insufficient credits return 402 with x-credits-remaining header | Check balance before deduction, return 402 with INSUFFICIENT_CREDITS code |
| CRED-03 | All responses include x-credits-remaining and x-credits-used headers | Fetch balance in HOC, pass to handler; handler reports credits used |
| INFRA-01 | Structured JSON error responses with codes matching OpenAPI spec | Create `apiError()` helper using the 7 error codes from openapi.ts |
| INFRA-02 | CORS headers for cross-origin browser-based API consumers | Add Access-Control-Allow-Origin/Methods/Headers to all responses + OPTIONS handler |
| INFRA-03 | Service extraction -- shared logic between server actions and route handlers | Extract project CRUD from dashboard/actions.ts, carousel gen from project/[id]/actions.ts into src/lib/services/ |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @upstash/ratelimit | 2.0.8 | Distributed sliding window rate limiting | Purpose-built for serverless, works across Vercel function instances [VERIFIED: npm registry] |
| @upstash/redis | 1.37.0 | Redis client for Upstash (HTTP-based) | Required by @upstash/ratelimit, HTTP transport works in Edge/serverless [VERIFIED: npm registry] |

### Already Installed (No Changes Needed)
| Library | Purpose | Relevance |
|---------|---------|-----------|
| next 15.5.13 | App router, API routes | Route handlers at src/app/api/v1/* |
| @supabase/supabase-js 2.99.3 | Database client | Admin client for credit operations |
| zod 4.3.6 | Validation | Request body validation in endpoints |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @upstash/ratelimit | Custom Redis EVAL script | Upstash handles sliding window math, analytics, edge cases -- don't hand-roll |
| Upstash Redis | Vercel KV | Vercel KV is built on Upstash Redis anyway; direct Upstash gives more control |

**Installation:**
```bash
npm install @upstash/ratelimit@^2.0.8 @upstash/redis@^1.37.0
```

## Architecture Patterns

### Recommended Project Structure
```
src/lib/
  api/
    auth.ts              # Existing: authenticateApiKey
    with-api-auth.ts     # Extend: add rate limit + credit headers + CORS + error handling
    errors.ts            # NEW: apiError() helper, error codes enum
    cors.ts              # NEW: CORS header utilities
    rate-limit.ts        # NEW: Upstash-based rate limiter (replaces src/lib/rate-limit.ts)
    response.ts          # NEW: apiSuccess() helper with standard headers
  services/
    carousel.ts          # NEW: extracted from project/[id]/actions.ts
    projects.ts          # NEW: extracted from dashboard/actions.ts
  credits/
    check-credits.ts     # Existing: add admin-client variant for API routes
```

### Pattern 1: Enhanced withApiAuth HOC
**What:** Extend the existing `withApiAuth` to chain auth -> rate limit -> handler -> response headers
**When to use:** Every `/api/v1/*` route handler
**Example:**
```typescript
// src/lib/api/with-api-auth.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { apiError } from './errors'
import { corsHeaders } from './cors'

export type ApiContext = {
  userId: string
  keyId: string
  supabase: ReturnType<typeof createAdminClient>
  creditBalance: number
}

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),            // reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
  limiter: Ratelimit.slidingWindow(60, '1 m'),  // 60 req/min per key
  prefix: 'vsl:ratelimit',
})

export function withApiAuth(handler: ApiHandler) {
  return async (req: NextRequest) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: corsHeaders() })
    }

    // 1. Auth
    const authResult = await authenticateApiKey(req)
    // ... error handling returns { error: { code: 'UNAUTHORIZED' } }

    // 2. Rate limit
    const { success, limit, remaining, reset } = await ratelimit.limit(authResult.keyId)
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000)
      return apiError('RATE_LIMITED', 'Rate limit exceeded', 429, {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': '0',
      })
    }

    // 3. Get credit balance for headers
    const creditBalance = await getCreditBalanceAdmin(supabase, authResult.userId)

    // 4. Call handler
    const response = await handler(req, { ...authResult, supabase, creditBalance })

    // 5. Attach standard headers
    response.headers.set('X-RateLimit-Limit', String(limit))
    response.headers.set('X-RateLimit-Remaining', String(remaining))
    response.headers.set('x-credits-remaining', String(creditBalance))
    // x-credits-used is set by the handler if it consumed credits
    for (const [k, v] of Object.entries(corsHeaders())) {
      response.headers.set(k, v)
    }
    return response
  }
}
```
[ASSUMED: rate limit of 60/min -- actual number is Claude's discretion per CONTEXT.md]

### Pattern 2: Structured Error Responses
**What:** Centralized error factory matching OpenAPI error codes
**When to use:** Every error path in API routes
**Example:**
```typescript
// src/lib/api/errors.ts
export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'INSUFFICIENT_CREDITS'
  | 'NOT_FOUND'
  | 'FORBIDDEN'

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  extraHeaders?: Record<string, string>
): NextResponse {
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...corsHeaders(),
    ...extraHeaders,
  })
  return NextResponse.json(
    { error: { code, message } },
    { status, headers }
  )
}
```
[VERIFIED: error codes from src/lib/api/openapi.ts lines 24-30]

### Pattern 3: Service Extraction
**What:** Move business logic from server actions into pure service functions that accept a Supabase client
**When to use:** Any logic shared between server actions (session-based) and API routes (admin client)
**Example:**
```typescript
// src/lib/services/projects.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export async function listProjects(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('id, title, topic, template_id, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

export async function deleteProject(supabase: SupabaseClient, userId: string, projectId: string) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId)  // ownership check
  if (error) throw error
}
```
Then server actions and API routes both call these, passing their respective Supabase client. [VERIFIED: current server actions at src/app/(dashboard)/dashboard/actions.ts]

### Pattern 4: CORS Headers
**What:** Allow cross-origin browser-based API consumers
**When to use:** All /api/v1/* responses
**Example:**
```typescript
// src/lib/api/cors.ts
export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Expose-Headers': 'X-RateLimit-Limit, X-RateLimit-Remaining, x-credits-remaining, x-credits-used, Retry-After',
  }
}
```
`Access-Control-Expose-Headers` is critical -- without it, browser JS cannot read custom response headers. [ASSUMED: wildcard origin is appropriate for a public API]

### Anti-Patterns to Avoid
- **Separate middleware for each concern:** Don't create separate Next.js middleware for rate limiting, CORS, etc. -- integrate into the `withApiAuth` HOC to maintain a single execution path and avoid ordering bugs
- **Session-based Supabase client in API routes:** The existing `createClient()` uses cookies for auth. API routes use Bearer tokens, so they MUST use `createAdminClient()` with manual user_id filtering. The `deductCredit()` function currently calls `createClient()` -- a new admin-compatible variant is needed.
- **In-memory rate limiting for API routes:** The current `src/lib/rate-limit.ts` uses in-memory Maps. Vercel spins up multiple serverless instances, so in-memory state is not shared. Upstash Redis is required for distributed rate limiting.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sliding window rate limiting | Custom counter + timestamp logic | @upstash/ratelimit slidingWindow | Handles window math, race conditions, cleanup automatically |
| Distributed state for rate limits | In-memory Map (current approach) | @upstash/redis (HTTP-based) | Shared across Vercel function instances, no TCP connections needed |
| Credit deduction atomicity | SELECT then UPDATE | Existing `deduct_credits` Postgres RPC | RPC does atomic check-and-deduct in single transaction |

**Key insight:** The existing in-memory rate limiter (`src/lib/rate-limit.ts`) works fine for server actions (same process, same user), but API routes run across distributed serverless instances. Upstash Redis solves this without requiring TCP connections (uses HTTP).

## Common Pitfalls

### Pitfall 1: Session Client vs Admin Client for Credits
**What goes wrong:** `deductCredit()` in `src/lib/credits/check-credits.ts` calls `createClient()` which depends on cookie-based auth. API routes use Bearer tokens and have no session cookies.
**Why it happens:** Server actions and API routes have different auth contexts.
**How to avoid:** Create an `deductCreditAdmin(supabase, userId, ...)` variant that accepts an admin Supabase client and userId directly, or refactor `deductCredit` to accept an optional client parameter.
**Warning signs:** "Invalid session" errors when calling credit functions from API routes.

### Pitfall 2: Missing Access-Control-Expose-Headers
**What goes wrong:** Browser JavaScript cannot read `X-RateLimit-Remaining`, `x-credits-remaining`, or other custom headers.
**Why it happens:** CORS spec requires `Access-Control-Expose-Headers` to list any non-simple headers the client can access.
**How to avoid:** Include all custom headers in `Access-Control-Expose-Headers`.
**Warning signs:** `response.headers.get('x-credits-remaining')` returns `null` in browser fetch.

### Pitfall 3: OPTIONS Preflight Not Handled
**What goes wrong:** Browser sends OPTIONS preflight for requests with Authorization header; if not handled, CORS fails.
**Why it happens:** `withApiAuth` currently tries to authenticate every request, including OPTIONS.
**How to avoid:** Check for OPTIONS method before auth and return 204 with CORS headers immediately.
**Warning signs:** "CORS preflight did not succeed" in browser console.

### Pitfall 4: Stale Credit Balance in Response Headers
**What goes wrong:** `x-credits-remaining` header shows pre-deduction balance.
**Why it happens:** Balance fetched before handler runs; handler deducts credits but header already set.
**How to avoid:** Handler must return credits used; HOC re-fetches or computes remaining = balance - used.
**Warning signs:** `x-credits-remaining` shows 5, but actual balance is 4 after deduction.

### Pitfall 5: Upstash Env Vars Missing
**What goes wrong:** `Redis.fromEnv()` throws at runtime because env vars not configured.
**Why it happens:** Upstash Redis requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
**How to avoid:** Verify env vars exist before deploying. Add to `.env.local` template and Vercel project settings.
**Warning signs:** Runtime error: "UPSTASH_REDIS_REST_URL is not defined".

## Code Examples

### Credit Deduction for API Routes
```typescript
// src/lib/credits/check-credits.ts -- add admin variant
import type { SupabaseClient } from '@supabase/supabase-js'

export async function deductCreditAdmin(
  supabase: SupabaseClient,
  userId: string,
  type: string,
  description?: string,
  referenceId?: string,
  amount: number = 1,
): Promise<boolean> {
  if (amount <= 0) return true
  const { data } = await supabase.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_type: type,
    p_description: description ?? null,
    p_reference_id: referenceId ?? null,
  })
  return data === true
}

export async function getCreditBalanceAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data } = await supabase.rpc('get_credit_balance', { p_user_id: userId })
  return data ?? 0
}
```
[VERIFIED: pattern matches existing deductCredit in src/lib/credits/check-credits.ts]

### Upstash Rate Limiter Setup
```typescript
// src/lib/api/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Lazy initialization to avoid errors during build when env vars aren't available
let _ratelimit: Ratelimit | null = null

function getRatelimit(): Ratelimit {
  if (!_ratelimit) {
    _ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      prefix: 'vsl:rl',
    })
  }
  return _ratelimit
}

export async function checkRateLimit(keyId: string) {
  const rl = getRatelimit()
  return rl.limit(keyId)
}
```
[VERIFIED: API pattern from @upstash/ratelimit GitHub README]

### API Success Response Helper
```typescript
// src/lib/api/response.ts
import { NextResponse } from 'next/server'

export function apiSuccess<T>(
  data: T,
  status: number = 200,
  creditsUsed: number = 0,
): NextResponse {
  const response = NextResponse.json(
    typeof data === 'object' && data !== null && !Array.isArray(data)
      ? data
      : { data },
    { status }
  )
  if (creditsUsed > 0) {
    response.headers.set('x-credits-used', String(creditsUsed))
  }
  return response
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run src/__tests__/api/ --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RATE-01 | Rate limit per key via Upstash sliding window | unit (mocked Redis) | `npx vitest run src/__tests__/api/rate-limit.test.ts -t "rate limit"` | Wave 0 |
| RATE-02 | X-RateLimit-Limit and X-RateLimit-Remaining headers in responses | unit | `npx vitest run src/__tests__/api/with-api-auth.test.ts -t "rate limit headers"` | Wave 0 |
| RATE-03 | 429 response with Retry-After when rate limited | unit | `npx vitest run src/__tests__/api/with-api-auth.test.ts -t "429"` | Wave 0 |
| CRED-01 | Credit deduction via atomic RPC (admin client variant) | unit | `npx vitest run src/__tests__/credits/check-credits.test.ts -t "admin"` | Wave 0 |
| CRED-02 | 402 response with x-credits-remaining on insufficient credits | unit | `npx vitest run src/__tests__/api/with-api-auth.test.ts -t "402"` | Wave 0 |
| CRED-03 | x-credits-remaining and x-credits-used headers in all responses | unit | `npx vitest run src/__tests__/api/with-api-auth.test.ts -t "credit headers"` | Wave 0 |
| INFRA-01 | Structured JSON errors with correct codes | unit | `npx vitest run src/__tests__/api/errors.test.ts` | Wave 0 |
| INFRA-02 | CORS headers including Access-Control-Expose-Headers | unit | `npx vitest run src/__tests__/api/cors.test.ts` | Wave 0 |
| INFRA-03 | Service extraction (projects, carousel) | unit | `npx vitest run src/__tests__/services/` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/api/ --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/api/rate-limit.test.ts` -- covers RATE-01
- [ ] `src/__tests__/api/errors.test.ts` -- covers INFRA-01
- [ ] `src/__tests__/api/cors.test.ts` -- covers INFRA-02
- [ ] `src/__tests__/services/projects.test.ts` -- covers INFRA-03

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (Phase 22) | withApiAuth HOC -- already implemented |
| V3 Session Management | no | API is stateless Bearer token |
| V4 Access Control | yes | Admin client with manual user_id filtering (RLS bypassed) |
| V5 Input Validation | yes | zod for request bodies |
| V6 Cryptography | no | No new crypto in this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Rate limit bypass via key rotation | Denial of Service | Rate limit keyed by api_key_id, new keys get fresh limits (acceptable) |
| Credit race condition | Tampering | Atomic `deduct_credits` Postgres RPC (existing) |
| CORS misconfiguration | Information Disclosure | Wildcard origin is intentional for public API; no cookies used |
| Missing ownership check in service layer | Elevation of Privilege | All queries filter by user_id from authenticated context |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Upstash Redis | RATE-01 (distributed rate limiting) | Unknown | -- | Must be provisioned; no viable local fallback |
| Supabase (Postgres RPC) | CRED-01 (credit deduction) | Yes | -- | -- |
| Node.js crypto | AUTH (Phase 22) | Yes | Built-in | -- |

**Missing dependencies with no fallback:**
- Upstash Redis account must be provisioned and `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` env vars set before rate limiting works. STATE.md notes this as a known blocker concern.

**Missing dependencies with fallback:**
- None

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Rate limit of 60 requests/minute per key is appropriate | Architecture Patterns | Too high = abuse risk; too low = frustrated users. Easy to change. |
| A2 | Wildcard CORS origin (*) is appropriate for public API | Architecture Patterns | If API uses cookies or sensitive headers, would need specific origins. But Bearer token API is safe with wildcard. |
| A3 | Upstash Redis account is already provisioned (or will be before execution) | Environment Availability | Rate limiting will not work without it |

## Open Questions

1. **Upstash Redis provisioning status**
   - What we know: STATE.md flags "confirm account provisioned and env vars available before Phase 23"
   - What's unclear: Whether the account exists and env vars are configured
   - Recommendation: Check for env vars at plan execution time; document setup steps if missing

2. **Rate limit numbers per tier**
   - What we know: OpenAPI spec defines headers but not specific limits
   - What's unclear: Should free/plus/pro tiers have different rate limits?
   - Recommendation: Start with a single limit (60/min) for all tiers; tier-based limits can be added later with minimal code change

## Sources

### Primary (HIGH confidence)
- Codebase: `src/lib/api/with-api-auth.ts` -- existing HOC to extend
- Codebase: `src/lib/api/openapi.ts` -- authoritative error codes and header definitions
- Codebase: `src/lib/credits/check-credits.ts` -- existing credit RPC patterns
- Codebase: `src/lib/rate-limit.ts` -- current in-memory rate limiter (to be replaced)
- npm registry: @upstash/ratelimit@2.0.8, @upstash/redis@1.37.0

### Secondary (MEDIUM confidence)
- GitHub: upstash/ratelimit-js README -- slidingWindow API, limit() return values

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - packages verified via npm registry, codebase patterns clear
- Architecture: HIGH - extending existing proven HOC pattern, all target files identified
- Pitfalls: HIGH - identified from direct codebase analysis (session vs admin client mismatch is concrete)

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable infrastructure, unlikely to change)
