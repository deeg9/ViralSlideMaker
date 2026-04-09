# Phase 25: REST Endpoints (Write & Render) - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Developers can create carousels, create projects, update slides, and render/download images entirely through the API. This phase implements the 5 remaining write/render endpoints that complete the REST API.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase.

Key constraints:
- POST /carousel uses services/carousel.ts (stubbed in Phase 23) — must implement the full generation flow
- POST /projects uses services/projects.ts createProject
- PATCH /slides/{index} needs slide-level update logic
- POST /render needs to call the existing Satori/ImageResponse rendering pipeline
- GET /download needs to generate ZIP of all slide PNGs
- All use withApiAuth HOC (auth + rate limit + CORS + credits)
- POST /carousel deducts 1 credit via deductCreditAdmin
- Responses must match OpenAPI spec exactly

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — refer to ROADMAP and OpenAPI spec.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
