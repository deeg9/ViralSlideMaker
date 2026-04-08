# Architecture Research

**Domain:** Per-user API key auth + REST API layer for existing Next.js 15 + Supabase SaaS
**Researched:** 2026-04-08
**Confidence:** HIGH

## System Overview

```
                          Clients
            ┌───────────────┬──────────────────┐
            │ Web Browser   │  API Consumer     │
            │ (cookies)     │  (Bearer vsl_*)   │
            └──────┬────────┴────────┬──────────┘
                   │                 │
            ┌──────┴────────┐ ┌─────┴──────────────┐
            │  Middleware    │ │  Middleware         │
            │  (session     │ │  (skip session for  │
            │   refresh)    │ │   /api/v1/*)        │
            └──────┬────────┘ └─────┬──────────────┘
                   │                │
            ┌──────┴────────┐ ┌─────┴──────────────┐
            │  Server       │ │  Route Handlers     │
            │  Actions      │ │  app/api/v1/*/      │
            │  (cookie auth)│ │  route.ts           │
            └──────┬────────┘ └─────┬──────────────┘
                   │                │
                   │         ┌──────┴──────────────┐
                   │         │  authenticateApiKey  │
                   │         │  (Bearer → user_id)  │
                   │         │  via admin client    │
                   │         └──────┬──────────────┘
                   │                │
            ┌──────┴────────────────┴──────────────┐
            │         Shared Service Layer          │
            │  (generateCarouselCore, credits,      │
            │   project CRUD, render)               │
            ├──────────────────────────────────────┤
            │  Supabase Admin Client                │
            │  (service_role — bypasses RLS)         │
            ├──────────────────────────────────────┤
            │  PostgreSQL (RLS enabled)             │
            │  ┌──────────┐ ┌──────────────────┐   │
            │  │ projects │ │ credit_txns      │   │
            │  │ api_keys │ │ subscriptions    │   │
            │  └──────────┘ └──────────────────┘   │
            └──────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Next.js Middleware | Skip session refresh for `/api/v1/*` routes; continue session handling for web routes | Modify existing `src/middleware.ts` |
| `authenticateApiKey()` | Extract Bearer token, SHA-256 hash, lookup in `api_keys` table, return `user_id` | New `src/lib/api/auth.ts` using admin client |
| Route Handlers | HTTP method routing, request validation, response formatting for REST API | New `src/app/api/v1/*/route.ts` files |
| Shared Service Layer | Core business logic (carousel gen, CRUD, render) callable by both server actions and route handlers | **Extract** from existing server actions into `src/lib/services/*.ts` |
| Rate Limiter (Upstash) | Per-API-key rate limiting with sliding window | New `src/lib/api/rate-limit.ts` using `@upstash/ratelimit` |
| API Key Manager | Create/revoke/list keys; SHA-256 hashing; `vsl_` prefix | New `src/lib/api/keys.ts` + server actions for UI |
| Settings UI | Create/revoke API keys, show masked keys, copy-to-clipboard | New `src/app/(dashboard)/settings/api-keys/page.tsx` |

## Recommended Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── carousel/
│   │   │   │   └── route.ts              # POST /api/v1/carousel
│   │   │   ├── templates/
│   │   │   │   └── route.ts              # GET /api/v1/templates
│   │   │   ├── projects/
│   │   │   │   ├── route.ts              # GET, POST /api/v1/projects
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts          # GET, DELETE /api/v1/projects/:id
│   │   │   │       ├── slides/
│   │   │   │       │   └── [index]/
│   │   │   │       │       └── route.ts  # GET, PATCH .../:id/slides/:index
│   │   │   │       ├── render/
│   │   │   │       │   └── route.ts      # POST /api/v1/projects/:id/render
│   │   │   │       └── download/
│   │   │   │           ├── route.ts      # GET /api/v1/projects/:id/download
│   │   │   │           └── [index]/
│   │   │   │               └── route.ts  # GET .../:id/download/:index
│   │   │   └── _lib/
│   │   │       ├── api-response.ts       # Standardized JSON response helpers
│   │   │       └── with-api-auth.ts      # Higher-order handler: auth + rate limit
│   │   ├── render/                        # EXISTING — unchanged
│   │   └── webhooks/                      # EXISTING — unchanged
│   └── (dashboard)/
│       └── settings/
│           └── api-keys/
│               ├── page.tsx               # NEW — API key management UI
│               └── actions.ts             # NEW — create/revoke key server actions
├── lib/
│   ├── api/
│   │   ├── openapi.ts                     # EXISTING — already defined
│   │   ├── auth.ts                        # NEW — authenticateApiKey()
│   │   ├── keys.ts                        # NEW — createApiKey, revokeApiKey, listApiKeys
│   │   └── rate-limit.ts                  # NEW — Upstash Redis rate limiter for API
│   ├── services/                           # NEW — extracted shared logic
│   │   ├── carousel-service.ts            # Core carousel generation
│   │   ├── project-service.ts             # CRUD operations
│   │   └── render-service.ts              # Slide rendering
│   ├── credits/                            # EXISTING — minor additions
│   │   ├── check-credits.ts               # Add admin-client variant functions
│   │   └── ...
│   └── supabase/
│       ├── admin.ts                        # EXISTING — used for API auth
│       └── server.ts                       # EXISTING — cookie-based, web only
└── middleware.ts                            # MODIFY — add /api/v1 bypass
```

### Structure Rationale

- **`app/api/v1/_lib/`:** Colocated API utilities. Underscore prefix means Next.js App Router does not treat it as a route segment. Keeps auth wrapper and response helpers close to the route handlers.
- **`lib/services/`:** Extract business logic from server actions so both server actions and route handlers call the same code. Server actions become thin wrappers that add `revalidatePath`.
- **`lib/api/`:** API-specific concerns (key management, auth, rate limiting) separate from general lib code.
- **Settings api-keys page:** Follows existing settings sidebar pattern -- add one nav item to the `settingsNav` array.

## Architectural Patterns

### Pattern 1: Higher-Order Auth Wrapper (withApiAuth)

**What:** A function that wraps route handlers with Bearer token auth, rate limiting, and error handling. Returns the resolved `user_id` and admin Supabase client to the handler.
**When to use:** Every `/api/v1/*` route handler.
**Trade-offs:** Clean DRY pattern, adds one level of nesting. Worth it because every endpoint needs identical auth + rate limit + error format.

**Example:**
```typescript
// src/app/api/v1/_lib/with-api-auth.ts
import { authenticateApiKey } from '@/lib/api/auth'
import { checkApiRateLimit } from '@/lib/api/rate-limit'
import { apiError } from './api-response'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

interface ApiContext {
  userId: string
  keyId: string
  supabase: SupabaseClient  // admin client, bypasses RLS
}

type ApiHandler = (
  request: Request,
  context: ApiContext,
  params: Record<string, string>
) => Promise<Response>

export function withApiAuth(handler: ApiHandler) {
  return async (
    request: Request,
    { params }: { params: Promise<Record<string, string>> }
  ) => {
    // 1. Extract and validate Bearer token
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return apiError('UNAUTHORIZED', 'Missing Authorization header', 401)
    }
    const token = authHeader.slice(7)

    // 2. Look up API key (SHA-256 hash, admin client)
    const keyResult = await authenticateApiKey(token)
    if (!keyResult) {
      return apiError('UNAUTHORIZED', 'Invalid API key', 401)
    }

    // 3. Rate limit check (per key)
    const rateResult = await checkApiRateLimit(keyResult.keyId)
    if (!rateResult.ok) {
      return apiError('RATE_LIMITED', 'Too many requests', 429, {
        'Retry-After': String(rateResult.retryAfter),
      })
    }

    // 4. Create admin client for handler
    const supabase = createAdminClient()
    const resolvedParams = await params

    return handler(request, {
      userId: keyResult.userId,
      keyId: keyResult.keyId,
      supabase,
    }, resolvedParams)
  }
}
```

### Pattern 2: Service Extraction (Server Actions to Shared Services)

**What:** Extract core logic from server actions into pure service functions that accept a Supabase client and userId as parameters (instead of reading cookies internally). Server actions become thin wrappers.
**When to use:** Any logic needed by both web (server actions) and API (route handlers).
**Trade-offs:** Requires refactoring existing server actions, but the change is mechanical: move logic out, pass dependencies in.

**Example:**
```typescript
// src/lib/services/carousel-service.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export async function generateCarouselCore(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  topic: string,
  templateId: string,
  options?: {
    imageSource?: 'stock' | 'ai'
    slideCount?: number
    font?: string
    fontColor?: string
  }
): Promise<
  { success: true; slideCount: number }
  | { success: false; error: string }
> {
  // Same logic as current generateCarousel server action
  // but uses provided supabase client and userId
}

// src/app/(dashboard)/project/[id]/actions.ts (thin wrapper)
'use server'
export async function generateCarousel(...args) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  const result = await generateCarouselCore(supabase, user.id, ...args)
  if (result.success) {
    revalidatePath(`/project/${args[0]}`)
    revalidatePath('/dashboard')
  }
  return result
}

// src/app/api/v1/carousel/route.ts (API handler)
export const POST = withApiAuth(async (request, { userId, supabase }) => {
  const body = await request.json()
  // validate with zod...
  const result = await generateCarouselCore(supabase, userId, ...)
  return NextResponse.json(result)
})
```

### Pattern 3: API Key Authentication with SHA-256 Hashing

**What:** Store only the SHA-256 hash of the API key in the database. On each request, hash the provided token and look up the hash. The raw key is shown to the user exactly once at creation time.
**When to use:** Always for API key storage.
**Trade-offs:** Cannot retrieve the key after creation (by design). User must copy it immediately.

**Example:**
```typescript
// src/lib/api/keys.ts
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

const KEY_PREFIX = 'vsl_'

export async function createApiKey(userId: string, name: string) {
  const rawKey = KEY_PREFIX + crypto.randomBytes(32).toString('base64url')
  const keyHash = crypto
    .createHash('sha256')
    .update(rawKey)
    .digest('hex')

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: userId,
      key_hash: keyHash,
      name,
      prefix: rawKey.slice(0, 8), // "vsl_XXXX" for display
    })
    .select('id, name, prefix, created_at')
    .single()

  if (error) throw error
  return { ...data, rawKey } // rawKey shown once, then discarded
}

export async function authenticateApiKey(token: string) {
  if (!token.startsWith(KEY_PREFIX)) return null
  const keyHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex')

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('api_keys')
    .select('id, user_id')
    .eq('key_hash', keyHash)
    .eq('revoked', false)
    .single()

  if (!data) return null

  // Update last_used_at (fire-and-forget)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return { keyId: data.id, userId: data.user_id }
}
```

## Data Flow

### API Request Flow

```
API Consumer
    |  Authorization: Bearer vsl_abc123...
    v
Next.js Middleware
    |  pathname.startsWith('/api/v1') → skip session refresh
    v
Route Handler (e.g. POST /api/v1/carousel)
    |  withApiAuth wrapper:
    |    1. Extract Bearer token from header
    |    2. SHA-256 hash the token
    |    3. Lookup hash in api_keys table (admin client)
    |    4. Verify key not revoked → get user_id
    |    5. Rate limit check (Upstash Redis, keyed by key_id)
    v
Handler Logic
    |  Parse + validate request body (Zod)
    |  Call shared service (e.g. generateCarouselCore)
    |    → Service uses admin client with explicit user_id filtering
    |    → Credit deduction via deduct_credits RPC
    v
JSON Response
    |  Envelope: { data: ... } or { error: { code, message } }
    |  Headers: X-RateLimit-Limit, X-RateLimit-Remaining, x-credits-remaining
    v
API Consumer
```

### Credit Deduction Flow for API Callers

```
API Route Handler
    v
withApiAuth → resolves user_id from API key
    v
Service Layer (e.g. generateCarouselCore)
    |  Receives: admin supabase client + user_id
    |  Calls: supabase.rpc('deduct_credits', { p_user_id: userId, ... })
    |  deduct_credits is SECURITY DEFINER → runs as postgres role
    |  Advisory lock prevents concurrent deduction race conditions
    |  Returns: true (deducted) or false (insufficient)
    v
If false → return 402 { error: { code: 'INSUFFICIENT_CREDITS' } }
If true → proceed with generation
    v
Response includes x-credits-remaining header
```

**Key insight:** The existing `deduct_credits` RPC is `SECURITY DEFINER`, so it runs with elevated privileges regardless of the calling role. The admin client (service_role) can call it with any `user_id`. No changes to the RPC are needed.

## Database: New `api_keys` Table

```sql
-- Migration: 007_api_keys.sql
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,       -- SHA-256 hex of the full key
  prefix TEXT NOT NULL,                 -- First 8 chars ("vsl_abc1") for display
  name TEXT NOT NULL DEFAULT 'Default', -- User-chosen label
  revoked BOOLEAN NOT NULL DEFAULT false,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX api_keys_hash_idx
  ON public.api_keys(key_hash) WHERE NOT revoked;
CREATE INDEX api_keys_user_idx
  ON public.api_keys(user_id);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Users can view/manage their own keys (web UI with cookie auth)
CREATE POLICY "Users can view own API keys"
  ON public.api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own API keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys"
  ON public.api_keys FOR UPDATE
  USING (auth.uid() = user_id);
```

**RLS note:** The web UI (cookie auth) uses the user's Supabase client, so RLS applies normally for viewing/revoking keys. The API auth lookup uses the admin client (service_role) to bypass RLS -- this is correct because the lookup happens before we know who the user is.

## RLS Strategy for API Auth

**Problem:** Cookie-based auth uses `auth.uid()` in RLS policies. API key auth has no Supabase session -- there is no `auth.uid()`.

**Solution:** Use the admin client (service_role) for ALL API route database operations. The service_role bypasses RLS entirely. The service layer manually filters by `user_id` in every query.

**Why this is safe:**
1. `withApiAuth` resolves the Bearer token to a verified `user_id` before any handler runs.
2. Every service function receives `userId` as a parameter and includes `.eq('user_id', userId)` in all queries.
3. The admin client is never exposed to the client -- it only exists in server-side route handlers.
4. This is the standard Supabase pattern for backend API key auth.

**Alternative considered (Supabase impersonation via custom JWT):** Would let RLS work naturally, but adds JWT signing complexity, requires a JWT secret, and has worse performance (token creation on every request). Not worth it for this use case.

## Middleware Changes

```typescript
// src/middleware.ts -- updated
import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Skip auth for webhook routes (Stripe webhooks)
  if (request.nextUrl.pathname.startsWith('/api/webhooks')) {
    return
  }
  // Skip session refresh for API v1 routes (Bearer token auth)
  if (request.nextUrl.pathname.startsWith('/api/v1')) {
    return
  }
  return await updateSession(request)
}
```

**Why skip middleware entirely for `/api/v1`:** The `updateSession` middleware reads/refreshes Supabase cookies. API requests have no cookies -- running it is wasted work and can produce confusing error logs. `withApiAuth` handles auth independently.

## Integration Points

### Existing Components Modified

| Component | Change | Risk |
|-----------|--------|------|
| `src/middleware.ts` | Add early return for `/api/v1/*` paths | LOW -- 3-line addition |
| `src/app/(dashboard)/settings/layout.tsx` | Add "API Keys" nav item to `settingsNav` | LOW -- add one object |
| `src/lib/credits/check-credits.ts` | Add `deductCreditAdmin(supabase, userId, ...)` variant that accepts a client param | LOW -- additive only |
| `src/app/(dashboard)/project/[id]/actions.ts` | Refactor to thin wrapper calling `generateCarouselCore` | MEDIUM -- logic moves, behavior identical |
| `src/app/(dashboard)/dashboard/actions.ts` | Refactor to thin wrapper calling service functions | LOW -- simple extraction |

### New Components

| Component | Purpose | Dependencies |
|-----------|---------|-------------|
| `supabase/migrations/007_api_keys.sql` | Database table + indexes + RLS | None |
| `src/lib/api/auth.ts` | `authenticateApiKey()` | `supabase/admin`, `crypto` |
| `src/lib/api/keys.ts` | `createApiKey()`, `revokeApiKey()`, `listApiKeys()` | `supabase/admin`, `crypto` |
| `src/lib/api/rate-limit.ts` | Upstash Redis sliding-window rate limiter | `@upstash/ratelimit`, `@upstash/redis` |
| `src/app/api/v1/_lib/with-api-auth.ts` | Auth + rate limit wrapper | `api/auth`, `api/rate-limit` |
| `src/app/api/v1/_lib/api-response.ts` | `apiSuccess()`, `apiError()` helpers | None |
| `src/lib/services/carousel-service.ts` | Extracted carousel generation logic | `ai/generate-slides`, `pexels`, `credits` |
| `src/lib/services/project-service.ts` | Extracted project CRUD | `supabase` |
| `src/lib/services/render-service.ts` | Extracted render logic | `render/`, `brand-kit/` |
| 10 route handler files | One per OpenAPI endpoint | `with-api-auth`, services |
| `settings/api-keys/page.tsx` | Key management UI | server actions |
| `settings/api-keys/actions.ts` | Create/revoke key server actions | `api/keys` |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Upstash Redis | `@upstash/ratelimit` sliding window, keyed by `apikey:{key_id}` | Requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` env vars. Existing in-memory limiter does NOT work across serverless instances. |
| Supabase (service_role) | Admin client for API key lookup + data access | Already exists at `src/lib/supabase/admin.ts`. No changes needed. |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k API users | Current design works. Upstash free tier handles rate limiting. |
| 1k-10k API users | Cache `key_hash -> user_id` in Redis (60s TTL) to reduce DB lookups. Partial index already covers this. |
| 10k+ API users | Add API key scoping (read-only vs read-write). Usage analytics table. Key lookup cache mandatory. |

### Scaling Priorities

1. **First bottleneck: Key lookup latency.** Every API request queries Postgres. Fix: cache `key_hash -> user_id` in Upstash Redis with 60s TTL, invalidate on revoke.
2. **Second bottleneck: Credit deduction contention.** Advisory lock serializes per-user. Fine for normal usage, only blocks under burst from a single user.

## Anti-Patterns

### Anti-Pattern 1: Using Cookie-Based Client in Route Handlers

**What people do:** Call `createClient()` (from `@/lib/supabase/server`) in API route handlers.
**Why it's wrong:** API requests have no cookies. The client becomes unauthenticated. Queries return empty results because RLS blocks everything (no `auth.uid()`).
**Do this instead:** Always use `createAdminClient()` in route handlers and filter by `user_id` explicitly.

### Anti-Pattern 2: Storing Plaintext API Keys

**What people do:** Store the raw API key in the database for easier lookup.
**Why it's wrong:** A database breach exposes all API keys.
**Do this instead:** Store SHA-256 hash only. Show the raw key once at creation. Store a prefix for display.

### Anti-Pattern 3: Using In-Memory Rate Limiter for API Keys

**What people do:** Reuse the existing `rateLimit()` / `rateLimitBucket()` from `src/lib/rate-limit.ts`.
**Why it's wrong:** Vercel serverless functions are ephemeral. Each instance has its own memory. Rate limits become effectively unlimited.
**Do this instead:** Use Upstash Redis (`@upstash/ratelimit`) for distributed rate limiting. Keep in-memory limiter for web UI only.

### Anti-Pattern 4: Duplicating Business Logic in Route Handlers

**What people do:** Copy-paste carousel generation logic from server action into route handler.
**Why it's wrong:** Two copies drift apart. Bug fixes only reach one path. Credit deduction inconsistencies.
**Do this instead:** Extract into shared services. Both server actions and route handlers call the same function.

## Suggested Build Order

Build order accounts for dependencies between components:

1. **Database + key management** (no external deps)
   - `007_api_keys.sql` migration
   - `src/lib/api/keys.ts` (create, revoke, list)
   - `src/lib/api/auth.ts` (authenticateApiKey)

2. **API infrastructure** (depends on step 1)
   - `src/app/api/v1/_lib/api-response.ts`
   - `src/app/api/v1/_lib/with-api-auth.ts`
   - `src/lib/api/rate-limit.ts` (Upstash)
   - Middleware update (add `/api/v1` bypass)

3. **Service extraction** (can parallel with step 2)
   - `src/lib/services/project-service.ts`
   - `src/lib/services/carousel-service.ts`
   - `src/lib/services/render-service.ts`
   - Update existing server actions to use services

4. **Route handlers** (depends on steps 2+3)
   - Read-only first: GET templates, GET projects, GET project, GET slide
   - Mutations: POST carousel, POST project, PATCH slide, DELETE project
   - Binary: POST render, GET download, GET download/:index

5. **Settings UI** (can parallel with step 4)
   - `settings/api-keys/actions.ts`
   - `settings/api-keys/page.tsx`
   - Update settings layout nav

6. **Polish + testing**
   - End-to-end: create key -> call API -> verify response
   - Credit deduction verification
   - Rate limit verification

## Sources

- Existing codebase: `src/middleware.ts`, `src/lib/supabase/admin.ts`, `src/lib/api/openapi.ts`, `src/lib/credits/check-credits.ts`, `src/app/(dashboard)/project/[id]/actions.ts`, `supabase/migrations/005_credit_system.sql`
- Next.js 15 App Router: route handlers use `export async function GET/POST(request, { params })` with `params` as a Promise
- Supabase service_role: standard pattern for backend API key auth (bypasses RLS, requires manual user_id filtering)
- Upstash Ratelimit: sliding window algorithm designed for serverless/edge

---
*Architecture research for: Per-user API keys + REST API integration*
*Researched: 2026-04-08*
