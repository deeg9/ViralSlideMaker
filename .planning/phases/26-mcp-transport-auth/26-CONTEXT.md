# Phase 26: MCP Transport & Auth - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

The /api/mcp endpoint accepts MCP protocol requests with Bearer token authentication, rate limiting, and stateless transport compatible with Vercel serverless. This phase sets up the MCP server infrastructure — no tools yet (Phase 27).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase.

Key constraints from research:
- Use `mcp-handler` (Vercel's Next.js adapter) + `@modelcontextprotocol/sdk` v1.x
- Route at `src/app/api/[transport]/route.ts` using dynamic segment per mcp-handler pattern
- Auth via `withMcpAuth` with `verifyToken` hook calling existing `authenticateApiKey`
- Stateless transport: `sessionIdGenerator: undefined` for Vercel compatibility
- Add `/api/mcp` to middleware bypass in `src/middleware.ts` (same pattern as /api/v1)
- Rate limiting via existing Upstash rate limiter, keyed by API key ID

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
