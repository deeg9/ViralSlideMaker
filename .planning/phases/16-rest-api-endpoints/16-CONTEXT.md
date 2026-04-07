# Phase 16: REST API Endpoints - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the full REST API surface: one-shot carousel generation, project CRUD, template listing, granular slide editing (text, image, style), render/download endpoints. All endpoints authenticated via Bearer token (from Phase 15), with credit headers on every response.

</domain>

<decisions>
## Implementation Decisions

### REST API Endpoint Structure
- API path convention: `/api/v1/{resource}` (RESTful) — continues pattern from Phase 15's `/api/v1/carousel`
- One-shot response: synchronous — return content + render URLs in single response (within 60s Vercel timeout)
- Granular edit: `PATCH /api/v1/projects/:id/slides/:index` — standard REST resource nesting
- Render endpoint: `POST /api/v1/projects/:id/render` → returns download URLs (TTL'd presigned URLs)

### Editor Actions Extraction
- Extract all slide-level editor actions: update text, swap image, restyle, reorder
- Service layer pattern: extract to `lib/services/editor.ts`, existing Server Actions become thin wrappers (same pattern as Phase 15)
- Image source for API: accept Pexels query string or direct URL — no Imagen support via API (credit cost too high for batch use)

### Credit Headers & Download
- Credit headers `x-credits-remaining` + `x-credits-used` on every response, even 0-cost reads
- ZIP endpoint returns presigned URL; individual PNGs returned as direct binary with Content-Disposition header
- Template listing requires API key authentication — keeps template list private to paying users

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (from Phase 15)
- `src/lib/services/carousel.ts` — extracted generateCarousel service
- `src/lib/api/auth.ts` — authenticateApiKey middleware
- `src/lib/api/errors.ts` — structured error responses (ApiError, apiError helper)
- `src/lib/api/rate-limit.ts` — Upstash Redis rate limiting with tier configs
- `src/lib/api/types.ts` — ApiKeyRecord, tier types
- `src/lib/credits/check-credits.ts` — deductCredit with optional adminClient
- `src/app/api/v1/carousel/route.ts` — existing one-shot endpoint to extend

### Established Patterns
- API route handler pattern: authenticateApiKey → checkRateLimit → business logic → apiError on failure
- Admin client for API routes (bypasses RLS)
- Service functions accept userId + params, return typed results
- Server Actions as thin wrappers with auth + revalidation

### Integration Points
- New routes under `/api/v1/`: projects, templates, slides, render, download
- Extract editor actions from `src/app/(dashboard)/project/[id]/actions.ts` and `editor-actions.ts`
- Render pipeline reuse: existing `/api/render/route.ts` for PNG generation

</code_context>

<specifics>
## Specific Ideas

- Reuse the auth + rate-limit pipeline pattern established in Phase 15's carousel route
- Editor service should mirror the existing Server Action signatures for backward compatibility
- Download URLs should include a short TTL (e.g., 15 minutes) to avoid permanent hosting

</specifics>

<deferred>
## Deferred Ideas

- Imagen image generation via API (too expensive for batch use)
- Async generation with polling (sync is sufficient for now)
- Webhook notifications on completion

</deferred>
