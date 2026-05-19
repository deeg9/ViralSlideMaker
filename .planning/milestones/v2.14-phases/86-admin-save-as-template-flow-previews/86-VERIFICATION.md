---
phase: 86-admin-save-as-template-flow-previews
status: passed
date: 2026-05-19
requirements: [ADMIN-01, ADMIN-02]
---

# Phase 86 Verification — Admin Save-as-Template Flow + Previews

## Success criteria

### ADMIN-01 — an admin can save a carousel as a template; a non-admin cannot reach the flow OR the endpoint
**PASS (hard gate).**
- An admin saves: `POST /api/admin/templates` extracts a recipe, renders +
  uploads the cover preview, and writes the full `templates` row in one
  service-role insert (RLS on `public.templates` permits service-role writes).
  The new template appears in every user's picker within the Phase 83 registry
  TTL window (≤60s) — `getPickerTemplates()` merges DB rows.
- Non-admin blocked at the PAGE: `(admin)/layout.tsx` calls the shared
  `requireAdmin` and `redirect('/dashboard')`s any non-admin or
  unauthenticated visitor before any admin UI renders (server-side, not a
  hidden link).
- Non-admin blocked at the ENDPOINT: `POST /api/admin/templates` re-checks
  `requireAdmin` on the session cookie and returns 403. Proven by
  `route.test.ts` — a non-admin session → 403, and a no-session request →
  403. The page-gate is the same `requireAdmin` helper (single source of
  truth) and is exercised by `admin.test.ts` (9 tests).

### ADMIN-02 — a DB template's picker tile is visually faithful to the source carousel
**PASS.**
- The preview is a real rendered cover-snapshot PNG (photo included) — the
  save endpoint renders slide 0 via `renderCoverPreviewPng`, which reuses
  `buildSlideElement` + `loadFontBuffersForSlide` + a 1080x1920
  `ImageResponse` (the `/api/render` pipeline) unchanged — render parity
  (TPLREND-05) preserved.
- The PNG is uploaded to the new public `template-previews` bucket; the
  public URL is stored in `templates.preview`, carried onto
  `SlideTemplate.preview` by `dbRowToSlideTemplate`.
- The picker tile renders the `preview` PNG via `TemplateTilePreview` (an
  `<img object-cover>` filling the existing 9:16 frame, descriptive `alt`)
  when present, and falls back to the byte-identical live `<SlidePreview>`
  path otherwise — proven by `template-tile-preview.test.tsx` (3 tests) and
  `db-template-row-preview.test.ts` (3 tests).

## Must-haves

| Item | Status |
|------|--------|
| `src/lib/auth/admin.ts` — `isAdminUser` + `requireAdmin` exported; the single reusable admin gate | PASS |
| `isAdminUser` fail-safe-closed when `ADMIN_USER_IDS` unset/empty | PASS |
| `requireAdmin` reads the session cookie via `auth.getUser()`, no bearer token, never throws | PASS |
| `(admin)/layout.tsx` calls `requireAdmin` and server-side redirects non-admins | PASS |
| `POST /api/admin/templates` re-checks `requireAdmin` → 403 for non-admin / no session | PASS |
| Source carousel picked from the admin's OWN projects (`getProject` filters `user_id`) | PASS |
| `category` validated against `CONTENT_CATEGORIES` (closed-enum) → 400 otherwise | PASS |
| Full row written in ONE service-role insert (`id`, `name`, `category`, `flat_style`, `layout_recipe`, `created_by`, `preview`) | PASS |
| Template id is a slug from `name`; suffix-on-collision; never shadows a code-template id (`TEMPLATE_IDS`) | PASS |
| `extractLayoutRecipe` (Phase 84) → `layout_recipe`; extracted `flatStyle` → `flat_style` | PASS |
| `renderCoverPreviewPng` renders slide 0 to a 1080x1920 PNG via the existing Satori pattern; no new render fields | PASS |
| `template-previews` public bucket migration — additive, reversible, service-role-only writes | PASS |
| `SlideTemplate.preview` optional field; `dbRowToSlideTemplate` carries `row.preview` | PASS |
| Picker tile renders the `preview` PNG when present, falls back to live `<SlidePreview>` | PASS |
| 13 code templates render byte-identically (render parity / TPLREND-05) — fallback branch unchanged | PASS |

## Tests
- Phase 86 new tests: 24 — `admin.test.ts` (9), `preview-render.test.ts` (3),
  `slug.test.ts` (7), `route.test.ts` (6 — incl. ADMIN-01 403 for non-admin
  AND no-session, closed-enum 400, happy-path 201 full-row insert, collision
  suffix), `db-template-row-preview.test.ts` (3), `template-tile-preview.test.tsx`
  (3). All 24 pass.
- Full suite: 3238 passed / 41 failed / 9 skipped / 1 todo (3289 total). The
  41 failures are the documented PRE-EXISTING baseline — verified unchanged
  (the same 41 fail with the Phase 86 working-tree changes stashed; the
  picker test `route-tos`/`upload-url` failures are all in non-Phase-86
  files). No regression.
- `npx tsc --noEmit` — zero errors in any Phase 86 file.
- `npm run build` — succeeds; the `(admin)` route group, `/templates/save`,
  and `/api/admin/templates` all compile.

## Notes
- The pre-existing picker test failure (`renders visible Phase 56 templates
  ... as SlidePreview tiles` — "Notes App Chic" not found) fails identically
  with Phase 86 changes stashed; it is template-naming drift in the baseline,
  NOT a Phase 86 regression. The TPLTHUMB-02 parity-count tests — the ones
  the `TemplateTilePreview` change could affect — still pass.
- User setup remains (tracked in 86-01-SUMMARY): set `ADMIN_USER_IDS` and
  apply the `template-previews` bucket migration. Until then the admin
  surface is fail-safe-closed.

## Verdict
**PASSED.** ADMIN-01 and ADMIN-02 satisfied. The ADMIN-01 hard gate is
enforced at BOTH the page and the endpoint and proven by tests; ADMIN-02's
faithful cover-snapshot preview renders via the unchanged Satori pipeline
with code-template render parity preserved. No regression to the pre-existing
41-failure baseline.
