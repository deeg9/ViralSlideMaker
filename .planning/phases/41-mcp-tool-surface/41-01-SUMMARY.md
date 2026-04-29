---
phase: 41-mcp-tool-surface
plan: 01
subsystem: mcp-tools
tags: [mcp, tools, carousel, credit-deduct, render, tdd, in-band-errors, raw-zod-shape]
requirements_completed:
  - MCP-TOOL-01
  - MCP-TOOL-02
  - MCP-TOOL-03
  - MCP-TOOL-04
  - MCP-TOOL-05
  - MCP-TOOL-06
dependency_graph:
  requires:
    - "src/lib/mcp/auth.ts (Phase 40 — verifyToken sets AuthInfo.extra={userId,keyId})"
    - "src/app/api/[transport]/route.ts (Phase 40 — empty setup callback to fill)"
    - "src/lib/services/carousel.ts:generateCarousel (existing — backs create_carousel)"
    - "src/lib/services/projects.ts:getProject + updateProjectService (existing — back edit_slide + render_carousel)"
    - "src/lib/credits/check-credits.ts:deductCreditAdmin + getCreditBalanceAdmin + getUserTier + checkProjectLimit + FREE_TIER_PROJECT_LIMIT (existing)"
    - "src/lib/render/templates/index.ts:templates (existing — backs list_templates)"
  provides:
    - "src/lib/mcp/tools.ts:registerTools(server) — registry of 4 outcome-oriented MCP tools (additively extensible for v2.7+)"
    - "MCP tools/list endpoint at /api/mcp now returns 4 tools (was empty in Phase 40)"
    - "Cross-phase test: extra.authInfo.extra.userId propagation contract from Phase 40 verified live in tool handlers"
    - "Mock-pattern reference: src/__tests__/mcp/tools/*.test.ts as a per-tool template for v2.7+ additions"
  affects:
    - "src/app/api/[transport]/route.ts (filled the empty setup callback — minimal 1-line change inside callback + import)"
    - "src/__tests__/mcp/route.test.ts (added vi.mock for carousel + projects services to block transitive Pexels init in test env)"
tech_stack:
  added: []
  patterns:
    - "Zod RAW SHAPE for inputSchema (NOT z.object) — SDK requires `{ topic: z.string() }` not `z.object({...})`"
    - "In-band tool errors: { isError: true, content: [{ type: 'text', text: JSON.stringify({ error, message }) }] } — never throw OAuthError from a tool handler"
    - "Double-nested AuthInfo path: extra.authInfo?.extra?.userId via getUserId() helper"
    - "Service-direct calls: tool handlers import from src/lib/services/* directly — never fetch() to internal /api/v1/* (would re-trigger auth+rate-limit+credit)"
    - "Credit deduct → service call → refund-on-failure (mirrors src/app/api/v1/carousel/route.ts exactly)"
    - "vi.hoisted() for mocks referenced inside vi.mock factories (hoisting order)"
    - "vi.mock @/lib/services/carousel even in tests not exercising it — top-level Pexels client init requires PEXELS_API_KEY"
key_files:
  created:
    - "src/lib/mcp/tools.ts (357 lines, exports registerTools — 4 server.registerTool calls + helpers)"
    - "src/__tests__/mcp/tools/contract.test.ts (56 lines, 3 tests)"
    - "src/__tests__/mcp/tools/list_templates.test.ts (42 lines, 1 test)"
    - "src/__tests__/mcp/tools/create_carousel.test.ts (93 lines, 3 tests)"
    - "src/__tests__/mcp/tools/edit_slide.test.ts (95 lines, 3 tests)"
    - "src/__tests__/mcp/tools/render_carousel.test.ts (64 lines, 2 tests)"
  modified:
    - "src/app/api/[transport]/route.ts (added import + filled empty setup callback with registerTools(server) call — preserved all Phase 40 config)"
    - "src/__tests__/mcp/route.test.ts (added vi.mock for @/lib/services/carousel and @/lib/services/projects to block transitive Pexels init at module load — Phase 41 regression fix)"
decisions:
  - "Used vi.hoisted() to declare mocks referenced inside vi.mock factories (Rule 3 - hoisting issue)"
  - "Mocked @/lib/services/carousel in EVERY test file (including those that don't use it) because tools.ts imports carousel which transitively triggers Pexels createClient(PEXELS_API_KEY!) at module load"
  - "Used tool.handler(...) not tool.callback(...) in tests — SDK exposes RegisteredTool.handler (verified node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts:274 + mcp.js:608-617)"
  - "render_carousel description explicitly notes URLs require browser session — /api/render reads supabase.auth.getUser() (resolves Open Q1 from RESEARCH)"
metrics:
  duration: "~11 minutes"
  completed_date: "2026-04-29"
  tasks_completed: 4
  files_created: 6
  files_modified: 2
  lines_added: ~660
  tests_added: 12
---

# Phase 41 Plan 01: MCP Tool Surface Summary

Registered exactly 4 outcome-oriented MCP tools (`list_templates`, `create_carousel`, `edit_slide`, `render_carousel`) on the Phase 40 MCP server so an AI agent can complete the full create→edit→render carousel loop entirely through MCP, with credit accounting (1 credit per `create_carousel` + refund-on-failure) at exact parity to REST `POST /api/v1/carousel`. `tools/list` now returns 4 tools instead of `[]`.

## What Was Built

### New Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/mcp/tools.ts` | 357 | `registerTools(server: McpServer)` exports the 4-tool registry. Helpers: `getAppUrl()` (env-derived NEXT_PUBLIC_APP_URL/VERCEL_URL/localhost), `getUserId(extra)` (double-nested AuthInfo path), `errorContent(code, msg)` / `successContent(data)` (in-band MCP response shape), `ALLOWED_PATCH_FIELDS` (9-field whitelist mirroring REST PATCH). |
| `src/__tests__/mcp/tools/contract.test.ts` | 56 | 3 tests: tools/list returns exactly 4 tools; every description ≥200 chars + mentions "credit"; cross-phase auth contract — handler called without authInfo returns UNAUTHORIZED in-band. |
| `src/__tests__/mcp/tools/list_templates.test.ts` | 42 | 1 test: returns `templates` array with the 5 REST projection keys (id, name, thumbnail, textPosition, textAlign). |
| `src/__tests__/mcp/tools/create_carousel.test.ts` | 93 | 3 tests: happy path (1-credit deduct + generateCarousel call + dashboardUrl shape); INSUFFICIENT_CREDITS in-band error on balance < 1; refund row inserted into credit_transactions when generateCarousel throws. |
| `src/__tests__/mcp/tools/edit_slide.test.ts` | 95 | 3 tests: 9-field whitelist filter + style_overrides deep-merge + non-allowed key rejection; non-https background_url → VALIDATION_ERROR; out-of-bounds slideIndex → NOT_FOUND. |
| `src/__tests__/mcp/tools/render_carousel.test.ts` | 64 | 2 tests: HTTPS URL shape `{ slides: [{ index, downloadUrl }], zipUrl }`; never returns binary content (every block.type === 'text'). |

### Modified Files

| File | Change |
|------|--------|
| `src/app/api/[transport]/route.ts` | Added `import { registerTools } from '@/lib/mcp/tools'`; replaced empty `(_server) => {}` setup with `(server) => { registerTools(server) }`. All Phase 40 config preserved verbatim: serverInfo, capabilities, basePath, maxDuration, disableSse, redisUrl, withMcpAuth wrap, GET/POST/DELETE exports, runtime='nodejs'. |
| `src/__tests__/mcp/route.test.ts` | Added `vi.mock('@/lib/services/carousel', ...)` and `vi.mock('@/lib/services/projects', ...)`. Phase 41 regression fix: importing the route now transitively brings in registerTools → carousel.ts → pexels/search-photos.ts which evaluates `createClient(PEXELS_API_KEY!)` at module load and throws "An ApiKey must be provided" without the env var. The mocks block heavy module init; the 3 Phase 40 transport+auth tests don't actually invoke any tool handlers. |

## Per-Tool Implementation Notes

### Tool 1: list_templates (free)
- **Service called:** None — reads `templates` from `src/lib/render/templates/index.ts` directly.
- **Projection:** `{ id, name, thumbnail, textPosition, textAlign }` — matches `src/app/api/v1/templates/route.ts:6-12` exactly.
- **Auth:** Reads userId via getUserId() but does NOT require it (templates are public).
- **Returns:** `{ templates: [...] }`.

### Tool 2: create_carousel (1 credit)
- **Service called:** `generateCarousel(supabase, userId, { topic, templateId, slideCount, imageSource })` from `src/lib/services/carousel.ts:28`.
- **Credit pattern (mirrors `src/app/api/v1/carousel/route.ts:54-115` exactly):**
  1. `getUserTier(userId)` → `checkProjectLimit(userId, tier)` → 403-equivalent in-band error if free tier exceeded.
  2. Free-tier slide-count cap: `tier === 'free' && validSlideCount > 3` → VALIDATION_ERROR.
  3. `getCreditBalanceAdmin(supabase, userId)` < 1 → INSUFFICIENT_CREDITS in-band.
  4. `deductCreditAdmin(supabase, userId, 'carousel_generation', \`Carousel: ${topic}\`, undefined, 1)` — atomic Postgres RPC.
  5. try `generateCarousel(...)` → `successContent({ projectId, slideCount, dashboardUrl })`.
  6. catch → `supabase.from('credit_transactions').insert({ user_id, type: 'refund', amount: 1, description: 'Carousel generation failed (MCP)' })` then GENERATION_FAILED in-band.
- **dashboardUrl:** `${getAppUrl()}/project/${projectId}` where `getAppUrl()` = `NEXT_PUBLIC_APP_URL ?? (VERCEL_URL ? https://VERCEL_URL : http://localhost:3000)` (mirrors `src/lib/services/publish.ts:70-75`).
- **Schema:** `templateId` is REQUIRED (`z.string().min(1)`) — no default. Forces agents to call `list_templates` first; closes the v2.5 trim regression where `bold-minimal` no longer exists.

### Tool 3: edit_slide (free)
- **Service called:** `getProject(supabase, userId, projectId)` then `updateProjectService(supabase, userId, projectId, { slide_data: updatedArray })` from `src/lib/services/projects.ts:13, 47`.
- **9-field whitelist:** `ALLOWED_PATCH_FIELDS` const array reproduces `src/app/api/v1/projects/[id]/slides/[index]/route.ts:41-51` exactly: `hook_text, body_text, hook_segments, body_segments, image_query, background_url, style_overrides, custom_texts, custom_images`.
- **background_url validation:** `string.startsWith('https://')` check before any DB write — VALIDATION_ERROR otherwise (mirrors REST line 84-87).
- **style_overrides deep merge:** `{ ...existingSlide.style_overrides, ...patch.style_overrides }` — mirrors REST line 105-117.
- **NOT_FOUND boundaries:** project lookup throw → NOT_FOUND; `slideIndex >= slideData.length` → NOT_FOUND.
- **No Pexels auto-fetch:** `image_query` updates the metadata field only — REST PATCH does not call `searchPhotos` either, so MCP matches REST exactly. Tool description explicitly tells agents to set `background_url` directly to swap an image. (Divergence from retired v2.3 plan, per Open Q2 in RESEARCH.)
- **Returns:** `{ slide: updatedSlide }` (full object, not just patch).

### Tool 4: render_carousel (free)
- **Service called:** `getProject(supabase, userId, projectId)` from `src/lib/services/projects.ts:13`.
- **URL construction:** `${baseUrl}/api/render?projectId=${id}&slide=${index}&download` per slide; `${baseUrl}/api/v1/projects/${id}/download` for the zip. `baseUrl = getAppUrl()` — env-derived. Reproduces `src/app/api/v1/projects/[id]/render/route.ts:34-42` shape (camelCase keys: `downloadUrl`, `zipUrl` instead of REST's snake_case `download_url`, `zip_url` per MCP-TOOL-04 contract).
- **Returns:** `{ slides: [{ index, downloadUrl }], zipUrl }` — URLs only, never inline binary.
- **Open Q1 resolution:** `/api/render` reads `supabase.auth.getUser()` (see `src/app/api/render/route.ts:38-44`) — it requires an authenticated browser session, NOT an MCP Bearer token. The render_carousel tool description now explicitly states: "download URLs require an authenticated user session (browser cookie) when fetched, since /api/render checks Supabase auth. For programmatic download in agent contexts, prefer opening dashboardUrl from create_carousel and using the in-app download UI." This is honest about the limitation; v2.7+ should design signed URLs or an MCP-Bearer-aware download path.

## Refund-Pattern Verification

The refund pattern is verified by:

1. **Code parity:** `src/lib/mcp/tools.ts:209-219` matches `src/app/api/v1/carousel/route.ts:106-114` line-for-line (only differences: `description: 'Carousel generation failed (MCP)'` vs REST's `'Carousel generation failed'`, and the in-band error envelope vs REST's `apiError`).
2. **Test coverage:** `src/__tests__/mcp/tools/create_carousel.test.ts` "refund on failure" sub-test asserts:
   - `mocks.generateCarouselMock.mockRejectedValue(new Error('Gemini timeout'))` triggers the catch
   - `mocks.fromMock` was called with `'credit_transactions'`
   - `mocks.insertMock` was called with `expect.objectContaining({ user_id: 'user-1', type: 'refund', amount: 1 })`
   - The handler returns `{ isError: true, content: [{ text: { error: 'GENERATION_FAILED' } }] }` (in-band, NOT thrown)

## Anti-Patterns Avoided (per RESEARCH.md)

| # | Anti-Pattern | How Avoided |
|---|--------------|-------------|
| 1 | Wrapping `inputSchema` in `z.object({...})` | All 4 tools pass raw zod shape `{ topic: z.string(), ... }`. `grep -c "inputSchema: z.object" src/lib/mcp/tools.ts` returns **0**. |
| 2 | Throwing `OAuthError`/`InvalidTokenError` from a tool handler | All 4 tools use the `errorContent(code, message)` helper which returns `{ isError: true, content: [{ type: 'text', text }] }`. Zero `throw new InvalidTokenError`/`OAuthError` in the file. |
| 3 | `fetch('http://localhost:3000/api/v1/...')` from a handler | All 4 tools call `src/lib/services/*` directly. `grep -nE "^[^/]*fetch\(.*api/v1" src/lib/mcp/tools.ts` returns **0** (the 2 `grep -c` hits are anti-pattern docstring warnings — not actual calls). |
| 4 | Defaulting `templateId` to `'bold-minimal'` | Schema is `z.string().min(1)` — REQUIRED, no `.optional()` or `.default()`. Tool description explicitly says "REQUIRED. Example: highlight-bar." |
| 5 | Inlining base64 image data in `render_carousel` response | Returns URL strings only. Test asserts `block.type === 'text'` for every content block. |
| 6 | Hardcoding `https://viralslidemaker.com` | `getAppUrl()` helper reads `NEXT_PUBLIC_APP_URL ?? (VERCEL_URL ? 'https://' + VERCEL_URL : 'http://localhost:3000')` — mirrors `src/lib/services/publish.ts:70-75`. |
| 7 | Auto-fetching Pexels in `edit_slide` on `image_query` change | Handler does NOT import `searchPhotos`. Tool description explicitly: "image_query updates the metadata field only — it does NOT auto-fetch a new image. To swap an image, set background_url directly." |

## Test Suite Result

```
$ npx vitest run src/__tests__/mcp/ --no-coverage

 Test Files  9 passed (9)
      Tests  23 passed (23)
   Duration  656ms
```

Breakdown:
- Phase 41 NEW (12): contract.test.ts (3) + list_templates.test.ts (1) + create_carousel.test.ts (3) + edit_slide.test.ts (3) + render_carousel.test.ts (2)
- Phase 40 (11): import-gate.test.ts (2) + auth.test.ts MCP (4) + rate-limit.test.ts MCP (2) + route.test.ts (3)

Note: the plan estimated "26 tests" but the Phase 40 SUMMARY actually shipped 11 tests under `src/__tests__/mcp/` plus 9 REST auth tests under `src/__tests__/api/auth*.test.ts` (totaling 20). The 12 + 11 = 23 figure matches the actual MCP-namespace test count.

```
$ npx vitest run src/__tests__/api/auth.test.ts src/__tests__/api/auth-core.test.ts --no-coverage

 Test Files  2 passed (2)
      Tests  9 passed (9)
```

Phase 40 REST auth regression check: GREEN.

## Build Verification

```
$ npm run build

 ✓ Compiled successfully in 4.4s
├ ƒ /api/[transport]                                          0 B            0 B

Build exit code: 0
```

The static `import { createMcpHandler, withMcpAuth } from 'mcp-handler'` build gate from Phase 40 still works (route file untouched at the import level). The `[transport]` route is still discovered.

## Plan Invariants Verification

| # | Invariant | Result |
|---|-----------|--------|
| 1 | `grep -c "server.registerTool(" src/lib/mcp/tools.ts` returns 4 | **4** ✓ |
| 2 | `grep -c "inputSchema: z.object" src/lib/mcp/tools.ts` returns 0 | **0** ✓ |
| 3 | `grep "extra.authInfo?.extra?.userId" src/lib/mcp/tools.ts` ≥1 (helper) | **1** ✓ (in `getUserId()` helper, called by all 3 scoped tools) |
| 4 | Real `fetch(.*api/v1)` calls in tools.ts | **0** ✓ (the 2 grep -c hits are anti-pattern docstring warnings) |
| 5 | `grep "credit_transactions" src/lib/mcp/tools.ts` confirms refund | **1** ✓ |
| 6 | `grep -c "registerTools" src/app/api/[transport]/route.ts` returns 2 | **2** ✓ (import + call) |
| 7 | All 23 MCP tests pass, 0 new failures | ✓ |
| 8 | `npm run build` exits 0 | ✓ |
| 9 | `npx tsc --noEmit` reports no new errors in modified files | ✓ |

## Manual MCP Inspector Smoke (Deferred to User)

The autonomous run cannot execute `npx -y @modelcontextprotocol/inspector` because:
- It requires a running `npm run dev` server (background process beyond plan scope).
- It requires a real `vsl_*` API key from the actual database (test env has no DB rows).
- Both UI checks (Inspector renders descriptions; user evaluates if they're self-contained) are inherently human.

**For the user to run after merge:**
```bash
# Terminal 1
npm run dev

# Terminal 2
npx -y @modelcontextprotocol/inspector
# In Inspector UI:
#   URL: http://localhost:3000/api/mcp
#   Authorization: Bearer vsl_<your_test_key>
# Verify:
#   1. tools/list returns exactly 4 tools (list_templates, create_carousel, edit_slide, render_carousel)
#   2. Each description reads as a self-contained instruction
#   3. Run sequence WITHOUT external docs:
#      a. list_templates → pick a templateId (e.g. "highlight-bar")
#      b. create_carousel({ topic: "test", templateId: "highlight-bar" }) → projectId
#      c. edit_slide({ projectId, slideIndex: 0, patch: { hook_text: "edited" } })
#      d. render_carousel({ projectId }) → downloadUrls + zipUrl
#      e. Open dashboardUrl in browser → confirms cross-modal handoff
```

The contract.test.ts "every tool description is at least 200 characters and mentions credit cost" test provides automated coverage of the description-quality dimension of MCP-TOOL-05. The workflow-completability dimension still requires the human eval above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vi.mock factory hoisting issue in create_carousel.test.ts**
- **Found during:** Task 2 verification (first vitest run after creating tools.ts)
- **Issue:** `vi.mock('@/lib/services/carousel', () => ({ generateCarousel: generateCarouselMock }))` factories are hoisted above all top-level statements, so they cannot reference regular `const` mocks defined in the test file body — `ReferenceError: Cannot access 'generateCarouselMock' before initialization`.
- **Fix:** Replaced top-level `const generateCarouselMock = vi.fn()` etc. with `const mocks = vi.hoisted(() => ({ generateCarouselMock: vi.fn(), ... }))`. Then `vi.mock(..., () => ({ generateCarousel: mocks.generateCarouselMock }))`. Same fix applied to edit_slide.test.ts and render_carousel.test.ts where the same pattern existed.
- **Files modified:** `src/__tests__/mcp/tools/create_carousel.test.ts`, `src/__tests__/mcp/tools/edit_slide.test.ts`, `src/__tests__/mcp/tools/render_carousel.test.ts`
- **Commit:** `f006ae2`

**2. [Rule 3 - Blocking] Pexels client init at module load (test env)**
- **Found during:** Task 2 verification (4 of 5 tool test files failing with `An ApiKey must be provided when initiating the Pexel's client`)
- **Issue:** `src/lib/mcp/tools.ts` imports `generateCarousel` from `src/lib/services/carousel.ts`, which has a top-level `import { searchPhotos } from '@/lib/pexels/search-photos'`. That module evaluates `const pexelsClient = createClient(process.env.PEXELS_API_KEY!)` at module load and throws when the env var is unset. Tests not mocking `@/lib/services/carousel` (contract, list_templates, edit_slide, render_carousel) crashed at import time.
- **Fix:** Added `vi.mock('@/lib/services/carousel', () => ({ generateCarousel: vi.fn() }))` to all 5 tool test files (the 4 affected + the 1 already mocking it). Effectively: every test file mocks all 4 service modules (`@/lib/services/carousel`, `@/lib/services/projects`, `@/lib/credits/check-credits`, `@/lib/supabase/admin`) regardless of which tools it exercises, to block heavy module init.
- **Same fix applied to:** `src/__tests__/mcp/route.test.ts` — Phase 40 regression. The route now transitively imports the heavy services through `registerTools`, so its 3 transport+auth tests broke too. Mocked them inline; transport+auth tests don't actually invoke any tool handlers.
- **Files modified:** all 5 tool test files + `src/__tests__/mcp/route.test.ts`
- **Commits:** `f006ae2`, `8638b0c`

**3. [Rule 1 - Bug] tool.callback vs tool.handler property name mismatch**
- **Found during:** Task 2 verification (10 of 12 tests failing with `tool.callback is not a function`)
- **Issue:** The plan's test snippets used `tool.callback(args, extra)` but the SDK stores the registered tool's invocation function under the `handler` property — verified at `node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts:266-290` (the `RegisteredTool` type) and `mcp.js:608-617` (runtime: `const registeredTool = { ..., handler: handler, ... }`).
- **Fix:** Renamed every `tool.callback(...)` invocation to `tool.handler(...)` in all 5 test files. Updated the inline TypeScript type annotation to match: `_registeredTools: Record<string, { handler: (args, extra) => Promise<...> }>`.
- **Files modified:** all 5 tool test files
- **Commit:** `f006ae2`

### Open Question Resolutions (from RESEARCH.md)

**Open Q1: Does `/api/render` require auth?**
- **Answer:** YES — `src/app/api/render/route.ts:38-44` reads `supabase.auth.getUser()` and returns 401 if no user session. The URL is NOT followable by an unauthenticated client.
- **Implication:** The download URLs returned by `render_carousel` require a browser session (Supabase auth cookie) to fetch. They are NOT MCP-Bearer-aware.
- **Documented:** The `render_carousel` tool description explicitly tells agents: "download URLs require an authenticated user session (browser cookie) when fetched, since /api/render checks Supabase auth. For programmatic download in agent contexts, prefer opening dashboardUrl from create_carousel and using the in-app download UI."
- **For Phase 42+:** Consider designing signed URLs (Supabase Storage signed URLs with TTL) or an MCP-Bearer-aware download path (`/api/v1/render?projectId=&slide=&download` wrapped in `withApiAuth`). The current design is honest about the limitation but suboptimal for headless-agent download.

**Open Q2: Should `edit_slide` auto-fetch a Pexels photo when `image_query` changes?**
- **Answer:** NO — match REST exactly. REST `PATCH` does not call `searchPhotos`; it only updates the metadata field.
- **Implementation:** `edit_slide` does not import `searchPhotos`. The tool description explicitly states the no-auto-fetch behavior so agents don't expect surprise Pexels round-trips.

**Open Q3: Should `templateId` be required or default to `'highlight-bar'`?**
- **Answer:** REQUIRED — no default. Forces the agent to call `list_templates` first (the intended discovery workflow).
- **Implementation:** `templateId: z.string().min(1).describe('Template ID from list_templates. REQUIRED.')` — no `.optional()` or `.default()`.

## Authentication Gates

None encountered. The plan ran fully autonomously.

## Phase 42+ Contract Reminder

**The `registerTools(server)` pattern is additively extensible.** v2.7+ adds new tools by appending more `server.registerTool(...)` calls inside the same function. No architectural rework needed. The 4 helpers at the top of the file (`getAppUrl`, `getUserId`, `errorContent`, `successContent`) are reusable; the `ALLOWED_PATCH_FIELDS` const stays scoped to `edit_slide` for now (consider extracting to a shared `src/lib/services/projects.ts` helper if v2.7+ adds bulk slide editing or full slide CRUD — flagged here for that future plan).

**Cross-phase contract preserved:** Tool handlers MUST continue reading `userId`/`keyId` via `extra.authInfo?.extra?.userId` and `extra.authInfo?.extra?.keyId`. Helper `getUserId(extra)` in `src/lib/mcp/tools.ts:48-51` is the single source of truth — DO NOT bypass.

**Test pattern reference:** `src/__tests__/mcp/tools/*.test.ts` files demonstrate the per-tool mock pattern for v2.7+ additions:
1. Top of file: `// @vitest-environment node` directive (required — jsdom Web Streams polyfill incompatibility).
2. `vi.hoisted(() => ({ ...mocks }))` for any mock function referenced inside `vi.mock(...)` factories.
3. Mock ALL 4 service modules (carousel, projects, check-credits, supabase/admin) — even if a test doesn't exercise them — to block transitive Pexels init.
4. Use `tool.handler(args, extra)` (NOT `tool.callback`) per SDK contract.
5. Always include `authInfo: { extra: { userId, keyId } }` shape in the `extra` arg for any scoped tool.

## Commits Made by This Plan

```
8638b0c fix(41-01): mock service modules in route.test.ts (Phase 41 regression)
f8e5198 feat(41-01): wire registerTools into MCP route setup callback
f006ae2 feat(41-01): implement registerTools — 4 MCP tools with credit + auth parity
70d7b10 test(41-01): add failing-stub tests for 4 MCP tools (Wave 0 scaffolding)
```

## Self-Check: PASSED

All 6 created files exist on disk:
- `src/lib/mcp/tools.ts`
- `src/__tests__/mcp/tools/contract.test.ts`
- `src/__tests__/mcp/tools/list_templates.test.ts`
- `src/__tests__/mcp/tools/create_carousel.test.ts`
- `src/__tests__/mcp/tools/edit_slide.test.ts`
- `src/__tests__/mcp/tools/render_carousel.test.ts`

Both modified files exist on disk:
- `src/app/api/[transport]/route.ts`
- `src/__tests__/mcp/route.test.ts`

All 4 task commits present in `git log`:
- `70d7b10` (Task 1: test scaffolding)
- `f006ae2` (Task 2: registerTools implementation + test fixes)
- `f8e5198` (Task 3: route setup callback wired)
- `8638b0c` (Task 4: route.test.ts regression fix)

`npm run build` exit code 0 (`[transport]` route discovered).
`npx vitest run src/__tests__/mcp/` reports 9 files passed, 23 tests passed.
`npx vitest run src/__tests__/api/auth.test.ts src/__tests__/api/auth-core.test.ts` reports 2 files passed, 9 tests passed (Phase 40 REST regression check green).
