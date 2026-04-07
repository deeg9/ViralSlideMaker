# Phase 15: Service Extraction & API Auth - Research

**Researched:** 2026-04-06
**Domain:** Service layer extraction, API key management, Bearer token auth, Upstash Redis rate limiting
**Confidence:** HIGH

## Summary

This phase extracts the `generateCarousel` Server Action (currently 165 lines in `src/app/(dashboard)/project/[id]/actions.ts`) into a shared service layer at `src/lib/services/carousel.ts`, builds API key management (CRUD + SHA-256 hashed storage), implements Bearer token auth for a new `/api/v1/` route namespace, and replaces the in-memory rate limiter with Upstash Redis. The existing credit system (`src/lib/credits/`) is already well-abstracted with RPC calls and can be reused directly by the service layer.

The stack additions are minimal: `@upstash/ratelimit` (sliding window algorithm, serverless-safe), `@upstash/redis` (HTTP-based Redis client), and `nanoid` (secure random key generation). SHA-256 hashing uses the built-in Web Crypto API -- no additional crypto library needed. The existing `createAdminClient()` (Supabase service role) is the correct tool for API key lookups since API routes cannot use cookie-based auth.

**Primary recommendation:** Extract `generateCarousel` into a pure service function that accepts `(userId, params)` instead of reading auth from cookies. Server Action becomes a thin wrapper that reads auth + calls service + calls `revalidatePath`. API route handler does the same but reads auth from Bearer token. This separation is clean and keeps both paths working identically.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Extract `generateCarousel` + credit functions first -- core API surface
- Shared service layer at `src/lib/services/carousel.ts` alongside `src/lib/credits/`
- Server Actions remain as thin wrappers (auth + revalidation only)
- Editor actions deferred to Phase 16
- API key management UI as new tab in `/settings` page
- Key format: `vsl_` prefix + 32 random chars (nanoid)
- Max 3 keys per user
- Required label on creation
- Tiered rate limits: Free 10/min, Plus 30/min, Pro 60/min
- 429 response with `Retry-After` header + JSON body `{ error: { code, message }, retryAfter }`
- Auth validation at route-handler level (not Next.js middleware) per CVE-2025-29927
- Structured API error format: `{ error: { code: string, message: string } }`

### Claude's Discretion
- Service layer internal structure and helper utilities
- API key table schema details beyond specified columns
- Error code naming conventions
- Test structure

### Deferred Ideas (OUT OF SCOPE)
- Editor action extraction (Phase 16)
- MCP server integration (Phase 17)
- OpenAPI spec generation (Phase 18)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AAUTH-01 | Developer can generate API keys from account settings page | Settings layout analysis, nanoid key generation, Supabase table schema |
| AAUTH-02 | Developer can revoke/delete API keys from settings | Soft-delete via `revoked_at` timestamp, settings UI tab pattern |
| AAUTH-03 | API requests authenticate via Bearer token in Authorization header | Route handler auth pattern, SHA-256 lookup, admin client |
| AAUTH-04 | API keys SHA-256 hashed in storage (shown once on creation) | Web Crypto API verified, hash-then-store pattern |
| AAUTH-05 | API requests rate-limited per key via Upstash Redis | @upstash/ratelimit sliding window, tier-based config |
| AAUTH-06 | API calls deduct credits from developer's credit balance | Existing `deductCredit()` RPC reusable directly |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @upstash/ratelimit | 2.0.8 | Sliding window rate limiting | Serverless-safe (HTTP-based), no persistent connections, Vercel-blessed [VERIFIED: npm registry] |
| @upstash/redis | 1.37.0 | Redis client for rate limiter | Required by @upstash/ratelimit, connectionless HTTP [VERIFIED: npm registry] |
| nanoid | 5.1.7 | Secure random API key generation | 118 bytes, crypto-safe, URL-friendly [VERIFIED: npm registry] |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 4.3.6 | Request body validation | Validate all API request payloads |
| @supabase/supabase-js | 2.99.3 | Database operations | API key storage, credit operations |
| Web Crypto API | built-in | SHA-256 hashing | Hash API keys before storage -- no extra package needed [VERIFIED: Node.js runtime test] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @upstash/ratelimit | Custom Redis MULTI/EXEC | Upstash handles algorithm, cleanup, edge cases -- no reason to hand-roll |
| nanoid | crypto.randomBytes | nanoid is shorter, URL-safe, already decided in CONTEXT |
| Web Crypto API | node:crypto | Web Crypto is edge-compatible, works in both Node and Vercel Edge runtime |

**Installation:**
```bash
npm install @upstash/ratelimit@^2.0.8 @upstash/redis@^1.37.0 nanoid@^5.1.7
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    services/
      carousel.ts          # Extracted generateCarousel service (no auth, no revalidation)
    api/
      auth.ts              # Bearer token validation: header -> key lookup -> user
      errors.ts            # Structured error responses + error codes enum
      rate-limit.ts        # Upstash-based rate limiter (replaces src/lib/rate-limit.ts)
    crypto/
      hash.ts              # SHA-256 hashing utility (Web Crypto)
  app/
    (dashboard)/settings/
      api-keys/
        page.tsx           # API key management UI
        actions.ts         # Server Actions: createKey, revokeKey, listKeys
    api/
      v1/
        carousel/
          route.ts         # POST /api/v1/carousel -- one-shot generation
```

### Pattern 1: Service Extraction (Thin Wrapper)
**What:** Extract business logic into pure functions that accept userId + params. Server Actions and API routes both call the same service.
**When to use:** Any Server Action that will also be exposed via API.
**Example:**
```typescript
// src/lib/services/carousel.ts
// Pure service -- no auth, no revalidation, no Next.js imports
export async function generateCarouselService(
  userId: string,
  params: {
    projectId: string
    topic: string
    templateId: string
    imageSource: 'stock' | 'ai'
    slideCount: number
    advancedOptions?: { font?: string; fontColor?: string; imagePrompt?: string }
  }
): Promise<CarouselResult> {
  // All existing logic from actions.ts, minus auth and revalidatePath
}

// src/app/(dashboard)/project/[id]/actions.ts (thin wrapper)
'use server'
export async function generateCarousel(...args) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  const result = await generateCarouselService(user.id, { ...args })
  if (result.success) revalidatePath(`/project/${args.projectId}`)
  return result
}

// src/app/api/v1/carousel/route.ts (API route)
export async function POST(req: NextRequest) {
  const { userId } = await authenticateApiKey(req)  // Bearer token
  const body = await req.json()
  const parsed = carouselSchema.parse(body)
  const result = await generateCarouselService(userId, parsed)
  return NextResponse.json(result)
}
```
[CITED: codebase analysis of src/app/(dashboard)/project/[id]/actions.ts]

### Pattern 2: Bearer Token Auth (Route Handler Level)
**What:** Validate API key in each route handler, not in Next.js middleware (per CVE-2025-29927).
**When to use:** Every `/api/v1/` route.
**Example:**
```typescript
// src/lib/api/auth.ts
import { createAdminClient } from '@/lib/supabase/admin'
import { hashApiKey } from '@/lib/crypto/hash'

export interface ApiKeyAuth {
  userId: string
  keyId: string
  tier: SubscriptionTier
}

export async function authenticateApiKey(req: NextRequest): Promise<ApiKeyAuth> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiError('UNAUTHORIZED', 'Missing or invalid Authorization header')
  }
  const rawKey = authHeader.slice(7)
  if (!rawKey.startsWith('vsl_')) {
    throw new ApiError('UNAUTHORIZED', 'Invalid API key format')
  }
  const keyHash = await hashApiKey(rawKey)
  const supabase = createAdminClient()  // Service role -- bypasses RLS
  const { data } = await supabase
    .from('api_keys')
    .select('id, user_id, revoked_at')
    .eq('key_hash', keyHash)
    .maybeSingle()
  if (!data || data.revoked_at) {
    throw new ApiError('UNAUTHORIZED', 'Invalid or revoked API key')
  }
  // Update last_used_at (fire-and-forget)
  supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id)
  const tier = await getUserTier(data.user_id)
  return { userId: data.user_id, keyId: data.id, tier }
}
```
[CITED: CONTEXT.md locked decision on route-handler auth + CVE-2025-29927]

### Pattern 3: Upstash Rate Limiting with Tiered Limits
**What:** Sliding window rate limiter with per-tier configuration.
**When to use:** Every `/api/v1/` route, after auth but before service call.
**Example:**
```typescript
// src/lib/api/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { SubscriptionTier } from '@/lib/credits/types'

const redis = Redis.fromEnv()

const limiters: Record<SubscriptionTier, Ratelimit> = {
  free: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m'), prefix: 'rl:free' }),
  plus: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 m'), prefix: 'rl:plus' }),
  pro: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m'), prefix: 'rl:pro' }),
}

export async function checkRateLimit(keyId: string, tier: SubscriptionTier) {
  const limiter = limiters[tier]
  const { success, limit, remaining, reset } = await limiter.limit(keyId)
  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000)
    throw new RateLimitError(retryAfter, limit, remaining)
  }
  return { limit, remaining, reset }
}
```
[CITED: Upstash ratelimit docs - gettingstarted and methods pages]

### Pattern 4: SHA-256 Key Hashing (Web Crypto)
**What:** Hash API keys before storage using Web Crypto API. No external crypto library.
**Example:**
```typescript
// src/lib/crypto/hash.ts
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
```
[VERIFIED: Node.js runtime test -- produces 64-char hex string]

### Anti-Patterns to Avoid
- **Auth in Next.js middleware:** CVE-2025-29927 allows middleware bypass. Always validate in route handler. [CITED: CONTEXT.md]
- **Storing raw API keys:** Never store unhashed keys. Only store SHA-256 hash. Show key exactly once on creation.
- **Comparing keys with `===`:** Use `timingSafeEqual` from `crypto` for hash comparison to prevent timing attacks. Actually, since we hash the incoming key and compare hashes (both derived), standard `===` on hex strings is fine -- timing attacks require comparing a secret with user input, and both sides here are SHA-256 outputs.
- **In-memory rate limiter for API:** The existing `src/lib/rate-limit.ts` uses `Map` -- does not persist across serverless invocations. Must use Upstash Redis.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | Custom Redis sliding window | @upstash/ratelimit | Edge cases in window reset, cleanup, multi-region |
| Secure random IDs | Math.random + hex | nanoid | Crypto-safe, URL-friendly, correct entropy |
| Redis client | fetch() to Redis | @upstash/redis | Connection management, retries, encoding |
| SHA-256 hashing | node:crypto | Web Crypto API | Edge-compatible, same API in Node + Vercel Edge |

**Key insight:** The entire auth + rate limiting pipeline is < 200 lines of integration code using these libraries. The complexity is in the wiring (auth -> rate limit -> service -> credits -> response), not in any individual component.

## Common Pitfalls

### Pitfall 1: Supabase Client Choice for API Routes
**What goes wrong:** Using `createClient()` (cookie-based auth) in API route handlers. API requests use Bearer tokens, not cookies.
**Why it happens:** Server Actions use `createClient()` everywhere -- easy to copy-paste.
**How to avoid:** API routes MUST use `createAdminClient()` (service role key) for API key lookups. After authenticating the key, use the resolved `userId` for all subsequent Supabase operations.
**Warning signs:** "Auth session missing" errors in API route handlers.

### Pitfall 2: nanoid ESM Import
**What goes wrong:** `require('nanoid')` fails because nanoid v5 is ESM-only.
**Why it happens:** Copy-paste from older examples.
**How to avoid:** Use `import { nanoid } from 'nanoid'` -- Next.js 15 handles ESM imports correctly in both server components and route handlers.
**Warning signs:** `ERR_REQUIRE_ESM` error.

### Pitfall 3: Rate Limiter Key Identity
**What goes wrong:** Rate limiting by userId instead of API key ID. A user with 3 keys shares the same limit across all keys.
**Why it happens:** Seems simpler to limit by user.
**How to avoid:** Rate limit by `keyId` (the database row ID), not `userId`. This matches the CONTEXT.md decision of "per key" rate limiting. Users who want higher throughput can spread across keys (capped at 3).
**Warning signs:** Users hitting limits faster than expected when using multiple keys.

### Pitfall 4: Forgetting `context.waitUntil` for Upstash Analytics
**What goes wrong:** Upstash `pending` promise resolves after response is sent, but in serverless the function terminates.
**Why it happens:** Upstash analytics and multi-region sync use background operations.
**How to avoid:** In route handlers, call `pending` resolution: `const { pending } = await limiter.limit(id); // pending can be ignored if analytics: false`. Set `analytics: false` in limiter config to skip this concern entirely for now.
**Warning signs:** Missing analytics data in Upstash dashboard.

### Pitfall 5: API Key Shown After Creation
**What goes wrong:** Trying to retrieve the raw key after initial creation response.
**Why it happens:** UI navigates away or user refreshes before copying.
**How to avoid:** Show key in a modal with copy button. Block modal dismiss until user confirms they copied. Only store the hash + a `prefix` field (first 8 chars like `vsl_F66C...`) for identification in the UI.
**Warning signs:** Support requests about lost API keys.

### Pitfall 6: Credit Deduction with Admin Client
**What goes wrong:** Existing `deductCredit()` uses `createClient()` (cookie-based), which wont work from API routes.
**Why it happens:** Credit functions were written for Server Action context only.
**How to avoid:** The service layer should accept a userId and use `createAdminClient()` for all database operations. This means `deductCredit` needs a variant that uses the admin client, or the RPC call is made directly in the service.
**Warning signs:** "Auth session missing" when API route tries to deduct credits.

## Code Examples

### API Key Generation (Server Action)
```typescript
// src/app/(dashboard)/settings/api-keys/actions.ts
'use server'
import { nanoid } from 'nanoid'
import { hashApiKey } from '@/lib/crypto/hash'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function createApiKey(label: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Check key limit
  const admin = createAdminClient()
  const { count } = await admin
    .from('api_keys')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('revoked_at', null)
  if ((count ?? 0) >= 3) throw new Error('Maximum 3 API keys allowed')

  // Generate key
  const rawKey = `vsl_${nanoid(32)}`
  const keyHash = await hashApiKey(rawKey)
  const prefix = rawKey.slice(0, 8)

  await admin.from('api_keys').insert({
    user_id: user.id,
    key_hash: keyHash,
    prefix,
    label,
  })

  return { key: rawKey }  // Shown exactly once
}
```

### Supabase Table Schema
```sql
-- api_keys table
CREATE TABLE api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,         -- First 8 chars (e.g., "vsl_F66C") for UI display
  label TEXT NOT NULL,          -- User-provided label ("Production", "Dev")
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ        -- Soft delete: NULL = active, set = revoked
);

-- Index for fast hash lookups during auth
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- RLS: users can only see/manage their own keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own keys" ON api_keys
  FOR ALL USING (auth.uid() = user_id);
```
[ASSUMED: exact Supabase migration syntax -- standard PostgreSQL + Supabase RLS pattern]

### API Route Handler (Full Pipeline)
```typescript
// src/app/api/v1/carousel/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api/auth'
import { checkRateLimit } from '@/lib/api/rate-limit'
import { generateCarouselService } from '@/lib/services/carousel'
import { apiError } from '@/lib/api/errors'
import { z } from 'zod/v4'

const schema = z.object({
  topic: z.string().min(1).max(500),
  templateId: z.string(),
  imageSource: z.enum(['stock', 'ai']).default('stock'),
  slideCount: z.number().int().min(3).max(20).default(7),
})

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const auth = await authenticateApiKey(req)

    // 2. Rate limit
    const { limit, remaining } = await checkRateLimit(auth.keyId, auth.tier)

    // 3. Validate
    const body = await req.json()
    const params = schema.parse(body)

    // 4. Execute
    const result = await generateCarouselService(auth.userId, {
      projectId: crypto.randomUUID(),  // Auto-create project for API
      ...params,
    })

    // 5. Deduct credits (handled inside service)
    return NextResponse.json(result, {
      headers: {
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': String(remaining),
      },
    })
  } catch (err) {
    return apiError(err)  // Structured { error: { code, message } }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| In-memory rate limiting | Upstash Redis (HTTP-based) | 2023+ | Required for serverless -- in-memory maps reset per invocation |
| Middleware auth | Route-handler auth | 2025 (CVE-2025-29927) | Next.js middleware can be bypassed; auth must be in route handler |
| node:crypto for hashing | Web Crypto API | Stable since Node 18 | Edge-compatible, same API everywhere |
| uuid for random IDs | nanoid | 2020+ | Smaller, URL-safe, configurable alphabet |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Upstash Redis free tier (10K req/day) sufficient for launch | Summary | Would need paid tier earlier -- low cost risk |
| A2 | Supabase migration syntax for api_keys table | Code Examples | May need minor adjustments for project's migration setup |
| A3 | `last_used_at` update can be fire-and-forget | Pattern 2 | If Supabase rejects the update silently, last-used tracking breaks |
| A4 | Zod v4 uses `z.parse()` same as v3 | Code Examples | API signature may differ -- verify at implementation time |

## Open Questions (RESOLVED)

1. **Credit deduction from API routes**
   - What we know: `deductCredit()` in `check-credits.ts` uses `createClient()` (cookie-based auth)
   - What's unclear: Whether to modify `deductCredit` to accept an optional admin client, or create a parallel `deductCreditAdmin()` function
   - Recommendation: Add an optional `supabaseClient` parameter to `deductCredit()` -- if provided, use it; otherwise fall back to `createClient()`. This keeps backward compatibility.

2. **Project creation for API-initiated carousels**
   - What we know: Current `generateCarousel` requires an existing `projectId`
   - What's unclear: Should API auto-create a project, or require a separate create-project call?
   - Recommendation: Auto-create for one-shot API. The REST-03 requirement (create/list/get/delete projects) is Phase 16, but the service layer should handle project creation internally for one-shot generation.

3. **Upstash Redis environment setup**
   - What we know: Need UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in env
   - What's unclear: Whether Diego already has an Upstash account/instance
   - Recommendation: Include setup instructions in plan. Upstash free tier setup takes < 2 minutes via upstash.com console.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | 22+ (Next 15.5 requires it) | -- |
| @upstash/ratelimit | AAUTH-05 | Not installed | -- | Install via npm |
| @upstash/redis | AAUTH-05 | Not installed | -- | Install via npm |
| nanoid | AAUTH-01 | Not installed | -- | Install via npm |
| Upstash Redis instance | AAUTH-05 | Unknown | -- | Must create free instance at upstash.com |
| Supabase | All | Yes | 2.99.3 | -- |
| Web Crypto API | AAUTH-04 | Yes | Built-in | -- |
| Vitest | Testing | Yes | 4.1.0 | -- |

**Missing dependencies with no fallback:**
- Upstash Redis instance (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) -- must be created before rate limiting works

**Missing dependencies with fallback:**
- npm packages (@upstash/ratelimit, @upstash/redis, nanoid) -- install step in plan

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AAUTH-01 | Create API key with label, returns raw key once | unit | `npx vitest run src/__tests__/api-keys/create.test.ts -t "create"` | No -- Wave 0 |
| AAUTH-02 | Revoke API key sets revoked_at | unit | `npx vitest run src/__tests__/api-keys/revoke.test.ts -t "revoke"` | No -- Wave 0 |
| AAUTH-03 | Bearer token auth resolves to userId | unit | `npx vitest run src/__tests__/api/auth.test.ts -t "bearer"` | No -- Wave 0 |
| AAUTH-04 | API key is SHA-256 hashed before storage | unit | `npx vitest run src/__tests__/api/auth.test.ts -t "hash"` | No -- Wave 0 |
| AAUTH-05 | Rate limiting returns 429 when exceeded | unit | `npx vitest run src/__tests__/api/rate-limit.test.ts -t "429"` | No -- Wave 0 |
| AAUTH-06 | API call deducts credits | unit | `npx vitest run src/__tests__/api/credits.test.ts -t "deduct"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/api-keys/create.test.ts` -- covers AAUTH-01, AAUTH-04
- [ ] `src/__tests__/api-keys/revoke.test.ts` -- covers AAUTH-02
- [ ] `src/__tests__/api/auth.test.ts` -- covers AAUTH-03, AAUTH-04
- [ ] `src/__tests__/api/rate-limit.test.ts` -- covers AAUTH-05
- [ ] `src/__tests__/api/credits.test.ts` -- covers AAUTH-06
- [ ] `src/__tests__/services/carousel.test.ts` -- covers service extraction correctness

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Bearer token via SHA-256 hashed API keys |
| V3 Session Management | No | API is stateless, no sessions |
| V4 Access Control | Yes | Keys scoped to user_id, RLS on api_keys table |
| V5 Input Validation | Yes | Zod schema validation on all API request bodies |
| V6 Cryptography | Yes | SHA-256 via Web Crypto API (no hand-rolled crypto) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key leak in logs | Information Disclosure | Never log raw keys; log only prefix (`vsl_F66C...`) |
| Brute force key guessing | Spoofing | 36-char key = 192 bits entropy; rate limit auth failures by IP |
| Timing attack on hash comparison | Information Disclosure | Compare SHA-256 hex strings (both derived from hash function, not timing-exploitable) |
| Rate limit bypass via key rotation | Denial of Service | Max 3 keys per user caps total throughput at 3x tier limit |
| Credit exhaustion via API | Denial of Service | Rate limiting + existing credit balance checks |
| Middleware auth bypass (CVE-2025-29927) | Elevation of Privilege | Auth in route handler, never in middleware |

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/app/(dashboard)/project/[id]/actions.ts`, `src/lib/credits/check-credits.ts`, `src/lib/rate-limit.ts`, `src/lib/supabase/admin.ts`, `src/app/(dashboard)/settings/layout.tsx`
- [Upstash Ratelimit docs - Getting Started](https://upstash.com/docs/redis/sdks/ratelimit-ts/gettingstarted) -- constructor, algorithms, env vars
- [Upstash Ratelimit docs - Methods](https://upstash.com/docs/redis/sdks/ratelimit-ts/methods) -- limit() return type, Next.js example
- npm registry: @upstash/ratelimit@2.0.8, @upstash/redis@1.37.0, nanoid@5.1.7 -- version verification
- Node.js runtime test: Web Crypto API SHA-256 -- produces correct 64-char hex hash

### Secondary (MEDIUM confidence)
- [nanoid GitHub](https://github.com/ai/nanoid) -- ESM-only in v5, import pattern
- [Next.js ESM externals docs](https://nextjs.org/docs/messages/import-esm-externals) -- ESM import handling

### Tertiary (LOW confidence)
- Upstash free tier limits (10K req/day) -- referenced from CONTEXT.md specific ideas, not independently verified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified against npm registry, APIs confirmed via docs
- Architecture: HIGH -- based on direct codebase analysis of extraction targets and existing patterns
- Pitfalls: HIGH -- identified from real code patterns (createClient vs createAdminClient, ESM imports, etc.)

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable -- Upstash and Supabase APIs are mature)
