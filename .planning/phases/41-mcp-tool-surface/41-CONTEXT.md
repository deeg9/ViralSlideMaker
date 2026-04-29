# Phase 41: MCP Tool Surface - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped via smart-discuss; lean 4-tool scope locked by approved v2.6 plan)

<domain>
## Phase Boundary

Register exactly 4 outcome-oriented MCP tools (`list_templates`, `create_carousel`, `edit_slide`, `render_carousel`) on the MCP server stood up in Phase 40. Tools call service-layer functions in `src/lib/services/` directly — they do NOT re-enter `/api/v1/*` HTTP routes (avoids double-auth, double-rate-limit, double-credit accounting). The full agent create→edit→render carousel loop must be completable through these 4 tools alone, with credit accounting parity to REST.

</domain>

<decisions>
## Implementation Decisions

### Locked from v2.6 plan and REQUIREMENTS.md

- **Exact tool list (lean scope):** 4 tools, no more, no less. Broader v2.5 surface (publish, fork, bookmarks, brand-kit, profile, credits, AI image gen, Pexels search, slide CRUD beyond edit_slide) deferred to v2.7+.
- **Tool registry location:** `src/lib/mcp/tools.ts`. New file. Must be additively extensible — v2.7+ should add tools by appending to the same registry without architectural rework.
- **Tools call services directly:** import from `src/lib/services/carousel.ts`, `src/lib/services/projects.ts`, `src/lib/services/render.ts` (or wherever render lives). NEVER fetch internal `/api/v1/*` URLs from inside a tool — that would re-trigger auth/rate-limit/credit deduction.
- **Auth context from Phase 40:** read `userId` and `keyId` from `AuthInfo.extra` (set in `src/lib/mcp/auth.ts:36`). Pass `userId` to service functions; `keyId` is for rate-limit attribution if needed.
- **Credit accounting:** `create_carousel` deducts exactly 1 credit via `deductCreditAdmin` (same pattern as `POST /api/v1/carousel`). On insufficient credits, return MCP-protocol-correct error (the SDK has `RESOURCE_EXHAUSTED` or similar; researcher will confirm exact mapping). On generation failure after deduction, refund via the catch pattern already used in `src/app/api/v1/carousel/route.ts`.
- **`edit_slide` patch surface:** accept the same 9 fields as `PATCH /api/v1/projects/{id}/slides/{index}` — `hook_text`, `body_text`, `image_query`, `background_url`, `style_overrides`, `custom_texts`, `custom_images`, `hook_segments`, `body_segments`. Server-side validation matches REST.
- **`render_carousel` returns URLs only:** never inline binary image data in tool responses. MCP responses get serialized over JSON-RPC; inlining PNGs would blow context budgets and break the protocol contract. Return `{ slides: [{ index, downloadUrl }], zipUrl }`.
- **Tool descriptions are self-contained:** an agent should be able to complete the full create→edit→render loop using only the tool descriptions, without reading external docs. This is MCP-TOOL-05 — validated by exercising each tool via MCP Inspector with no extra context.
- **Tool registration on the existing server:** modify `src/app/api/[transport]/route.ts` to import the tool registry from `src/lib/mcp/tools.ts` and pass it into `createMcpHandler({ setup: ... })`. The route file from Phase 40 currently has an empty setup callback — Phase 41 fills it.

### Claude's Discretion

- Exact MCP error code for insufficient credits (researcher confirms — `RESOURCE_EXHAUSTED` likely, but verify against `@modelcontextprotocol/sdk` 1.29.0)
- Tool input schema shape (use Zod via the SDK if it natively supports it; otherwise plain JSON Schema)
- Whether `dashboardUrl` returned by `create_carousel` should be `https://viralslidemaker.com/project/{id}` or env-configurable
- Test organization under `src/__tests__/mcp/` — mirror the per-tool file pattern already established in Phase 40

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (Phase 40 + earlier)

- `src/lib/mcp/auth.ts` (Phase 40) — `verifyToken` returns AuthInfo with `extra: { userId, keyId }`. Tools read `userId` from this.
- `src/app/api/[transport]/route.ts` (Phase 40) — MCP route. Currently empty setup. Phase 41 modifies the setup callback to register tools.
- `src/lib/services/carousel.ts:generateCarousel(supabase, userId, input)` — backs `create_carousel`. Already accepts admin client + userId. Does NOT gate credits — caller must check.
- `src/lib/services/projects.ts` — `getProject`, `updateProjectService`. Backs `edit_slide`. Service functions accept admin client + userId.
- `src/app/api/v1/projects/[id]/render/route.ts` — REST render handler. The render service it calls is what `render_carousel` should reuse (find the underlying service function, not the handler).
- `src/app/api/v1/projects/[id]/download/route.ts` — REST ZIP download. The signed-URL generation logic is what `render_carousel` returns.
- `src/lib/credits/deductCreditAdmin` (or similar) — atomic credit deduction with refund-on-failure pattern. Used by `POST /api/v1/carousel`. `create_carousel` MUST use the same.
- Templates registry — wherever `GET /api/v1/templates` reads from. `list_templates` returns the same shape.

### Established Patterns (from REST routes)

- **Service-layer pattern:** services accept `(supabaseAdminClient, userId, input)`. They throw on errors; the caller (REST handler or MCP tool) catches and translates to the appropriate response shape.
- **Credit deduction:** check balance → deduct → call service → on failure, refund. See `src/app/api/v1/carousel/route.ts` for the canonical pattern.
- **Validation:** Zod schemas at the route boundary. MCP tools should validate input the same way (mcp-handler / SDK supports Zod schema integration).
- **Render output:** signed Supabase Storage URLs with TTL. Never base64.

### Integration Points

- Modified: `src/app/api/[transport]/route.ts` (fill in tools registry call)
- New: `src/lib/mcp/tools.ts` (tool definitions + registration helper)
- New: `src/__tests__/mcp/tools/list_templates.test.ts`
- New: `src/__tests__/mcp/tools/create_carousel.test.ts`
- New: `src/__tests__/mcp/tools/edit_slide.test.ts`
- New: `src/__tests__/mcp/tools/render_carousel.test.ts`
- Possibly new: `src/__tests__/mcp/tools/contract.test.ts` (asserts tools/list returns exactly 4 tools with the documented shapes)

### Retired v2.3 Reference

- `.planning/phases/27-mcp-tools/27-01-PLAN.md` — original 4-tool registration plan. Most decisions carry forward; service-layer signatures may have evolved (v2.5 added 21+ endpoints — verify the carousel/projects/render service functions still match what 27 cited).

</code_context>

<specifics>
## Specific Ideas

- **Tool descriptions must teach the workflow.** An agent reading `tools/list` should understand: "use list_templates first to pick a style, then create_carousel with topic + templateId, then edit_slide to refine, then render_carousel to download." Embed enough context in the descriptions that the model doesn't need external docs.
- **`create_carousel` returns a `dashboardUrl` so the user can immediately review the result in browser** — this is friction-reducing for the human-in-the-loop case where Claude Desktop creates a carousel and the user wants to open it visually.
- **Test the cross-phase contract:** `extra: { userId, keyId }` from Phase 40 must be readable in tool handlers. Add an explicit test that asserts the auth context propagates correctly into a tool invocation.
- **The empty `tools/list` response from Phase 40 should now return 4 tools.** A regression test catching this transition is valuable — modify the existing Phase 40 contract test or add a new one.

</specifics>

<deferred>
## Deferred Ideas

- **Broader tool surface** (publish, fork, bookmarks, brand-kit, profile, credits, AI image gen, Pexels search, full slide CRUD) → v2.7+
- **MCP Resources or Prompts** (per spec terminology) → out of scope for v2.6 entirely
- **Stateful sessions / sampling** → out of scope for v2.6 entirely
- **Tool-specific rate limits** (e.g., create_carousel limited to N/hour separately from REST) → uses shared per-key budget from Phase 40

</deferred>
