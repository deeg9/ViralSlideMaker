# Phase 87: Picker + Generation Wiring - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

DB-backed templates (the v2.14 `templates` table) appear in the generation
picker, category-filtered, and survive selection through the generation
pipeline into the saved carousel's `template_id`.

**In scope:** server-side DB-template fetch threaded into the client
`TemplatePicker`; the picker merge (DB templates under their category, DB-first,
newest-first); the category-snap fix in `generation-form.tsx`,
`project/[id]/actions.ts`, and `services/carousel.ts` so a DB template id is no
longer discarded; `isKnownTemplateId` validation on `/api/v1/carousel`;
converting the one sync `getTemplate(...).backgroundMode` call in `carousel.ts`
to async `resolveTemplate` (the snap fix exposes it to DB ids). WIRE-01, WIRE-02.

**Out of scope (Phase 88):** the three render-path call sites — `/api/render`,
`projects/[id]/download`, `publish-actions.ts`, `services/publish.ts` — still
resolve via sync `getTemplate`; per-slide `template_id_override` DB-id
acceptance; publish/fork `template_id` preservation; render-parity / byte-identity
re-verification. After Phase 87 a carousel generated on a DB template SAVES with
the correct DB `template_id`, but the editor canvas / exports may still render
it via the sync fallback until Phase 88 lands.

</domain>

<decisions>
## Implementation Decisions

### DB-Template Data Flow to the Picker
- The server component `src/app/(dashboard)/project/[id]/page.tsx` fetches DB
  templates via `getPickerTemplates()` and threads them as a prop down through
  `generation-form.tsx` → `TemplatePicker`. No new API route, no client fetch.
- Fetch ALL DB templates once at page load; the client filters by category
  (the DB-template count is small).
- What is passed: the DB templates as resolved `SlideTemplate[]` — the client
  `TemplatePicker` merges them with its existing code-only `pickerTemplates`.
- Staleness: the page-load snapshot is accepted (the Phase 83 registry already
  has a ≤60s TTL cache) — no live refetch.

### Picker Merge & Ordering
- A DB template appears under the category that matches its `templates.category`
  column (set, required, at save time).
- Ordering within a category's picker: DB templates first, then the category's
  code templates — consistent with Phase 83's `getPickerTemplates` DB-first rule.
- Among multiple DB templates: `created_at` descending (newest first).
- The "Your Brand Kit" tile stays the first slot, unaffected; DB templates slot
  in after it.

### Snap-Logic Fix (Generation)
- Client snap — `generation-form.tsx` initial `templateId` state AND the
  category-change handler: keep the current id if it is a code template in the
  selected category OR among the fetched DB templates whose `category` matches
  the selected category; otherwise snap to `categoryModule.templateIds[0]`.
- Server snap — `services/carousel.ts` and `project/[id]/actions.ts`: keep the
  submitted id if `isKnownTemplateId(id)` AND (it is a code template in the
  category OR a DB template whose `category` matches); otherwise snap to
  `categoryModule.templateIds[0]`.
- `/api/v1/carousel` adds `await isKnownTemplateId(templateId)` and rejects an
  unknown id with HTTP 400.
- The sync `getTemplate(effectiveTemplateId).backgroundMode` call in
  `carousel.ts` is converted to async `resolveTemplate` in THIS phase — the
  snap fix newly allows a DB `effectiveTemplateId` to reach it, so the sync
  code-only lookup would otherwise read `backgroundMode` off the wrong template.

### Phase Boundary & Verification
- Phase 87 does NOT touch the three render-path call sites (`/api/render`,
  `projects/[id]/download`, `publish-actions.ts`, `services/publish.ts`) — those
  are Phase 88. The editor canvas preview may still resolve a DB `template_id`
  via the sync fallback until Phase 88.
- WIRE-01 verification: a test asserting the picker's visible-templates list
  includes a DB template of the matching category, ordered DB-first.
- WIRE-02 verification: a test asserting generation with a DB `templateId`
  saves `template_id` = the DB id (the snap does not discard it) — covering
  BOTH generation paths (the API service `generateCarousel` and the dashboard
  server action `generateCarousel`).
- Public-by-default: re-assert `autoPublishOnGenerate` still fires on both
  touched generation paths (this helper has regressed 6×).

</decisions>

<code_context>
## Existing Code Insights

(From the 2026-05-19 blast-radius investigation — see
`.planning/DB-TEMPLATE-WIRING-SPEC.md`.)

### Reusable Assets
- `src/lib/render/templates/registry.ts` — `getPickerTemplates()` (async,
  merged code+DB, DB-first), `resolveTemplate(id)` (async), `isKnownTemplateId(id)`
  (async), ~60s TTL cache. Built in Phase 83; currently used only by tests +
  the admin save endpoint.
- `src/components/slides/template-picker.tsx` — `TemplatePicker`; currently
  imports the sync code-only `pickerTemplates` and filters by
  `categoryModule.templateIds`.
- `src/components/slides/template-tile-preview.tsx` — `TemplateTilePreview`,
  already DB-aware (renders a DB template's `preview` PNG; code templates fall
  back to live `<SlidePreview>`).
- `src/components/slides/generation-form.tsx` — `templateId` state init
  (~L65–72) + category-change handler (~L156–162); both snap via the code-only
  `categoryModule.templateIds`.
- `src/app/(dashboard)/project/[id]/page.tsx` — the server component that
  renders the generation form (the fetch point).
- `src/app/(dashboard)/project/[id]/actions.ts` — dashboard server-action
  `generateCarousel`, snap logic (~L48–52).
- `src/lib/services/carousel.ts` — API-service `generateCarousel`, snap
  (~L65–70), `getTemplate(...).backgroundMode` (~L119).
- `src/app/api/v1/carousel/route.ts` — the POST entry; currently no template-id
  registry validation.
- `src/lib/ai/categories/{index,news,facts}.ts` — `categoryModule.templateIds`
  (code-only); `templates.category` uses the closed `CONTENT_CATEGORIES` set.
- `src/lib/services/auto-publish-on-generate.ts` — `autoPublishOnGenerate`.

### Established Patterns
- Server component fetches data and threads it as props to client components.
- Closed-enum invariant — `templates.category` ∈ `CONTENT_CATEGORIES`.
- `getPickerTemplates()` already merges DB-first; `resolveTemplate` handles a
  code-or-DB id; the wiring just needs to USE them.

### Integration Points
- `project/[id]/page.tsx` → `generation-form.tsx` → `TemplatePicker` — a new
  `dbTemplates` (or merged) prop threaded down.
- `TemplatePicker` — merge DB templates into the category-filtered list.
- `generation-form.tsx`, `actions.ts`, `carousel.ts` — DB-aware snap.
- `/api/v1/carousel/route.ts` — `isKnownTemplateId` validation.

</code_context>

<specifics>
## Specific Ideas

- The fix is wiring existing capability, not new design: `getPickerTemplates` /
  `resolveTemplate` / `isKnownTemplateId` and the DB-aware `TemplateTilePreview`
  already exist — Phase 87 makes the picker + generation actually use them.
- WIRE-01 acceptance: a `category='news'` DB template appears in the News
  picker with its preview-PNG tile.
- WIRE-02 acceptance: selecting a DB template and generating yields a carousel
  whose `template_id` is the DB id (not snapped away).
- Public-by-default: every touched generation path still routes new carousels
  through `autoPublishOnGenerate`.

</specifics>

<deferred>
## Deferred Ideas

- The three render paths resolving a DB `template_id` (sync `getTemplate` →
  async `resolveTemplate`) — Phase 88 (WIRE-03).
- Per-slide `template_id_override` accepting a DB id — Phase 88 (WIRE-04).
- Publish/fork preserving a DB `template_id` — Phase 88 (WIRE-05).
- Render-parity / byte-identity re-verification — Phase 88 (WIRE-06).

</deferred>
