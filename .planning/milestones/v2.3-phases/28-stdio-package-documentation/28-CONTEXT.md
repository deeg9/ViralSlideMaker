# Phase 28: stdio Package & Documentation - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Developers can install an npm package for local MCP agent use, and the MCP guide accurately reflects the working implementation. This phase creates the stdio transport npm package and verifies the existing docs.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase.

Key constraints from research:
- Use `mcp-remote` as stdio-to-HTTP bridge — zero business logic in the package
- npm package name: `viralslidemaker-mcp`
- Package in `packages/mcp-cli/` directory
- bin entry with shebang for `npx viralslidemaker-mcp` usage
- Verify docs/MCP-GUIDE.md against actual implementation (Claude Desktop config, Cursor config, tool names, endpoints)

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
