# Phase 16: REST API Endpoints - Validation Architecture

**Created:** 2026-04-06
**Framework:** Vitest 4.1.0
**Config:** `vitest.config.ts`

## Test Commands

| Scope | Command |
|-------|---------|
| Quick (single file) | `npx vitest run {file} --reporter=verbose` |
| Full suite | `npx vitest run` |
| Per-wave gate | `npx vitest run --reporter=verbose` |

## Requirements -> Test Map

| Req ID | Behavior | Test File | Automated Command |
|--------|----------|-----------|-------------------|
| REST-01 | One-shot carousel returns credit headers | `src/__tests__/api/v1/carousel-headers.test.ts` | `npx vitest run src/__tests__/api/v1/carousel-headers.test.ts` |
| REST-02 | List templates returns template array | `src/__tests__/api/v1/templates.test.ts` | `npx vitest run src/__tests__/api/v1/templates.test.ts` |
| REST-03 | Project CRUD operations | `src/__tests__/services/project.test.ts` | `npx vitest run src/__tests__/services/project.test.ts` |
| REST-04 | Slide update with text/image/style | `src/__tests__/services/editor.test.ts` | `npx vitest run src/__tests__/services/editor.test.ts` |
| REST-05 | Render returns PNG buffer, ZIP packages multiple | `src/__tests__/services/render.test.ts` | `npx vitest run src/__tests__/services/render.test.ts` |
| REST-06 | Credit headers on success and error responses | `src/__tests__/api/v1/headers.test.ts` | `npx vitest run src/__tests__/api/v1/headers.test.ts` |

## Wave 0 Test Stubs Required

All test files listed above must be created by Plan 16-00 (Wave 0) before implementation plans execute.

Each stub should:
- Import vitest `describe`, `it`, `expect`, `vi`, `beforeEach`
- Mock dependencies (`@/lib/supabase/admin`, `@/lib/api/auth`, etc.)
- Define `describe` blocks with `it.todo()` or `it()` stubs that assert expected behavior
- Stubs should FAIL (red) until the corresponding implementation plan completes them

## Deviation Log

| Decision | CONTEXT.md Says | Implementation | Rationale |
|----------|----------------|----------------|-----------|
| Download URLs | "TTL'd presigned URLs" | Relative API paths (`/api/v1/projects/:id/download`) | No Supabase Storage bucket configured for rendered output; direct binary response is simpler, faster, and avoids storage costs. Auth on download endpoints provides equivalent access control to TTL'd URLs. |

## Sampling Rate

- **Per task commit:** Run test files relevant to modified code
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`
