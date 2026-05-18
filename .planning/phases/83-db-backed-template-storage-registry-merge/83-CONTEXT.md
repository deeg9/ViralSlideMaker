# Phase 83: DB-Backed Template Storage + Registry Merge - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Templates can live in a database row, not just code. A new `templates` DB table
stores a template's identity, category, flat style, an (initially empty)
`layout_recipe` JSON, a preview reference, and authorship/timestamps. A merged
registry resolves both code templates and DB rows, so a DB template appears in
the picker with **no code deploy** — while the 13 code templates and ~82
existing carousels keep rendering byte-identically.

**In scope:** the `templates` table + additive migration; the code+DB registry
merge for `getTemplate` / `pickerTemplates` / `TEMPLATE_IDS`; render parity for
DB templates across all 3 render paths; byte-identity preservation for code
templates and existing carousels.

**Out of scope (later phases):** the `LayoutRecipe` model itself and extraction
(Phase 84) — Phase 83 only adds the nullable column; recipe-driven generation
(Phase 85); the admin Save-as-Template authoring flow + preview generation
(Phase 86). The 13 code templates are NOT migrated into the DB — DB storage is
purely additive.

</domain>

<decisions>
## Implementation Decisions

### Registry Merge Architecture
- Hybrid sync+async registry: the 13 code templates stay in the synchronous
  `templates[]` array. Add an async resolution layer — `resolveTemplate(id)` and
  `getPickerTemplates()` — for DB-aware call sites. Render functions already
  accept `SlideTemplate` objects (not ids), so the 3 render paths do not change;
  only route handlers / server components that currently call `getTemplate(id)`
  gain an async-aware resolution path.
- Cache: a short-TTL in-memory server cache (~60s) over DB template rows — a
  newly-inserted row appears in the picker within the TTL window, no deploy and
  no restart.
- ID collision: a code template always wins over a DB row with the same id.
  Reject a duplicate id at insert time.
- Picker ordering: DB templates appear first (newest curated content surfaced),
  then the code picker templates.

### Schema Design
- Primary key: a text slug `id` — one ID space shared with `projects.template_id`
  (text) and the existing code-template ids.
- Flat style: stored as a single `flat_style` jsonb column mirroring the
  `SlideTemplate` fields — `SlideTemplate` has ~30 mostly-optional fields, so a
  JSON blob keeps the schema additive (no migration per new style field).
- `layout_recipe`: a nullable `jsonb` column added now, even though the
  `LayoutRecipe` model is defined in Phase 84 — so Phase 84 needs no second
  migration.
- `category`: a text column matching the existing `projects.category` value set;
  add a CHECK constraint if the categories are a closed set.
- Other columns: `name` (text), `preview` reference (column for Phase 86's
  picker preview — nullable now), `created_by` (see RLS below), `created_at` /
  `updated_at` timestamps.

### RLS & Access
- Read: public `SELECT USING (true)` — templates show in every user's picker
  (mirrors the `profiles` public-read pattern).
- Write: no INSERT/UPDATE RLS policy — deny by default. Writes go through the
  service-role admin client; Phase 86's endpoint performs the app-level admin
  role check (mirrors `src/app/api/admin/seed-explore/route.ts`).
- Reads use the anon/publishable client (`src/lib/supabase/server.ts`),
  respecting the public SELECT policy.
- `created_by`: a nullable `uuid` FK to `auth.users`, `ON DELETE SET NULL`
  (mirrors `projects.user_id`).

### Parity & Verification
- The code `templates[]` array stays untouched — the merge happens only in the
  accessor layer, so `legacy-templates-byte-identical` and `new-templates-parity`
  suites stay green with no fixture regen.
- Add a new parity test for TSTORE-03: seed a fixture DB template and assert
  identical render output across canvas preview / Satori PNG / HTML export.
- Test DB rows are fixture-injected via a test seam (no live DB connection) —
  hermetic, matches the remote-only Supabase setup.
- `TEMPLATE_IDS` stays code-only as the static validation allowlist; add a
  separate async `isKnownTemplateId` (or equivalent) for DB ids.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/render/templates/index.ts` — the `templates[]` array (13), the
  `SlideTemplate` interface (~30 fields, mostly optional flat style), and the
  sync accessors `getTemplate(id)` (line ~230, falls back to `templates[0]`),
  `TEMPLATE_IDS` (runtime `templates.map(t => t.id)`), `pickerTemplates`
  (filters out `HIDDEN_FROM_PICKER`), `HIDDEN_FROM_PICKER` set.
- `src/lib/supabase/admin.ts` — `createAdminClient()` (service-role).
- `src/lib/supabase/server.ts` — `createClient()` (anon/publishable, cookie-aware).
- `supabase/migrations/` — timestamped `.sql` migrations; pattern uses
  `IF NOT EXISTS` guards, CHECK constraints, `COMMENT ON COLUMN`. Example RLS in
  `20260427_create_profiles.sql` (public SELECT + owner-update).
- Render functions are object-based: `slide-preview.tsx` (canvas),
  `render-slide-satori.tsx` `buildSlideElement` (Satori PNG), `render-slide.ts`
  (HTML) all take a `SlideTemplate` object — so no render-path signature changes.

### Established Patterns
- Migrations: additive, timestamp-prefixed `.sql` in `supabase/migrations/`,
  idempotent guards, column comments.
- `projects` table: `id` uuid, `user_id` FK to `auth.users`, `slide_data` jsonb,
  `template_id` text, `category` text, RLS scoped to `auth.uid()`.
- Admin auth: hardcoded per-endpoint in `seed-explore` (env token / Diego user
  id) — Phase 86 will formalize; Phase 83 only needs deny-by-default RLS.

### Integration Points
- New `templates` table + migration in `supabase/migrations/`.
- New async resolver module alongside `src/lib/render/templates/index.ts`.
- Call sites of `getTemplate` / `pickerTemplates` / `TEMPLATE_IDS` — picker
  surface and route handlers — gain async-aware resolution.
- Byte-identity guards: `src/__tests__/render/legacy-templates-byte-identical.test.ts`,
  `src/__tests__/render/new-templates-parity.test.tsx` (assert by ID list, not
  count — stay green if `templates[]` is untouched).

</code_context>

<specifics>
## Specific Ideas

- Render-parity (TPLREND-05 / PARITY-01) is the gate, not a nice-to-have: a
  DB-backed template must render byte-identically across canvas / Satori PNG /
  HTML, and the 13 code templates + ~82 existing carousels must be unaffected.
- The migration hits the shared prod Supabase project — additive and reversible
  per project migration discipline; it must change how *no* existing carousel
  renders.
- DB storage is additive only — the 13 code templates stay in code for
  back-compat; this is a hybrid code+DB registry, not a migration.

</specifics>

<deferred>
## Deferred Ideas

- The `LayoutRecipe` model + extraction — Phase 84 (this phase only adds the
  nullable `layout_recipe` column).
- Recipe-driven generation — Phase 85.
- Admin Save-as-Template authoring flow + picker preview generation — Phase 86
  (this phase only adds the deny-by-default RLS and a nullable preview column).
- Editing/deleting a DB template after save — V1 is save-new-only.

</deferred>
