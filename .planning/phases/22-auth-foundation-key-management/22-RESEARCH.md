# Phase 22: Auth Foundation & Key Management - Research

**Researched:** 2026-04-08
**Domain:** API key management, Bearer token authentication, Supabase RLS, Next.js middleware
**Confidence:** HIGH

## Summary

Phase 22 delivers the foundational auth layer for the public REST API: a database-backed API key system with create/view/revoke lifecycle, Bearer token authentication middleware, and a settings UI for key management. The decisions from CONTEXT.md are comprehensive and well-aligned with the existing codebase patterns.

The project uses Next.js 15.5, Supabase (with RLS), and Vitest for testing. No new npm packages are needed for this phase -- Node.js built-in `crypto` module provides `randomBytes` for key generation and `timingSafeEqual` for constant-time hash comparison. The existing admin Supabase client (`src/lib/supabase/admin.ts`) is the correct tool for service-role lookups in API route handlers.

**Primary recommendation:** Implement in 3 layers: (1) database migration with RLS, (2) auth library functions (`authenticateApiKey` + `withApiAuth` HOC), (3) settings UI page with server actions. All code patterns already exist in the codebase and should be followed precisely.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Max 10 API keys per user
- Key format: `vsl_` prefix + 32 random hex chars (44 chars total)
- Store: name, prefix (first 8 chars after `vsl_`), SHA-256 hash, created_at, last_used_at
- Migration: `007_api_keys.sql` -- next in sequence after `006_storage_buckets.sql`
- Bypass middleware: add `request.nextUrl.pathname.startsWith('/api/v1')` in `src/middleware.ts`
- Auth helper: `authenticateApiKey(request)` returning `{ userId, keyId }` or throwing
- HOC wrapper: `export const GET = withApiAuth(async (req, ctx) => ...)` where `ctx` includes `userId`, `keyId`, `supabase` (admin client)
- `last_used_at` update: fire-and-forget after auth succeeds (non-blocking)
- Nav position: 5th item in settings sidebar
- Create flow: modal dialog with name input, show full key in copyable code block, "This key won't be shown again" warning
- Key list: table with Name, Key (masked), Created, Last Used, Actions (Revoke)
- Quick-start snippets: tabbed code blocks for curl, JavaScript, Python -- auto-populated with user's key

### Claude's Discretion
- RLS policy design for api_keys table (user can only see/manage own keys)
- Error message wording for 401 responses
- Exact key generation implementation (crypto.randomBytes)
- Table styling to match existing settings pages

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KEY-01 | User can create an API key with a name, receiving a `vsl_` prefixed token shown once | Key generation via `crypto.randomBytes(16).toString('hex')` producing 32 hex chars; prefix `vsl_` for 44 total; store SHA-256 hash only |
| KEY-02 | API key is stored as SHA-256 hash in Supabase with RLS policies | Migration `007_api_keys.sql` creates table with RLS; policies restrict to own user_id |
| KEY-03 | User can list their keys showing name, prefix, created date, and last used timestamp | Server action queries api_keys table filtered by authenticated user; prefix stored as column |
| KEY-04 | User can revoke an API key, immediately invalidating it | DELETE via server action; subsequent auth lookups return no match |
| KEY-05 | Settings page displays quick-start code snippets after key creation | Post-creation dialog state shows tabbed curl/JS/Python snippets with key interpolated |
| AUTH-01 | API routes accept Bearer token and authenticate via SHA-256 hash lookup | `authenticateApiKey()` parses Authorization header, hashes token, queries api_keys table |
| AUTH-02 | Hash comparison uses `crypto.timingSafeEqual` to prevent timing attacks | After hash lookup, use `timingSafeEqual(Buffer.from(storedHash), Buffer.from(computedHash))` |
| AUTH-03 | Middleware skips Supabase session auth for `/api/v1/*` routes | Add early return in `src/middleware.ts` matching `/api/v1` path prefix |
| AUTH-04 | Route handlers use Supabase admin client with manual user_id filtering | `withApiAuth` HOC passes `ctx.supabase` as admin client; queries filter by `ctx.userId` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `crypto` | built-in (Node 24.7) | `randomBytes`, `createHash`, `timingSafeEqual` | No external dependency needed; standard for key generation and hashing [VERIFIED: node -e test] |
| @supabase/supabase-js | 2.99.3 | Database queries, RLS enforcement | Already installed, used throughout project [VERIFIED: package.json] |
| @supabase/ssr | 0.9.0 | Server-side Supabase client for settings page auth | Already installed [VERIFIED: package.json] |
| Next.js | 15.5.13 | Middleware, route handlers, server actions | Already installed [VERIFIED: package.json] |
| @base-ui/react | 1.3.0 | Dialog component for create/revoke modals | Already installed, used in existing dialogs [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 4.3.6 | Input validation for key name | Already installed; validate name length/chars in server action [VERIFIED: package.json] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| crypto.randomBytes | uuid v4 | randomBytes + hex gives exact control over format; uuid would need stripping dashes |
| Raw SHA-256 | bcrypt/scrypt | SHA-256 is correct for API keys (high entropy input); bcrypt is for passwords (low entropy) [ASSUMED] |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/api/
│   ├── auth.ts              # authenticateApiKey() function
│   ├── with-api-auth.ts     # withApiAuth() HOC wrapper
│   └── openapi.ts           # (existing) OpenAPI spec
├── app/(dashboard)/settings/api-keys/
│   ├── page.tsx             # Server component (matches brand-kit pattern)
│   └── actions.ts           # Server actions: createApiKey, listApiKeys, revokeApiKey
├── components/api-keys/
│   ├── api-key-table.tsx    # Client component: key list table
│   ├── create-key-dialog.tsx # Client component: create flow modal
│   └── revoke-key-dialog.tsx # Client component: revoke confirmation
supabase/migrations/
└── 007_api_keys.sql         # Table, RLS, indexes
```

### Pattern 1: API Key Generation
**What:** Generate a cryptographically secure API key with `vsl_` prefix, return the raw key to the user exactly once, store only the SHA-256 hash.
**When to use:** Key creation server action.
**Example:**
```typescript
// Source: Node.js crypto built-in
import { randomBytes, createHash } from 'crypto'

function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const bytes = randomBytes(16) // 16 bytes = 32 hex chars
  const hex = bytes.toString('hex')
  const raw = `vsl_${hex}` // 44 chars total
  const hash = createHash('sha256').update(raw).digest('hex')
  const prefix = hex.slice(0, 8) // first 8 hex chars after vsl_
  return { raw, hash, prefix }
}
```
[VERIFIED: crypto.randomBytes tested locally]

### Pattern 2: Timing-Safe Hash Comparison
**What:** Prevent timing attacks when verifying API keys by using constant-time comparison.
**When to use:** In `authenticateApiKey()` after database lookup.
**Example:**
```typescript
// Source: Node.js crypto built-in
import { timingSafeEqual, createHash } from 'crypto'

function verifyKeyHash(rawKey: string, storedHash: string): boolean {
  const computedHash = createHash('sha256').update(rawKey).digest('hex')
  // Both are hex strings of SHA-256, always 64 chars
  return timingSafeEqual(
    Buffer.from(computedHash, 'utf8'),
    Buffer.from(storedHash, 'utf8')
  )
}
```
[VERIFIED: crypto.timingSafeEqual available in Node 24]

### Pattern 3: withApiAuth HOC Wrapper
**What:** Higher-order function wrapping Next.js route handlers with auth extraction.
**When to use:** Every `/api/v1/*` route handler.
**Example:**
```typescript
// Source: project pattern (webhook route + admin client pattern)
import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from './auth'
import { createAdminClient } from '@/lib/supabase/admin'

type ApiContext = {
  userId: string
  keyId: string
  supabase: ReturnType<typeof createAdminClient>
}

type ApiHandler = (
  req: NextRequest,
  ctx: ApiContext
) => Promise<NextResponse>

export function withApiAuth(handler: ApiHandler) {
  return async (req: NextRequest) => {
    try {
      const { userId, keyId } = await authenticateApiKey(req)
      const supabase = createAdminClient()
      return await handler(req, { userId, keyId, supabase })
    } catch {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' } },
        { status: 401 }
      )
    }
  }
}
```
[VERIFIED: follows existing webhook route.ts and admin.ts patterns]

### Pattern 4: Middleware Bypass
**What:** Skip Supabase session refresh for API routes to avoid redirect loops.
**When to use:** `src/middleware.ts` -- add before `updateSession()` call.
**Example:**
```typescript
// Source: existing webhook bypass pattern in src/middleware.ts
export async function middleware(request: NextRequest) {
  // Skip auth for webhook routes (Stripe webhooks)
  if (request.nextUrl.pathname.startsWith('/api/webhooks')) {
    return
  }
  // Skip session auth for API v1 routes (uses Bearer token auth)
  if (request.nextUrl.pathname.startsWith('/api/v1')) {
    return
  }
  return await updateSession(request)
}
```
[VERIFIED: exact match of existing pattern in src/middleware.ts]

### Pattern 5: Settings Server Action Pattern
**What:** Server actions that authenticate via cookie-based Supabase client, matching existing settings pages.
**When to use:** API key CRUD operations from the settings UI.
**Example:**
```typescript
// Source: existing brand-kit/actions.ts pattern
'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function listApiKeys() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Use admin client for reads to bypass RLS if needed,
  // or use cookie client with RLS policies
  const { data } = await supabase
    .from('api_keys')
    .select('id, name, prefix, created_at, last_used_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return data ?? []
}
```
[VERIFIED: follows brand-kit/actions.ts exactly]

### Anti-Patterns to Avoid
- **Storing raw API keys:** Never store the plaintext key. Store only the SHA-256 hash. The raw key is returned exactly once at creation time.
- **Using bcrypt for API keys:** bcrypt is for low-entropy passwords. API keys have high entropy (128 bits); SHA-256 is the correct choice. [ASSUMED]
- **Blocking on last_used_at update:** The `last_used_at` timestamp update should be fire-and-forget (don't await) to avoid adding latency to every API request.
- **Using cookie-based auth in API routes:** API routes under `/api/v1` must use the admin client with manual user_id filtering, not the cookie-based client which requires session cookies.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Random key generation | Custom RNG or Math.random | `crypto.randomBytes(16)` | Cryptographic security required; Math.random is predictable [VERIFIED: Node crypto docs] |
| Hash comparison | `===` string comparison | `crypto.timingSafeEqual()` | Prevents timing side-channel attacks [VERIFIED: Node crypto docs] |
| Dialog component | Custom modal with portals | Base UI `Dialog` | Focus trapping, escape handling, accessibility built-in [VERIFIED: @base-ui/react in package.json] |
| Clipboard API | Custom fallback chain | `navigator.clipboard.writeText()` | Modern browsers all support it; existing pattern in project [ASSUMED] |

**Key insight:** The security-critical parts (key generation, hash comparison) must use Node.js `crypto` built-ins. Everything else follows existing project patterns.

## Common Pitfalls

### Pitfall 1: Timing Attack on Hash Lookup
**What goes wrong:** Using `===` to compare hashes leaks information about which bytes match through response timing differences.
**Why it happens:** String equality returns early on first mismatch.
**How to avoid:** Use `crypto.timingSafeEqual()` with Buffer inputs of equal length. SHA-256 hex output is always 64 chars, so length is guaranteed equal.
**Warning signs:** Any use of `===` or `!==` on hash values.

### Pitfall 2: Middleware Redirect Loop
**What goes wrong:** `/api/v1/*` requests hit Supabase session middleware, which tries to refresh cookies and redirects to login when no session exists.
**Why it happens:** The middleware matcher catches all non-static paths by default.
**How to avoid:** Add the `/api/v1` bypass BEFORE the `updateSession()` call in middleware.ts.
**Warning signs:** API requests returning 307 redirects instead of 401.

### Pitfall 3: Returning Key Hash Instead of Raw Key
**What goes wrong:** After creating a key, the server action returns the hash instead of the raw key to the client.
**Why it happens:** The hash is what's stored in the database; easy to return the wrong value.
**How to avoid:** Generate the raw key, compute the hash, store the hash, return the raw key -- all in one server action, in that order.
**Warning signs:** User sees a 64-char hex string instead of a `vsl_` prefixed string.

### Pitfall 4: RLS Policy Blocks Admin Client Reads
**What goes wrong:** API route handlers using admin client (service_role) bypass RLS but forget to manually filter by user_id.
**Why it happens:** Admin client bypasses RLS by design, so all rows are visible.
**How to avoid:** Always include `.eq('user_id', ctx.userId)` in queries within `withApiAuth` handlers.
**Warning signs:** Users can see or modify other users' data.

### Pitfall 5: timingSafeEqual with Different Buffer Lengths
**What goes wrong:** `timingSafeEqual` throws if buffers have different lengths.
**Why it happens:** If an invalid hash is stored or computed with a different encoding.
**How to avoid:** SHA-256 hex digest is always exactly 64 characters. Add a length check before comparison as a safety guard.
**Warning signs:** Uncaught errors in auth middleware causing 500s.

## Code Examples

### Database Migration (007_api_keys.sql)
```sql
-- Source: follows project migration patterns (005_credit_system.sql)
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,           -- first 8 hex chars after vsl_ (for display)
  key_hash TEXT NOT NULL UNIQUE,  -- SHA-256 hash of full key
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

-- Index for hash lookups during authentication
CREATE INDEX api_keys_key_hash_idx ON public.api_keys(key_hash);

-- Index for listing user's keys
CREATE INDEX api_keys_user_id_idx ON public.api_keys(user_id);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Users can view their own keys (for settings page)
CREATE POLICY "Users can view own api keys"
  ON public.api_keys FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own keys (for key creation)
CREATE POLICY "Users can create own api keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own keys (for revocation)
CREATE POLICY "Users can revoke own api keys"
  ON public.api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- No UPDATE policy for users -- last_used_at is updated via service role
```
[VERIFIED: follows 005_credit_system.sql patterns for table structure, RLS, and indexing]

### authenticateApiKey Function
```typescript
// Source: Node.js crypto + project Supabase patterns
import { createHash, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'

export async function authenticateApiKey(
  request: NextRequest
): Promise<{ userId: string; keyId: string }> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer vsl_')) {
    throw new Error('Missing or invalid Authorization header')
  }

  const rawKey = authHeader.slice(7) // Remove "Bearer "
  const keyHash = createHash('sha256').update(rawKey).digest('hex')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('api_keys')
    .select('id, user_id, key_hash')
    .eq('key_hash', keyHash)
    .single()

  if (error || !data) {
    throw new Error('Invalid API key')
  }

  // Timing-safe comparison as defense in depth
  const storedHashBuf = Buffer.from(data.key_hash, 'utf8')
  const computedHashBuf = Buffer.from(keyHash, 'utf8')
  if (!timingSafeEqual(storedHashBuf, computedHashBuf)) {
    throw new Error('Invalid API key')
  }

  // Fire-and-forget: update last_used_at
  admin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {}) // swallow result

  return { userId: data.user_id, keyId: data.id }
}
```
[VERIFIED: uses createAdminClient from src/lib/supabase/admin.ts]

### Server Action: Create API Key
```typescript
// Source: brand-kit/actions.ts pattern
'use server'
import { randomBytes, createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createApiKey(name: string): Promise<
  { success: true; rawKey: string } | { success: false; error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Check key count limit
  const { count } = await supabase
    .from('api_keys')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) >= 10) {
    return { success: false, error: 'Maximum of 10 API keys reached' }
  }

  // Generate key
  const hex = randomBytes(16).toString('hex') // 32 hex chars
  const rawKey = `vsl_${hex}`
  const keyHash = createHash('sha256').update(rawKey).digest('hex')
  const prefix = hex.slice(0, 8)

  const { error } = await supabase
    .from('api_keys')
    .insert({
      user_id: user.id,
      name: name.trim(),
      prefix,
      key_hash: keyHash,
    })

  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/api-keys')
  return { success: true, rawKey }
}
```
[VERIFIED: follows brand-kit/actions.ts server action pattern]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Store API keys in plaintext | Store SHA-256 hash only | Industry standard | Keys unrecoverable if DB breached |
| bcrypt for API keys | SHA-256 for high-entropy tokens | Always been best practice | bcrypt's slow hashing unnecessary for 128-bit entropy keys |
| Session cookies for API auth | Bearer token auth | REST API standard | Enables stateless API consumption from any client |

**Deprecated/outdated:**
- None relevant to this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SHA-256 is the correct choice over bcrypt for high-entropy API keys | Anti-Patterns, Alternatives | LOW -- this is widely accepted security practice; bcrypt would still work but adds unnecessary latency |
| A2 | navigator.clipboard.writeText() is sufficient for copy-to-clipboard | Don't Hand-Roll | LOW -- fallback could be added but all target browsers support it |

## Open Questions

1. **Max key name length**
   - What we know: UI has an input field for key name
   - What's unclear: No explicit max length specified in CONTEXT.md
   - Recommendation: Use zod validation with max 64 characters (reasonable for a label)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KEY-01 | Create API key returns vsl_ prefixed token, 44 chars | unit | `npx vitest run src/__tests__/api-keys/create-key.test.ts -x` | Wave 0 |
| KEY-02 | Key stored as SHA-256 hash; RLS blocks cross-user access | unit | `npx vitest run src/__tests__/api-keys/create-key.test.ts -x` | Wave 0 |
| KEY-03 | List keys returns name, prefix, dates | unit | `npx vitest run src/__tests__/api-keys/list-keys.test.ts -x` | Wave 0 |
| KEY-04 | Revoked key returns 401 on next auth attempt | unit | `npx vitest run src/__tests__/api-keys/revoke-key.test.ts -x` | Wave 0 |
| KEY-05 | Quick-start snippets render with key value | unit | `npx vitest run src/__tests__/api-keys/snippets.test.tsx -x` | Wave 0 |
| AUTH-01 | Bearer vsl_ token authenticates via hash lookup | unit | `npx vitest run src/__tests__/api-keys/auth.test.ts -x` | Wave 0 |
| AUTH-02 | timingSafeEqual used for hash comparison | unit | `npx vitest run src/__tests__/api-keys/auth.test.ts -x` | Wave 0 |
| AUTH-03 | Middleware skips /api/v1 paths | unit | `npx vitest run src/__tests__/auth/middleware.test.ts -x` | Exists (extend) |
| AUTH-04 | withApiAuth provides admin client in ctx | unit | `npx vitest run src/__tests__/api-keys/with-api-auth.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/api-keys/ --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/api-keys/create-key.test.ts` -- covers KEY-01, KEY-02
- [ ] `src/__tests__/api-keys/list-keys.test.ts` -- covers KEY-03
- [ ] `src/__tests__/api-keys/revoke-key.test.ts` -- covers KEY-04
- [ ] `src/__tests__/api-keys/snippets.test.tsx` -- covers KEY-05
- [ ] `src/__tests__/api-keys/auth.test.ts` -- covers AUTH-01, AUTH-02
- [ ] `src/__tests__/api-keys/with-api-auth.test.ts` -- covers AUTH-04
- [ ] Extend `src/__tests__/auth/middleware.test.ts` -- covers AUTH-03

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | SHA-256 hash lookup + timingSafeEqual for API keys |
| V3 Session Management | no | API keys are stateless bearer tokens, no session |
| V4 Access Control | yes | RLS policies + manual user_id filtering in admin queries |
| V5 Input Validation | yes | zod validation on key name input |
| V6 Cryptography | yes | crypto.randomBytes for key generation, SHA-256 for hashing -- never hand-roll |

### Known Threat Patterns for API Key Auth

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Timing attack on hash comparison | Information Disclosure | `crypto.timingSafeEqual()` |
| Brute-force key guessing | Tampering | 128-bit entropy (2^128 keyspace) makes brute force infeasible |
| Key leakage via logs | Information Disclosure | Never log raw keys; log only prefix |
| Cross-user data access | Elevation of Privilege | RLS + manual user_id filter on all admin client queries |
| Key shown multiple times | Information Disclosure | Return raw key exactly once at creation; store only hash |

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/middleware.ts`, `src/lib/supabase/admin.ts`, `src/app/(dashboard)/settings/` -- verified patterns for middleware bypass, admin client, settings page structure
- Codebase inspection: `supabase/migrations/005_credit_system.sql` -- verified migration pattern (table structure, RLS policies, indexes)
- Codebase inspection: `package.json` -- verified all dependencies already installed (no new packages needed)
- Codebase inspection: `vitest.config.ts`, `src/__tests__/` -- verified test infrastructure and patterns
- Node.js runtime: `crypto.randomBytes`, `crypto.timingSafeEqual` verified available on Node 24.7.0

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions from discuss phase -- locked implementation choices

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all dependencies already in project, verified via package.json
- Architecture: HIGH -- all patterns verified against existing codebase (brand-kit, webhook, middleware)
- Pitfalls: HIGH -- common API key security pitfalls are well-documented; timing attack and middleware bypass verified against actual code

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable domain, no fast-moving dependencies)
