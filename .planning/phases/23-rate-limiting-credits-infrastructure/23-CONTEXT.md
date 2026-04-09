# Phase 23: Rate Limiting, Credits & Infrastructure - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

API requests are rate limited per key, credit-consuming operations enforce balances, and all responses follow a consistent structured format. This phase builds the middleware infrastructure that all /api/v1/* route handlers will use — it sits between the withApiAuth HOC (Phase 22) and the actual endpoint logic (Phases 24-25).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from research:
- Use @upstash/ratelimit + @upstash/redis for distributed rate limiting (npm install needed)
- Sliding window strategy, keyed by api_key_id
- Integrate rate limiting into the withApiAuth HOC from Phase 22
- Use existing deduct_credits Postgres RPC for credit deduction (don't bypass it)
- Error responses must match OpenAPI spec codes: UNAUTHORIZED, RATE_LIMITED, VALIDATION_ERROR, INTERNAL_ERROR, INSUFFICIENT_CREDITS, NOT_FOUND, FORBIDDEN
- CORS headers for cross-origin browser-based API consumers
- Service extraction: pull carousel generation, project CRUD, and rendering logic from server actions into shared src/lib/services/ functions

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
