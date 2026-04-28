# Requirements: ViralSlideMaker v2.5 Public REST API Parity

**Defined:** 2026-04-28
**Core Value:** Type a topic, get ready-to-post carousel slide images — fully AI-generated, editable, downloadable. v2.5 closes the gap between the dashboard and the public REST API: a customer with an API key can do everything they can do in the UI.

## v2.5 Requirements

Requirements for the Public REST API Parity milestone. Each maps to roadmap phases (34–39). Audit captured 2026-04-28 — current API at `/api/v1/*` covers ~30% of dashboard capabilities.

### Locked Decisions

- **Auth:** all new endpoints use the existing Bearer token + rate-limit pattern via `withApiAuth` (`src/lib/api/with-api-auth.ts`). No new auth surface.
- **Versioning:** stay on v1 path prefix. New endpoints are additive; no breaking changes to existing 7 routes.
- **Spec parity:** every new endpoint adds a matching OpenAPI path entry in the **same commit**. Spec and impl never diverge.
- **Credit accounting:** credit-deducting endpoints (`carousel`, AI image generation) deduct via `deductCreditAdmin` and surface `x-credits-remaining` / `x-credits-used` headers per existing convention.
- **Idempotency:** mutation endpoints accept an optional `Idempotency-Key` header (best-effort; full impl deferred).
- **Excluded surfaces (deferred to v2.6+):** Stripe checkout/portal/subscription sync (web-only), API key CRUD via API (chicken-and-egg), webhooks for project/fork events, OAuth 2.1.
- **Tier ordering:** Tier 1 ships first as a single spec-only PR (zero behavior change → low risk → immediate /docs improvement). Tiers 2 and 3 build on top.

### Tier 1 — Spec Accuracy (Phase 34)

Update `src/lib/api/openapi.ts` to fully document everything the existing 7 routes already accept and return. Surfaced via Scalar at `/docs`. No new endpoints.

- [ ] **SPEC-01**: `Slide` schema documents `hook_segments` and `body_segments` (`TextSegment[]`) used by news-headline two-color rendering
- [ ] **SPEC-02**: `StyleOverrides` schema documents `hook_text_effects`, `body_text_effects` (`TextEffects` with shadow / outline / highlight sub-types), `layout` ('cover' | 'body'), and `hide_watermark` boolean
- [ ] **SPEC-03**: `CustomText` schema documents `text_effects` and `segments` fields
- [ ] **SPEC-04**: New `TextSegment` schema (text + accent boolean) added to `components/schemas`
- [ ] **SPEC-05**: New `TextEffects` schema with `TextShadowEffect` / `TextOutlineEffect` / `TextHighlightEffect` sub-schemas matching `src/lib/types/slide.ts`
- [ ] **SPEC-06**: `Project` schema documents `description` and `generation_status` fields (current type from `src/lib/types/project.ts`)
- [ ] **SPEC-07**: `/carousel` POST 200 response schema documents the actual `{ success: true, projectId: string, slideCount: number }` shape

### Tier 2.A — Project & Slide CRUD (Phase 35)

Close the project-rename and slide-shape gaps. Each item is a real new endpoint or expanded handler.

- [ ] **API-01**: `PATCH /projects/{id}` — update `title`, `description`, `template_id`. Validates ownership via existing service layer.
- [ ] **API-02**: `PATCH /projects/{id}/slides/{index}` accepts new fields beyond the existing 5: `custom_texts`, `custom_images`, `hook_segments`, `body_segments`, `hide_watermark` (style_overrides field). Backwards-compatible — existing 5 fields continue to work.
- [ ] **API-03**: `POST /projects/{id}/slides` — append a new slide; optional `position` body param to insert at index.
- [ ] **API-04**: `DELETE /projects/{id}/slides/{index}` — remove a slide. Adjusts indices on remaining slides.
- [ ] **API-05**: `POST /projects/{id}/slides/reorder` — body `{ order: number[] }` (array of indices). Validates length matches and is a permutation.

### Tier 2.B — Publish & Credits Read (Phase 36)

Programmatic publishing and a read-only credits surface.

- [ ] **API-06**: `POST /projects/{id}/publish` — calls `publishProjectToExplore` server-action equivalent. Body: `{ title, description?, tags? }`. Returns `{ publishedId, slug, url }`. Reuses existing hero-render + `publish_carousel` RPC.
- [ ] **API-07**: `DELETE /projects/{id}/publish` — calls `unpublish_carousel` RPC. Returns `{ unpublished_at }`.
- [ ] **API-08**: `GET /me/credits` — returns `{ tier, balance, monthly_grant, period_end }`. Reuses `getCreditBalance` + `getUserTier`.

### Tier 3.A — AI & Image Sources (Phase 37)

- [ ] **API-09**: `POST /pexels/search` — body `{ query, orientation?, perPage? }`. Proxies `searchPhotos`. Free.
- [ ] **API-10**: `POST /projects/{id}/slides/{index}/generate-image` — body `{ prompt? }` (defaults to slide's `image_query`). Calls Imagen, writes resulting URL to `slide.background_url`, deducts 1 credit.
- [ ] **API-11**: `POST /projects/{id}/slides/{index}/regenerate-text` — body `{ field: 'hook' | 'body' }`. Calls existing AI text-regen path. Free per current dashboard pricing.

### Tier 3.B — Explore Feed, Bookmarks, Forking (Phase 38)

- [ ] **API-12**: `GET /explore` — query params `?sort=trending|new|featured&tag=&q=&cursor=`. Mirrors current `/explore` page query (popularity_score for trending, published_at for new, is_featured filter). Returns `{ items: PublishedCarousel[], next_cursor }`.
- [ ] **API-13**: `GET /explore/{slug}` — single published carousel detail (slide_data, owner profile snippet, counts). Mirrors current `/explore/[slug]` server fetch.
- [ ] **API-14**: `POST /explore/{slug}/fork` — calls `fork_published_carousel` RPC. Returns `{ projectId }`.
- [ ] **API-15**: `POST /me/bookmarks` — body `{ publishedId }`. Inserts into `public.bookmarks`.
- [ ] **API-16**: `DELETE /me/bookmarks/{publishedId}` — deletes the bookmark row.
- [ ] **API-17**: `GET /me/bookmarks` — list current user's bookmarks (most-recent first), each item shaped like `PublishedCarousel`.

### Tier 3.C — Brand Kit & Profile (Phase 39)

- [ ] **API-18**: `GET /me/brand-kit` — returns the current user's brand kit row (or `null`).
- [ ] **API-19**: `PUT /me/brand-kit` — upsert brand kit. Body matches the `BrandKit` schema (logo_url, accent_color, font pairings, text-position defaults). Logo upload flow uses an upload-URL pattern: server returns a signed PUT URL on `POST /me/brand-kit/logo-upload-url` (sub-endpoint), client uploads, then `PUT /me/brand-kit` with the resulting public URL.
- [ ] **API-20**: `GET /me/profile` — returns `public.profiles` row (display_name, bio, avatar_url, website_url, social_links).
- [ ] **API-21**: `PATCH /me/profile` — update profile fields (excluding username; that has its own claim flow).

### Documentation

- [ ] **DOC-01**: Update PROJECT.md with v2.5 milestone goal and shipped summary upon completion
- [ ] **DOC-02**: README quickstart reflects new credits + publish endpoints

## Out of Scope (deferred to v2.6+)

| Feature | Reason |
|---|---|
| Stripe checkout / portal / subscription sync | Session-auth surface, not API-key surface |
| Create / list / revoke API keys via API | Chicken-and-egg; stays in `/settings/api-keys` |
| Webhooks ("project published", "carousel forked") | Need infra for at-least-once delivery; defer |
| OAuth 2.1 / per-scope tokens | Static Bearer tokens cover v1 |
| Pagination cursor encryption | Plain offset/timestamp cursors fine for v1 |
| GraphQL surface | REST is sufficient for v1 |

## Audit Reference

Live audit captured 2026-04-28 in conversation transcript:
- All 7 existing routes' HTTP methods match the spec (no method mismatches).
- Schema staleness identified per Tier 1 above.
- Capability gap inventory crossed dashboard features against `/api/v1/*` route handlers.
