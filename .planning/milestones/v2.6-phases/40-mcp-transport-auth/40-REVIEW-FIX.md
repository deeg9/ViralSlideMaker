---
phase: 40
fixed_at: 2026-04-28
review_path: .planning/phases/40-mcp-transport-auth/40-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 40: Code Review Fix Report

**Fixed at:** 2026-04-28
**Source review:** .planning/phases/40-mcp-transport-auth/40-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (2 MEDIUM + 3 LOW)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### MR-01: `TemporarilyUnavailableError` from rate-limit returns 401, not 503

**Files modified:** `src/lib/mcp/auth.ts`
**Commit:** c499978
**Applied fix:** Updated the header comment in `src/lib/mcp/auth.ts` to accurately describe behavior: mcp-handler's `withMcpAuth` catches every error from `verifyToken` and coerces it to `InvalidTokenError` → HTTP 401 (not 503 `temporarily_unavailable`). The comment now references the SDK code path (`node_modules/mcp-handler/dist/index.js:904-916`) and notes that delivering a true 503 + Retry-After would require bypassing `withMcpAuth` and writing the `Response` directly in the route file. Did NOT switch to throwing `InvalidTokenError` directly (would have broken `rate-limit.test.ts` which asserts `TemporarilyUnavailableError`, and the user constraint says only update tests when fix changes assumptions).

### MR-02: `withMcpAuth` `console.error`s the entire caught error from `verifyToken`

**Files modified:** `src/lib/mcp/auth.ts`
**Commit:** c499978
**Applied fix:** Wrapped the entire body of `verifyToken` in a single try/catch at the boundary. On any unexpected `Error`, the message is scrubbed of the raw `bearerToken` (replaced with `vsl_***`) before re-throwing. `InvalidApiKeyError` still returns `undefined` (→ 401), `TemporarilyUnavailableError` still propagates. Verified via grep that no throw site in `src/lib/api/auth-core.ts` or `src/lib/api/auth.ts` interpolates `rawKey`/`bearerToken` into an error message; all throws use static literals. The boundary scrubber is defense-in-depth against future regressions.

### LR-01: Middleware bypass `startsWith('/api/mcp')` would also match `/api/mcps` or `/api/mcp-foo`

**Files modified:** `src/middleware.ts`
**Commit:** 6fabfaf
**Applied fix:** Changed the MCP bypass check from `startsWith('/api/mcp')` to `pathname === '/api/mcp' || pathname.startsWith('/api/mcp/')`. This ensures only the exact MCP route and its true subpaths bypass session auth. Added inline comment explaining why the strict form was chosen over the looser pattern used by sibling bypass entries.

### LR-02: `auth.ts` rethrow loses original error type/stack

**Files modified:** `src/lib/api/auth.ts`
**Commit:** c952c43
**Applied fix:** Replaced `throw new Error('Invalid API key')` with `throw err`, preserving the original `InvalidApiKeyError` type and stack trace. The default message of `InvalidApiKeyError` is already `'Invalid API key'`, so the substring contract that `with-api-auth.ts:87` relies on for REST 401 mapping is unchanged. Added inline comment documenting the contract dependency.

### LR-03: Route file omits `export const runtime = 'nodejs'`

**Files modified:** `src/app/api/[transport]/route.ts`
**Commit:** 9aa32d3
**Applied fix:** Added `export const runtime = 'nodejs'` after the `maxDuration` export, with a comment explaining why (Node-only `crypto` via `verifyApiKeyHash` and the Supabase admin client). Self-documents the Node requirement and guards against an accidental Edge migration.

## Skipped Issues

_None._

## Verification

**Targeted vitest runs (after each fix):**
- `src/__tests__/mcp/auth.test.ts` + `src/__tests__/mcp/rate-limit.test.ts` after MR-01/MR-02: 6/6 passed
- `src/__tests__/api/auth.test.ts` + `src/__tests__/api/auth-core.test.ts` after LR-02: 9/9 passed
- `src/__tests__/mcp/route.test.ts` + `src/__tests__/mcp/import-gate.test.ts` after LR-03: 5/5 passed

**Full Phase 40 sweep (`vitest run src/__tests__/mcp src/__tests__/api`):**
- 50/52 tests passed across 11 files
- 2 failures in `src/__tests__/api/rate-limit.test.ts` are PRE-EXISTING on `HEAD` (verified by re-running on the same tree without local changes). Not in any file modified by these fixes; out of scope.

**Build (`npm run build`):**
- Compiled successfully in 4.2s
- `/api/[transport]` route registered as a dynamic Node serverless function
- No new type or lint errors introduced (only pre-existing warnings)

---

_Fixed: 2026-04-28_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
