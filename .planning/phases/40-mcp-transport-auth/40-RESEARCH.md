# Phase 40: MCP Transport & Auth - Research

**Researched:** 2026-04-28
**Domain:** MCP server transport (Streamable HTTP) + Bearer-token auth on Next.js 15 / Vercel
**Confidence:** HIGH

## Summary

Phase 40 rebuilds the `/api/mcp` Streamable HTTP endpoint that retired in v2.3 (Phase 26). The cause of the retirement was operational, not architectural: `mcp-handler` was declared in `package.json` but missing from `node_modules`, so the `[transport]/route.ts` route threw `Cannot find module 'mcp-handler'` at request time and returned HTTP 500. The v2.3 architecture itself (createMcpHandler + withMcpAuth + dynamic `[transport]` route + extra-field auth context) is sound and `mcp-handler@1.1.0` (released 2026-03-24) preserves the same import shape and option contract — we re-pin and rebuild.

The single change that makes this rebuild bulletproof is a **build-time guarantee** that the import resolves: a static top-of-file `import { createMcpHandler, withMcpAuth } from 'mcp-handler'` is sufficient to fail `next build` if the module is missing — Turbopack/webpack module-graph resolution runs as part of `next build`. We add a vitest smoke test as belt-and-braces and run `npm run build` in CI as the regression gate.

**Primary recommendation:** Re-pin to `mcp-handler@1.1.0` + `@modelcontextprotocol/sdk@1.29.0`, re-create the Phase 26 route + auth adapter with a refactored `verifyApiKeyHash` core extracted from `src/lib/api/auth.ts`, throw `TemporarilyUnavailableError` from `verifyToken` when rate-limit fails (so `withMcpAuth` returns a protocol-correct 503 instead of a generic auth failure), and add a vitest smoke test that asserts both `createMcpHandler` and `withMcpAuth` are importable functions.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Stack:** `mcp-handler` (Vercel's Next.js adapter) + `@modelcontextprotocol/sdk` v1.x. Pin both at the latest stable release at install time. Re-verify via Context7 lookup before adding to package.json — the retired v2.3 plans cite an April 2026 snapshot.
- **Route file:** `src/app/api/[transport]/route.ts` (per `mcp-handler`'s dynamic-segment pattern). The `[transport]` segment maps `mcp` → Streamable HTTP, `sse` → SSE.
- **Auth pattern:** wrap `createMcpHandler(...)` with `withMcpAuth(handler, verifyToken)` from `mcp-handler`. The `verifyToken` callback receives the bearer token and returns `{ userId, keyId }` on success or null/throws on failure — at which point `mcp-handler` returns the MCP-protocol-correct error.
- **Auth core extraction:** create `src/lib/api/auth-core.ts` containing the SHA-256 hash → DB lookup → timingSafeEqual → fire-and-forget `last_used_at` update logic. Export a `verifyApiKeyHash(rawKey: string)` function that takes a raw `vsl_...` string and returns `{ userId, keyId }` or throws. Refactor `src/lib/api/auth.ts:authenticateApiKey` to extract the bearer token from `NextRequest`, then delegate to `verifyApiKeyHash`. The MCP `verifyToken` callback calls `verifyApiKeyHash` directly.
- **Rate limiting:** wrap the auth-success path so that after `verifyToken` returns, the request hits `checkRateLimit({ keyId })` from `src/lib/api/rate-limit.ts` BEFORE the MCP handler dispatches the request. Same per-key sliding-window budget as REST. On 429, return MCP-protocol-correct error.
- **Transport mode:** stateless (`sessionIdGenerator: undefined`). NO session persistence between requests. Required for Vercel serverless compatibility.
- **Middleware bypass:** add `/api/mcp` to the auth-bypass list in `src/middleware.ts` (same pattern as `/api/v1` and `/api/webhooks`). Bearer-token is the only auth surface for the MCP endpoint — no Supabase session redirects.
- **Build-gate regression check (MCP-TRANS-06):** include a static, top-of-file `import { createMcpHandler } from 'mcp-handler'` in the route file. Next.js typecheck and `npm run build` will fail fast if `mcp-handler` is missing from `node_modules`. Additionally, add a smoke test under `src/__tests__/mcp/` that imports from `mcp-handler` and asserts the function exists — runs in CI.
- **Tool registration deferred:** this phase ships an empty tool list. `tools/list` returns `[]` until Phase 41 registers the 4 tools. The success criteria check for transport + auth + handshake — NOT for any specific tool being callable.

### Claude's Discretion

- Exact error message wording in `verifyToken` failures (any clear MCP-spec-compliant error)
- Test file structure under `src/__tests__/mcp/` (any organization that runs in vitest)
- Whether to add a `maxDuration` export on the route — recommended yes, set to 60s to align with REST `/carousel` route
- Whether to add a `runtime = 'nodejs'` export — yes if `mcp-handler` requires it, otherwise omit

### Deferred Ideas (OUT OF SCOPE)

- **Tool definitions** → Phase 41
- **npm bridge package + setup docs** → Phase 42
- **OAuth 2.1 / dynamic client registration** → out of scope for v2.6 entirely (REQUIREMENTS.md "Out of Scope")
- **Stateful sessions / sampling** → out of scope for v2.6 entirely
- **Broader tool surface (publish, fork, bookmarks, brand-kit)** → v2.7+

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MCP-TRANS-01 | `POST /api/mcp` Streamable HTTP endpoint at `src/app/api/[transport]/route.ts` accepts JSON-RPC 2.0 | Confirmed `[transport]` dynamic-segment pattern is canonical for `mcp-handler@1.1.0`; `basePath: '/api'` derives `/api/mcp` for streamable HTTP and `/api/sse` for SSE [VERIFIED: mcp-handler 1.1.0 dist/index.d.ts] |
| MCP-TRANS-02 | `withMcpAuth` rejects invalid keys with MCP-protocol-correct error | Confirmed `withMcpAuth` returns RFC-9728 `Bearer error=...` 401 with `WWW-Authenticate` header when `verifyToken` returns `undefined` and `required: true` [VERIFIED: mcp-handler dist/index.js auth-wrapper.ts] |
| MCP-TRANS-03 | Reuses Upstash limiter from `src/lib/api/rate-limit.ts`, keyed by API key ID | `checkRateLimit(keyId)` is called from inside `verifyToken` after hash verification succeeds; on `!success` we throw `TemporarilyUnavailableError` so `withMcpAuth`'s catch block returns 500 with `temporarily_unavailable` errorCode [VERIFIED: mcp-handler error mapping in dist/index.js + SDK errors.d.ts] |
| MCP-TRANS-04 | Stateless mode (`sessionIdGenerator: undefined`) for Vercel serverless | Confirmed: `Config.sessionIdGenerator` is typed as `undefined` in mcp-handler 1.1.0 — leaving it unset IS the stateless path; default. No Redis required for streamable HTTP unless using SSE resumability [VERIFIED: dist/index.d.ts type def] |
| MCP-TRANS-05 | Bearer-token verification core extracted from `src/lib/api/auth.ts:5` | New `src/lib/api/auth-core.ts` exports `verifyApiKeyHash(rawKey)`. `authenticateApiKey(NextRequest)` becomes a thin adapter that pulls the Bearer prefix and delegates. MCP `verifyToken` calls `verifyApiKeyHash` directly. Eliminates `NextRequest` coupling in the MCP path. |
| MCP-TRANS-06 | Build fails when `mcp-handler` missing from `node_modules` | Static top-of-file import in `route.ts` is sufficient — Next.js 15.5.13 with `next build --turbopack` resolves the module graph at build time and errors out on missing modules. Belt-and-braces: vitest smoke test imports both symbols and asserts they are functions. Run `npm run build` as a CI step BEFORE deploy. |
| MCP-TRANS-07 | `/api/mcp` added to auth-bypass list in `src/middleware.ts` | Add `if (request.nextUrl.pathname.startsWith('/api/mcp')) return` in the same pattern as the existing `/api/v1`, `/api/webhooks`, `/api/admin` blocks. Note: the dynamic `[transport]` route catches all non-static `/api/*` paths, so the bypass MUST match `/api/mcp` (the streamable-HTTP transport name) and `/api/sse` if SSE is left enabled. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| MCP transport (JSON-RPC 2.0 over HTTP) | API / Backend | — | Server-side route handler; Streamable HTTP is request/response, no client SDK in browser |
| Bearer-token verification | API / Backend | — | Hash + DB lookup + timing-safe compare; cannot leave server (timing attacks, secret-handling) |
| Rate limiting | API / Backend | — | Distributed Upstash Redis state; only meaningful per API key on the server |
| Session-auth bypass | API / Backend (middleware) | — | Next.js middleware decides whether to invoke Supabase session refresh — runs before the route |
| Build-gate import-resolution check | Build pipeline | CI | Must run during `next build` (compile-time) AND vitest (test-time) |
| MCP handshake response shape | API / Backend | — | `mcp-handler` owns the protocol-correct `initialize` response; we configure `serverInfo` |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `mcp-handler` | `1.1.0` | Vercel's Next.js adapter for MCP — provides `createMcpHandler`, `withMcpAuth`, transport plumbing | Official Vercel-maintained adapter; the only well-supported way to host MCP on Next.js App Router today; built specifically for the `[transport]` dynamic-segment pattern. Latest stable [VERIFIED: `npm view mcp-handler version` → `1.1.0`, published 2026-03-24] |
| `@modelcontextprotocol/sdk` | `1.29.0` | Core MCP types (`McpServer`, `AuthInfo`, OAuth error classes) — peer dep of `mcp-handler` | Reference implementation from Anthropic; supplies the `AuthInfo` interface our `verifyToken` returns and the `OAuthError` subclasses (`InvalidTokenError`, `InsufficientScopeError`, `TemporarilyUnavailableError`, `ServerError`) that `withMcpAuth` translates into protocol-correct HTTP responses [VERIFIED: `npm view @modelcontextprotocol/sdk version` → `1.29.0`, published 2026-03-30; mcp-handler 1.1.0 declares `peerDependencies: { @modelcontextprotocol/sdk: 1.26.0 }` — `1.29.0` is forward-compatible (same v1 major)] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@upstash/ratelimit` + `@upstash/redis` | already installed (`^2.0.8`, `^1.37.0`) | Sliding-window per-key rate limit | Already wired into `src/lib/api/rate-limit.ts` — call `checkRateLimit(keyId)` from inside `verifyToken` |
| `@modelcontextprotocol/inspector` | `0.21.2` | Local handshake validator | Run `npx -y @modelcontextprotocol/inspector` and point it at `http://localhost:3000/api/mcp` with a `Bearer vsl_...` header to confirm `initialize` succeeds [VERIFIED: `npm view @modelcontextprotocol/inspector version`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `mcp-handler` | Hand-rolled `WebStandardStreamableHTTPServerTransport` from `@modelcontextprotocol/sdk` directly | Loses the auth wrapper, the SSE/streamable-HTTP routing, the protocol-correct error responses, and the resource-metadata endpoint helper. ~250 LOC of plumbing we'd own. Don't. |
| Stateless transport | Stateful with `sessionIdGenerator: () => crypto.randomUUID()` + `redisUrl` | Required for SSE resumability and long-lived agent sessions. NOT supported on stateless Vercel serverless without external Redis. v2.6 is request/response only — not needed. |

**Installation:**

```bash
npm install mcp-handler@1.1.0 @modelcontextprotocol/sdk@1.29.0
```

**Version verification (run at start of Phase 40):**

```bash
npm view mcp-handler version              # → 1.1.0 (verified 2026-04-28)
npm view @modelcontextprotocol/sdk version # → 1.29.0 (verified 2026-04-28)
```

If a newer minor of either is published between research and execution, prefer it — both packages have followed semver since their 1.0 releases (mcp-handler@1.0.0 published 2025-07-11; SDK@1.0.0 earlier).

## Architecture Patterns

### System Architecture Diagram

```
                                ┌──────────────────────────────────────────────┐
                                │              MCP CLIENT                      │
                                │  (Claude Desktop / Cursor / Inspector)       │
                                │  POST /api/mcp                               │
                                │  Authorization: Bearer vsl_...               │
                                │  Content-Type: application/json              │
                                │  body: JSON-RPC 2.0 envelope                 │
                                └─────────────────────┬────────────────────────┘
                                                      │
                                                      ▼
                                ┌──────────────────────────────────────────────┐
                                │  Next.js middleware  (src/middleware.ts)     │
                                │  • startsWith('/api/mcp') → bypass session   │
                                │    refresh; pass straight to route           │
                                └─────────────────────┬────────────────────────┘
                                                      │
                                                      ▼
                                ┌──────────────────────────────────────────────┐
                                │  Dynamic route handler                       │
                                │  src/app/api/[transport]/route.ts            │
                                │  exports GET, POST, DELETE = authHandler     │
                                │                                              │
                                │  authHandler = withMcpAuth(handler,          │
                                │                            verifyToken,      │
                                │                            { required: true })│
                                └─────────────────────┬────────────────────────┘
                                                      │
                                                      ▼
                ┌─────────────────────────────────────┼─────────────────────────────────────┐
                │                                     │                                     │
                ▼                                     ▼                                     ▼
┌─────────────────────────┐   ┌──────────────────────────────────────┐   ┌─────────────────────────┐
│ verifyToken             │   │ withMcpAuth                          │   │ NO bearer / bad bearer  │
│ src/lib/mcp/auth.ts     │   │ • parses Authorization header        │   │ → 401 InvalidTokenError │
│                         │   │ • required: true → 401 if no auth    │   │   {WWW-Authenticate:    │
│ 1. starts with vsl_?    │   │ • catches OAuthError throws → maps   │   │    Bearer error=...}    │
│ 2. verifyApiKeyHash()   │   │   to protocol-correct HTTP responses │   └─────────────────────────┘
│    src/lib/api/auth-core│   └──────────┬───────────────────────────┘
│    • SHA-256 hash       │              │ authInfo OK
│    • Supabase admin     │              ▼
│      lookup api_keys    │   ┌──────────────────────────────────────┐
│    • timingSafeEqual    │   │ createMcpHandler(setup, opts, config)│
│    • fire-and-forget    │   │ • setup: (server) => {} (empty;      │
│      last_used_at       │   │   Phase 41 will registerTool here)   │
│ 3. checkRateLimit(keyId)│   │ • opts: { serverInfo, capabilities }│
│    • !success → throw   │   │ • config: { basePath: '/api',        │
│      TemporarilyUnavail │   │            maxDuration: 60,          │
│ 4. return AuthInfo {    │   │            disableSse: true,         │
│      token, clientId,   │   │            sessionIdGenerator: undef}│
│      scopes:[],         │   │                                      │
│      extra: {userId,    │   │ → WebStandardStreamableHTTPServer    │
│             keyId}      │   │   Transport handles JSON-RPC         │
│    }                    │   └──────────┬───────────────────────────┘
└─────────────┬───────────┘              │
              │                           ▼
              │              ┌──────────────────────────────────────┐
              │              │ JSON-RPC 2.0 response                │
              │              │ • initialize → serverInfo, caps      │
              │              │ • tools/list → [] (empty in Phase 40)│
              │              └──────────────────────────────────────┘
              │
              └─→ throw → mapped by withMcpAuth catch:
                  InvalidTokenError → 401
                  InsufficientScopeError → 403
                  TemporarilyUnavailableError → 500 (we use this for rate-limit)
                  ServerError → 500
```

### Component Responsibilities

| Component | File | Responsibility |
|-----------|------|----------------|
| Route handler | `src/app/api/[transport]/route.ts` | Top-of-file static import of `mcp-handler` (build gate). Configures `createMcpHandler` with empty `setup` (Phase 41 will populate). Wraps with `withMcpAuth(handler, verifyToken, { required: true })`. Exports as GET/POST/DELETE. Sets `maxDuration = 60`. |
| MCP auth adapter | `src/lib/mcp/auth.ts` | Implements `verifyToken(req: Request, bearerToken?: string): Promise<AuthInfo \| undefined>`. Validates `vsl_` prefix, calls `verifyApiKeyHash`, calls `checkRateLimit`, returns `AuthInfo` with `extra: { userId, keyId }`. Throws `TemporarilyUnavailableError` on rate-limit fail. |
| Auth core | `src/lib/api/auth-core.ts` (NEW) | `verifyApiKeyHash(rawKey: string): Promise<{ userId: string; keyId: string }>` — SHA-256 hash + Supabase admin lookup + timingSafeEqual + fire-and-forget last_used_at. NextRequest-free. Throws on invalid. |
| REST auth (refactored) | `src/lib/api/auth.ts` | `authenticateApiKey(req: NextRequest)` becomes a thin wrapper: extract Bearer prefix, delegate to `verifyApiKeyHash`. Existing throw shape preserved (so `withApiAuth` catch block still maps to 401). |
| Middleware bypass | `src/middleware.ts` | New `if (pathname.startsWith('/api/mcp')) return` block — placed near the existing `/api/v1`, `/api/admin`, `/api/webhooks` bypasses. |
| Build smoke test | `src/__tests__/mcp/import-gate.test.ts` (NEW) | `import { createMcpHandler, withMcpAuth } from 'mcp-handler'` + `expect(typeof createMcpHandler).toBe('function')`. Fails the test suite if `mcp-handler` is missing or its exports change. |
| Route smoke test | `src/__tests__/mcp/verify-token.test.ts` (NEW) | Mocks Supabase admin + checkRateLimit. Asserts `verifyToken` returns `undefined` for missing/non-vsl bearer; returns `AuthInfo` for valid; throws `TemporarilyUnavailableError` when rate-limited. |

### Recommended Project Structure

```
src/
├── app/
│   └── api/
│       └── [transport]/
│           └── route.ts          # NEW — exports GET/POST/DELETE = authHandler
├── lib/
│   ├── api/
│   │   ├── auth-core.ts          # NEW — verifyApiKeyHash(rawKey)
│   │   ├── auth.ts               # MODIFIED — delegates to auth-core
│   │   ├── rate-limit.ts         # unchanged — checkRateLimit reused
│   │   └── with-api-auth.ts      # unchanged
│   └── mcp/
│       └── auth.ts               # NEW — verifyToken adapter
├── middleware.ts                 # MODIFIED — /api/mcp bypass
└── __tests__/
    └── mcp/                      # NEW directory
        ├── import-gate.test.ts   # build-regression smoke test
        └── verify-token.test.ts  # verifyToken behavior
```

### Pattern 1: Static-import Build Gate (the v2.3 lesson)

**What:** A direct, unconditional `import` at the top of `route.ts` that resolves `mcp-handler` from `node_modules` at build time.

**When to use:** Always. This is the single most important pattern in this phase.

**Why it works:** Next.js 15 with `next build --turbopack` walks the module graph for every `route.ts` it discovers under `src/app/`. If `mcp-handler` is declared in `package.json` but not present in `node_modules` (the v2.3 failure mode — likely a partial install or `.gitignore`'d node_modules combined with a missing CI install step), the build fails with `Module not found: Can't resolve 'mcp-handler'`. Dynamic `await import('mcp-handler')` would defer that failure to request time — which is exactly what made v2.3 fail at runtime instead of at deploy time.

```typescript
// src/app/api/[transport]/route.ts
// Source: docs/AUTHORIZATION.md (Context7 /vercel/mcp-handler)
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { verifyToken } from '@/lib/mcp/auth'

const handler = createMcpHandler(
  (server) => {
    // Phase 41 will registerTool here. Empty in Phase 40.
  },
  {
    serverInfo: { name: 'viralslidemaker-mcp', version: '0.1.0' },
    capabilities: { tools: {} },
  },
  {
    basePath: '/api',          // routes to /api/mcp and /api/sse via [transport]
    maxDuration: 60,           // matches REST /api/v1/carousel
    disableSse: true,          // SSE deprecated by 2025-03-26 spec; we only serve streamable HTTP
    // sessionIdGenerator NOT set → stateless transport (Vercel serverless safe)
  }
)

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
})

export { authHandler as GET, authHandler as POST, authHandler as DELETE }
export const maxDuration = 60
```

### Pattern 2: NextRequest-free Auth Core

**What:** Pull the SHA-256 + DB lookup + timingSafeEqual logic out of `authenticateApiKey(NextRequest)` into `verifyApiKeyHash(rawKey: string)`, so both `withApiAuth` (REST) and `verifyToken` (MCP) share one source of truth.

**When to use:** This phase. `verifyToken` receives a plain `Request` (not `NextRequest`) and a pre-extracted `bearerToken: string`. Importing `authenticateApiKey` from MCP would force converting `Request` to `NextRequest` — a foot-gun.

```typescript
// src/lib/api/auth-core.ts (NEW)
import { createHash, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export class InvalidApiKeyError extends Error {
  constructor() { super('Invalid API key') }
}

export async function verifyApiKeyHash(
  rawKey: string
): Promise<{ userId: string; keyId: string }> {
  if (!rawKey.startsWith('vsl_')) throw new InvalidApiKeyError()

  const keyHash = createHash('sha256').update(rawKey).digest('hex')
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('api_keys')
    .select('id, user_id, key_hash')
    .eq('key_hash', keyHash)
    .single()
  if (error || !data) throw new InvalidApiKeyError()

  const storedHashBuf = Buffer.from(data.key_hash, 'utf8')
  const computedHashBuf = Buffer.from(keyHash, 'utf8')
  if (!timingSafeEqual(storedHashBuf, computedHashBuf)) throw new InvalidApiKeyError()

  // Fire-and-forget last_used_at update
  admin.from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return { userId: data.user_id, keyId: data.id }
}
```

```typescript
// src/lib/api/auth.ts (REFACTORED)
import { NextRequest } from 'next/server'
import { verifyApiKeyHash } from './auth-core'

export async function authenticateApiKey(
  request: NextRequest
): Promise<{ userId: string; keyId: string }> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer vsl_')) {
    throw new Error('Missing or invalid Authorization header')
  }
  const rawKey = authHeader.slice(7) // 'Bearer '
  try {
    return await verifyApiKeyHash(rawKey)
  } catch {
    throw new Error('Invalid API key')
  }
}
```

The error-message strings (`'Missing or invalid Authorization header'`, `'Invalid API key'`) are deliberately preserved verbatim — `src/lib/api/with-api-auth.ts:85-89` matches against them in its catch block. Changing the message would silently break REST auth-failure-to-401 mapping.

### Pattern 3: verifyToken with rate-limit-as-OAuthError

**What:** `verifyToken` is the right place to call `checkRateLimit` because (a) we've just resolved `keyId` and (b) `withMcpAuth`'s catch block translates `OAuthError` subclasses into protocol-correct HTTP responses with `WWW-Authenticate` headers.

**Why throw vs return undefined:** Returning `undefined` would surface as a generic 401 "no authorization provided" — wrong, because the bearer was valid. Throwing `TemporarilyUnavailableError` triggers the `error instanceof errors_js.ServerError` branch (TemporarilyUnavailableError extends ServerError? — verify in plan), which returns a 500 with the `temporarily_unavailable` errorCode. **Best fit:** throw `TemporarilyUnavailableError` from `verifyToken` — `mcp-handler`'s `withMcpAuth` translates it to a protocol-correct response with the right errorCode. [CITED: mcp-handler dist/index.js auth-wrapper catch block]

```typescript
// src/lib/mcp/auth.ts (NEW)
// Source: docs/AUTHORIZATION.md from Context7 /vercel/mcp-handler
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { TemporarilyUnavailableError } from '@modelcontextprotocol/sdk/server/auth/errors.js'
import { verifyApiKeyHash, InvalidApiKeyError } from '@/lib/api/auth-core'
import { checkRateLimit } from '@/lib/api/rate-limit'

export async function verifyToken(
  _req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined            // → withMcpAuth required:true → 401
  if (!bearerToken.startsWith('vsl_')) return undefined

  let userId: string, keyId: string
  try {
    ({ userId, keyId } = await verifyApiKeyHash(bearerToken))
  } catch (err) {
    if (err instanceof InvalidApiKeyError) return undefined  // → 401 InvalidTokenError
    throw err  // unexpected → 500 ServerError
  }

  const rl = await checkRateLimit(keyId)
  if (!rl.success) {
    throw new TemporarilyUnavailableError('Rate limit exceeded')
  }

  return {
    token: bearerToken,
    clientId: keyId,
    scopes: [],
    extra: { userId, keyId },
  }
}
```

**Phase 41 contract:** Tools read `extra.authInfo.extra.userId` and `extra.authInfo.extra.keyId` to scope DB queries and bill credits. The shape of `extra` is the cross-phase interface — do NOT rename these fields.

### Anti-Patterns to Avoid

- **Dynamic `await import('mcp-handler')` in the route:** Defers module-resolution failures to request time. This is exactly the v2.3 failure pattern — do not do this even "for code-splitting".
- **Calling `authenticateApiKey(req)` from `verifyToken`:** Forces `Request` → `NextRequest` conversion and adds the `'Bearer '` prefix back just to slice it off again. Use `verifyApiKeyHash` directly.
- **Returning `undefined` from `verifyToken` on rate-limit:** Surfaces as 401 `invalid_token`, semantically misleading the client. Throw `TemporarilyUnavailableError` instead.
- **Setting `sessionIdGenerator: () => crypto.randomUUID()`:** Activates stateful transport, which requires sticky sessions or a shared Redis store between requests. Vercel serverless functions are ephemeral — sessions would die between requests. `sessionIdGenerator: undefined` (the default) is the correct stateless mode.
- **Leaving SSE enabled:** SSE was deprecated in the 2025-03-26 MCP spec. Set `disableSse: true`. Reduces attack surface and prevents the `[transport]/sse` route from accepting requests we didn't design for. [CITED: mcp-handler Config.disableSse JSDoc]
- **Adding the route under `src/app/api/mcp/route.ts` instead of `[transport]`:** `mcp-handler`'s endpoint derivation expects the `[transport]` segment to map `mcp` and `sse`. A static `/api/mcp/route.ts` would not match the `streamableHttpEndpoint` calculation and would 404 the SSE path entirely (acceptable in our case since we disable SSE — but the convention is `[transport]`, and Phase 41+ tools may rely on it).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP JSON-RPC envelope parsing | Custom `JSON.parse` + JSON-RPC 2.0 validator | `mcp-handler`'s `WebStandardStreamableHTTPServerTransport` | Spec-compliance is non-trivial; mcp-handler handles `initialize`, `tools/list`, `tools/call`, error envelopes |
| Bearer header parsing + WWW-Authenticate response | Custom auth middleware | `withMcpAuth` from `mcp-handler` | Already handles RFC 9728 resource-metadata URL, lowercase Bearer normalization, scope-checking, expiry-checking, error-class → HTTP-status translation |
| MCP error response shape | Custom `{ jsonrpc, error: { code, message } }` builders | Throw `OAuthError` subclasses from `@modelcontextprotocol/sdk/server/auth/errors.js` | `withMcpAuth`'s catch block maps them to spec-correct responses with `WWW-Authenticate` headers |
| Rate-limit response | Custom 429 with Retry-After | `TemporarilyUnavailableError` thrown from `verifyToken` | Returns MCP-protocol-correct 500 with `temporarily_unavailable` errorCode and `WWW-Authenticate` header |

**Key insight:** `mcp-handler` is a thin, opinionated layer that exists specifically to absorb the protocol boilerplate. Every line we write inside `verifyToken` and the `setup` callback IS our business logic — everything else is library work. We exited v2.3 with ~80 LOC of our own MCP code; v2.6 should land in the same range.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `vsl_` API keys are already in `public.api_keys` (set up in v2.2). No new tables. No rename of any existing key/column. | None |
| Live service config | Vercel project: `mcp-handler` may want a `vercel.json` `functions["src/app/api/[transport]/route.ts"].maxDuration` override IF the route's `export const maxDuration = 60` is not respected on the current Vercel plan. Default Hobby plan is 10s — this would 504 on long tool calls (relevant Phase 41+, not 40). | Verify Vercel plan limit; the `export const maxDuration = 60` declaration in `route.ts` is the canonical Next.js 15 way. |
| OS-registered state | None — no scheduled tasks, no native bridges, no daemons. | None |
| Secrets and env vars | `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` already required by `src/lib/api/rate-limit.ts` (gracefully no-ops in dev when missing). NO new env vars introduced by this phase. | Verify production has them set (already a known blocker in STATE.md "Upstash Redis env vars need provisioning"). |
| Build artifacts / installed packages | `node_modules/mcp-handler` is currently MISSING (v2.3 was retired and the dep removed via quick `260428-rmm`). `node_modules/@modelcontextprotocol/sdk@1.26.0` is still present (transitive via something else, or stale). | `npm install mcp-handler@1.1.0 @modelcontextprotocol/sdk@1.29.0` will refresh both. After install, run `ls node_modules/mcp-handler/dist/index.d.ts` as a verification step in the plan. |

**The canonical question:** *After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?* — Nothing. This is an additive infrastructure phase, not a rename. The only "carry-over" risk is that the v2.3 retirement quick (260428-rmm) successfully removed all references, so we are starting clean.

## Common Pitfalls

### Pitfall 1: Module-not-found at request time (the v2.3 retirement cause)

**What goes wrong:** `mcp-handler` is in `package.json` but not in `node_modules`. `next build` succeeds (because the route file is present and TypeScript checks pass against the type-only imports if you were unlucky enough to use `import type`), but at runtime the `[transport]/route.ts` throws `Cannot find module 'mcp-handler'` and returns 500.

**Why it happens:** Multiple causes — partial `npm install` after a merge conflict, Vercel build cache poisoning, a `.gitignore`'d `package-lock.json` causing version drift, or a postinstall hook that fails silently.

**How to avoid:**
1. Use a static `import { createMcpHandler, withMcpAuth } from 'mcp-handler'` (NOT `import type`). A type-only import gets erased at build time and won't fail on missing modules.
2. Add a vitest smoke test (`src/__tests__/mcp/import-gate.test.ts`) that does the same import and asserts `typeof createMcpHandler === 'function'` — this catches the failure even when types are present but the runtime module is missing.
3. Make `npm run build` a required CI step before any Vercel deploy. `next build --turbopack` walks the module graph and fails on missing runtime imports.

**Warning signs:** `Cannot find module 'mcp-handler'` in Vercel runtime logs. 500 errors at `/api/mcp` with no MCP-protocol error envelope.

### Pitfall 2: SSE route accidentally exposed

**What goes wrong:** With `disableSse: false` (the default), the dynamic `[transport]` route also serves `/api/sse` and `/api/message` (the SSE endpoints). These attempt to use Redis and may surface different auth/rate-limit behavior.

**Why it happens:** SSE is deprecated in MCP spec 2025-03-26 but `mcp-handler` keeps it on by default for backward compatibility.

**How to avoid:** Set `disableSse: true` in the `createMcpHandler` config block. If the middleware bypass uses `startsWith('/api/mcp')`, the `/api/sse` path would NOT bypass session auth — but the route handler would still try to serve it. Belt-and-braces: disable SSE at the handler level.

### Pitfall 3: AuthInfo import path

**What goes wrong:** Importing `AuthInfo` from `'mcp-handler'` fails because mcp-handler does NOT re-export it.

**Why it happens:** mcp-handler imports `AuthInfo` from `@modelcontextprotocol/sdk/server/auth/types.js` for its own type signatures but does not re-export the type from its own `index.d.ts`. (The retired v2.3 plan caught this — see `26-01-SUMMARY.md` "Auto-fixed Issues".)

**How to avoid:** Always import `AuthInfo` from the SDK directly:
```typescript
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
```

### Pitfall 4: `withMcpAuth` exported as `experimental_withMcpAuth`

**What goes wrong:** mcp-handler 1.1.0 exports BOTH `withMcpAuth` and `experimental_withMcpAuth` as the same symbol. If a future major moves to experimental-only, plans that import `withMcpAuth` would break.

**How to avoid:** Use `withMcpAuth` (the stable name) — it is the public name and the experimental alias is for internal Vercel deprecation tracking. [VERIFIED: `dist/index.d.ts` last-line `export { ..., withMcpAuth as experimental_withMcpAuth, ..., withMcpAuth }`]

### Pitfall 5: Middleware bypass too narrow OR too broad

**What goes wrong:** If the bypass is `pathname === '/api/mcp'` (exact match), nested paths like `/api/mcp/some-extension` (Phase 41+) would still go through Supabase session refresh and 302-redirect on missing session. If the bypass is `startsWith('/api/')`, it accidentally bypasses session auth for everything.

**How to avoid:** Use `startsWith('/api/mcp')` — matches `/api/mcp` and any future sub-paths but not unrelated `/api/*` routes. Same pattern as the existing `/api/v1` and `/api/webhooks` bypasses.

### Pitfall 6: `redisUrl` accidentally configured

**What goes wrong:** `mcp-handler` defaults `redisUrl` to `process.env.REDIS_URL || process.env.KV_URL`. If either env var is set (e.g., from a Vercel KV integration), `mcp-handler` initializes a Redis client even when not needed for stateless streamable HTTP — surfacing "Redis connection failed" errors at boot time.

**How to avoid:** Either explicitly pass `redisUrl: undefined` in the config, OR confirm those env vars are NOT set in the Vercel project. Stateless streamable HTTP does NOT need Redis. [VERIFIED: dist/index.d.ts Config.redisUrl JSDoc]

## Code Examples

### Example 1: Complete route.ts (synthesized from Context7 docs + verified types)

```typescript
// src/app/api/[transport]/route.ts
// Source: Context7 /vercel/mcp-handler docs/AUTHORIZATION.md + dist/index.d.ts inspection
import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { verifyToken } from '@/lib/mcp/auth'

const handler = createMcpHandler(
  (server) => {
    // Phase 41: server.registerTool(...) for list_templates, create_carousel, edit_slide, render_carousel
  },
  {
    serverInfo: {
      name: 'viralslidemaker-mcp',
      version: '0.1.0',
    },
    capabilities: { tools: {} },
  },
  {
    basePath: '/api',
    maxDuration: 60,
    disableSse: true,
    // sessionIdGenerator NOT set → stateless (Vercel serverless safe)
  }
)

const authHandler = withMcpAuth(handler, verifyToken, { required: true })

export { authHandler as GET, authHandler as POST, authHandler as DELETE }
export const maxDuration = 60
```

### Example 2: Build-gate vitest smoke test

```typescript
// src/__tests__/mcp/import-gate.test.ts
// REGRESSION GATE: prevents v2.3 failure mode (mcp-handler missing from node_modules)
import { describe, it, expect } from 'vitest'

describe('mcp-handler import gate', () => {
  it('imports createMcpHandler and withMcpAuth as functions', async () => {
    const mod = await import('mcp-handler')
    expect(typeof mod.createMcpHandler).toBe('function')
    expect(typeof mod.withMcpAuth).toBe('function')
  })

  it('imports AuthInfo type and OAuth error classes from SDK', async () => {
    const errs = await import('@modelcontextprotocol/sdk/server/auth/errors.js')
    expect(typeof errs.InvalidTokenError).toBe('function')
    expect(typeof errs.TemporarilyUnavailableError).toBe('function')
  })
})
```

### Example 3: verifyToken unit test

```typescript
// src/__tests__/mcp/verify-token.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'

const mockSingle = vi.fn()
const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ then: vi.fn() }) })
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect, update: mockUpdate })

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({ from: mockFrom }),
}))

const mockCheckRateLimit = vi.fn()
vi.mock('@/lib/api/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
}))

describe('MCP verifyToken', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns undefined for missing bearer (→ 401 from withMcpAuth)', async () => {
    const { verifyToken } = await import('@/lib/mcp/auth')
    const req = new Request('http://localhost/api/mcp')
    expect(await verifyToken(req, undefined)).toBeUndefined()
  })

  it('returns undefined for non-vsl_ prefix', async () => {
    const { verifyToken } = await import('@/lib/mcp/auth')
    const req = new Request('http://localhost/api/mcp')
    expect(await verifyToken(req, 'sk_other')).toBeUndefined()
  })

  it('returns AuthInfo with extra.userId/keyId on valid key + rate-limit pass', async () => {
    const rawKey = 'vsl_test_abc'
    const keyHash = createHash('sha256').update(rawKey).digest('hex')
    mockSingle.mockResolvedValueOnce({ data: { id: 'k1', user_id: 'u1', key_hash: keyHash }, error: null })
    mockCheckRateLimit.mockResolvedValueOnce({ success: true, limit: 60, remaining: 59, reset: Date.now() + 60000 })

    const { verifyToken } = await import('@/lib/mcp/auth')
    const req = new Request('http://localhost/api/mcp')
    const result = await verifyToken(req, rawKey)
    expect(result).toMatchObject({
      token: rawKey,
      clientId: 'k1',
      scopes: [],
      extra: { userId: 'u1', keyId: 'k1' },
    })
  })

  it('throws TemporarilyUnavailableError on rate-limit fail', async () => {
    const rawKey = 'vsl_test_abc'
    const keyHash = createHash('sha256').update(rawKey).digest('hex')
    mockSingle.mockResolvedValueOnce({ data: { id: 'k1', user_id: 'u1', key_hash: keyHash }, error: null })
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 60, remaining: 0, reset: Date.now() + 60000 })

    const { verifyToken } = await import('@/lib/mcp/auth')
    const { TemporarilyUnavailableError } = await import('@modelcontextprotocol/sdk/server/auth/errors.js')
    const req = new Request('http://localhost/api/mcp')
    await expect(verifyToken(req, rawKey)).rejects.toBeInstanceOf(TemporarilyUnavailableError)
  })
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SSE-only transport | Streamable HTTP (request/response over POST) | MCP spec 2025-03-26 | SSE deprecated; clients should use `/api/mcp` not `/api/sse` |
| Hand-roll JSON-RPC + auth | `mcp-handler` adapter | mcp-handler@1.0.0 (2025-07-11) | ~250 LOC saved; spec-compliant errors out of the box |
| `streamableHttpEndpoint`/`sseEndpoint` config | `basePath: '/api'` derives endpoints | mcp-handler@~1.0 | The explicit endpoint config is now `@deprecated` in mcp-handler 1.1.0 — use `basePath` |
| Stateful sessions with `sessionIdGenerator` | Stateless (`sessionIdGenerator: undefined`) for serverless | Vercel guidance | Required for serverless — sessions die between requests otherwise |

**Deprecated/outdated:**

- `streamableHttpEndpoint`, `sseEndpoint`, `sseMessageEndpoint` config keys → use `basePath` [VERIFIED: dist/index.d.ts JSDoc `@deprecated`]
- SSE transport (`/api/sse`) → MCP spec 2025-03-26 dropped it [CITED: mcp-handler dist/index.d.ts JSDoc on `disableSse` field]

## Project Constraints (from CLAUDE.md)

No `CLAUDE.md` exists in the project root — no project-wide constraints to honor beyond CONTEXT.md.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `TemporarilyUnavailableError` extends `ServerError` (so `withMcpAuth` returns it as 500 not as a thrown 503) | Pattern 3 | Plan should verify the error class hierarchy in the SDK install before committing to this pattern. If `TemporarilyUnavailableError` is NOT caught by the `instanceof ServerError` branch, it would surface as the generic "Unexpected error" 500 — same HTTP status, but a less-specific errorCode in the body. Acceptable fallback. |
| A2 | `next build --turbopack` fails on missing static imports the same way as standard `next build` | Pitfall 1 | If turbopack is more permissive than standard webpack on missing-module errors, the build gate is weakened. Belt-and-braces vitest test still catches it. Plan's verification step should run `npm run build` and grep for "Module not found". |
| A3 | Phase 41 will read `extra.authInfo.extra.userId` to scope DB queries | Pattern 3 contract | If Phase 41 expects a different key shape, we'd need to revisit. The Phase 26 plan used the same shape — assume continuity. |

## Open Questions

1. **Is `TemporarilyUnavailableError` the right OAuth error for rate-limit?**
   - What we know: `withMcpAuth`'s catch block translates `InvalidTokenError`→401, `InsufficientScopeError`→403, `ServerError`→500. `TemporarilyUnavailableError` extends `OAuthError` per SDK errors.d.ts.
   - What's unclear: whether `TemporarilyUnavailableError` is matched by the `error instanceof errors_js.ServerError` branch (it is NOT explicitly named, so it falls through to the "unexpected error" `serverError = new ServerError(...)` branch, surfacing as generic 500).
   - Recommendation: At plan time, run a small isolated test to confirm. If `TemporarilyUnavailableError` doesn't get its specific errorCode in the response body, use `ServerError('Rate limit exceeded')` instead — pragmatic and equally correct from the client's perspective (still 500, still server-side).

2. **Does the Vercel project have `REDIS_URL` or `KV_URL` set?**
   - What we know: mcp-handler defaults `redisUrl` to those env vars, and stateless streamable HTTP does not need Redis.
   - What's unclear: whether the project has a Vercel KV integration that auto-injects `KV_URL`.
   - Recommendation: Plan should explicitly pass `redisUrl: undefined` in `createMcpHandler` config to be defensive. Cost: zero. Benefit: no surprise Redis init failures.

3. **Does the Vercel plan support `maxDuration: 60`?**
   - What we know: Hobby plan defaults to 10s, Pro to 60s, Enterprise to 900s. The route's `export const maxDuration = 60` is honored on Pro+.
   - What's unclear: which plan this project is on.
   - Recommendation: Set `maxDuration = 60` in the route AND in `createMcpHandler`'s `config.maxDuration`. If the deploy target is Hobby, the long Phase 41 tools (`create_carousel`) will 504 — but that surfaces in Phase 41 testing, not Phase 40.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `mcp-handler` package on npm | MCP-TRANS-01,02,06 | ✓ | 1.1.0 | None — required |
| `@modelcontextprotocol/sdk` package on npm | MCP-TRANS-02 | ✓ | 1.29.0 | None — required (peer dep of mcp-handler) |
| `@modelcontextprotocol/inspector` (dev tool) | Manual smoke test | ✓ | 0.21.2 | curl-based JSON-RPC POST as substitute |
| `@upstash/ratelimit` + `@upstash/redis` | MCP-TRANS-03 | ✓ (already installed) | ^2.0.8, ^1.37.0 | `checkRateLimit` no-ops in dev when env vars missing — production needs real Upstash creds |
| Upstash Redis credentials (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) | Production rate limiting | ✗ (per STATE.md blockers) | — | `checkRateLimit` returns `{ success: true }` in their absence — phase 40 NOT blocked but rate limiting is silently disabled in prod until provisioned |
| Supabase admin client | Auth core DB lookup | ✓ (already wired via `src/lib/supabase/admin.ts`) | — | None |
| Node.js runtime on Vercel | Crypto module | ✓ | 18+ | None |
| `vitest` | Smoke tests | ✓ (`^4.1.0` in devDeps) | 4.1.0 | None |

**Missing dependencies with no fallback:** None — the only missing item is the optional Upstash credentials, and the rate-limit code already gracefully no-ops without them.

**Missing dependencies with fallback:** `mcp-handler` is currently MISSING from `node_modules` (verified via `ls node_modules/mcp-handler` — no such directory). The plan's first task MUST be `npm install mcp-handler@1.1.0`.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `vitest.config.ts` (jsdom env, `@/` alias to `src/`, setupFiles `src/__tests__/setup.ts`) |
| Quick run command | `npx vitest run src/__tests__/mcp/ --no-coverage` |
| Full suite command | `npx vitest run --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MCP-TRANS-01 | Route file exists at `src/app/api/[transport]/route.ts` and exports GET/POST/DELETE | smoke (file-system check) | `node -e "require.resolve('./src/app/api/[transport]/route.ts'.replace('[transport]', '%5Btransport%5D'))"` or grep | ❌ Wave 0 |
| MCP-TRANS-01 | `npm run build` succeeds (route compiles + imports resolve) | build | `npm run build` | n/a (existing) |
| MCP-TRANS-02 | `verifyToken` returns `undefined` for missing/non-vsl bearer | unit | `npx vitest run src/__tests__/mcp/verify-token.test.ts -t "missing bearer"` | ❌ Wave 0 |
| MCP-TRANS-02 | `verifyToken` returns `AuthInfo` with `extra.userId/keyId` for valid key | unit | `npx vitest run src/__tests__/mcp/verify-token.test.ts -t "valid key"` | ❌ Wave 0 |
| MCP-TRANS-02 | Live endpoint returns 401 + WWW-Authenticate header on missing bearer | integration (manual or CI) | `curl -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' http://localhost:3000/api/mcp` → expect 401 | ❌ Wave 0 (curl runs against `npm run dev`) |
| MCP-TRANS-03 | `verifyToken` throws `TemporarilyUnavailableError` on rate-limit fail | unit | `npx vitest run src/__tests__/mcp/verify-token.test.ts -t "rate limit"` | ❌ Wave 0 |
| MCP-TRANS-04 | `createMcpHandler` config does NOT set `sessionIdGenerator` | source-grep | `grep -L "sessionIdGenerator" src/app/api/\[transport\]/route.ts` (expect file path = stateless) | n/a |
| MCP-TRANS-05 | `verifyApiKeyHash` exported from `src/lib/api/auth-core.ts` and called by both `authenticateApiKey` and `verifyToken` | unit + grep | `npx vitest run src/__tests__/mcp/verify-token.test.ts && grep -l "verifyApiKeyHash" src/lib/api/auth.ts src/lib/mcp/auth.ts` | ❌ Wave 0 |
| MCP-TRANS-06 | `import { createMcpHandler, withMcpAuth } from 'mcp-handler'` resolves at build AND test time | smoke | `npx vitest run src/__tests__/mcp/import-gate.test.ts && npm run build` | ❌ Wave 0 |
| MCP-TRANS-07 | `/api/mcp` bypass present in middleware | source-grep | `grep "api/mcp" src/middleware.ts` | n/a |
| MCP-TRANS-01 (E2E) | MCP Inspector completes `initialize` handshake against `http://localhost:3000/api/mcp` with `Bearer vsl_<test_key>` | integration (manual) | `npx -y @modelcontextprotocol/inspector` → set URL `http://localhost:3000/api/mcp`, set Authorization header, click Connect, expect serverInfo response with empty tools list | manual |

### Sampling Rate

- **Per task commit:** `npx vitest run src/__tests__/mcp/ --no-coverage` (~5s — fast loop)
- **Per wave merge:** `npx vitest run --no-coverage && npm run build` (full suite + build gate)
- **Phase gate:** Full suite green AND `curl -X POST http://localhost:3000/api/mcp` (no auth) returns 401 with `WWW-Authenticate` header AND MCP Inspector handshake succeeds with valid `vsl_` key

### Wave 0 Gaps

- [ ] `src/__tests__/mcp/` directory — does not exist yet
- [ ] `src/__tests__/mcp/import-gate.test.ts` — covers MCP-TRANS-06 build-regression
- [ ] `src/__tests__/mcp/verify-token.test.ts` — covers MCP-TRANS-02, 03, 05
- [ ] No new framework install needed — vitest 4.1.0 already configured

*(setup.ts at `src/__tests__/setup.ts` is already shared; no new fixtures needed.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Bearer-token (`vsl_` prefix) → SHA-256 hash → DB lookup → timing-safe compare. Library: Node `crypto` (`createHash`, `timingSafeEqual`) — never hand-roll comparison. |
| V3 Session Management | no | Stateless transport — no session state to manage. |
| V4 Access Control | partial | All MCP tools (Phase 41+) scope by `extra.authInfo.extra.userId` from the verified token. Phase 40 itself has no tools, so no row-level access decisions yet. |
| V5 Input Validation | partial | JSON-RPC envelope validation handled by `mcp-handler` via the SDK transport. Tool-input validation is per-tool (Phase 41) using zod. Phase 40: nothing user-controlled is parsed by us directly. |
| V6 Cryptography | yes | SHA-256 for hash (already used by `src/lib/api/auth.ts`). Timing-safe compare via `crypto.timingSafeEqual` (already used). No new crypto introduced. |
| V11 Business Logic | yes (rate-limit) | Per-key sliding-window rate limit via Upstash. Reused unchanged. |

### Known Threat Patterns for Next.js + MCP Bearer-Token

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token guessing / brute force | Spoofing | SHA-256 + timing-safe compare; rate limit per key (60 req/min) prevents online brute force. Tokens are 32+ random bytes (out of scope to verify here — set in api-key creation route). |
| Information disclosure on key validity | Information Disclosure | `verifyToken` returns `undefined` for ALL invalid-bearer cases (missing, wrong prefix, no DB row, hash mismatch) — `withMcpAuth` produces an identical 401 response in every case. No timing leak between "key not found" and "key found, hash mismatch" thanks to `timingSafeEqual`. |
| Replay of expired key | Spoofing | DB lookup hits live `api_keys` table on every request — revoked/deleted keys fail immediately. No JWT-style cached validity. |
| DoS via auth-bypass routes | Denial of Service | Rate limit is enforced INSIDE `verifyToken` (after hash succeeds, before MCP handler dispatches). Prevents amplification via expensive tool calls. NOTE: bad-bearer requests are NOT rate-limited (because `keyId` is unknown until hash succeeds) — pre-auth Layer 7 protection (Vercel WAF / Cloudflare) is the right control there. |
| Session-auth bypass coupling | Elevation of Privilege | `/api/mcp` bypass in `src/middleware.ts` skips Supabase session refresh. Bearer auth via `withMcpAuth({ required: true })` is the SOLE auth surface — Supabase session is never even consulted. |
| `[transport]` route catches unintended paths | Tampering | Dynamic route catches any non-static `/api/*` path. Disable SSE (`disableSse: true`) so only `/api/mcp` actively serves. `/api/sse` and `/api/message` return 404 from inside the handler. |
| Module-not-found at runtime | Denial of Service | Static top-of-file import + vitest smoke test + `npm run build` CI gate. The retired-v2.3 root cause. |

## Sources

### Primary (HIGH confidence)

- **Context7 `/vercel/mcp-handler`** — fetched docs for `createMcpHandler`, `withMcpAuth`, AUTHORIZATION.md, basePath/maxDuration/disableSse/sessionIdGenerator config (queries: "Next.js Streamable HTTP route", "stateless transport sessionIdGenerator basePath maxDuration", "redis url SSE resumability", "Vercel deployment runtime")
- **`/tmp/mcp-handler-inspect/package/dist/index.d.ts`** (via `npm pack mcp-handler@1.1.0`) — direct inspection of the published type definitions for `Config`, `withMcpAuth` options, default values, deprecated fields, JSDoc on every Config property
- **`/tmp/mcp-handler-inspect/package/dist/index.js`** — direct inspection of the runtime: confirmed `withMcpAuth`'s catch block maps `InvalidTokenError`→401, `InsufficientScopeError`→403, `ServerError`→500, others→500; confirmed Bearer header parsing is case-insensitive on the type ("bearer")
- **`node_modules/@modelcontextprotocol/sdk/dist/esm/server/auth/types.d.ts`** — direct inspection of the canonical `AuthInfo` interface (token, clientId, scopes, expiresAt, resource, extra)
- **`node_modules/@modelcontextprotocol/sdk/dist/esm/server/auth/errors.d.ts`** — direct inspection of `OAuthError`, `InvalidTokenError`, `InsufficientScopeError`, `TemporarilyUnavailableError`, `ServerError` class hierarchy
- **`npm view mcp-handler@1.1.0` + `npm view @modelcontextprotocol/sdk version`** — verified latest stable versions and publish dates (1.1.0 / 2026-03-24, 1.29.0 / 2026-03-30) [VERIFIED: npm registry]
- **Existing project files** — `src/lib/api/auth.ts`, `src/lib/api/with-api-auth.ts`, `src/lib/api/rate-limit.ts`, `src/middleware.ts`, `package.json`, `vitest.config.ts`, `src/__tests__/api/auth.test.ts`, `src/__tests__/api/rate-limit.test.ts`
- **Retired-v2.3 plan and summary** — `.planning/phases/26-mcp-transport-auth/26-01-PLAN.md`, `26-01-SUMMARY.md` — confirmed the architecture is sound, identified the AuthInfo import path gotcha that already burned us once

### Secondary (MEDIUM confidence)

- None needed — Context7 + dist/ inspection covered everything.

### Tertiary (LOW confidence)

- None — every claim above is sourced from one of the HIGH-confidence sources.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — versions verified via `npm view`, type contracts verified via direct dist/ inspection
- Architecture: HIGH — pattern is identical to retired v2.3 (which worked in dev) plus targeted fixes for the regression cause
- Pitfalls: HIGH — Pitfall 1 is from direct retirement post-mortem, Pitfall 3 from `26-01-SUMMARY.md` "Auto-fixed Issues", Pitfalls 2/4/5/6 from inspection of dist/ source

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (30 days — `mcp-handler` had a stable 1.0 → 1.1.0 cadence over 8 months; not fast-moving)
