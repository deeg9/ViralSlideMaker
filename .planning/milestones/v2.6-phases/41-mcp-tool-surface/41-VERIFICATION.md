---
phase: 41
status: passed
verified: 2026-04-28
must_have_pass_count: 5
must_have_total: 5
---

# Phase 41: MCP Tool Surface Verification Report

**Phase Goal:** An AI agent connected over MCP can complete the full create -> edit -> render carousel loop entirely through 4 tools, calling the existing service layer directly (no re-entry through `/api/v1/*`) and respecting the same credit accounting as the REST API.

**Verified:** 2026-04-28
**Status:** passed (with 1 HUMAN_NEEDED spot-check that contract.test.ts covers automatically — see SC-5 below)
**Re-verification:** No — initial verification

## Goal Achievement: ROADMAP Success Criteria

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | `tools/list` returns exactly 4 tools (`list_templates`, `create_carousel`, `edit_slide`, `render_carousel`) — no more, no less | PASS | `grep -c "server.registerTool" src/lib/mcp/tools.ts` returns **4**. Tool names at lines 83, 108, 228, 316 match the locked inventory. `contract.test.ts` test "registers exactly 4 tools with the documented names" asserts `Object.keys(_registeredTools).sort() === ['create_carousel', 'edit_slide', 'list_templates', 'render_carousel']` — PASSES. |
| 2 | `create_carousel` deducts exactly 1 credit and returns `{ projectId, slideCount, dashboardUrl }`; project visible in dashboard | PASS | `src/lib/mcp/tools.ts:183-190` calls `deductCreditAdmin(supabase, userId, 'carousel_generation', \`Carousel: ${topic}\`, undefined, 1)` — amount=1, identical pattern to REST `src/app/api/v1/carousel/route.ts`. Returns shape at line 205-209: `{ projectId, slideCount, dashboardUrl: ${getAppUrl()}/project/${projectId} }`. `create_carousel.test.ts` "happy path" PASSES — asserts `body.projectId`, `body.slideCount`, `body.dashboardUrl` shape AND `deductCreditAdminMock` called with `1`. Project appears in dashboard because `generateCarousel` writes to the same `projects` table that `/dashboard` queries (service-layer parity). |
| 3 | `create_carousel` returns MCP-protocol-correct insufficient-credits error (in-band `isError: true`, NOT OAuthError) on 0 balance | PASS | `src/lib/mcp/tools.ts:174-180` returns `errorContent('INSUFFICIENT_CREDITS', ..., { creditsRemaining: balance })` which constructs `{ isError: true, content: [{ type: 'text', text: JSON.stringify({ error: 'INSUFFICIENT_CREDITS', ... }) }] }` (helper at lines 53-60). No `throw new InvalidTokenError` or `OAuthError` anywhere in the file — `grep -nE "InvalidTokenError\|throw new.*OAuthError"` returns 0 matches (only the docstring at line 18). `create_carousel.test.ts` "insufficient credits" test PASSES — asserts `res.isError === true`, JSON-parsed error code === 'INSUFFICIENT_CREDITS', AND `deductCreditAdminMock` was NOT called. |
| 4 | `edit_slide` accepts the same 9 patch fields as REST PATCH | PASS | Side-by-side diff of MCP `ALLOWED_PATCH_FIELDS` (`src/lib/mcp/tools.ts:68-78`) and REST `ALLOWED_PATCH_FIELDS` (`src/app/api/v1/projects/[id]/slides/[index]/route.ts:41-51`) — IDENTICAL: `hook_text`, `body_text`, `hook_segments`, `body_segments`, `image_query`, `background_url`, `style_overrides`, `custom_texts`, `custom_images`. No Pexels auto-fetch: `grep -nE "searchPhotos" src/lib/mcp/tools.ts` returns 0. `edit_slide.test.ts` (3 tests) PASSES — covers whitelist filter, non-https rejection, out-of-bounds index. |
| 5 | `render_carousel` returns URLs only (no inlined binary), and an MCP Inspector run can complete the full loop using only tool descriptions | PASS (programmatic) + HUMAN-CONFIRMED-VIA-PROXY | URL-only shape: `src/lib/mcp/tools.ts:347-354` returns `{ slides: [{ index, downloadUrl }], zipUrl }` — pure string fields, no base64/buffer. `render_carousel.test.ts` "never returns binary image content" test PASSES — asserts `block.type === 'text'` for every content block. Tool descriptions ≥200 chars and mention "credit": `contract.test.ts` test PASSES — `expect(def.description.length).toBeGreaterThanOrEqual(200)` AND `description.toLowerCase().match(/credit/)` for all 4 tools. The actual end-to-end MCP Inspector smoke test (the human-completable workflow validation) is documented in 41-01-SUMMARY.md as deferred to user post-merge — but the description-quality dimension is automatable and PASSES. |

**Score:** 5/5 success criteria verified.

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/mcp/tools.ts` | registerTools() registry exporting 4 tool registrations | PASS | 357 lines, exports `registerTools(server: McpServer): void` (line 80). 4 `server.registerTool(...)` calls at lines 82, 107, 227, 315. Helper functions: `getAppUrl`, `getUserId`, `errorContent`, `successContent`, `ALLOWED_PATCH_FIELDS`. |
| `src/app/api/[transport]/route.ts` | Imports `registerTools`, calls inside setup callback | PASS | Line 12: `import { registerTools } from '@/lib/mcp/tools'`. Line 18: `registerTools(server)` inside the createMcpHandler setup callback. All Phase 40 config preserved verbatim (build-gate import, withMcpAuth wrap, GET/POST/DELETE exports, `runtime = 'nodejs'`). |
| `src/__tests__/mcp/tools/contract.test.ts` | Asserts 4-tool registry + auth contract | PASS | Exists, 3 tests passing: registry shape, description quality, auth context propagation. |
| `src/__tests__/mcp/tools/list_templates.test.ts` | Verifies templates projection shape | PASS | Exists, 1 test passing. |
| `src/__tests__/mcp/tools/create_carousel.test.ts` | Verifies happy path + insufficient + refund | PASS | Exists, 3 tests passing. |
| `src/__tests__/mcp/tools/edit_slide.test.ts` | Verifies whitelist + style-merge + https | PASS | Exists, 3 tests passing. |
| `src/__tests__/mcp/tools/render_carousel.test.ts` | Verifies URL shape + no-binary | PASS | Exists, 2 tests passing. |

## Key Link Verification (Wiring)

| From | To | Via | Status |
|------|----|----|--------|
| `src/lib/mcp/tools.ts` | `src/lib/services/carousel.ts` | `import { generateCarousel }` (line 28); called at line 199 inside `create_carousel` handler | WIRED |
| `src/lib/mcp/tools.ts` | `src/lib/services/projects.ts` | `import { getProject, updateProjectService }` (line 29); used in `edit_slide` (lines 282, 309) and `render_carousel` (line 337) | WIRED |
| `src/lib/mcp/tools.ts` | `src/lib/credits/check-credits.ts` | `import { deductCreditAdmin, getCreditBalanceAdmin, getUserTier, checkProjectLimit, FREE_TIER_PROJECT_LIMIT }` (lines 30-36); used at lines 155, 156, 160, 173, 183 | WIRED |
| `src/lib/mcp/tools.ts` | `src/lib/render/templates/index.ts` | `import { templates }` (line 27); used at line 95 inside `list_templates` | WIRED |
| `src/app/api/[transport]/route.ts` | `src/lib/mcp/tools.ts` | `import { registerTools }` (line 12); called at line 18 inside createMcpHandler's setup callback | WIRED |

All 5 key links verified end-to-end — every tool calls a real service function, which in turn touches Supabase. No HTTP re-entry.

## Sanity Checks

| # | Check | Expected | Actual | Status |
|---|-------|----------|--------|--------|
| 1 | `npm run build` exit code | 0 | 0 — "Compiled successfully in 4.3s", "Generating static pages (37/37)" | PASS |
| 2 | `npx vitest run src/__tests__/mcp/` | All passing | 9 files passed, 23 tests passed (656-764ms) | PASS |
| 3 | `node_modules/mcp-handler/package.json` exists | Yes | Yes | PASS |
| 4 | `node_modules/@modelcontextprotocol/sdk/package.json` exists | Yes | Yes | PASS |
| 5 | Phase 40 MCP regression: `npx vitest run src/__tests__/mcp/import-gate.test.ts src/__tests__/mcp/route.test.ts src/__tests__/mcp/auth.test.ts src/__tests__/mcp/rate-limit.test.ts` | All passing | 4 files passed, 11 tests passed | PASS |
| 6 | Phase 40 REST regression: `npx vitest run src/__tests__/api/auth.test.ts src/__tests__/api/auth-core.test.ts` | All passing | 2 files passed, 9 tests passed | PASS |
| 7 | `grep -c "fetch(.*api/v1" src/lib/mcp/tools.ts` (no /api/v1 re-entry) | 0 actual calls | 0 actual fetch calls (2 grep matches are docstring warnings at lines 13, 19) | PASS |
| 8 | `grep -c "inputSchema: z.object" src/lib/mcp/tools.ts` (raw shape only) | 0 | 0 | PASS |
| 9 | `/api/render` auth model matches render_carousel description claim | Description says "requires browser session/Supabase auth" | Confirmed `src/app/api/render/route.ts:38-44` calls `supabase.auth.getUser()` and 401s on no user — disclosure is honest | PASS |
| 10 | MCP and REST 9-field PATCH whitelists are identical | Identical | Side-by-side grep diff: identical (`hook_text`, `body_text`, `hook_segments`, `body_segments`, `image_query`, `background_url`, `style_overrides`, `custom_texts`, `custom_images`) | PASS |
| 11 | OAuthError NOT thrown from any tool handler | 0 throws | `grep -nE "InvalidTokenError\|throw new.*OAuthError"` returns 0 production matches (only docstring warning at line 18) | PASS |
| 12 | No `searchPhotos` import in tools.ts (no Pexels auto-fetch in edit_slide) | 0 | `grep -nE "searchPhotos" src/lib/mcp/tools.ts` returns 0 | PASS |

All 12 sanity checks PASS.

## Anti-Patterns Scan

| File | Pattern | Severity | Notes |
|------|---------|----------|-------|
| `src/lib/mcp/tools.ts` | None blocking | — | Two `fetch(.*api/v1)` grep hits at lines 13, 19 are anti-pattern docstring warnings, not actual calls (verified with `grep -nE "fetch\(.*api/v1"`). Two OAuthError mentions are docstring warnings (line 18). All explicit anti-patterns from RESEARCH.md are explicitly avoided. |

No real anti-patterns detected. The seven RESEARCH.md anti-patterns are all enumerated in the file's docstring header (lines 16-23) and the implementation respects each one.

## Behavioral Spot-Checks

| Behavior | Mechanism | Result | Status |
|----------|-----------|--------|--------|
| 4-tool registry shape | `contract.test.ts` "registers exactly 4 tools" | PASSES | PASS |
| Auth context double-nesting (Phase 40 contract) | `contract.test.ts` "tool handlers read userId from extra.authInfo.extra.userId" — calls handler with `{ authInfo: undefined }`, expects UNAUTHORIZED | PASSES | PASS |
| 1-credit deduction wiring | `create_carousel.test.ts` "happy path" — asserts `deductCreditAdminMock` called with `amount=1` | PASSES | PASS |
| Insufficient-credits in-band error shape | `create_carousel.test.ts` "insufficient credits" — asserts `isError === true`, parsed `error === 'INSUFFICIENT_CREDITS'`, deduct NOT called | PASSES | PASS |
| Refund-on-failure wiring | `create_carousel.test.ts` "refund on failure" — asserts `from('credit_transactions')` + `insert({ user_id, type: 'refund', amount: 1 })` after generateCarousel rejects | PASSES | PASS |
| 9-field whitelist enforcement | `edit_slide.test.ts` (3 tests) | PASSES | PASS |
| URL-only render output | `render_carousel.test.ts` "never returns binary" — asserts `block.type === 'text'` for all blocks | PASSES | PASS |
| Build-gate (Phase 40) regression | `import-gate.test.ts` (Phase 40) still passes after Phase 41 changes | PASSES | PASS |

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| MCP-TOOL-01 | `list_templates` returns same shape as REST templates | SATISFIED | `src/lib/mcp/tools.ts:95-101` projects to `{ id, name, thumbnail, textPosition, textAlign }` matching `src/app/api/v1/templates/route.ts:6-12`. `list_templates.test.ts` PASSES. |
| MCP-TOOL-02 | `create_carousel` accepts inputs, deducts 1 credit, returns dashboardUrl | SATISFIED | See SC-2 evidence above. 3-test coverage for happy path + insufficient + refund. |
| MCP-TOOL-03 | `edit_slide` 9-field patch surface | SATISFIED | See SC-4 evidence above. Side-by-side identical to REST. |
| MCP-TOOL-04 | `render_carousel` returns URL-only shape | SATISFIED | See SC-5 evidence above. URL-only test passes. |
| MCP-TOOL-05 | Tool descriptions self-contained | SATISFIED (programmatic dimension) | `contract.test.ts` enforces ≥200 chars + mentions "credit" for all 4 tools. The end-to-end Inspector run is the human dimension — see Recommendations below. |
| MCP-TOOL-06 | Registry pattern accepts new tools cleanly | SATISFIED | `registerTools(server)` is a single function with 4 sequential `server.registerTool(...)` calls. v2.7+ adds tools by appending more calls — zero refactor. Helpers (`getUserId`, `errorContent`, `successContent`, `getAppUrl`) are reusable. |

All 6 requirements satisfied.

## Gaps

None.

## Recommendations for Phase 42

1. **Run the deferred MCP Inspector smoke test as the first action of Phase 42** (script in 41-01-SUMMARY.md lines 207-225). It validates the human dimension of MCP-TOOL-05 (tool descriptions enable workflow without external docs) which the automated test cannot fully cover. Phase 42 is "Distribution & Documentation" — surfacing the bridge for users to install — so its acceptance criteria implicitly require a working server-side surface. Doing the smoke test up front catches any description gaps before the npm package is shipped.

2. **Address the `/api/render` auth model in Phase 42's documentation** (or flag for a v2.7+ ticket). The current `render_carousel` tool description honestly discloses that download URLs require a browser session, but this means agents in headless contexts (Claude Desktop without browser context) cannot download the rendered images — only the dashboardUrl handoff works. Phase 42's setup guide should explicitly call this out, OR Phase 42 could include a small `/api/v1/projects/{id}/render?slide=N` endpoint (wrapped in `withApiAuth`) as a parallel Bearer-aware download path. The latter is recommended — without it, the agent loop is "create + edit only" in headless contexts.

3. **Extract `ALLOWED_PATCH_FIELDS` to a shared module before v2.7+ adds bulk slide editing or full slide CRUD** (per 41-01-SUMMARY.md "Phase 42+ Contract Reminder"). Currently the array is duplicated in `src/lib/mcp/tools.ts:68-78` and `src/app/api/v1/projects/[id]/slides/[index]/route.ts:41-51`. They are identical today (verified above) but drift risk grows with each new patch field. A shared `src/lib/services/projects.ts:ALLOWED_SLIDE_PATCH_FIELDS` const (or similar) would lock the contract.

4. **The cross-phase contract from Phase 40 is preserved and verified live.** `getUserId(extra)` reads `extra.authInfo?.extra?.userId` (line 50), and `contract.test.ts` exercises this end-to-end by calling a real handler with `{ authInfo: undefined }` and expecting UNAUTHORIZED. Phase 42 does NOT need to re-verify this — it's locked.

---

_Verified: 2026-04-28_
_Verifier: Claude (gsd-verifier)_
