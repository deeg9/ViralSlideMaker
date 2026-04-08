# Pitfalls Research: Public REST API with Per-User API Keys (v2.2)

**Domain:** Adding API key authentication, REST API routes, rate limiting, and credit deduction to existing Next.js 15 + Supabase SaaS
**Researched:** 2026-04-08
**Confidence:** HIGH (codebase verified, official docs checked, known patterns from Next.js 15 + Supabase + Upstash ecosystem)

---

## Critical Pitfalls

### Pitfall 1: API Key Comparison Vulnerable to Timing Attacks

**What goes wrong:**
The API key lookup flow hashes the incoming Bearer token with SHA-256 and compares it to stored hashes. If the comparison uses JavaScript `===` (standard string equality), the comparison short-circuits on the first mismatched character. An attacker making thousands of requests can statistically measure response time differences to infer the correct hash one character at a time. With SHA-256 producing a 64-character hex string, this is a real attack vector.

**Why it happens:**
Developers hash the key correctly but use `===` for the final comparison because it "looks the same" -- both are hashed, so the raw key is never compared. But the hash itself becomes the secret, and `===` leaks information about it.

**How to avoid:**
Use `crypto.timingSafeEqual()` for the hash comparison. Both buffers must be the same length (they will be -- both are SHA-256 hex digests). Implementation:

```typescript
import { timingSafeEqual, createHash } from 'crypto';

function verifyApiKey(providedKey: string, storedHash: string): boolean {
  const providedHash = createHash('sha256').update(providedKey).digest('hex');
  // Both are 64-char hex strings, so equal length guaranteed
  return timingSafeEqual(Buffer.from(providedHash), Buffer.from(storedHash));
}
```

**Warning signs:**
- `===` or `.includes()` used anywhere in the API key verification path
- No import of `crypto.timingSafeEqual` in the auth middleware
- API key validation tests only check correct/incorrect, not timing behavior

**Phase to address:**
Phase 1 -- API key table + auth middleware. This must be correct from the first implementation.

---

### Pitfall 2: Next.js Middleware Redirects API Routes to Login Page

**What goes wrong:**
The existing `middleware.ts` redirects unauthenticated users to `/login` for all routes except a whitelist (`/`, `/login`, `/signup`, `/auth`, `/privacy`, `/terms`). The `/api/v1/*` routes are NOT in this whitelist. When an API consumer sends a Bearer token request without Supabase session cookies, the middleware intercepts it, finds no session, and redirects to `/login` with a 307 -- before the route handler ever sees the request.

**Why it happens:**
The middleware was written for browser-based auth where all routes need cookie-based sessions. API key auth is a fundamentally different auth model that was not anticipated by the middleware. The `/api/webhooks` route is already excluded (line 6-7 of middleware.ts), but `/api/v1` is not.

**How to avoid:**
Add `/api/v1` to the middleware exclusion list. Two approaches:

1. **Exclude in middleware.ts** (simplest): Add `request.nextUrl.pathname.startsWith('/api/v1')` to the early return at the top of middleware, alongside the existing webhook exclusion.
2. **Exclude in matcher config**: Update the matcher regex to skip `/api/v1` paths.

Option 1 is better because it is explicit and readable. The auth middleware should ONLY handle browser session management. API key validation belongs in the route handler layer (a shared `withApiKey` wrapper or similar).

**Warning signs:**
- API requests return 307 redirects instead of 401 errors
- `curl` with Bearer token gets HTML login page in response
- Tests pass when running route handlers in isolation but fail through the full Next.js stack

**Phase to address:**
Phase 1 -- must be the FIRST change, before any route handler implementation.

---

### Pitfall 3: Supabase RLS Blocks API Key-Authenticated Queries

**What goes wrong:**
The existing credit system uses `createClient()` (the cookie-based server client) for operations like `getCreditBalance()` and `deductCredit()`. These functions call Supabase RPCs that use `SECURITY DEFINER` (which bypass RLS). However, other queries -- like listing projects (`supabase.from('projects').select(...)`) -- rely on RLS policies that check `auth.uid() = user_id`. When a request comes via API key (no Supabase session), `auth.uid()` is null, and RLS blocks everything.

**Why it happens:**
The web app authenticates via Supabase session cookies, so `auth.uid()` is always populated. API key auth resolves the user from the `api_keys` table, but this user ID is never set in the Supabase context. The developer tests with the admin client (service role, bypasses RLS) and everything works -- then deploys, and public API users get empty results or 403s.

**How to avoid:**
For API key-authenticated requests, use the admin client (`createAdminClient()` which uses `SUPABASE_SERVICE_ROLE_KEY`) and manually filter by user_id in every query:

```typescript
// In API route handler after resolving userId from API key
const supabase = createAdminClient();
const { data } = await supabase
  .from('projects')
  .select('*')
  .eq('user_id', userId);  // Manual filter -- RLS is bypassed
```

This is secure ONLY IF the userId is resolved from the verified API key, never from user input. The API key lookup (hash verification) is the trust boundary -- after that, the userId is trustworthy.

Alternative: Set a custom claim on a temporary Supabase JWT for the API key user. This is more complex and slower (JWT signing per request) with no real benefit for this use case.

**Warning signs:**
- API returns empty arrays for `GET /projects` even when user has projects
- Works with admin client in tests but fails with regular client in production
- RLS error messages in Supabase logs for API requests

**Phase to address:**
Phase 1 -- architecture decision. Must decide admin-client-with-manual-filtering vs. JWT-per-request before writing any route handler.

---

### Pitfall 4: In-Memory Rate Limiter Does Not Work Across Serverless Instances

**What goes wrong:**
The existing `rate-limit.ts` uses `Map()` for in-memory storage. On Vercel (or any serverless platform), each function invocation may run in a different instance. The in-memory map is not shared between instances, so rate limits are effectively per-instance, not per-user. A user hitting the API at 100 req/s could be load-balanced across 10 instances, each seeing only 10 req/s -- the rate limit is 10x higher than intended.

The file's own comment says: "For production with multiple serverless instances, replace with Upstash Redis."

**Why it happens:**
The in-memory limiter was a v1 placeholder that works in development. The project already references Upstash Redis in the OpenAPI spec and PROJECT.md, but the actual implementation has not been swapped yet.

**How to avoid:**
Replace the in-memory rate limiter with `@upstash/ratelimit` + `@upstash/redis` for ALL API routes. Use the sliding window algorithm (avoids burst-at-boundary problems). Key by API key ID (not user ID) so revoking one key does not affect other keys for the same user.

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, '1 m'),  // 60 req/min
  prefix: 'vsl_api',
});
```

Keep the in-memory limiter as a fallback for local development (when `UPSTASH_REDIS_REST_URL` is not set).

**Warning signs:**
- Rate limit tests pass locally but users report being able to exceed limits in production
- `Map()` used in any production rate limiting code path
- No `@upstash/ratelimit` in `package.json`

**Phase to address:**
Phase 2 (rate limiting phase) -- but decide the architecture in Phase 1.

---

### Pitfall 5: Credit Race Condition Between Web UI and API

**What goes wrong:**
A user has 1 credit remaining. They click "Generate" in the web UI AND their automation script hits `POST /api/v1/carousel` at the same moment. Both requests check the credit balance, both see 1 credit, both proceed with generation. The user gets 2 carousels for 1 credit, and the balance goes negative.

**Why it happens:**
The existing `deduct_credits` Postgres function uses `pg_advisory_xact_lock(hashtext(p_user_id::text))` -- this IS the correct solution and already prevents this race condition. The lock serializes concurrent deductions for the same user. The pitfall is NOT in the existing code -- it is in accidentally bypassing it.

The bypass happens when developers add a "pre-check" (read balance, return 402 if insufficient) BEFORE calling `deduct_credits`, and the pre-check does NOT hold the advisory lock. The time between the pre-check and the actual deduction is the race window.

**How to avoid:**
Never pre-check credits outside the `deduct_credits` RPC. The RPC already returns `FALSE` when credits are insufficient. The API handler flow should be:

1. Validate request body
2. Call `deduct_credits(userId, cost, type, description, referenceId)`
3. If returns `FALSE` -> respond 402 INSUFFICIENT_CREDITS
4. If returns `TRUE` -> proceed with generation

Do NOT add a separate `getCreditBalance()` check before `deductCredit()` in the API handler. The web UI may already do this for UX (showing "insufficient credits" before the user clicks), but the server-side handler must rely solely on the atomic RPC.

**Warning signs:**
- API route handler calls `getCreditBalance()` before `deductCredit()`
- Two separate database calls for balance check + deduction outside a transaction
- Tests mock `deductCredit` to always return true without testing the false case

**Phase to address:**
Phase implementing credit deduction for API routes. Verify by load-testing with concurrent requests from 2+ clients.

---

### Pitfall 6: API Key Plaintext Leaked in Logs, Error Messages, or Response Bodies

**What goes wrong:**
The raw API key (`vsl_abc123...`) appears in: (a) server logs via `console.log(request.headers)` or error stack traces, (b) error response bodies like `{"error": "Invalid key: vsl_abc123..."}`, (c) Vercel function logs, (d) Supabase query logs if the raw key is used in a WHERE clause. Once leaked, the key is compromised.

**Why it happens:**
During development, logging the full request for debugging is natural. The raw key is in the Authorization header of every request. Generic error handlers may serialize the entire request object.

**How to avoid:**
1. Never log the Authorization header. Create a `sanitizeHeaders()` utility that redacts it.
2. Hash the key IMMEDIATELY on receipt -- before any logging, validation, or error handling. The raw key should exist in memory for the minimum possible time.
3. Error messages should reference the key prefix only: `"Invalid API key (vsl_abc1...)"` -- first 8 chars max.
4. Never use the raw key in database queries. Always query by hash: `WHERE key_hash = $1`.
5. In the key creation response (the ONLY time the raw key is shown), set `Cache-Control: no-store` to prevent CDN/proxy caching.

**Warning signs:**
- `console.log(req.headers)` or `console.log(request)` anywhere in API route code
- Error response includes the full Bearer token
- Database query uses `WHERE key = $rawKey` instead of `WHERE key_hash = $hash`
- No `no-store` header on the key creation endpoint response

**Phase to address:**
Phase 1 -- establish logging hygiene before any route handler writes to stdout.

---

### Pitfall 7: OpenAPI Spec Drifts from Route Handler Implementation

**What goes wrong:**
The OpenAPI spec (`src/lib/api/openapi.ts`) is hand-written and static. As route handlers are implemented, small deviations accumulate: a field is renamed from camelCase to snake_case, an optional parameter becomes required, an error code is added that is not in the spec's enum. The Scalar playground at `/docs` shows one API contract, but the actual routes behave differently. Users build integrations against the spec and get unexpected errors.

**Why it happens:**
The spec was written before implementation as a design document. The spec and the route handlers are in separate files with no automated connection. There is no test that validates the spec matches the implementation.

**How to avoid:**
1. Write integration tests that validate route handler responses against the OpenAPI spec schemas. Use a library like `openapi-response-validator` or manually validate response shapes in tests.
2. For each route handler, add a test that: (a) calls the route, (b) validates the response status code is in the spec's responses, (c) validates the response body matches the spec's schema.
3. Alternatively, generate Zod schemas from the OpenAPI spec (or vice versa) so there is a single source of truth.
4. Add a CI step that compares the spec to the previous version and flags breaking changes.

The pragmatic approach for this project: since the spec is already hand-written in TypeScript, keep it as-is but add response-shape assertions in tests.

**Warning signs:**
- Scalar playground example requests return errors
- API consumers report "field not found" for spec-documented fields
- Route handler returns fields not in the spec
- Spec has camelCase but handler returns snake_case (or vice versa)

**Phase to address:**
Every phase that implements routes. Add spec-validation tests alongside route handler tests.

---

### Pitfall 8: GET Route Handlers Accidentally Cached by CDN or Build

**What goes wrong:**
Although Next.js 15 does NOT cache GET route handlers by default (a change from v14), Vercel's Edge Network or CDN layers may still cache GET responses if they lack proper `Cache-Control` headers. An API consumer's `GET /projects` returns another user's project list because the CDN cached the response.

Additionally, if a developer adds `export const dynamic = 'force-static'` to optimize a read-heavy endpoint (like `GET /templates`), ALL responses get cached regardless of the Authorization header.

**Why it happens:**
Next.js 15 changed defaults, but developers may copy patterns from v14 examples. CDN caching is a separate layer from Next.js route handler caching.

**How to avoid:**
1. Set `Cache-Control: private, no-store` on ALL authenticated API responses.
2. Never use `export const dynamic = 'force-static'` on any route that reads the Authorization header.
3. The `GET /templates` endpoint (which returns the same data for all users) CAN be cached, but set `Cache-Control: public, max-age=3600` explicitly rather than relying on defaults.
4. Add `Vary: Authorization` header to all API responses so CDNs treat different API keys as different cache entries.

**Warning signs:**
- Two different API keys get the same project list
- Response headers show `x-vercel-cache: HIT` on user-specific endpoints
- `force-static` export in any `/api/v1/` route file

**Phase to address:**
Phase 1 -- establish the response helper that sets correct cache headers on all API responses.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using admin client for ALL API queries (bypassing RLS) | Simple, no RLS policy changes needed | Must manually add `.eq('user_id', userId)` to every query; forgetting = data leak | Acceptable for v2.2 -- the trust boundary is the API key lookup |
| In-memory rate limiter for development | No Upstash dependency for local dev | Must ensure production ALWAYS uses Upstash; feature flag risk | Acceptable -- guard with `process.env.UPSTASH_REDIS_REST_URL` check |
| Hand-written OpenAPI spec | Full control, no code generation toolchain | Drift risk increases with every route change | Acceptable for 10 endpoints -- add spec-validation tests to compensate |
| Single rate limit tier for all API keys | Simple implementation | Cannot offer higher limits for paid tiers | Acceptable for launch -- add tier-based limits when pricing tiers exist |
| No API key rotation (only create + revoke) | Simpler key management UI | Users must revoke old key and create new one; brief downtime | Acceptable for v2.2 -- add rotation in v2.3 if users request it |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase admin client | Using `createClient()` (cookie-based) for API key-authenticated requests -- RLS blocks queries because `auth.uid()` is null | Use `createAdminClient()` (service role) and manually filter by `user_id` resolved from the API key |
| Supabase admin client (SSR) | Initializing admin client with SSR helpers that pick up user session from cookies, overriding service role in Authorization header | Always create admin client via `createClient(url, serviceRoleKey)` directly (which the codebase already does correctly in `admin.ts`) |
| Upstash Redis rate limiting | Using `Ratelimit.fixedWindow()` which allows burst at window boundaries (user gets 2x limit in a 1-second window) | Use `Ratelimit.slidingWindow()` for smoother rate distribution |
| Upstash ephemeral cache | Skipping the optional `ephemeralCache` config, causing every rate limit check to hit Redis | Enable ephemeral cache: `new Ratelimit({ ephemeralCache: new Map(), ... })` -- reduces Redis calls by ~40% |
| Next.js middleware + API routes | Middleware processes API routes through Supabase session refresh, adding ~50ms latency and cookie operations irrelevant for API key auth | Exclude `/api/v1` from middleware entirely; handle auth in route handler layer |
| Stripe credit webhooks + API deduction | Webhook grants credits via service role, API deducts via service role -- if both use different Supabase client instances, advisory lock might not serialize across connections | Both use the same `deduct_credits` RPC which acquires `pg_advisory_xact_lock` -- this works across connections because advisory locks are server-wide, not connection-scoped |
| OpenAPI spec `$ref` references | Using `$ref` in the hand-written TypeScript object but Scalar not resolving them | Scalar resolves `$ref` correctly from the object structure. Verify by checking the rendered docs at `/docs` after every schema change. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Querying API key hash on every request without index | Auth latency increases as api_keys table grows | Add index: `CREATE INDEX api_keys_hash_idx ON api_keys(key_hash)` | >1000 API keys |
| Loading full project with all slides for list endpoint | `GET /projects` returns massive payloads, slow response | Select only summary fields for list: `id, title, topic, template_id, created_at, updated_at`. Load slides only for `GET /projects/{id}` | >50 projects per user |
| Rate limit check + credit check + auth check = 3 serial async operations before any work | API response time floor of ~150ms even for simple reads | Parallelize independent checks: auth + rate limit can run concurrently. Credit check only needed for generation endpoints. | Noticeable at any scale -- adds latency to every request |
| Rendering slides server-side on every download request | `POST /render` and `GET /download` re-render from scratch each time | Cache rendered PNGs in Supabase Storage with a content hash. Invalidate on slide edit. | >10 concurrent render requests |
| `setInterval` cleanup in rate-limit.ts runs in serverless | `setInterval` keeps the function warm, increasing costs; also does not clean up across instances | Remove `setInterval` entirely when switching to Upstash. Upstash handles TTL natively. | Immediately on serverless -- the interval is a no-op across invocations |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing API key prefix (`vsl_`) + raw key in the same database column | If DB is breached, attacker has usable keys | Store ONLY the SHA-256 hash. Store prefix separately for display (`vsl_abc1****`). The raw key is shown once at creation and never stored. |
| Not validating API key format before database lookup | Allows probing attacks and unnecessary DB queries | Validate format first: must start with `vsl_`, must be expected length (e.g., `vsl_` + 32 hex chars). Return 401 immediately if format is wrong, before any hash computation or DB query. |
| API key grants access to ALL user data without scopes | A leaked key from an automation tool exposes everything -- projects, credit balance, account info | For v2.2, acceptable (all keys are full-access). For v2.3+, add optional scopes (read-only, generate-only). Document the risk in API docs. |
| Not rate limiting the key creation endpoint | Attacker creates thousands of keys to exhaust resources | Rate limit `POST /settings/api-keys` to 5 creations per hour per user session. |
| Returning different error messages for "key not found" vs "key revoked" | Allows enumeration of valid (but revoked) keys | Return identical 401 response for all auth failures: `{"error": {"code": "UNAUTHORIZED", "message": "Invalid or expired API key"}}` |
| API key shown in URL query parameter | Keys in URLs are logged by proxies, CDNs, browser history, server access logs | Enforce Bearer token auth ONLY (Authorization header). Reject requests with key in query string. The OpenAPI spec already specifies `type: http, scheme: bearer`. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Not showing the full API key after creation | User cannot copy the key; it is never shown again | Show the key in a modal with a prominent "Copy" button and a warning: "This key will not be shown again. Copy it now." |
| No key usage stats | User cannot tell which key is being used or hitting limits | Show last-used timestamp and request count per key in the management UI. Update `last_used_at` on each authenticated request (async, do not block response). |
| Confusing error when credits run out via API | API returns 402 but user does not know their balance or how to buy more | Include `credits_remaining: 0` and `purchase_url: "https://app.example.com/pricing"` in the 402 error response body. |
| No clear API key naming/labeling | User creates multiple keys and cannot tell them apart | Require a `name` field on creation (e.g., "Zapier integration", "n8n automation"). Show name + last 4 chars of key in the management UI. |
| Rate limit error without retry guidance | API returns 429 but user does not know when to retry | Include `Retry-After` header (seconds) on 429 responses. The OpenAPI spec already defines this -- implement it. |

## "Looks Done But Isn't" Checklist

- [ ] **Auth middleware:** `/api/v1/*` routes excluded from Supabase session middleware (middleware.ts line 6)
- [ ] **Timing-safe comparison:** `crypto.timingSafeEqual` used for hash comparison, NOT `===`
- [ ] **Admin client:** API routes use `createAdminClient()`, NOT `createClient()` for Supabase queries
- [ ] **Manual user scoping:** Every admin-client query includes `.eq('user_id', userId)` -- no query returns unscoped data
- [ ] **Cache headers:** All authenticated responses include `Cache-Control: private, no-store`
- [ ] **Rate limit headers:** All responses include `X-RateLimit-Limit` and `X-RateLimit-Remaining` as defined in OpenAPI spec
- [ ] **Credit headers:** Generation responses include `x-credits-remaining` and `x-credits-used`
- [ ] **Key hash indexed:** `api_keys.key_hash` column has a database index
- [ ] **Key never logged:** No `console.log` that could output the Authorization header
- [ ] **Error consistency:** Auth failures return identical messages regardless of failure reason
- [ ] **Upstash in production:** Rate limiting uses Upstash Redis, not in-memory Map, when deployed
- [ ] **Spec accuracy:** Every implemented endpoint response matches the OpenAPI spec schema
- [ ] **CORS headers:** API routes return appropriate CORS headers for cross-origin clients
- [ ] **Content-Type:** All JSON responses set `Content-Type: application/json`; download routes set `image/png` or `application/zip`
- [ ] **Revoked key cleanup:** Revoked keys return 401 immediately, not a different error

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Middleware redirecting API routes | LOW (5 min) | Add `/api/v1` to middleware exclusion list |
| RLS blocking API queries | MEDIUM (1-2 hrs) | Switch affected queries to admin client + manual user_id filter |
| Timing attack vulnerability | LOW (15 min) | Replace `===` with `crypto.timingSafeEqual` in hash comparison |
| API key leaked in logs | HIGH (immediate) | Revoke all potentially exposed keys, rotate, notify affected users, scrub logs |
| Credit race condition | LOW (0 min) | Existing `deduct_credits` RPC already handles this -- just ensure no pre-check bypass |
| OpenAPI spec drift | MEDIUM (2-4 hrs) | Audit all routes against spec, add response-validation tests |
| In-memory rate limiter in production | MEDIUM (1-2 hrs) | Install @upstash/ratelimit, configure Redis, swap implementation |
| GET responses cached by CDN | MEDIUM (1 hr) | Add `Cache-Control: private, no-store` + `Vary: Authorization` to all responses, purge CDN cache |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Timing attack on key comparison | Phase 1 (auth middleware) | Code review for `timingSafeEqual` usage; no `===` on hashes |
| Middleware redirect | Phase 1 (auth setup) | `curl -H "Authorization: Bearer vsl_test" /api/v1/templates` returns JSON, not redirect |
| RLS bypass with admin client | Phase 1 (architecture) | API request returns only the authenticated user's projects |
| In-memory rate limiter | Phase 2 (rate limiting) | Deploy to Vercel preview, verify rate limit persists across multiple rapid requests |
| Credit race condition | Phase 3 (credit integration) | Load test: 10 concurrent generation requests with 1 credit remaining, verify exactly 1 succeeds |
| API key leakage in logs | Phase 1 (auth middleware) | Grep codebase for `console.log` in API route files; no raw key in any output |
| OpenAPI spec drift | Every phase | Integration tests validate response shapes against spec schemas |
| CDN caching | Phase 1 (response helpers) | Check response headers in Vercel preview for `Cache-Control: private, no-store` |

## Sources

- [Preventing Timing Attacks on String Comparison](https://paragonie.com/blog/2015/11/preventing-timing-attacks-on-string-comparison-with-double-hmac-strategy) -- timing-safe comparison patterns
- [Node.js crypto.timingSafeEqual](https://nodejs.org/api/crypto.html) -- official Node.js docs
- [Next.js 15 Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) -- caching behavior changes in v15
- [Next.js 15 Caching Changes](https://nextjs.org/blog/next-15) -- GET handlers uncached by default
- [Supabase RLS and Service Role](https://supabase.com/docs/guides/database/postgres/row-level-security) -- how service role bypasses RLS
- [Supabase API Keys](https://supabase.com/docs/guides/api/api-keys) -- Authorization header vs apikey header
- [Implement user API keys with Supabase](https://gist.github.com/j4w8n/25d233194877f69c1cbf211de729afb2) -- community pattern
- [Upstash Rate Limiting](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview) -- sliding window, ephemeral cache
- [Upstash Rate Limiting with Next.js](https://upstash.com/blog/nextjs-ratelimiting) -- serverless pitfalls
- [PostgreSQL Advisory Locks](https://www.postgresql.org/docs/current/explicit-locking.html) -- transaction-scoped locks for credit atomicity
- [Using PostgreSQL Advisory Locks](https://firehydrant.com/blog/using-advisory-locks-to-avoid-race-conditions-in-rails/) -- race condition prevention patterns
- [oasdiff -- OpenAPI Breaking Change Detection](https://www.oasdiff.com/) -- spec drift tooling
- Codebase: `src/middleware.ts` -- current middleware excluding only `/api/webhooks`
- Codebase: `src/lib/supabase/middleware.ts` -- session middleware redirecting unauthenticated users
- Codebase: `src/lib/rate-limit.ts` -- in-memory rate limiter with Map()
- Codebase: `supabase/migrations/005_credit_system.sql` -- deduct_credits RPC with pg_advisory_xact_lock
- Codebase: `src/lib/credits/check-credits.ts` -- credit functions using cookie-based client
- Codebase: `src/lib/supabase/admin.ts` -- admin client with service role key
- Codebase: `src/lib/api/openapi.ts` -- hand-written OpenAPI 3.1 spec

---
*Pitfalls research for: Public REST API with per-user API keys (v2.2)*
*Researched: 2026-04-08*
