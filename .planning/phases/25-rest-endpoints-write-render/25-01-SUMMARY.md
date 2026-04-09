---
phase: 25-rest-endpoints-write-render
plan: 01
subsystem: rest-api
tags: [api, endpoints, carousel, projects, slides]
dependency_graph:
  requires: [with-api-auth, projects-service, credits-service, ai-generate-slides, pexels-search]
  provides: [post-carousel, post-projects, patch-slides]
  affects: [openapi-spec-consumers]
tech_stack:
  added: []
  patterns: [admin-supabase-client, withApiAuth-HOC, credit-gating]
key_files:
  created:
    - src/app/api/v1/carousel/route.ts
  modified:
    - src/lib/services/carousel.ts
    - src/app/api/v1/projects/route.ts
    - src/app/api/v1/projects/[id]/slides/[index]/route.ts
decisions:
  - Carousel service re-throws errors (route handler catches and returns generic 500) for clean separation
  - PATCH slides uses allowlist of fields rather than accepting arbitrary keys
  - Deep merge for style_overrides so partial overrides don't wipe existing styles
metrics:
  duration: ~2 min
  completed: "2026-04-08"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 25 Plan 01: Write/Mutation REST Endpoints Summary

Three write endpoints implemented: one-shot carousel generation with credit deduction, project creation, and partial slide update with deep style_overrides merge.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Extract carousel service and implement POST /carousel | ac17f7e | src/lib/services/carousel.ts, src/app/api/v1/carousel/route.ts |
| 2 | Add POST /projects and PATCH /slides/{index} | 2e9ff8d | src/app/api/v1/projects/route.ts, src/app/api/v1/projects/[id]/slides/[index]/route.ts |

## What Was Built

### POST /api/v1/carousel
- Accepts topic, templateId, optional imageSource/slideCount/advancedOptions
- Validates all input with structured error responses
- Checks credit balance, deducts 1 credit via deductCreditAdmin
- Calls extracted generateCarousel service
- Returns { success, projectId, slideCount } with x-credits-used header
- maxDuration=60 for Vercel timeout

### POST /api/v1/projects
- Accepts title (required, 1-200 chars), optional topic and templateId
- Creates project via createProjectService
- Returns 201 with { data: { id } }

### PATCH /api/v1/projects/{id}/slides/{index}
- Accepts partial slide fields: hook_text, body_text, image_query, background_url, style_overrides
- Validates at least one field provided
- Validates background_url starts with https:// (T-25-02)
- Deep merges style_overrides to preserve existing overrides
- Returns updated slide object

### Carousel Service Extraction
- Replaced stub in src/lib/services/carousel.ts with real implementation
- Extracted from server action, uses admin supabase client (no session cookies)
- Handles both stock (Pexels) and AI (Imagen) image sources
- Creates project, generates content, fetches images, applies font/color overrides
- On error, marks project generation_status as 'error' and re-throws

## Deviations from Plan

None - plan executed exactly as written.

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-25-01 | All endpoints use withApiAuth for Bearer token validation |
| T-25-02 | background_url validated to require https:// prefix |
| T-25-03 | Carousel errors caught in route handler, generic message returned |
| T-25-04 | Rate limiting via withApiAuth + credit gate + maxDuration=60 |
| T-25-05 | All queries filter by userId from authenticated context |
| T-25-06 | slideCount clamped to 3-20 in both route validation and service |

## Self-Check: PASSED

All 4 created/modified files verified on disk. Both commit hashes (ac17f7e, 2e9ff8d) verified in git log.
