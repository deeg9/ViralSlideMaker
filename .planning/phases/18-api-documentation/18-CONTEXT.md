# Phase 18: API Documentation - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — documentation)

<domain>
## Phase Boundary

Generate OpenAPI spec from API route schemas, set up interactive Scalar playground at /docs, and write MCP server connection instructions for Claude Code and other AI agents.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure documentation phase. Use standard OpenAPI 3.1 + Scalar patterns. MCP connection instructions should cover claude_desktop_config.json format for Claude Code and general MCP client setup.

</decisions>

<code_context>
## Existing Code Insights

### API Routes to Document (from Phases 15-16)
- POST /api/v1/carousel — one-shot carousel generation
- GET /api/v1/templates — list available templates
- GET/POST /api/v1/projects — project CRUD
- GET/DELETE /api/v1/projects/:id — single project
- PATCH/GET /api/v1/projects/:id/slides/:index — slide editing
- POST /api/v1/projects/:id/render — trigger render
- GET /api/v1/projects/:id/download — ZIP download
- GET /api/v1/projects/:id/download/:index — single PNG
- POST /api/mcp — MCP Streamable HTTP endpoint

### Integration Points
- New page: /docs (Scalar playground)
- New file: openapi.json or openapi.yaml
- New file: MCP-README.md or section in existing README

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard documentation patterns.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
