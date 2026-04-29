# Requirements: ViralSlideMaker v2.6 MCP Server

**Defined:** 2026-04-28
**Core Value:** Type a topic, get ready-to-post carousel slide images — fully AI-generated, editable, downloadable. v2.6 makes the product a first-class verb inside Claude Desktop, Cursor, ChatGPT, and other MCP-aware AI agents — closing the failure that retired v2.3.

## v2.6 Requirements

Requirements for the MCP Server milestone. Rebuilds the retired v2.3 effort end-to-end (zero working code survived the `quick-260428-rmm` retirement). Lean 4-tool scope per user decision; broader surface deferred to v2.7+.

### Locked Decisions

- **Tool inventory:** lean — exactly 4 tools (`list_templates`, `create_carousel`, `edit_slide`, `render_carousel`). Broader v2.5 REST surface (publish, fork, bookmarks, brand-kit, profile, credits) deferred to v2.7+.
- **Auth:** reuse existing `vsl_` API keys. MCP endpoint authenticates via `Authorization: Bearer vsl_...` — same scheme as `/api/v1/*`. No new auth surface.
- **Stack:** `mcp-handler` (Vercel's Next.js adapter) + `@modelcontextprotocol/sdk` v1.x. Versions to be re-pinned at the start of Phase A (the v2.3 plans cite an April 2026 snapshot).
- **Transport mode:** stateless (`sessionIdGenerator: undefined`) for Vercel serverless compatibility. No session persistence between requests.
- **Tool implementation:** tools call service-layer functions in `src/lib/services/` directly. They do NOT re-enter `/api/v1/*` HTTP routes (avoids double-auth, double-rate-limit).
- **Auth core extraction:** the bearer-token verification logic in `src/lib/api/auth.ts:5` (SHA-256 hash → DB lookup → timing-safe compare → `last_used_at` update) gets pulled into a shared helper that both `withApiAuth` (REST) and the new MCP `verifyToken` adapter call. Avoids `NextRequest` coupling in the MCP path.
- **Rate limiting:** reuse existing Upstash sliding-window limiter from `src/lib/api/rate-limit.ts`, keyed by API key ID — same as REST.
- **Build-gate regression:** v2.6 must include a CI/build step that explicitly imports from `mcp-handler` so a missing dep fails the build. This is the exact failure mode that retired v2.3.
- **Distribution:** `viralslidemaker-mcp` npm package wraps `mcp-remote` (no business logic duplicated in the bridge). Zero-build plain JS in `bin/cli.js` for fast install.
- **Excluded surfaces (deferred to v2.7+):** publishing tools, fork/bookmark/explore tools, brand-kit/profile management, AI image generation, Pexels search, slide CRUD beyond `edit_slide`, OAuth 2.1, anonymous tools.

### Phase A — MCP Transport & Auth

Stand up the `/api/mcp` Streamable HTTP endpoint with bearer-token auth, rate limiting, and the build-gate regression check.

- [ ] **MCP-TRANS-01**: `POST /api/mcp` Streamable HTTP endpoint exists at `src/app/api/[transport]/route.ts` (per `mcp-handler`'s dynamic-segment pattern) and accepts JSON-RPC 2.0 requests
- [ ] **MCP-TRANS-02**: Endpoint authenticates `Authorization: Bearer vsl_...` headers via `withMcpAuth` and rejects invalid keys with the MCP-protocol-correct error response
- [ ] **MCP-TRANS-03**: Endpoint reuses the existing Upstash rate limiter (`src/lib/api/rate-limit.ts`), keyed by API key ID — same per-key budget as REST
- [ ] **MCP-TRANS-04**: Endpoint runs in stateless mode (`sessionIdGenerator: undefined`) for Vercel serverless compatibility
- [ ] **MCP-TRANS-05**: Bearer-token verification core extracted from `src/lib/api/auth.ts:5` into a shared helper that both `withApiAuth` (REST) and the MCP adapter call
- [ ] **MCP-TRANS-06**: Build fails when `mcp-handler` is missing from `node_modules` — regression gate against the exact failure mode that retired v2.3 (a static import from `mcp-handler` in the route handler is sufficient)
- [ ] **MCP-TRANS-07**: `/api/mcp` added to the auth-bypass list in `src/middleware.ts` (same pattern as `/api/v1` and `/api/webhooks`)

### Phase B — MCP Tool Surface

Register exactly 4 outcome-oriented tools that let an agent complete the full create→edit→render loop.

- [ ] **MCP-TOOL-01**: `list_templates` tool returns the same template list shape as `GET /api/v1/templates`. Free; no credit deduction.
- [ ] **MCP-TOOL-02**: `create_carousel` tool accepts `{ topic, templateId, slideCount?, imageSource? }`, calls `src/lib/services/carousel.ts:generateCarousel`, deducts 1 credit via `deductCreditAdmin`, returns `{ projectId, slideCount, dashboardUrl }`. Returns 402-equivalent MCP error on insufficient credits.
- [ ] **MCP-TOOL-03**: `edit_slide` tool accepts `{ projectId, slideIndex, patch }` where `patch` supports the same 9 fields as `PATCH /api/v1/projects/{id}/slides/{index}` (hook_text, body_text, image_query, background_url, style_overrides, custom_texts, custom_images, hook_segments, body_segments). Free.
- [ ] **MCP-TOOL-04**: `render_carousel` tool accepts `{ projectId }`, returns `{ slides: [{ index, downloadUrl }], zipUrl }`. Returns URLs only — never inlined binary image data. Free.
- [ ] **MCP-TOOL-05**: Tool descriptions are self-contained — an agent can complete the full create→edit→render loop without reading external docs. Validated by exercising each tool via MCP Inspector with no extra context.
- [ ] **MCP-TOOL-06**: Tool registry pattern in `src/lib/mcp/tools.ts` accepts new tool definitions cleanly so v2.7+ broader surface can be added without architectural rework.

### Phase C — Distribution & Documentation

Ship the npm bridge and the setup docs that get users from "I have a `vsl_` key" to "Claude Desktop is calling my tools".

- [ ] **MCP-DIST-01**: `viralslidemaker-mcp` npm package has a working `bin/cli.js` that spawns `npx -y mcp-remote https://viralslidemaker.com/api/mcp --header "Authorization:Bearer ${VIRALSLIDEMAKER_API_KEY}"`. Plain JS, zero-build.
- [ ] **MCP-DIST-02**: Package reads `VIRALSLIDEMAKER_API_KEY` from env and exits with a clear, copy-paste-able error message if missing (pointing to `/settings/api-keys`)
- [ ] **MCP-DIST-03**: Package supports `VIRALSLIDEMAKER_BASE_URL` env override for self-hosted / staging deployments
- [ ] **MCP-DIST-04**: MCP setup guide exists (under `/docs` Scalar page or `docs/MCP-GUIDE.md`) with copy-paste config snippets for: Claude Desktop (`claude_desktop_config.json`), Cursor, Windsurf, ChatGPT custom-connector
- [ ] **MCP-DIST-05**: `/settings/api-keys` automation guide section (added earlier this session at `src/components/api-keys/automation-guide.tsx`) gets a fourth card linking to the MCP setup guide
- [ ] **MCP-DIST-06**: `viralslidemaker-mcp` published to npm at version 0.1.0 with a working install command in the setup guide

## Future Requirements (v2.7+)

Broader MCP tool surface that exposes the rest of the v2.5 REST endpoints as native MCP verbs. Deferred per lean-scope decision:

- Project management: `list_projects`, `get_project`, `update_project`, `delete_project`
- Slide-level CRUD beyond patch: `add_slide`, `delete_slide`, `reorder_slides`
- AI generation: `generate_slide_image` (Imagen, 1 credit), `regenerate_slide_text` (Gemini, free)
- Image sources: `search_pexels`
- Publishing: `publish_carousel`, `unpublish_carousel`
- Discovery: `list_explore`, `get_published_carousel`, `fork_published_carousel`
- Account: `list_bookmarks`, `bookmark`, `unbookmark`, `get_brand_kit`, `update_brand_kit`, `get_profile`, `update_profile`, `get_credits`

## Out of Scope (v2.6)

- **OAuth 2.1 / dynamic client registration** — `vsl_` static bearer tokens cover the use case. MCP spec allows static tokens.
- **Anonymous MCP tools** (e.g. exposing `/explore` reads without auth) — every MCP request requires a `vsl_` key. Mirrors REST policy.
- **Per-tool credit pricing different from REST** — `create_carousel` deducts 1 credit, identical to `POST /api/v1/carousel`. No MCP-specific tariff.
- **MCP Resources or Prompts** (per MCP spec terminology) — Tools only for v2.6. Resources/Prompts are differentiation surface, not table stakes.
- **Stateful sessions / sampling / agent-callback patterns** — stateless transport only. Stateful flows are v2.7+ if user demand emerges.
- **Broadcast notifications** (e.g. server-pushed events when a carousel completes async generation) — `create_carousel` is synchronous in v2.6, same as REST.
- **Tools that re-enter `/api/v1/*`** — tools call services directly. Avoids double-auth, double-rate-limit, double-credit accounting.

## Traceability

(Populated by the roadmapper in Step 10. Each REQ-ID maps to exactly one phase.)
