# Phase 17: MCP Server - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — MCP wraps existing REST API)

<domain>
## Phase Boundary

Build MCP server with curated tools (create_carousel, edit_slide, render_carousel, list_templates) that wrap the REST API endpoints from Phase 16. Deploy as Streamable HTTP endpoint inside Next.js app via mcp-handler, and publish as npm package for local stdio transport.

</domain>

<decisions>
## Implementation Decisions

### MCP Tools Design
- 4 curated high-level tools: create_carousel, edit_slide, render_carousel, list_templates
- Tools call REST service layer directly (not HTTP calls to own API) — same shared services
- MCP auth via API key passed in tool context (mcp-handler's withMcpAuth)
- Use Streamable HTTP transport (not SSE — incompatible with serverless)

### Package & Deployment
- MCP route handler at `/api/mcp` using mcp-handler package inside Next.js App Router
- npm package published for local stdio transport (separate entry point)
- Use @modelcontextprotocol/sdk for tool definitions and server setup
- Zod schemas for tool input validation (test zod/v3 compat with mcp-handler)

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase wrapping established REST services. Use research findings from .planning/research/STACK.md and ARCHITECTURE.md for mcp-handler patterns.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (from Phases 15-16)
- `src/lib/services/carousel.ts` — generateCarouselService
- `src/lib/services/editor.ts` — updateSlide, getSlide
- `src/lib/services/render.ts` — renderSlide, renderAllSlidesToZip
- `src/lib/services/project.ts` — project CRUD
- `src/lib/api/auth.ts` — authenticateApiKey (for MCP auth)
- `src/lib/api/rate-limit.ts` — checkRateLimit

### Integration Points
- New route: `src/app/api/mcp/route.ts` (mcp-handler)
- New package entry: `src/mcp/index.ts` (stdio transport for npm package)
- New npm packages: `mcp-handler`, `@modelcontextprotocol/sdk` (already in research)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard MCP server implementation wrapping existing services.

</specifics>

<deferred>
## Deferred Ideas

None — phase scope is well-defined.

</deferred>
