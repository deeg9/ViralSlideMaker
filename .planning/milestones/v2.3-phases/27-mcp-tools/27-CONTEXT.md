# Phase 27: MCP Tools - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

AI agents can complete the full carousel workflow — discover templates, create a carousel, edit slides, and get download URLs — through MCP tool calls. This phase defines and registers 4 outcome-oriented tools on the MCP server from Phase 26.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase.

Key constraints from research:
- 4 outcome-oriented tools: create_carousel, list_templates, edit_slide, render_carousel
- Tools call service layer directly (src/lib/services/) — NOT internal REST endpoints
- Tool definitions in src/lib/mcp/tools.ts (shared between transports)
- Register tools on the MCP server created in Phase 26
- create_carousel deducts 1 credit via deductCreditAdmin
- Tool descriptions must enable full workflow without external docs
- Return download URLs, not binary image data

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
