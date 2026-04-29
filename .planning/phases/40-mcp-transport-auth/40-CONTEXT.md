# Phase 40: MCP Transport & Auth - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped via smart-discuss)

<domain>
## Phase Boundary

Stand up the `/api/mcp` Streamable HTTP endpoint with `vsl_` Bearer-token authentication, Upstash sliding-window rate limiting, stateless transport for Vercel serverless compatibility, and an explicit build-gate regression check that prevents the v2.3 failure mode (`mcp-handler` missing from `node_modules`) from recurring. NO tool definitions in this phase — Phase 41 registers tools on the server stood up here.

</domain>

<decisions>
## Implementation Decisions

### Locked from v2.6 plan and REQUIREMENTS.md

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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/lib/api/auth.ts:authenticateApiKey` — SHA-256 hash → DB lookup → timingSafeEqual → fire-and-forget `last_used_at` update. Auth-core extraction target.
- `src/lib/api/with-api-auth.ts` — REST wrapper that chains auth → rate limit → credits → CORS → handler. Pattern reference (NOT directly callable from MCP path because of `NextRequest` coupling).
- `src/lib/api/rate-limit.ts` — Upstash sliding-window limiter keyed by API key ID. Reuse directly.
- `src/lib/supabase/admin.ts` — `createAdminClient()` for service-role DB access from non-session contexts.
- `src/middleware.ts` — existing auth bypass for `/api/v1`, `/api/webhooks`. Add `/api/mcp` to the same list.

### Established Patterns

- **REST auth flow:** Bearer token in `Authorization` header → SHA-256 hash → row lookup in `api_keys` table → timingSafeEqual against stored `key_hash` → return `{ userId, keyId }`. Fire-and-forget `last_used_at` update.
- **Rate limit flow:** key by `keyId`, check Upstash sliding window, on success continue; on 429 return error with `Retry-After` header.
- **Error response shape (REST):** `{ error: { code, message } }` with codes from a fixed enum (UNAUTHORIZED, RATE_LIMITED, VALIDATION_ERROR, etc.). MCP errors will follow MCP-protocol shape, NOT this REST shape — tool implementations may need to translate.
- **Test pattern:** vitest under `src/__tests__/<area>/<name>.test.ts`. Existing examples: `src/__tests__/api/auth.test.ts`, `src/__tests__/api/with-api-auth.test.ts`.

### Integration Points

- New: `src/app/api/[transport]/route.ts` — the MCP route handler
- New: `src/lib/mcp/auth.ts` — MCP-specific `verifyToken` callback (calls `verifyApiKeyHash`)
- New: `src/lib/api/auth-core.ts` — extracted SHA-256 verification core
- Modified: `src/lib/api/auth.ts` — `authenticateApiKey` refactored to call `auth-core.ts`
- Modified: `src/middleware.ts` — `/api/mcp` bypass entry
- New: `src/__tests__/mcp/route.test.ts` — smoke test for `mcp-handler` import + endpoint behavior
- Modified: `package.json` — `mcp-handler` + `@modelcontextprotocol/sdk` deps

### Retired v2.3 Reference

- `.planning/phases/26-mcp-transport-auth/26-01-PLAN.md` — original transport+auth task breakdown. Most decisions carry forward; library version pins need re-verification.
- `.planning/phases/26-mcp-transport-auth/26-01-SUMMARY.md` — what was built (and then retired) in v2.3.

</code_context>

<specifics>
## Specific Ideas

- **The build-gate regression check is THE point of this phase.** v2.3 retired because `mcp-handler` was in `package.json` but missing from `node_modules` and the route returned 500. The static import + smoke test combo must catch that before any deploy.
- **Tools surface is intentionally empty in this phase.** A `tools/list` call to the new endpoint returns `[]`. This is correct — Phase 41 registers tools.
- **Test against MCP Inspector locally before merging.** `npx @modelcontextprotocol/inspector` should be able to complete the `initialize` handshake against `http://localhost:3000/api/mcp` with a `Bearer vsl_<test_key>` header.

</specifics>

<deferred>
## Deferred Ideas

- **Tool definitions** → Phase 41
- **npm bridge package + setup docs** → Phase 42
- **OAuth 2.1 / dynamic client registration** → out of scope for v2.6 entirely (REQUIREMENTS.md "Out of Scope")
- **Stateful sessions / sampling** → out of scope for v2.6 entirely
- **Broader tool surface (publish, fork, bookmarks, brand-kit)** → v2.7+

</deferred>
