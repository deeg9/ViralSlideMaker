# Stack Research: v2.2 Public REST API

**Domain:** Per-user API key management + REST API routes for existing Next.js 15 SaaS
**Researched:** 2026-04-08
**Confidence:** HIGH

## Context

This is a SUBSEQUENT milestone. The existing stack (Next.js 15.5.13, React 19, Supabase, Stripe, Zod 4) is validated and shipping. This research covers ONLY the new packages and patterns needed for API key management, Bearer token auth, and Upstash Redis rate limiting.

## New Dependencies to Add

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@upstash/redis` | ^1.37.0 | Redis client for serverless | HTTP-based, no persistent connections. Works in Vercel Edge and serverless. Already planned in project constraints. |
| `@upstash/ratelimit` | ^2.0.8 | Per-key rate limiting | Purpose-built for serverless rate limiting on Upstash Redis. Provides sliding window, fixed window, and token bucket algorithms out of the box. Eliminates the in-memory rate limiter's multi-instance problem. |

### Zero-Dependency Solutions (Already Available)

| Capability | Solution | Why No Package Needed |
|------------|----------|----------------------|
| SHA-256 key hashing | Node.js `crypto` module (`crypto.createHash('sha256')`) | Built into Node.js runtime. Available in Next.js route handlers. No external package required. |
| API key generation | Node.js `crypto.randomBytes(32)` | Generates cryptographically secure random bytes. Prefix with `vsl_` and hex-encode for the user-facing key. |
| UUID generation | `crypto.randomUUID()` | Built into Node.js 19+ (already using Node.js compatible with Next.js 15). |
| Request validation | `zod` ^4.3.6 (already installed) | Already in use. Define Zod schemas for each API route's request body and query params. |
| OpenAPI spec | Hand-written (already at `src/lib/api/openapi.ts`) | Already defined with all 10 endpoints, Bearer auth scheme, error responses, and rate limit headers. |

## Existing Stack (DO NOT Re-add)

These are already installed and working. Listed for integration context only:

| Package | Version | Role in v2.2 |
|---------|---------|-------------|
| `@supabase/supabase-js` | ^2.99.3 | Service role client for API key lookups (bypasses RLS) |
| `@supabase/ssr` | ^0.9.0 | Session auth for the key management UI (settings page) |
| `zod` | ^4.3.6 | Request body validation in route handlers |
| `@scalar/nextjs-api-reference` | ^0.10.6 | API docs playground at /docs |
| `next` | 15.5.13 | Route handlers at `src/app/api/v1/` |

## Installation

```bash
# New dependencies (only 2 packages)
npm install @upstash/redis@^1.37.0 @upstash/ratelimit@^2.0.8
```

No new dev dependencies needed.

## Environment Variables to Add

```env
# Upstash Redis (get from Upstash console)
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

## Architecture Decisions

### API Key Hashing: Node.js `crypto` (not bcrypt, not argon2)

**Use `crypto.createHash('sha256')`** because:
- API keys are high-entropy random strings (32 bytes), not user-chosen passwords. Brute-force is computationally infeasible.
- SHA-256 is fast, which matters for every authenticated API request (bcrypt at ~100ms would be unacceptable).
- SHA-256 is deterministic, enabling direct DB lookups: `SELECT * FROM api_keys WHERE key_hash = $1`.
- No salt needed for high-entropy keys (unlike passwords).
- This is the standard pattern used by Stripe, GitHub, and every major API provider.

**Do NOT use bcrypt/argon2** -- those are for low-entropy passwords. Using them for API keys adds latency with zero security benefit.

### Rate Limiting: @upstash/ratelimit Sliding Window

**Use sliding window algorithm** because:
- The in-memory rate limiter (`src/lib/rate-limit.ts`) breaks across serverless instances -- each cold start gets a fresh Map.
- Upstash Ratelimit's sliding window provides smooth rate limiting without burst spikes at window boundaries.
- Per-key limiting: use the hashed API key as the identifier, not IP address.
- Different limits per tier: create separate Ratelimit instances for free/plus/pro tiers.

```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv() // reads UPSTASH_REDIS_REST_URL + TOKEN

// Tier-specific rate limiters
export const rateLimiters = {
  free: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m') }),
  plus: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(200, '1 m') }),
  pro:  new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(600, '1 m') }),
}
```

### Bearer Token Auth: Route Handler Helper (not middleware)

**Use a shared auth helper function** called at the top of each route handler, rather than trying to authenticate in Next.js middleware.

Rationale:
- Next.js middleware runs on the Edge Runtime, which has limitations with some Node.js APIs.
- Route handlers run in Node.js runtime with full access to `crypto` module.
- Keeps auth logic co-located with route logic for easier debugging.
- The existing middleware (`src/middleware.ts`) just needs to skip Supabase session auth for `/api/v1/*` routes.

Pattern:
```typescript
// src/lib/api/auth.ts
export async function authenticateApiKey(request: Request): Promise<ApiKeyContext | ApiError> {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer vsl_')) return { error: 'UNAUTHORIZED' }
  
  const token = header.slice(7) // strip "Bearer "
  const hash = crypto.createHash('sha256').update(token).digest('hex')
  
  // Lookup with service role client (bypasses RLS)
  const { data } = await supabaseAdmin
    .from('api_keys')
    .select('user_id, revoked_at')
    .eq('key_hash', hash)
    .single()
  
  if (!data || data.revoked_at) return { error: 'UNAUTHORIZED' }
  return { userId: data.user_id, keyHash: hash }
}
```

### Supabase Migration: Numbered SQL Files

**Use the existing pattern:** numbered SQL files in `supabase/migrations/`. The project already has `002_` through `006_`. The API keys table will be `007_api_keys.sql`.

Key table design:
```sql
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,        -- SHA-256 hex of full vsl_xxx key
  key_prefix TEXT NOT NULL,             -- First 8 chars for display (vsl_abc1...)
  name TEXT NOT NULL DEFAULT 'Default', -- User-assigned label
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ               -- NULL = active, set = revoked
);

CREATE INDEX api_keys_key_hash_idx ON public.api_keys(key_hash) WHERE revoked_at IS NULL;
CREATE INDEX api_keys_user_id_idx ON public.api_keys(user_id);
```

RLS policy: users can only see/manage their own keys via the dashboard. API key lookups in route handlers use the service role client to bypass RLS (since Bearer token requests have no Supabase session).

### Request Validation: Zod 4 Schemas

Zod 4 is already installed (^4.3.6). Define request schemas per route, matching the existing OpenAPI spec at `src/lib/api/openapi.ts`. Validate at the top of each route handler. Return structured errors matching the OpenAPI `ErrorResponse` schema.

### Credit Deduction for API Calls

Reuse the existing `deduct_credits` Postgres RPC function from `005_credit_system.sql`. Add a new transaction type `'api_carousel_generation'` to the CHECK constraint via an ALTER in the new migration. The atomic advisory-lock pattern already handles concurrent deductions correctly.

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `@upstash/ratelimit` | `rate-limiter-flexible` | Requires a persistent Redis connection (not HTTP). Upstash's HTTP client is purpose-built for serverless. |
| `@upstash/ratelimit` | Vercel KV (`@vercel/kv`) | Vercel KV is Upstash under the hood but with markup pricing and vendor lock-in to Vercel. Using Upstash directly is cheaper and portable. |
| `@upstash/redis` | `ioredis` / `redis` | Require persistent TCP connections incompatible with serverless cold starts. |
| Node.js `crypto` | `nanoid` for key generation | nanoid adds a dependency for something `crypto.randomBytes` does natively. |
| SHA-256 hash | HMAC-SHA256 | HMAC adds a server secret, providing defense if the DB is leaked. Worth considering but adds key management complexity. SHA-256 is sufficient for 256-bit random keys. |
| Numbered SQL files | Supabase CLI migrations | Project doesn't use `supabase init` / `config.toml`. Stick with the existing manual numbered file pattern. |
| Route handler auth | Middleware-level auth | Edge Runtime limitations, harder to debug, separates auth from route logic. |

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `bcrypt` / `argon2` | Designed for low-entropy passwords. API keys are high-entropy; SHA-256 is correct and fast. | Node.js `crypto.createHash('sha256')` |
| `passport.js` / `next-auth` | Massive overkill for Bearer token auth. Just hash a token and look it up. | 20-line auth helper function |
| `ioredis` / `redis` | Require persistent TCP connections incompatible with serverless. | `@upstash/redis` (HTTP-based) |
| `express-rate-limit` | Express middleware, not compatible with Next.js App Router route handlers. | `@upstash/ratelimit` |
| `jose` / `jsonwebtoken` | JWT-based API auth adds token expiry, refresh, and revocation complexity. API keys with DB lookup are simpler and revocable instantly. | SHA-256 hashed API keys in Postgres |
| `uuid` package | `crypto.randomUUID()` is built into the runtime. | Built-in `crypto.randomUUID()` |
| `@upstash/redis` for caching | Out of scope for this milestone. Redis is only for rate limiting. | Do not add caching concerns yet. |
| `zod-to-openapi` / `@asteasolutions/zod-to-openapi` | OpenAPI spec already hand-written and complete. Auto-generation adds complexity without benefit for 10 endpoints. | Keep hand-written spec at `src/lib/api/openapi.ts` |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@upstash/redis@^1.37.0` | Next.js 15, Edge Runtime, Node.js 18+ | HTTP-based, no native deps. Works everywhere. |
| `@upstash/ratelimit@^2.0.8` | `@upstash/redis@^1.34.0+` | Peer dependency on @upstash/redis. Both maintained by Upstash. |
| `zod@^4.3.6` | Already installed | Zod 4 has breaking changes from Zod 3 (new import paths). Already on Zod 4 so no migration needed. |

## File Structure for New Code

```
src/
  lib/
    api/
      openapi.ts          # EXISTS -- OpenAPI 3.1 spec
      auth.ts             # NEW: Bearer token extraction + key hash lookup
      rate-limit.ts       # NEW: Upstash-based per-key rate limiter
      errors.ts           # NEW: Structured error responses matching OpenAPI spec
      schemas.ts          # NEW: Zod schemas for all route request/response bodies
      with-api-auth.ts    # NEW: Wrapper combining auth + rate limit + error handling
  app/
    api/
      v1/
        carousel/route.ts           # POST /api/v1/carousel
        templates/route.ts          # GET /api/v1/templates
        projects/route.ts           # GET, POST /api/v1/projects
        projects/[id]/route.ts      # GET, DELETE /api/v1/projects/:id
        projects/[id]/slides/[index]/route.ts  # GET, PATCH
        projects/[id]/render/route.ts          # POST
        projects/[id]/download/route.ts        # GET (ZIP)
        projects/[id]/download/[index]/route.ts # GET (single PNG)
    (dashboard)/
      settings/
        api-keys/page.tsx  # NEW: API key management UI
  lib/
    rate-limit.ts         # EXISTS -- in-memory limiter (keep for non-API routes, or replace entirely)
supabase/
  migrations/
    007_api_keys.sql       # NEW: api_keys table + RLS + indexes
```

## Sources

- [@upstash/ratelimit on npm](https://www.npmjs.com/package/@upstash/ratelimit) -- version 2.0.8 confirmed
- [@upstash/redis on npm](https://www.npmjs.com/package/@upstash/redis) -- version 1.37.0 confirmed
- [Upstash Ratelimit documentation](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview) -- sliding window API reference
- [Rate limiting Next.js with Upstash](https://upstash.com/blog/nextjs-ratelimiting) -- Next.js integration patterns
- Existing codebase: `src/lib/rate-limit.ts` (in-memory limiter to replace), `src/lib/api/openapi.ts` (spec to implement), `supabase/migrations/005_credit_system.sql` (migration pattern), `src/middleware.ts` (needs `/api/v1/*` bypass)

---
*Stack research for: v2.2 Public REST API*
*Researched: 2026-04-08*
