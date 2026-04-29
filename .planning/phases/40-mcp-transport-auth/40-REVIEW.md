---
phase: 40
status: findings_present
reviewed: 2026-04-28
critical_count: 0
warning_count: 2
nit_count: 3
---

# Phase 40: Code Review Report

**Reviewed:** 2026-04-28
**Depth:** standard (with cross-file tracing into `mcp-handler` internals for the rate-limit concern)
**Files Reviewed:** 9
- `src/app/api/[transport]/route.ts` (NEW)
- `src/lib/mcp/auth.ts` (NEW)
- `src/lib/api/auth-core.ts` (NEW)
- `src/lib/api/auth.ts` (REFACTORED)
- `src/middleware.ts` (UPDATED)
- `src/__tests__/mcp/auth.test.ts` (NEW)
- `src/__tests__/mcp/import-gate.test.ts` (NEW)
- `src/__tests__/mcp/rate-limit.test.ts` (NEW)
- `src/__tests__/mcp/route.test.ts` (NEW)
- `src/__tests__/api/auth-core.test.ts` (NEW)
- `src/__tests__/api/auth.test.ts` (UPDATED)

**Status:** findings_present (no Critical/HIGH; 2 MEDIUM warnings, 3 LOW nits)

## Summary

The auth-chain refactor (auth.ts → auth-core.ts) preserves the SHA-256 + `timingSafeEqual` flow correctly, the REST 401-mapping substring contract is intact (`'Authorization'` and `'API key'` still appear verbatim in `authenticateApiKey`'s thrown messages), the fire-and-forget `last_used_at` update still runs, and `AuthInfo.extra: { userId, keyId }` is wired correctly for Phase 41 tools to consume. Tests cover the critical paths (negative-prefix, missing-row, hash-mismatch, valid-key, last_used_at write) and the import gate locks in the build-time failure mode that retired v2.3.

The **two MEDIUM findings are real behavioral gaps** in the rate-limit + `withMcpAuth` integration:

1. `TemporarilyUnavailableError` does not extend `ServerError` in the SDK, so `withMcpAuth`'s catch block converts it to a generic `InvalidTokenError` 401 — not the 503 the source comment promises. The rate-limit test in `rate-limit.test.ts` only checks that `verifyToken` *throws* the error; it never exercises the integrated route response. So the contract documented in `src/lib/mcp/auth.ts:5` is not actually delivered end-to-end.
2. `withMcpAuth`'s outer catch unconditionally `console.error`s the raw thrown error. Today our errors carry no token, but any future throw site that includes `bearerToken` in a message would leak it to Vercel logs.

The three LOW findings are documentation/defense-in-depth items, not bugs.

## Critical Issues

_None._

## High Issues

_None._

## Medium Issues

### MR-01: `TemporarilyUnavailableError` from rate-limit returns 401, not 503

**File:** `src/lib/mcp/auth.ts:5,29` (and behavioral, root cause in `node_modules/mcp-handler/dist/index.js:904-916`)

**Issue:**
The header comment at `src/lib/mcp/auth.ts:5` claims:

> throws TemporarilyUnavailableError on rate-limit failure (→ 503 with temporarily_unavailable errorCode)

This is not what happens. `withMcpAuth` wraps the `verifyToken` call in a try/catch (mcp-handler index.js lines 904–916) that catches **every** error and converts it into `InvalidTokenError("Invalid token")` returned as **HTTP 401**. The second try/catch (lines 917–966), which has the `instanceof ServerError → 500` branch, only runs *after* `verifyToken` returns successfully (for scope/expiry/handler errors). And even that branch wouldn't help, because in `@modelcontextprotocol/sdk/dist/esm/server/auth/errors.d.ts:76` `TemporarilyUnavailableError` extends `OAuthError` directly — not `ServerError`.

Net effect: a rate-limited MCP client sees `401 Invalid token` with no `Retry-After`, instead of `503 temporarily_unavailable`. The integration test (`src/__tests__/mcp/rate-limit.test.ts:25-34`) only asserts the *internal* throw, never the route's actual HTTP response, so this gap is invisible from green tests.

**Fix:**
Add an explicit rate-limit response ahead of the throw, so we control the status and headers directly instead of relying on `withMcpAuth`'s error mapping. Smallest viable change in `src/lib/mcp/auth.ts`:

```ts
import { TemporarilyUnavailableError } from '@modelcontextprotocol/sdk/server/auth/errors.js'

// ...inside verifyToken, replace the existing rate-limit branch with:
const rl = await checkRateLimit(keyId)
if (!rl.success) {
  // mcp-handler's withMcpAuth catches anything thrown from verifyToken and
  // returns 401. To get a real 503 with Retry-After, either:
  //   (a) set required:false here and short-circuit a 503 Response in the
  //       handler before tools dispatch, or
  //   (b) accept 401 + custom error_description and document the deviation.
  // For now, throw a ServerError subclass so the second try/catch (line 954)
  // produces 500 instead of 401 — losing the 503 semantics but at least not
  // misleading the client into thinking their key is invalid.
  throw new TemporarilyUnavailableError('Rate limit exceeded')
}
```

Better long-term fix: drop `withMcpAuth` and do the auth + rate-limit check ourselves in the route file, returning native `Response`s with proper status + `Retry-After` / `WWW-Authenticate` headers. That removes mcp-handler's lossy error mapping from the equation entirely.

At minimum **update the comment in `src/lib/mcp/auth.ts:5`** to accurately reflect actual behavior (currently 401), and **add a route-level test** that drives a real Request through `route.POST` with `mockCheckRateLimit` returning `success:false` and asserts the actual `res.status`. That test would have caught this.

---

### MR-02: `withMcpAuth` `console.error`s the entire caught error from `verifyToken`

**File:** `src/lib/mcp/auth.ts` (behavioral; root cause `node_modules/mcp-handler/dist/index.js:907,962`)

**Issue:**
`withMcpAuth`'s catch block does `console.error("Unexpected error authenticating bearer token:", error)` (lines 907 and 962). On Vercel this writes to the function logs. Today, none of our throw sites include the bearer token in their message — `verifyApiKeyHash` throws `new InvalidApiKeyError()` with the default `'Invalid API key'` string, and the rate-limit branch throws `new TemporarilyUnavailableError('Rate limit exceeded')`. So in practice no token is leaked.

But the contract is fragile: any future change that does `throw new Error(\`bad token \${bearerToken}\`)` in `verifyToken` (or any helper it calls) would silently emit the raw bearer to logs. We should make the no-leak property explicit and protected.

**Fix:**
Wrap the entire body of `verifyToken` in a single try/catch at the boundary, scrubbing any error message before letting it propagate. Smallest version in `src/lib/mcp/auth.ts`:

```ts
export async function verifyToken(
  _req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined
  if (!bearerToken.startsWith('vsl_')) return undefined

  try {
    const { userId, keyId } = await verifyApiKeyHash(bearerToken)
    const rl = await checkRateLimit(keyId)
    if (!rl.success) throw new TemporarilyUnavailableError('Rate limit exceeded')
    return { token: bearerToken, clientId: keyId, scopes: [], extra: { userId, keyId } }
  } catch (err) {
    if (err instanceof InvalidApiKeyError) return undefined
    if (err instanceof TemporarilyUnavailableError) throw err
    // Strip any incidental token leakage before re-throwing.
    const msg = err instanceof Error ? err.message.replaceAll(bearerToken, 'vsl_***') : 'unknown'
    throw new Error(msg)
  }
}
```

Alternative: add a unit test that calls `verifyToken` with a token whose value (e.g. `vsl_LEAK_CANARY_${Date.now()}`) is grepped for in any captured `console.error` mock, asserting it never appears. That would catch future regressions.

## Low Issues / Nits

### LR-01: Middleware bypass `startsWith('/api/mcp')` would also match `/api/mcps` or `/api/mcp-foo`

**File:** `src/middleware.ts:16`

**Issue:**
`request.nextUrl.pathname.startsWith('/api/mcp')` matches `/api/mcp`, `/api/mcp/anything`, but also `/api/mcps`, `/api/mcp-admin`, etc. No such routes exist today, so this is not currently exploitable. But the same shape of typo or sibling-route addition is exactly how middleware bypass surprises happen later. The other bypass entries in this file (`/api/webhooks`, `/api/v1`, `/api/admin`) have the same theoretical issue, so there's a consistency argument for the current form — but it's still worth tightening.

**Fix:**
Use a stricter prefix match, either:

```ts
const p = request.nextUrl.pathname
if (p === '/api/mcp' || p.startsWith('/api/mcp/')) {
  return
}
```

Or add a top-level guard test that asserts the bypass list does not match any unintended sibling path.

---

### LR-02: `auth.ts` rethrow loses original error type/stack

**File:** `src/lib/api/auth.ts:18-20`

**Issue:**
```ts
if (err instanceof InvalidApiKeyError) {
  throw new Error('Invalid API key')
}
```
This converts the typed `InvalidApiKeyError` into a plain `Error` with the same message. The substring `'API key'` is preserved (so `with-api-auth.ts:87` 401-mapping still works — verified), but downstream callers that might want `instanceof InvalidApiKeyError` lose that signal, and the original stack trace is dropped. Today nothing depends on the type, so this is a nit, not a bug.

**Fix:**
Either preserve the type by re-throwing `err` directly (the message `'Invalid API key'` already contains the matched substring), or use `cause`:

```ts
if (err instanceof InvalidApiKeyError) {
  throw new Error('Invalid API key', { cause: err })
}
```

The first option (just `throw err`) is simpler and works because `InvalidApiKeyError`'s default message is already `'Invalid API key'`.

---

### LR-03: Route file omits `export const runtime = 'nodejs'`

**File:** `src/app/api/[transport]/route.ts:38`

**Issue:**
The file exports `maxDuration = 60` but not `runtime = 'nodejs'`. The MCP route uses Node-only crypto via `verifyApiKeyHash` (which calls `createHash` and `timingSafeEqual` from `'crypto'`) and the Supabase admin client, so it must run on the Node runtime — not the Edge runtime.

In Next.js App Router the App Router default *is* Node, so this works. The existing v1 routes (e.g. `src/app/api/v1/carousel/route.ts`) also omit `runtime`, so this is consistent with project convention. Flagging as a nit because if someone ever changes the project default or this route is moved to Edge by accident, the failure mode is silent (`crypto` import fails at request time). Adding `export const runtime = 'nodejs'` makes the requirement explicit and self-documenting.

**Fix:**
Add to `src/app/api/[transport]/route.ts`:
```ts
export const runtime = 'nodejs'
```

If the team prefers to stay consistent with v1 and not add it, leave as-is and consider a project-level note in `CLAUDE.md` that all `/api/*` routes run on Node.

## Items Verified (No Findings)

- **SHA-256 + `timingSafeEqual` flow preserved:** `auth-core.ts:21-42` performs the exact same hash → DB lookup → buffer-length-equality → `timingSafeEqual` sequence as the pre-refactor `auth.ts`. Both buffers are constructed identically (`Buffer.from(x, 'utf8')`).
- **REST 401 substring contract intact:** `with-api-auth.ts:85-90` matches `err.message.includes('Authorization') || err.message.includes('API key')`. `auth.ts` still throws `'Missing or invalid Authorization header'` and `'Invalid API key'` — both substrings present. Verified.
- **Fire-and-forget `last_used_at`:** `auth-core.ts:44-49` issues the update without `await`, identical to the pre-refactor behavior. The `.then(() => {})` keeps lint happy without blocking. Test covers it (`auth-core.test.ts:44-46`).
- **AuthInfo cross-phase contract:** `extra: { userId, keyId }` is set in `auth.ts:36`. SDK type at `@modelcontextprotocol/sdk/dist/esm/server/auth/types.d.ts:30` is `extra?: Record<string, unknown>` — Phase 41 tools will need to narrow the type when reading, but both fields are guaranteed present.
- **Stateless transport config:** `route.ts:13-33` correctly omits `sessionIdGenerator`, sets `disableSse: true`, and explicitly sets `redisUrl: undefined` to defeat any stale `KV_URL`/`REDIS_URL` auto-detection in Vercel.
- **`required: true` on `withMcpAuth`:** Correct for "we always require auth." Confirmed against `withMcpAuth` source at index.js:918 — when `required` is true and `authInfo` is undefined, an `InvalidTokenError` is thrown, producing the 401 the route test expects.
- **No debug artifacts:** No `console.log`, `debugger`, `TODO`, `FIXME`, `XXX`, or `HACK` strings in any of the 6 changed source files (verified via grep).
- **No unused imports:** `auth.ts` post-refactor imports only `NextRequest`, `verifyApiKeyHash`, `InvalidApiKeyError` — all used. No stale `createHash`/`timingSafeEqual`/`createAdminClient` imports left over.
- **Bearer-token error-message hygiene (current state):** None of our throw sites include the bearer token in error messages today. Token does not appear in `InvalidApiKeyError`, `TemporarilyUnavailableError`, or any thrown string in `auth.ts`/`auth-core.ts`. (See MR-02 for the future-proofing concern.)
- **Import gate works:** `import-gate.test.ts` correctly asserts `createMcpHandler`, `withMcpAuth`, and the OAuth error classes are real functions, locking in the build-time failure mode.

---

_Reviewed: 2026-04-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
