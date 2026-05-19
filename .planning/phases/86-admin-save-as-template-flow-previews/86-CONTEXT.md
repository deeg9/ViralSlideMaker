# Phase 86: Admin Save-as-Template Flow + Previews - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

An admin can save a chosen source carousel as a new template — name it, assign
a content category — through an admin-role-gated flow, and the resulting DB
template carries a faithful picker preview. A non-admin cannot reach the flow or
its endpoint.

**In scope:** a reusable server-enforced admin check; a new `(admin)` route
group + Save-as-Template page; the save endpoint (extract recipe + flat style,
render a preview, write the `templates` row); a `template-previews` storage
bucket; the picker rendering a DB template's preview (ADMIN-01, ADMIN-02).

**Out of scope (shipped earlier / deferred):** the `templates` table + registry
merge (Phase 83); the `LayoutRecipe` model + extraction (Phase 84); recipe-driven
generation (Phase 85). Also deferred: a non-admin / end-user template-saving
surface; community/publishable templates; editing or deleting a saved DB
template (V1 is save-new-only — a re-save mints a new template); a Save-as-Template
MCP tool.

This is the final phase of milestone v2.14 and ties the milestone together.

</domain>

<decisions>
## Implementation Decisions

### Admin Auth Gating
- Admin identity comes from an env allowlist — `ADMIN_USER_IDS` (comma-separated
  Supabase user ids). No migration, server-enforced, extensible, consistent with
  the seed-explore env pattern. (`profiles` has no `role` column today.)
- A single reusable helper — `isAdminUser()` / `requireAdmin()` in
  `src/lib/auth/admin.ts` — is used by BOTH the admin page loader and the save
  endpoint. The role check is mirrored on every Save-as-Template surface.
- Non-admins are blocked by a server-side redirect/404 in the `(admin)` layout —
  not merely a hidden link.
- The save endpoint re-checks admin via the logged-in Supabase session cookie
  (this is a real authenticated admin action) — no bearer token (unlike
  seed-explore's dev-script gate).

### Authoring Flow & Surface
- The surface is a web admin page only. Save-as-Template is NOT an MCP tool in
  v1 — the MCP is for building source carousels, not saving them.
- A new `(admin)` route group: `(admin)/templates/save/page.tsx` with an
  `(admin)/layout.tsx` admin-auth wrapper (parallels `(dashboard)`).
- The admin picks the source carousel from a list of their OWN projects
  (`listProjects`) — not a pasted id, not other users' projects.
- Form fields: a required `name` (text) and a required `category` select,
  constrained to the closed `CONTENT_CATEGORIES` enum (`news` / `facts`).

### Picker Preview Generation (ADMIN-02)
- The preview is a rendered snapshot PNG of the source carousel's cover slide —
  faithful, because the Oracle look is photo-driven and a `sample`-only payload
  would omit the source photo.
- The cover slide (slide 0) is the preview slide.
- The PNG is rendered synchronously at save time (Satori render inline in the
  save endpoint) — no job queue.
- A new public `template-previews` Supabase Storage bucket holds the PNG
  (additive migration); the public URL is stored in `templates.preview`.
- The template picker renders the `preview` PNG for a DB template that has one,
  falling back to the live `sample` `<SlidePreview>` path otherwise. Render
  parity (TPLREND-05) is preserved — no new render fields.

### Save Mechanics & Write Path
- The template `id` is a slug derived from the `name`, with a uniqueness check
  (the text PK is shared with code-template ids).
- On collision with a code-template id or an existing DB id, append a short
  suffix — never shadow a code template (code wins per Phase 83).
- The save writes the full row in ONE service-role insert: `extractLayoutRecipe`
  (Phase 84) on the source carousel → `layout_recipe`; extracted flat style →
  `flat_style`; `category` from the form; `created_by` = the admin's user id;
  `preview` = the uploaded PNG URL.
- Post-save, the template appears in the picker within the Phase 83 registry's
  ≤60s TTL window — that delay is accepted for v1 (no explicit cache bust). The
  admin sees a success confirmation.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/api/admin/seed-explore/route.ts` — the auth pattern to model from
  (`DIEGO_USER_ID`, `ADMIN_SEED_TOKEN`, NODE_ENV gate) and the storage
  upload+`getPublicUrl` pattern (`admin.storage.from(bucket).upload(...)`).
- `src/lib/render/templates/db-template-row.ts` — `DbTemplateRow`,
  `dbRowToSlideTemplate()`; `registry.ts` — `getPickerTemplates()` (DB-first
  merge), `resolveTemplate()`, the 60s TTL cache.
- `supabase/migrations/20260518_phase83_templates_table.sql` — the `templates`
  table (`id` text PK, `name`, `category` CHECK `news|facts`, `flat_style`
  jsonb, `layout_recipe` jsonb, `preview` text, `created_by` uuid FK,
  timestamps); public SELECT RLS, deny-by-default writes (service-role only).
- `src/lib/services/projects.ts` — `listProjects(supabase, userId)`,
  `getProject(supabase, userId, projectId)`.
- `src/components/slides/template-picker.tsx` — picker tiles render
  `<SlidePreview slide={makeSampleSlide(template)}>`; `src/lib/render/sample-slide.ts`.
- `src/app/api/render/route.ts` + `src/lib/render/render-slide-satori.tsx` —
  `buildSlideElement()` + `loadFontBuffersForSlide()` + `ImageResponse` →
  PNG buffer (1080×1920); extract into a reusable preview-render helper.
- `src/lib/ai/layout-recipe-extract.ts` — `extractLayoutRecipe(slides, template)`
  → `{ recipe, flatStyle }` (Phase 84, pure deterministic).
- `src/lib/ai/categories/index.ts` — `CONTENT_CATEGORIES = ['news','facts']`,
  `getCategory()`.
- `src/lib/supabase/admin.ts` — `createAdminClient()` (service-role writer);
  `src/lib/supabase/server.ts` — `createClient()` (session-aware reader).
- `src/app/(dashboard)/layout.tsx` — the route-group layout + auth pattern to
  parallel for `(admin)/layout.tsx`.

### Established Patterns
- Storage: public buckets created via additive migration; upload via
  service-role `admin.storage.from(bucket).upload(path, buffer, {contentType})`
  then `getPublicUrl(path)`.
- Writes to `templates` only via `createAdminClient()` (RLS denies otherwise).
- Closed-enum invariant — `category` is `CONTENT_CATEGORIES`.
- No reusable admin/role helper exists yet, and `profiles` has no `role` column —
  this phase introduces the first real admin helper.

### Integration Points
- New: `src/lib/auth/admin.ts` (`isAdminUser`/`requireAdmin`).
- New route group: `src/app/(admin)/layout.tsx`,
  `src/app/(admin)/templates/save/page.tsx`.
- New endpoint: a Save-as-Template route (e.g.
  `src/app/api/admin/templates/route.ts`) — session-authed, admin-gated,
  service-role insert.
- New migration: a `template-previews` public storage bucket.
- New: a reusable single-slide-to-PNG render helper extracted from `/api/render`.
- `template-picker.tsx` — render a DB template's `preview` PNG when present.

</code_context>

<specifics>
## Specific Ideas

- ADMIN-01 acceptance: an admin saves a carousel as a template and it appears in
  every user's picker; a non-admin cannot reach the flow OR the endpoint.
- ADMIN-02 acceptance: a DB template's picker tile is visually faithful to the
  source carousel (hence the snapshot PNG, photo included).
- Admin gating is real auth — server-enforced, mirrored on the page AND the
  endpoint. Modeled on `src/app/api/admin/seed-explore/route.ts`.
- The save flow extracts a recipe (Phase 84) so the minted template is
  recipe-driven at generation time (Phase 85) — the milestone ties together here.
- Render parity (TPLREND-05): the DB template + its preview render consistently
  across editor preview / PNG export / HTML export.

</specifics>

<deferred>
## Deferred Ideas

- A non-admin / end-user Save-as-Template surface — deferred (admin-only is the
  locked v2.14 decision).
- Community / publishable / marketplace templates + moderation — a later growth
  feature.
- Editing or deleting a saved DB template — V1 is save-new-only; a re-save mints
  a new template.
- A Save-as-Template MCP tool — could be added later (Phase 87+) if community
  templates are enabled, as a role-gated tool.
- Explicit registry cache invalidation on write — v1 accepts the ≤60s TTL delay.

</deferred>
