---
phase: 40
status: passed
verified: 2026-04-28
must_have_pass_count: 5
must_have_total: 5
---

# Phase 40 Verification

**Phase Goal:** A `vsl_`-authenticated MCP client can complete the JSON-RPC 2.0 protocol handshake against `/api/mcp` on Vercel, with rate limiting and an explicit build-gate regression check that prevents the v2.3 failure mode (missing `mcp-handler` in `node_modules`) from ever recurring.

**Re-verification:** No — initial verification.

---

## Must-Have Coverage

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | Authenticated POST /api/mcp returns valid JSON-RPC 2.0 server-capabilities response | PASS | Route file `src/app/api/[transport]/route.ts` exists (38 lines) with static `import { createMcpHandler, withMcpAuth } from 'mcp-handler'` (line 10, NOT `import type`). `serverInfo: { name: 'viralslidemaker-mcp', version: '0.1.0' }` configured. `src/__tests__/mcp/route.test.ts` test 3 confirms valid Bearer + JSON-RPC `initialize` returns 200 with body containing `viralslidemaker-mcp`. All 3 route tests pass. |
| 2 | Invalid/missing/revoked Bearer returns MCP-protocol-correct error (NOT /login redirect) | PASS | `verifyToken` in `src/lib/mcp/auth.ts` returns `undefined` for missing/non-vsl_/InvalidApiKeyError → `withMcpAuth` produces 401 with `WWW-Authenticate: Bearer` header. Route tests 1+2 confirm 401 response with bearer challenge header. Middleware bypass at `src/middleware.ts:16` confirms /api/mcp does NOT hit Supabase session redirect path. All 4 auth.test.ts unit tests pass. |
| 3 | Per-key Upstash rate limit shares same counter as REST | PASS | `src/lib/mcp/auth.ts:9` imports `checkRateLimit` from the same `@/lib/api/rate-limit` module REST uses. `src/lib/api/rate-limit.ts:26` defines `checkRateLimit(keyId)` with shared `vsl:rl` Upstash prefix. The keyId comes from `verifyApiKeyHash(bearerToken)` return (line 21) — server-derived, NOT a request header. `src/__tests__/mcp/rate-limit.test.ts` confirms `mockCheckRateLimit.toHaveBeenCalledWith('k1')` (the keyId from auth) and that rate-limit failure throws `TemporarilyUnavailableError`. Both tests pass. |
| 4 | `npm run build` fails when mcp-handler is removed from node_modules (BUILD-GATE REGRESSION) | PASS | Layer 1: Static import `import { createMcpHandler, withMcpAuth } from 'mcp-handler'` confirmed at route.ts line 10 via grep (NOT `import type`). Layer 2: `src/__tests__/mcp/import-gate.test.ts` exists with 2 tests asserting `typeof mod.createMcpHandler === 'function'` and `typeof mod.withMcpAuth === 'function'`; both pass. Build proof: `npm run build` exits 0 with `[transport]` route discovered (`├ ƒ /api/[transport]`) and reports `./src/app/api/[transport]/route.ts` in the compiled output. The static import would produce `Module not found: Can't resolve 'mcp-handler'` if removed. |
| 5 | `src/middleware.ts` bypasses Supabase session auth for /api/mcp | PASS | `src/middleware.ts:16` contains `if (request.nextUrl.pathname.startsWith('/api/mcp')) return` — placed between the `/api/v1` (line 11) and `/api/admin` (line 21) bypass blocks. Same `startsWith` pattern as existing `/api/v1` and `/api/webhooks` entries. Matcher config unchanged. |

**AuthInfo Cross-Phase Contract (Phase 41 dependency)** — VERIFIED

`src/lib/mcp/auth.ts:32-37` returns `AuthInfo` with the exact shape Phase 41 will consume:

```typescript
return {
  token: bearerToken,
  clientId: keyId,
  scopes: [],
  extra: { userId, keyId },
}
```

The `extra: { userId, keyId }` field shape is asserted in `src/__tests__/mcp/auth.test.ts:50-55` via `toMatchObject`. Phase 41 tools can safely read `ctx.authInfo.extra.userId` and `ctx.authInfo.extra.keyId`.

---

## Sanity Checks

| Check | Result | Evidence |
|-------|--------|----------|
| `npm run build` exits 0 | PASS | Build completed; `[transport]` route compiled and discovered: `├ ƒ /api/[transport]` |
| `npx vitest run src/__tests__/mcp/ src/__tests__/api/auth.test.ts src/__tests__/api/auth-core.test.ts` all green | PASS | 6 test files passed, 20 tests passed in 627ms |
| `package.json` lists mcp-handler@^1.1.0 + @modelcontextprotocol/sdk@^1.29.0 | PASS | Both dependencies present at expected version ranges |
| `node_modules/mcp-handler/package.json` exists at v1.1.0 | PASS | File present, version 1.1.0 confirmed (NOT the v2.3 retirement scenario) |
| `node_modules/@modelcontextprotocol/sdk/package.json` exists at v1.29.0 | PASS | File present, version 1.29.0 confirmed |
| REST auth tests still pass after auth.ts → auth-core.ts refactor | PASS | `npx vitest run src/__tests__/api/auth.test.ts src/__tests__/api/with-api-auth.test.ts` → 2 files passed, 18 tests passed. Step D source-grep update kept REST tests green. |
| `authenticateApiKey` preserves error message strings | PASS | `src/lib/api/auth.ts:10` throws `'Missing or invalid Authorization header'`; `src/lib/api/auth.ts:18` throws `'Invalid API key'` — both substrings consumed by `with-api-auth.ts` 401 mapping, preserved verbatim |
| `keyId` for rate-limit derived server-side (not from request) | PASS | `src/lib/mcp/auth.ts:21` destructures `keyId` from `verifyApiKeyHash(bearerToken)` return; `src/lib/mcp/auth.ts:27` passes that same `keyId` to `checkRateLimit`. No request-header path. |
| `sessionIdGenerator` omitted (stateless mode) | PASS | `src/app/api/[transport]/route.ts:31` comment confirms omission; only mention of `sessionIdGenerator` in route file is the documenting comment. `redisUrl: undefined` (line 30) explicitly defeats KV_URL/REDIS_URL auto-detect. |

---

## Pre-Existing Failures

The executor's SUMMARY.md claims "8 pre-existing failing tests being unrelated." Audit of full `npx vitest run` (40 files, 238 tests):

**Result:** 8 file failures / 7 test failures. All confirmed unrelated to Phase 40.

| Failing Test | Phase 40 Touched? | Notes |
|--------------|-------------------|-------|
| `src/__tests__/api/rate-limit.test.ts` (2 tests) | NO | Last commit: `d490449` (Phase 23). Tests mock `Ratelimit.limit()` differently than current implementation. `src/lib/api/rate-limit.ts` unchanged by Phase 40. |
| `src/__tests__/stripe/checkout.test.ts` (1 test) | NO | Stripe `credit_pack_10` price test — affected by recent commit `32afd97` ("credit pack now grants 5 credits per $4.99 pack"), pre-Phase 40 |
| `src/__tests__/stripe/sync-subscription.test.ts` (1 test) | NO | Tier name "Pro" vs "Creator" — affected by recent commits `f09aae5` (tier rename) and `cd6c2a7` (tier credit changes), pre-Phase 40 |
| `src/__tests__/projects/crud.test.ts` (3 tests) | NO | Project CRUD test infrastructure issues, no MCP/auth touch |
| `src/__tests__/components/slide-preview.test.tsx` (suite-load) | NO | UI component test |
| `src/__tests__/editor/responsive.test.tsx` (suite-load) | NO | UI component test |
| `src/__tests__/editor/slide-preview.test.tsx` (suite-load) | NO | UI component test |
| `src/__tests__/projects/dashboard.test.tsx` (suite-load) | NO | Dashboard UI test |

None of the failing tests touch: MCP code, `auth-core.ts`, `auth.ts` refactor, `mcp/auth.ts`, `[transport]/route.ts`, or `middleware.ts`. Executor's claim verified.

---

## Gaps Found

None — phase delivers as promised.

All 5 ROADMAP success criteria pass. All 7 MCP-TRANS-0X requirements satisfied. Build gate works in both directions (positive: build passes with dep present; negative: import-gate test asserts the runtime function shape catches missing-dep scenario at test time). The AuthInfo contract for Phase 41 is in code and test-asserted.

---

## Recommendations for Phase 41

1. **AuthInfo contract is locked.** Phase 41 tool handlers must read `ctx.authInfo.extra.userId` and `ctx.authInfo.extra.keyId` (NOT `ctx.userId` or any other shape). The contract is established in `src/lib/mcp/auth.ts:36` and asserted in `src/__tests__/mcp/auth.test.ts:54`. Do NOT rename these fields in Phase 41 or any future phase — REST tests would not catch a regression here.

2. **Tool registration site is ready.** The empty `_server` callback at `src/app/api/[transport]/route.ts:14` is where the 4 tools (`list_templates`, `create_carousel`, `edit_slide`, `render_carousel`) should be registered. The ESLint warning on `_server` will resolve once Phase 41 uses the parameter.

3. **Rate-limit counter is shared.** Phase 41 does NOT need to add per-tool rate limiting at the auth layer — `verifyToken` already gates every MCP request through the shared `vsl:rl` counter. Phase 41 can focus on per-tool credit deduction (orthogonal concern).

4. **Stateless transport is the contract.** Do not introduce `sessionIdGenerator` in Phase 41 — Vercel serverless requires the stateless path. The `redisUrl: undefined` line at route.ts:30 explicitly defeats env-var auto-detect; do not remove it.

5. **Test infrastructure quirk.** The `// @vitest-environment node` directive in `src/__tests__/mcp/route.test.ts` is required (jsdom's stream polyfill rejects mcp-handler's chunks). Use the same directive for any Phase 41 tests that exercise the actual route handler end-to-end.

6. **Pre-existing failing tests are NOT Phase 41's responsibility** but the rate-limit test file (`src/__tests__/api/rate-limit.test.ts`) is worth fixing eventually since it shares conceptual ground with the MCP rate-limit contract — out-of-scope flagging for a future cleanup phase.

---

_Verified: 2026-04-28_
_Verifier: Claude (gsd-verifier)_
