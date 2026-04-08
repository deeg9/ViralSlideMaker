# Project Research Summary

**Project:** ViralSlideMaker v2.2 — Public REST API
**Domain:** SaaS developer API platform (API key management + REST endpoints over existing Next.js 15 app)
**Researched:** 2026-04-08
**Confidence:** HIGH

## Executive Summary

This is a greenfield API layer on top of a shipping product. The research is anchored in the existing codebase (Next.js 15.5.13, React 19, Supabase, Stripe, Zod 4) — not a blank-slate build. The fundamental challenge is threading a new Bearer-token auth model through an app built entirely around Supabase cookie sessions. Every architectural decision flows from that constraint: the middleware must be patched to skip `/api/v1/*`, all route handlers must use the admin Supabase client (bypassing RLS), and business logic must be extracted from server actions into shared service functions callable by both the web UI and the API.

The recommended approach is a three-layer stack addition: (1) `@upstash/ratelimit` + `@upstash/redis` for distributed rate limiting (the existing in-memory limiter breaks across serverless instances), (2) a `withApiAuth` higher-order wrapper that handles Bearer extraction, SHA-256 hashing, key lookup, and rate limiting uniformly across all 10 endpoints, and (3) a service extraction refactor that pulls carousel generation, project CRUD, and rendering logic out of server actions into pure functions that accept an explicit Supabase client and `userId`. Only two new packages are required; everything else (crypto, UUID, Zod, OpenAPI spec) is already available.

The most dangerous pitfalls are established security hygiene items that are easy to miss: using `===` instead of `crypto.timingSafeEqual` for hash comparison (timing attack), forgetting to exclude `/api/v1/*` from the Supabase session middleware (causes 307 redirects to login for all API consumers), and using the cookie-based Supabase client in route handlers (RLS blocks all queries silently). All three must be addressed in the first phase before any route handler is written. The existing `deduct_credits` RPC already handles the credit race condition correctly via advisory locks — do not add a pre-check that bypasses it.

## Key Findings

### Recommended Stack

The existing stack requires exactly two new packages. `@upstash/ratelimit@^2.0.8` and `@upstash/redis@^1.37.0` provide distributed rate limiting over HTTP (compatible with Vercel serverless and edge). Everything else — key generation (`crypto.randomBytes`), SHA-256 hashing (`crypto.createHash`), request validation (Zod 4 already installed), and the OpenAPI spec (already hand-written at `src/lib/api/openapi.ts`) — is already in place. Two environment variables are needed: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

**Core technologies:**
- `@upstash/ratelimit@^2.0.8`: Per-key sliding-window rate limiting — HTTP-based, works across serverless instances unlike the existing in-memory Map
- `@upstash/redis@^1.37.0`: HTTP Redis client for Upstash — no persistent connections, required peer dep for ratelimit
- Node.js `crypto` (built-in): Key generation (`randomBytes(32)`), SHA-256 hashing (`createHash`), timing-safe comparison (`timingSafeEqual`) — no package needed
- `@supabase/supabase-js` (existing): Admin client (`service_role`) for all API-authenticated DB operations, bypassing RLS
- `zod@^4.3.6` (existing): Request body validation per route handler, already installed

### Expected Features

The OpenAPI spec already defines 10 endpoints and the full error/auth contract. Implementation is the bulk of the work. The API key management UI in settings is a table-stakes dashboard feature (Stripe, Resend, Vercel all follow the same pattern).

**Must have (table stakes):**
- API keys table with SHA-256 hashing, `vsl_` prefix, create/list/revoke UI — foundation for everything
- Show key once on creation, never again — industry standard
- Bearer token authentication on all `/api/v1/*` routes — non-negotiable for developer trust
- All 10 OpenAPI-specified endpoints working — a spec that returns 404s destroys trust immediately
- Rate limiting with `X-RateLimit-*` headers — developers build retry logic around these
- Credit enforcement with 402 + `x-credits-remaining` headers — required by existing spec
- Consistent structured JSON error responses — developers script against error codes

**Should have (competitive):**
- `last_used_at` timestamp per key — Resend popularized this pattern, low cost, high perceived value
- Multiple keys per user (cap at 10) — dev/staging/prod separation is the norm
- Key prefix display (`vsl_abc1...`) — lets users distinguish keys without exposing them
- Quick-start code snippets on key creation — reduces time-to-first-request

**Defer (v2+):**
- Scoped key permissions — 10-endpoint API does not need per-resource scopes yet
- Test mode / sandbox environment — free tier credits serve as the sandbox
- API key rotation with grace period — manual create-new + delete-old is sufficient at this scale
- Official SDK packages (npm/pip) — defer until API surface stabilizes

### Architecture Approach

The core pattern is a `withApiAuth` higher-order function that wraps every route handler, performing Bearer extraction, SHA-256 hash lookup (admin client), rate limit check, and error normalization before the handler runs. This ensures auth and rate limiting are never accidentally omitted. Below that, a service extraction step moves business logic from server actions into shared `src/lib/services/` functions that accept an explicit Supabase client and `userId` — making the same logic callable from both the cookie-authenticated web app and the Bearer-authenticated API without duplication. The middleware change (add early return for `/api/v1/*`) must be the first commit.

**Major components:**
1. `src/middleware.ts` (modify) — add early return for `/api/v1/*` before session refresh runs
2. `src/lib/api/auth.ts` (new) — `authenticateApiKey()` using admin client + `timingSafeEqual`
3. `src/app/api/v1/_lib/with-api-auth.ts` (new) — HOC: auth + rate limit + error handling wrapper
4. `src/lib/api/rate-limit.ts` (new) — Upstash sliding-window rate limiter, keyed by `key_id`
5. `src/lib/services/` (new) — extracted carousel, project, render services shared by server actions and route handlers
6. 10 route handler files under `src/app/api/v1/` — thin handlers calling `withApiAuth` + services
7. `supabase/migrations/007_api_keys.sql` (new) — `api_keys` table, partial index on `key_hash WHERE NOT revoked`, RLS for web UI
8. `src/app/(dashboard)/settings/api-keys/page.tsx` (new) — create/revoke/list UI following existing settings layout

### Critical Pitfalls

1. **Middleware redirects API requests to `/login`** — The existing middleware has no `/api/v1` exclusion; API consumers get 307 HTML redirects instead of 401 JSON. Must add early return for `/api/v1/*` as the very first change, before any route handler exists.

2. **`===` on hash comparison enables timing attacks** — Standard string equality leaks information about the correct hash via response time variance. Use `crypto.timingSafeEqual(Buffer.from(providedHash), Buffer.from(storedHash))` everywhere a hash is compared.

3. **Cookie-based Supabase client in route handlers silently returns empty data** — `createClient()` relies on `auth.uid()` via cookies; API requests have no session, so RLS blocks all queries. Use `createAdminClient()` (service role) and manually append `.eq('user_id', userId)` to every query.

4. **In-memory rate limiter does not work across serverless instances** — Vercel routes concurrent requests to different instances, each with a fresh Map. The existing `rate-limit.ts` even documents this. Replace with `@upstash/ratelimit` for all `/api/v1/*` traffic.

5. **API key plaintext in logs or error responses** — The Authorization header contains the raw key on every request. Log sanitization and immediate hashing on receipt must be established before any handler writes to stdout.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation — Auth, Middleware, Database

**Rationale:** Everything depends on the `api_keys` table and `withApiAuth` infrastructure. The middleware bypass is a one-line blocker that, if missing, causes 307 redirects for all API traffic. Security properties (timing-safe comparison, admin client pattern, log hygiene) must be established here so no subsequent implementation can accidentally regress them.

**Delivers:** Working API key lifecycle (create/list/revoke), authenticated request pipeline, safe infrastructure for all subsequent route handlers to plug into.

**Addresses:** API keys table, Create/List/Revoke UI, Bearer auth, middleware bypass, key management settings page.

**Avoids:** Middleware redirect pitfall, timing attack pitfall, RLS blocking pitfall, key leakage in logs, CDN caching (response helpers set correct headers from day one).

### Phase 2: Rate Limiting + Error Infrastructure

**Rationale:** The `withApiAuth` wrapper from Phase 1 has a stub for rate limiting. This phase fills it with Upstash Redis and establishes the canonical error response format. Both must be in place before any route handler is built so every endpoint gets rate limiting and consistent errors automatically.

**Delivers:** Distributed per-key rate limiting with sliding window, `X-RateLimit-*` headers on all responses, structured error responses matching the OpenAPI spec.

**Uses:** `@upstash/ratelimit@^2.0.8`, `@upstash/redis@^1.37.0`, `UPSTASH_REDIS_REST_URL`/`TOKEN` env vars.

**Implements:** `src/lib/api/rate-limit.ts` (Upstash), `src/app/api/v1/_lib/api-response.ts` (success/error helpers).

**Avoids:** In-memory rate limiter pitfall; enable `ephemeralCache: new Map()` in Ratelimit config to reduce Redis calls ~40%.

### Phase 3: Service Extraction

**Rationale:** Route handlers must call business logic without duplicating it from server actions. Extracting services first means route handlers are thin from the start — no copy-paste, no logic drift, no credit deduction inconsistencies.

**Delivers:** `carousel-service.ts`, `project-service.ts`, `render-service.ts` — shared functions callable by both existing server actions and new route handlers. Server actions become thin wrappers.

**Implements:** `src/lib/services/` directory; refactored `project/[id]/actions.ts` and `dashboard/actions.ts`.

**Avoids:** Business logic duplication anti-pattern; credit race condition (services call `deduct_credits` RPC directly, no pre-check bypass).

### Phase 4: REST Endpoints

**Rationale:** With auth, rate limiting, error formatting, and services in place, route handlers are thin boilerplate. Build read-only endpoints first (lower risk, no credit deduction) then mutations, then binary endpoints (render/download require Satori and Supabase Storage).

**Delivers:** All 10 OpenAPI-specified endpoints returning correct response shapes with proper headers.

**Addresses:** POST /carousel, GET+POST /projects, GET+DELETE /projects/:id, GET+PATCH /projects/:id/slides/:index, POST /projects/:id/render, GET /projects/:id/download, GET /projects/:id/download/:index.

**Avoids:** OpenAPI spec drift (validate response shapes against spec as each endpoint lands), CDN caching on authenticated GET endpoints.

### Phase 5: Validation + Polish

**Rationale:** End-to-end verification before declaring v2.2 complete. The "looks done but isn't" checklist from PITFALLS.md is the forcing function.

**Delivers:** Verified API with confirmed credit deduction, rate limit persistence across Vercel instances, spec accuracy, CORS headers, Content-Type correctness, full checklist passing.

**Avoids:** Spec drift (integration test suite validates response shapes), credit race condition (load test: 10 concurrent requests against 1 credit, verify exactly 1 succeeds), in-memory rate limiter shipping to production.

### Phase Ordering Rationale

- **Foundation first:** The middleware bypass must precede any route handler. Auth must precede rate limiting. Both must precede service extraction. Services must precede route handlers. This is a strict dependency chain.
- **Service extraction before route handlers:** Avoids copy-paste anti-pattern that causes business logic to drift. The refactor cost is mechanical (move logic, add explicit params).
- **Security properties in Phase 1:** Timing-safe comparison, admin client pattern, and log hygiene cannot be retrofitted — they must be structural from the start.
- **Rate limiting before endpoints:** The `withApiAuth` wrapper must have a complete rate limit implementation before Phase 4 so every endpoint automatically inherits it.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 4 (REST endpoints):** The render and download endpoints depend on existing Satori/ImageResponse rendering and Supabase Storage integration. Confirm the exact surface area of those integrations in the codebase before estimating task effort.
- **Phase 5 (Validation):** Load testing with concurrent credit deduction and Vercel preview behavior (rate limit persistence across instances) may surface surprises. Define the test protocol before planning tasks.

Phases with standard patterns (skip research-phase):

- **Phase 1 (Auth/DB):** SHA-256 hashing, `timingSafeEqual`, Supabase admin client, and numbered SQL migrations are well-documented patterns with verified codebase examples.
- **Phase 2 (Rate limiting):** Upstash ratelimit sliding window setup is fully documented; no novel patterns.
- **Phase 3 (Service extraction):** Mechanical refactor — no novel patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Only 2 new packages; both verified on npm. All other capabilities are built-in or already installed. Exact versions confirmed. |
| Features | HIGH | Grounded in the existing OpenAPI spec (`src/lib/api/openapi.ts`) and competitor analysis (Stripe, OpenAI, Resend, Vercel). 10 endpoints are fully defined. |
| Architecture | HIGH | Based directly on verified codebase files — middleware.ts, admin.ts, openapi.ts, credits RPC. No speculative patterns. |
| Pitfalls | HIGH | All 8 pitfalls grounded in either codebase verification or official Next.js 15 / Supabase / Upstash documentation. |

**Overall confidence:** HIGH

### Gaps to Address

- **Upstash account/credentials:** Research assumes Upstash Redis is provisioned. If not yet set up, account creation and env var configuration should be a task in Phase 2.
- **CORS policy:** PITFALLS.md flags that CORS headers are needed for cross-origin API clients. The exact `Access-Control-Allow-Origin` policy (all origins vs. specific) should be decided during Phase 1 when the response helper is built.
- **Render endpoint caching strategy:** The download endpoints could re-render from scratch on every request. PITFALLS.md notes this as a performance trap (cache in Supabase Storage with content hash). The exact caching implementation is not detailed in any research file — needs design in Phase 4.
- **Tier-based rate limit values:** STACK.md proposes 60/200/600 req/min for free/plus/pro. These are unvalidated conventions, not benchmarked values. Treat as starting defaults.

## Sources

### Primary (HIGH confidence)
- Codebase: `src/lib/api/openapi.ts` — existing OpenAPI 3.1 spec with all 10 endpoints, auth scheme, error codes
- Codebase: `src/middleware.ts` — confirmed `/api/v1` is NOT currently excluded
- Codebase: `src/lib/rate-limit.ts` — confirmed in-memory Map with documented serverless caveat
- Codebase: `src/lib/supabase/admin.ts` — confirmed admin client exists
- Codebase: `supabase/migrations/005_credit_system.sql` — confirmed `deduct_credits` RPC with `pg_advisory_xact_lock`
- [Upstash Ratelimit docs](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview) — sliding window, ephemeral cache
- [Next.js 15 Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) — caching behavior, params as Promise
- [Supabase RLS and Service Role](https://supabase.com/docs/guides/database/postgres/row-level-security) — bypass pattern

### Secondary (MEDIUM confidence)
- [Stripe API Keys docs](https://docs.stripe.com/keys) — competitor pattern for show-once, naming, prefix format
- [Resend API Keys docs](https://resend.com/docs/dashboard/api-keys/introduction) — last-used timestamp pattern
- [Vercel Tokens docs](https://vercel.com/docs/sign-in-with-vercel/tokens) — token format conventions
- [Node.js crypto.timingSafeEqual](https://nodejs.org/api/crypto.html) — timing-safe comparison

### Tertiary (LOW confidence)
- Tier-based rate limit values (60/200/600 req/min) — proposed based on general SaaS conventions, not benchmarked

---
*Research completed: 2026-04-08*
*Ready for roadmap: yes*
