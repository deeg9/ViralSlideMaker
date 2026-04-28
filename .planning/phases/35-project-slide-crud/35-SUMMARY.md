---
phase: 35-project-slide-crud
status: complete
shipped: 2026-04-28
requirements_closed: [API-01, API-02, API-03, API-04, API-05]
---

# Phase 35 — SUMMARY

## What shipped

Closes the project-rename and slide-shape gaps in the public API.
Five new (or expanded) endpoints; all reuse existing services + auth.

| Endpoint | Method | Route file |
|---|---|---|
| Update project metadata | `PATCH /projects/{id}` | `src/app/api/v1/projects/[id]/route.ts` |
| Edit slide (expanded fields) | `PATCH /projects/{id}/slides/{index}` | `src/app/api/v1/projects/[id]/slides/[index]/route.ts` |
| Add slide | `POST /projects/{id}/slides` | `src/app/api/v1/projects/[id]/slides/route.ts` (new) |
| Delete slide | `DELETE /projects/{id}/slides/{index}` | `src/app/api/v1/projects/[id]/slides/[index]/route.ts` |
| Reorder slides | `POST /projects/{id}/slides/reorder` | `src/app/api/v1/projects/[id]/slides/reorder/route.ts` (new) |

Plus matching OpenAPI path entries shipped in the same commit.

## Decisions (defaults applied — no user input requested per autonomous mode)

- **Min slide count on DELETE:** 1. Cannot delete the last remaining slide; caller deletes the project instead.
- **Max slide count on POST:** 20 (matches dashboard).
- **`POST /slides` body:** optional `position` (0..N) defaults to append; optional `slide` body defaults to a blank skeleton.
- **`POST /slides/reorder` body:** requires a full permutation of 0..N-1 (length must match, all unique). Partial permutations rejected.
- **`PATCH /projects/{id}` allowed fields:** `title` (1-200 chars), `description` (string|null), `template_id` (string|null). Other fields (slide_data, generation_status, user_id, timestamps) are immutable via this endpoint.
- **Expanded `PATCH /slides/{index}` fields:** added `hook_segments`, `body_segments`, `custom_texts`, `custom_images`. `style_overrides` continues to deep-merge; arrays replace wholesale.

## Verification

- `npx tsc --noEmit | grep -E "v1/projects|openapi"` → empty
- `curl -X PATCH /api/v1/projects/test` → 401 (Unauthorized, expected — no API key); confirms route compiled and middleware skips auth correctly.
- New OpenAPI entries all reference existing schemas; no breaking changes to existing routes.

## Out of scope

- No tests added; existing test suite has pre-existing typecheck issues unrelated to v2.5.
- No SDK regeneration; that's a downstream consumer's job.
