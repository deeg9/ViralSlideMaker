# Phase 24: REST Endpoints (Read) - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Developers can query templates, list and retrieve projects, and fetch individual slides through the API. This phase implements 5 read-only REST endpoints that use the withApiAuth HOC and service layer from Phases 22-23.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints:
- All routes use withApiAuth HOC from Phase 22/23 (auth + rate limit + CORS + credits)
- Use services/projects.ts for project CRUD (extracted in Phase 23)
- Route files go in src/app/api/v1/ following Next.js App Router conventions
- Responses must match OpenAPI spec at src/lib/api/openapi.ts exactly
- DELETE /projects/{id} is included despite being a mutation — it's in this phase per ROADMAP

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — refer to ROADMAP phase description and OpenAPI spec.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
