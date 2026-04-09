---
phase: 24-rest-endpoints-read
plan: 02
subsystem: api
tags: [rest, endpoints, projects, slides, crud]
dependency_graph:
  requires: [with-api-auth, api-errors, api-response, projects-service]
  provides: [project-get-endpoint, project-delete-endpoint, slide-get-endpoint]
  affects: [api-routes]
tech_stack:
  added: []
  patterns: [url-path-param-extraction, withApiAuth-hoc, slide_data-to-slides-remap]
key_files:
  created:
    - src/app/api/v1/projects/[id]/route.ts
    - src/app/api/v1/projects/[id]/slides/[index]/route.ts
  modified: []
decisions:
  - Extract route params from URL path since withApiAuth replaces Next.js params arg
  - Cast slide_data as unknown[] for type-safe array index access
metrics:
  duration: 115s
  completed: 2026-04-08
---

# Phase 24 Plan 02: Project Get/Delete and Slide Get Endpoints Summary

GET/DELETE project and GET slide endpoints using withApiAuth HOC with URL-based param extraction and slide_data-to-slides remapping.

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | GET and DELETE /api/v1/projects/{id} | 1d933fa | src/app/api/v1/projects/[id]/route.ts |
| 2 | GET /api/v1/projects/{id}/slides/{index} | 753319e | src/app/api/v1/projects/[id]/slides/[index]/route.ts |

## Implementation Details

### Task 1: Project GET and DELETE
- **GET** retrieves full project via `getProject`, remaps `slide_data` to `slides` for OpenAPI compliance, returns `{ data: Project }`
- **DELETE** verifies project exists and belongs to user via `getProject`, then calls `deleteProjectService`, returns `{ data: { deleted: true } }`
- Both return 404 NOT_FOUND for non-existent or unauthorized projects
- Extracts project ID from URL path segment (index 4) since withApiAuth replaces the params argument

### Task 2: Slide GET by Index
- Parses slide index from URL path segment (index 6) as integer
- Returns 400 VALIDATION_ERROR for non-numeric or negative index values
- Returns 404 NOT_FOUND for non-existent project or out-of-range slide index
- Returns individual slide object from `slide_data` array

## Deviations from Plan

None - plan executed exactly as written.

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-24-03 | User scoping via ctx.userId in getProject query |
| T-24-04 | User scoping + existence check before delete |
| T-24-05 | Project ownership check before slide access; out-of-range returns 404 |
| T-24-06 | parseInt validation rejects non-numeric input with 400 before DB query |

## Self-Check: PASSED
