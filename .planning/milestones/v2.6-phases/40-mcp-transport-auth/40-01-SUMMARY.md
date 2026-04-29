---
phase: 40-mcp-transport-auth
plan: 01
subsystem: mcp-transport
tags: [mcp, auth, rate-limit, transport, build-gate]
requirements_completed:
  - MCP-TRANS-01
  - MCP-TRANS-02
  - MCP-TRANS-03
  - MCP-TRANS-04
  - MCP-TRANS-05
  - MCP-TRANS-06
  - MCP-TRANS-07
dependency_graph:
  requires:
    - "src/lib/api/rate-limit.ts (existing — Upstash sliding-window)"
    - "src/lib/supabase/admin.ts (existing — service-role client)"
    - "src/middleware.ts (existing — extended with /api/mcp bypass)"
  provides:
    - "/api/mcp Streamable HTTP endpoint (Bearer-token authenticated, rate-limited, stateless)"
    - "src/lib/api/auth-core.ts:verifyApiKeyHash (NextRequest-free, shared by REST + MCP)"
    - "src/lib/mcp/auth.ts:verifyToken (withMcpAuth callback, throws TemporarilyUnavailableError)"
    - "Build-gate regression: static mcp-handler import + import-gate vitest test"
  affects:
    - "src/lib/api/auth.ts (refactored to delegate to verifyApiKeyHash)"
    - "src/__tests__/api/auth.test.ts (Step D source-grep test now reads auth-core.ts)"
    - "src/middleware.ts (added /api/mcp bypass between /api/v1 and /api/admin)"
tech_stack:
  added:
    - "mcp-handler@1.1.0 (Vercel's Next.js adapter for MCP Streamable HTTP)"
    - "@modelcontextprotocol/sdk@1.29.0 (AuthInfo type + OAuthError classes)"
  patterns:
    - "Static-import build gate: top-of-file `import { createMcpHandler, withMcpAuth } from 'mcp-handler'` makes `next build` fail fast on missing dep"
    - "NextRequest-free auth core: shared SHA-256+DB+timing-safe-compare extracted to auth-core.ts; both REST and MCP delegate to it"
    - "Throw OAuthError subclass from verifyToken: TemporarilyUnavailableError on rate-limit → withMcpAuth maps to MCP-protocol-correct 503"
    - "Stateless transport: sessionIdGenerator omitted; redisUrl: undefined; disableSse: true (MCP spec 2025-03-26)"
key_files:
  created:
    - "src/lib/api/auth-core.ts (54 lines)"
    - "src/lib/mcp/auth.ts (38 lines)"
    - "src/app/api/[transport]/route.ts (38 lines)"
    - "src/__tests__/mcp/import-gate.test.ts (16 lines, 2 tests)"
    - "src/__tests__/mcp/auth.test.ts (58 lines, 4 tests)"
    - "src/__tests__/mcp/rate-limit.test.ts (47 lines, 2 tests)"
    - "src/__tests__/mcp/route.test.ts (90 lines, 3 tests)"
    - "src/__tests__/api/auth-core.test.ts (51 lines, 3 tests)"
  modified:
    - "src/lib/api/auth.ts (refactored to thin Bearer-extraction wrapper, 22 lines)"
    - "src/middleware.ts (added /api/mcp bypass, +5 lines)"
    - "src/__tests__/api/auth.test.ts (Step D — source-grep test now reads auth-core.ts)"
    - "package.json + package-lock.json (mcp-handler@1.1.0 + @modelcontextprotocol/sdk@1.29.0)"
decisions:
  - "Used --legacy-peer-deps for npm install: mcp-handler@1.1.0 declares strict peer @modelcontextprotocol/sdk@1.26.0, but 1.29.0 is forward-compatible per RESEARCH.md (same v1 major)"
  - "src/__tests__/mcp/route.test.ts uses @vitest-environment node directive: jsdom's Web Streams polyfill yields non-Uint8Array chunks that mcp-handler's internal node-bridge writer rejects"
  - "Tightened route.test.ts POST cast to satisfy strict TS without `as never` (build-time noEmit typecheck includes test files)"
  - "ESLint warning 'unused _server' on route.ts is acceptable: matches the existing v1/templates/route.ts pattern in the repo (project style precedent)"
metrics:
  duration: "~25 minutes"
  completed_date: "2026-04-29"
  tasks_completed: 6
  files_created: 8
  files_modified: 4
  lines_added: ~290
  tests_added: 14
---

# Phase 40 Plan 01: MCP Transport & Auth Summary

`/api/mcp` Streamable HTTP endpoint stood up with `vsl_` Bearer auth, Upstash rate limiting, stateless transport, shared NextRequest-free auth-core helper, middleware bypass, and the static-import build-gate that prevents the v2.3 retirement cause (`mcp-handler` missing from `node_modules` → /api/mcp returns 500 at request time). Empty tool list — Phase 41 will register the 4 MCP tools on the server stood up here.

## What Was Built

### New Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/api/auth-core.ts` | 54 | `verifyApiKeyHash(rawKey)` + `InvalidApiKeyError`. NextRequest-free SHA-256 → DB lookup → `timingSafeEqual` → fire-and-forget `last_used_at` update. Shared by REST `authenticateApiKey` and MCP `verifyToken`. |
| `src/lib/mcp/auth.ts` | 38 | `verifyToken(req, bearer)` adapter for `withMcpAuth`. Returns `AuthInfo` with `extra: { userId, keyId }` on success; returns `undefined` on auth failure (→ 401); throws `TemporarilyUnavailableError` on rate-limit fail (→ 503 with `temporarily_unavailable` errorCode). |
| `src/app/api/[transport]/route.ts` | 38 | The MCP Streamable HTTP endpoint. Static top-of-file `import { createMcpHandler, withMcpAuth } from 'mcp-handler'` is the build gate. Stateless transport (no `sessionIdGenerator`), `disableSse: true`, `redisUrl: undefined`, `maxDuration: 60`. Wrapped with `withMcpAuth(handler, verifyToken, { required: true })`. Empty `setup` callback — Phase 41 owns tool registration. |
| `src/__tests__/mcp/import-gate.test.ts` | 16 | Belt-and-braces regression gate: asserts `createMcpHandler` and `withMcpAuth` are runtime functions; asserts SDK OAuth error classes exist. Catches the v2.3 failure mode at the test layer. |
| `src/__tests__/mcp/auth.test.ts` | 58 | 4 unit tests for `verifyToken` covering: missing bearer → undefined; non-`vsl_` prefix → undefined; `InvalidApiKeyError` → undefined; valid key + rate-limit pass → `AuthInfo` with cross-phase `extra: { userId, keyId }`. |
| `src/__tests__/mcp/rate-limit.test.ts` | 47 | 2 integration tests: rate-limit fail → throws `TemporarilyUnavailableError`; rate-limit pass → returns `AuthInfo`, `checkRateLimit` called with `keyId`. |
| `src/__tests__/mcp/route.test.ts` | 90 | 3 integration tests against the Route Handler: missing auth → 401 with `WWW-Authenticate: Bearer`; non-`vsl_` Bearer → 401; valid Bearer + JSON-RPC `initialize` → 200 with body containing `viralslidemaker-mcp`. Uses `@vitest-environment node` directive (see Deviations). |
| `src/__tests__/api/auth-core.test.ts` | 51 | 3 unit tests for `verifyApiKeyHash`: non-`vsl_` prefix → throws; no DB row → throws; valid → returns `{ userId, keyId }` and fires `last_used_at` update. |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/api/auth.ts` | Refactored from 42 lines (full SHA-256 + DB + timingSafeEqual implementation) to 22 lines (thin Bearer-extraction wrapper that delegates to `verifyApiKeyHash`). Error message strings `'Missing or invalid Authorization header'` and `'Invalid API key'` preserved verbatim — `with-api-auth.ts:85-89` matches against those substrings for 401 mapping. |
| `src/middleware.ts` | Added `if (request.nextUrl.pathname.startsWith('/api/mcp')) return` block between `/api/v1` and `/api/admin` bypasses (per Pitfall 5: `startsWith` matches `/api/mcp` and any future sub-paths but not unrelated `/api/*` routes). Matcher config unchanged. |
| `src/__tests__/api/auth.test.ts` | Step D update: the source-grep test "uses timingSafeEqual for hash comparison" now reads `src/lib/api/auth-core.ts` instead of `src/lib/api/auth.ts` — necessary because the crypto logic moved into the shared core. All other tests in the file unchanged and still green. |
| `package.json` + `package-lock.json` | Added `mcp-handler@^1.1.0` and `@modelcontextprotocol/sdk@^1.29.0` to dependencies. |

## Requirement-by-Requirement Coverage

### MCP-TRANS-01: `POST /api/mcp` Streamable HTTP endpoint accepts JSON-RPC 2.0
- Route file at `src/app/api/[transport]/route.ts` exports `GET`, `POST`, `DELETE` (per the dynamic-segment pattern documented in mcp-handler 1.1.0)
- `createMcpHandler` configured with `serverInfo: { name: 'viralslidemaker-mcp', version: '0.1.0' }` + `basePath: '/api'` (derives `/api/mcp` for streamable HTTP)
- `npm run build` confirms the `[transport]` route is discovered: `├ ƒ /api/[transport]                                          0 B`
- `src/__tests__/mcp/route.test.ts` test 3 confirms a valid Bearer + JSON-RPC `initialize` round-trips: `body.toContain('viralslidemaker-mcp')` passes

### MCP-TRANS-02: `withMcpAuth` rejects invalid keys with MCP-protocol-correct error
- Route wraps `createMcpHandler(...)` in `withMcpAuth(handler, verifyToken, { required: true })`
- `verifyToken` returns `undefined` for missing bearer, non-`vsl_` prefix, and `InvalidApiKeyError` — `withMcpAuth` produces an identical 401 with `WWW-Authenticate: Bearer` header in every case (no info leak)
- `src/__tests__/mcp/route.test.ts` tests 1 + 2 confirm: missing auth → 401 + `WWW-Authenticate: Bearer ...`; non-`vsl_` Bearer → 401
- `src/__tests__/mcp/auth.test.ts` 4 unit tests cover the `verifyToken` contract directly

### MCP-TRANS-03: Per-key Upstash rate limit, shared with REST
- `src/lib/mcp/auth.ts:verifyToken` calls `checkRateLimit(keyId)` from the existing `src/lib/api/rate-limit.ts` (same prefix `vsl:rl`, same 60 req/min sliding window — counter shared with REST `/api/v1/*`)
- On `!success`, `verifyToken` throws `TemporarilyUnavailableError` (extends `ServerError` → caught by `withMcpAuth`'s `instanceof ServerError` branch → 503 with `temporarily_unavailable` errorCode)
- `src/__tests__/mcp/rate-limit.test.ts` confirms: rate-limit fail → throws `TemporarilyUnavailableError`; rate-limit pass → returns `AuthInfo`; `checkRateLimit` called with `keyId` (the verified server-derived ID, not anything user-controllable)

### MCP-TRANS-04: Stateless mode (`sessionIdGenerator: undefined`)
- `createMcpHandler` config OMITS `sessionIdGenerator` entirely (the unset default IS the stateless path per `mcp-handler@1.1.0` `dist/index.d.ts`)
- `redisUrl: undefined` explicitly defeats `KV_URL`/`REDIS_URL` auto-detect (Pitfall 6)
- Route file grep: only mention of `sessionIdGenerator` is the comment "OMITTED → stateless transport (Vercel serverless safe)"

### MCP-TRANS-05: Bearer-token verification core extracted
- `src/lib/api/auth-core.ts` (NEW) exports `verifyApiKeyHash(rawKey)` + `InvalidApiKeyError`
- `src/lib/api/auth.ts:authenticateApiKey` (REST) delegates: `return await verifyApiKeyHash(rawKey)`
- `src/lib/mcp/auth.ts:verifyToken` (MCP) delegates: `({ userId, keyId } = await verifyApiKeyHash(bearerToken))`
- Both REST and MCP paths now share one source of truth for SHA-256 + DB lookup + timing-safe compare
- Error strings preserved: `'Missing or invalid Authorization header'` / `'Invalid API key'` (consumed by `with-api-auth.ts:85-89` for 401 mapping)
- 9/9 REST auth tests + 3/3 auth-core tests green

### MCP-TRANS-06: Build fails when `mcp-handler` missing from `node_modules`
- Static top-of-file `import { createMcpHandler, withMcpAuth } from 'mcp-handler'` (NOT `import type`) in `src/app/api/[transport]/route.ts`
- `npm run build` exits 0 with mcp-handler installed; would fail with `Module not found: Can't resolve 'mcp-handler'` if removed
- Belt-and-braces: `src/__tests__/mcp/import-gate.test.ts` runs in CI vitest, asserts `typeof mod.createMcpHandler === 'function'`
- Both gates close the v2.3 retirement-cause regression at deploy-time AND test-time

### MCP-TRANS-07: `/api/mcp` added to auth-bypass list in `src/middleware.ts`
- New block at line 16: `if (request.nextUrl.pathname.startsWith('/api/mcp')) return`
- Placed between `/api/v1` (line 11) and `/api/admin` (line 21) bypass blocks per the plan
- Pattern matches `/api/mcp` and any future sub-paths but not unrelated `/api/*` routes (Pitfall 5: avoids both too-narrow `===` and too-broad `/api/`)
- Matcher config unchanged

## Must-Haves Verification

| Must-Have | How Verified |
|-----------|--------------|
| Authenticated POST /api/mcp returns valid JSON-RPC 2.0 server capabilities | `src/__tests__/mcp/route.test.ts` test 3 — body contains `viralslidemaker-mcp` |
| POST /api/mcp without/malformed/revoked Bearer returns MCP-protocol-correct error | `src/__tests__/mcp/route.test.ts` tests 1+2 — 401 with `WWW-Authenticate: Bearer`. NOT a redirect to /login (middleware bypass works). |
| Per-key Upstash rate limit, shared with REST | `src/__tests__/mcp/rate-limit.test.ts` — `checkRateLimit` called with `keyId`; same prefix `vsl:rl` from existing rate-limit.ts (no new prefix introduced) |
| `next build` fails fast when mcp-handler removed from node_modules | Static import + `npm run build` exits 0 with dep present (gate works in the positive direction); import-gate test catches the negative direction in CI |
| `src/middleware.ts` bypasses Supabase session auth for /api/mcp | `grep -n /api/mcp src/middleware.ts` → line 16 in the bypass block |

## Build Output (last 8 lines)

```
ƒ Middleware                                              84.3 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

Build exit code: 0
[transport] route discovered: ├ ƒ /api/[transport]                                          0 B            0 B
```

## Test Suite Result

```
$ npx vitest run src/__tests__/mcp/ src/__tests__/api/auth.test.ts src/__tests__/api/auth-core.test.ts --no-coverage

 Test Files  6 passed (6)
      Tests  20 passed (20)
   Duration  591ms
```

Files: `import-gate.test.ts` (2), `auth.test.ts` MCP (4), `rate-limit.test.ts` MCP (2), `route.test.ts` (3), `auth-core.test.ts` (3), `auth.test.ts` REST (6 — kept green via Step D update).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm install required `--legacy-peer-deps`**
- **Found during:** Task 2
- **Issue:** `mcp-handler@1.1.0` declares a strict peer dependency on `@modelcontextprotocol/sdk@1.26.0` (exact pin), but the plan installs `1.29.0`. RESEARCH.md explicitly notes 1.29.0 is forward-compatible (same v1 major), but npm's strict peer resolution refuses without the flag.
- **Fix:** `npm install mcp-handler@1.1.0 @modelcontextprotocol/sdk@1.29.0 --legacy-peer-deps`
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** `d490a8b`
- **Verification:** `node_modules/mcp-handler/package.json` and `node_modules/@modelcontextprotocol/sdk/package.json` confirm versions 1.1.0 and 1.29.0 respectively.

**2. [Rule 3 - Blocking] route.test.ts needed `@vitest-environment node`**
- **Found during:** Task 5 verification
- **Issue:** The valid-Bearer handshake test in `src/__tests__/mcp/route.test.ts` timed out with `Unhandled Rejection: Unexpected chunk type: object` from `node_modules/mcp-handler/dist/index.mjs:755`. mcp-handler internally bridges Web `Response` streams through a fake node `ServerResponse` adapter; jsdom's Web Streams polyfill yields non-`Uint8Array` chunks that the bridge rejects.
- **Fix:** Added `// @vitest-environment node` directive at the top of `src/__tests__/mcp/route.test.ts`. Native node Web Streams produce `Uint8Array` chunks correctly.
- **Files modified:** `src/__tests__/mcp/route.test.ts`
- **Commit:** `a8f1e2c` (alongside the route handler creation)

**3. [Rule 3 - Blocking] route.test.ts POST cast adjusted to satisfy strict TS**
- **Found during:** Task 5 verification
- **Issue:** `route.POST(req as never, { params: ... } as never)` produced `error TS2554: Expected 1 arguments, but got 2` because mcp-handler's exported handler is `(req: Request) => Promise<Response>` (single arg). The plan's example used `as never` casts which suppressed runtime issues but not the TS-level arity check, and tsconfig.json includes test files.
- **Fix:** Replaced `as never` casts with an explicit local type assertion: `(route.POST as (req: Request, ctx: unknown) => Promise<Response>)(req, { params: ... })`. Documents the Next.js App Router convention while satisfying the actual mcp-handler signature.
- **Files modified:** `src/__tests__/mcp/route.test.ts`
- **Commit:** `a8f1e2c`

### Non-Deviations (worth flagging)

- **ESLint warning on `_server` parameter** in route.ts:14: Not auto-fixed — the existing project has the same pattern in `src/app/api/v1/templates/route.ts:5` (`_req`/`_ctx`). Following project precedent.
- **Pre-existing test failures**: `npx vitest run` (full suite) shows 8 pre-existing failures in unrelated files (`projects/crud.test.ts`, `stripe/checkout.test.ts`, `components/slide-preview.test.tsx`, etc.). Confirmed via `git stash` + re-run that these failures predate Phase 40 changes — out of scope per the SCOPE BOUNDARY rule.

## Authentication Gates

None encountered. The Upstash credentials are gracefully no-op'd in dev/test (per existing `src/lib/api/rate-limit.ts:27-30`). No external service auth needed during execution.

## Phase 41 Contract Reminder

Phase 41 tools will read the authenticated context via:
- `ctx.authInfo.extra.userId` — for DB query scoping
- `ctx.authInfo.extra.keyId` — for credit-deduction logging

**These field names are the cross-phase contract. DO NOT rename in Phase 41 or any future phase.** The shape is established in `src/lib/mcp/auth.ts:33` and asserted in `src/__tests__/mcp/auth.test.ts:48-52`.

## Manual Smoke Test (NOT run automatically — for human verification)

```bash
# Terminal 1 — start dev server
npm run dev

# Terminal 2 — confirm 401 on no auth (no Supabase /login redirect)
curl -i -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
# Expect: HTTP/1.1 401 with WWW-Authenticate: Bearer ...

# Terminal 2 — full handshake with MCP Inspector
npx -y @modelcontextprotocol/inspector
# In Inspector: URL = http://localhost:3000/api/mcp
#               Authorization: Bearer vsl_<your_test_key>
# Expect: serverInfo: { name: 'viralslidemaker-mcp', version: '0.1.0' }, tools: []
```

## Open Questions for Phase 41

- None directly blocking. Phase 41 should:
  - Register the 4 tools (list_templates, create_carousel, edit_slide, render_carousel) inside the empty `_server` callback in `src/app/api/[transport]/route.ts:14`
  - Read `ctx.authInfo.extra.userId` and `ctx.authInfo.extra.keyId` from the tool handler context
  - Use zod for tool input validation (per RESEARCH.md "V5 Input Validation")
- Vercel plan tier check (`maxDuration: 60` requires Pro+) is deferred to Phase 41 testing per RESEARCH.md Open Question 3 — the existing `/api/v1/carousel` route already uses the same value successfully, suggesting the plan tier supports it.

## Commits Made by This Plan

```
0f44cb1 feat(40-01): add /api/mcp bypass to middleware (MCP-TRANS-07)
a8f1e2c feat(40-01): add MCP Streamable HTTP route at src/app/api/[transport]/route.ts
9f24a5e feat(40-01): add MCP verifyToken adapter at src/lib/mcp/auth.ts
6e6f693 refactor(40-01): extract verifyApiKeyHash into auth-core.ts; refactor authenticateApiKey to delegate
d490a8b chore(40-01): install mcp-handler@1.1.0 + @modelcontextprotocol/sdk@1.29.0
8789021 test(40-01): add MCP test scaffolding (import-gate, auth, rate-limit, route, auth-core)
```

## Self-Check: PASSED

All 8 created files exist on disk:
- `src/lib/api/auth-core.ts`, `src/lib/mcp/auth.ts`, `src/app/api/[transport]/route.ts`
- `src/__tests__/mcp/import-gate.test.ts`, `src/__tests__/mcp/auth.test.ts`, `src/__tests__/mcp/rate-limit.test.ts`, `src/__tests__/mcp/route.test.ts`
- `src/__tests__/api/auth-core.test.ts`

All 6 task commits present in `git log`:
- `8789021`, `d490a8b`, `6e6f693`, `9f24a5e`, `a8f1e2c`, `0f44cb1`

`npm run build` exit code 0; `npx vitest run src/__tests__/mcp/ src/__tests__/api/auth.test.ts src/__tests__/api/auth-core.test.ts` reports 6 files passed, 20 tests passed.
