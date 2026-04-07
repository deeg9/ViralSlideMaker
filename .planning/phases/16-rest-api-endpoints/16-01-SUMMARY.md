---
phase: 16-rest-api-endpoints
plan: 01
subsystem: api
tags: [rest-api, cors, credit-headers, project-crud, templates, next-api-routes]

# Dependency graph
requires:
  - phase: 15-service-extraction-api-auth
    provides: API auth pipeline (authenticateApiKey, checkRateLimit, apiError), carousel service, admin client pattern
provides:
  - Shared API headers utility (buildResponseHeaders, CORS_HEADERS, corsOptions)
  - Extended error codes (NOT_FOUND 404, FORBIDDEN 403) with CORS on all error responses
  - Project CRUD service layer (listProjects, getProject, createProjectService, deleteProjectService)
  - GET /api/v1/templates endpoint
  - GET/POST /api/v1/projects endpoints
  - GET/DELETE /api/v1/projects/:id endpoints
  - Credit headers (x-credits-remaining, x-credits-used) on carousel endpoint
affects: [16-02-slide-editing-render-download, 17-mcp-server]

# Tech tracking
tech-stack:
  added: []
  patterns: ["buildResponseHeaders for consistent credit+CORS headers", "project service with userId filter on admin client"]

key-files:
  created:
    - src/lib/api/headers.ts
    - src/lib/services/project.ts
    - src/app/api/v1/templates/route.ts
    - src/app/api/v1/projects/route.ts
    - src/app/api/v1/projects/[id]/route.ts
  modified:
    - src/lib/api/errors.ts
    - src/app/api/v1/carousel/route.ts

key-decisions:
  - "Return 404 (not 403) for non-owned projects to prevent ID enumeration (T-16-02)"
  - "All project service queries filter by user_id even with admin client to prevent IDOR (T-16-01)"
  - "Credit headers on all responses including 0-cost reads for consistent API experience"

patterns-established:
  - "buildResponseHeaders: single utility for credit + CORS + rate-limit headers on every response"
  - "Service options pattern: { adminClient?: SupabaseClient } for API vs Server Action flexibility"
  - "Route handler pattern: auth -> rateLimit -> validate -> service(adminClient) -> headers -> response"

requirements-completed: [REST-01, REST-02, REST-03, REST-06]

# Metrics
duration: 2min
completed: 2026-04-07
---

# Phase 16 Plan 01: REST API Endpoints - Shared Utilities & CRUD Summary

**Built shared credit/CORS header utility, extended API error codes, extracted project CRUD service, and created templates + projects REST endpoints**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-07T18:06:17Z
- **Completed:** 2026-04-07T18:08:18Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created buildResponseHeaders utility that consistently applies credit balance, usage count, CORS, and rate-limit headers to every API response
- Extended error handling with NOT_FOUND (404) and FORBIDDEN (403) codes; all error responses now include CORS headers automatically
- Extracted project CRUD into service layer with mandatory user_id filtering on every query (admin client bypasses RLS)
- Built 4 new API route handlers: GET /templates, GET/POST /projects, GET/DELETE /projects/:id -- all following the established auth pipeline pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared API headers utility, extend error codes, add credit headers to carousel** - `20f5980` (feat)
2. **Task 2: Extract project CRUD service and create templates + projects API routes** - `59d0a92` (feat)

## Files Created/Modified
- `src/lib/api/headers.ts` - Shared buildResponseHeaders, CORS_HEADERS, corsOptions utilities
- `src/lib/api/errors.ts` - Added NOT_FOUND/FORBIDDEN codes, CORS headers on all error responses
- `src/app/api/v1/carousel/route.ts` - Updated to use buildResponseHeaders with creditsUsed=1
- `src/lib/services/project.ts` - Project CRUD service with user_id filtering on admin client
- `src/app/api/v1/templates/route.ts` - GET handler returning template list with credit headers
- `src/app/api/v1/projects/route.ts` - GET (list) + POST (create) with Zod validation
- `src/app/api/v1/projects/[id]/route.ts` - GET (single) + DELETE with Next.js 15 Promise params

## Decisions Made
- Return 404 (not 403) for non-owned projects to prevent ID enumeration (threat T-16-02)
- All project service queries include .eq('user_id', userId) even with admin client to prevent IDOR (threat T-16-01)
- Credit headers included on all responses, even 0-cost reads, for consistent API experience

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Next Phase Readiness
- All shared utilities (headers, extended errors) ready for Plan 02 slide editing and render/download routes
- Project service ready for Plan 02 to build on (slide editing operates on projects)
- Established route handler pattern reusable for all remaining endpoints

## Self-Check: PASSED

All 5 created files verified present. Both task commit hashes (20f5980, 59d0a92) verified in git log.

---
*Phase: 16-rest-api-endpoints*
*Completed: 2026-04-07*
