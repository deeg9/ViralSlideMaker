---
phase: 86-admin-save-as-template-flow-previews
status: clean
depth: standard
date: 2026-05-19
files_reviewed: 12
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
---

# Phase 86 Code Review — Admin Save-as-Template Flow + Previews

**Depth:** standard. **Scope:** 18 files changed in Phase 86 — 12 source/SQL,
6 test. Source files reviewed below; test files spot-checked for correctness.

## Files reviewed
- `src/lib/auth/admin.ts` (new)
- `src/lib/render/preview-render.ts` (new)
- `src/lib/templates/slug.ts` (new)
- `src/app/api/admin/templates/route.ts` (new)
- `src/app/(admin)/layout.tsx` (new)
- `src/app/(admin)/templates/save/page.tsx` (new)
- `src/app/(admin)/templates/save/save-template-form.tsx` (new)
- `src/components/slides/template-tile-preview.tsx` (new)
- `src/lib/render/templates/index.ts` (modified — +1 optional field)
- `src/lib/render/templates/db-template-row.ts` (modified — carries preview)
- `src/components/slides/template-picker.tsx` (modified — tile delegation)
- `supabase/migrations/20260519_phase86_template_previews_bucket.sql` (new)

## Findings

### IN-01 (Info) — preview render fails closed; no orphan-row risk
`src/app/api/admin/templates/route.ts` — the save path orders side effects
correctly: recipe extract → render → upload → insert. A render failure
returns 500 BEFORE any storage write; an insert failure best-effort removes
the just-uploaded preview. There is no window where a `templates` row exists
without its preview, nor a preview file without a row except a transient
upload-then-insert-fail case which is cleaned up. Left as Info — the
cleanup is best-effort (`await ... .remove()` is not itself error-checked),
so a storage outage during cleanup could leave one orphan PNG; harmless
(public bucket, no row references it) and not worth a retry loop for V1.

### IN-02 (Info) — picker still sources the static code-template list
`src/components/slides/template-picker.tsx` — the picker iterates
`pickerTemplates` (the 13 code templates), not the async
`getPickerTemplates()` registry merge. A DB template therefore renders its
`preview` PNG correctly *once it appears in the picker's list*, but this
phase did not switch the picker's data source to the merged list. This is
the planned scope per 86-CONTEXT.md ("the template picker renders the
`preview` PNG for a DB template that has one" — RENDERING, not list
sourcing); the Phase 83 registry already provides `getPickerTemplates()`.
Left as Info — a follow-up wiring task, not a Phase 86 defect.

## Notes (no findings — verified correct)
- **ADMIN-01 — admin gate is real and doubled:** `requireAdmin` is the single
  shared helper. The `(admin)/layout.tsx` Server Component calls it and
  `redirect('/dashboard')`s a non-admin before any admin UI renders; the
  `POST /api/admin/templates` endpoint re-checks it and returns 403. Both
  paths use the session cookie (no bearer token). The route test proves
  403 for a non-admin session AND for no session.
- **Fail-safe-closed:** `isAdminUser` returns false for everyone when
  `ADMIN_USER_IDS` is unset/empty — the admin surface is closed by default,
  proven by a unit test.
- **`requireAdmin` never throws:** the `auth.getUser()` call is wrapped in
  try/catch → `null` on any error.
- **Own-projects-only:** the save endpoint loads the source carousel via
  `getProject(supabase, admin.id, projectId)`, which filters
  `.eq('user_id', userId)` — another user's project id resolves to a 404.
- **Closed-enum invariant:** `category` is validated against
  `CONTENT_CATEGORIES`; anything else is a 400. The form's category options
  are derived from `CONTENT_CATEGORIES` (no hardcoded third option).
- **Slug id never shadows a code template:** the collision loop forces a
  `withSuffix` reslug when the id is in `TEMPLATE_IDS` OR an existing DB row
  — code wins per Phase 83. Proven by the collision-suffix route test.
- **One service-role insert:** the full row (`id`, `name`, `category`,
  `flat_style`, `layout_recipe`, `created_by`, `preview`) is written in a
  single `.insert()` via `createAdminClient`; RLS on `public.templates`
  denies non-service-role writes.
- **Render parity (TPLREND-05):** `renderCoverPreviewPng` reuses
  `buildSlideElement` + `loadFontBuffersForSlide` + a 1080x1920
  `ImageResponse` unchanged — no new render fields. `TemplateTilePreview`'s
  fallback branch is byte-identical to the pre-Phase-86 picker tile body, so
  every code template renders unchanged.
- **Migration is additive + reversible:** creates one new public bucket
  `template-previews`, public SELECT only, no authenticated write policy
  (service-role-only writes), a reversal note in the header. Touches no
  existing bucket or table.
- **No injection surface:** the preview `<img>` takes a Supabase Storage URL
  (`<img src>` cannot execute script); all form text flows through React
  (auto-escaped); the storage path is `${admin.id}/${slug}.png` — admin.id
  is a uuid and slug is `[a-z0-9-]`.

## Verdict
**CLEAN.** No Critical or Warning findings. Two Info notes (best-effort
orphan cleanup; planned picker-list-sourcing follow-up) — neither requires a
change. The ADMIN-01 hard gate is enforced at both the page and the endpoint
and proven by tests; render parity and the closed-enum invariant hold.
