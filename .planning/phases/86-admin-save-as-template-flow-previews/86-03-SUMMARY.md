---
phase: 86-admin-save-as-template-flow-previews
plan: 03
status: complete
date: 2026-05-19
requirements-completed: [ADMIN-02]
---

# Plan 86-03 Summary — Template Picker Preview-PNG Rendering

## What was built
- **`src/lib/render/templates/index.ts`** — added an optional `preview?:
  string` field to the `SlideTemplate` interface (public URL of a rendered
  cover-snapshot PNG). The 13 code-template literals leave it undefined — an
  optional field is non-breaking, no code template changed.
- **`src/lib/render/templates/db-template-row.ts`** — `dbRowToSlideTemplate`
  now carries `row.preview` onto `SlideTemplate.preview` (`null` → `undefined`
  to match the optional field type). `layout_recipe` is still deliberately not
  read by the mapper.
- **NEW `src/components/slides/template-tile-preview.tsx`** — `'use client'`
  `TemplateTilePreview` component, the per-tile preview switch:
  - `template.preview` set → renders an `<img>` filling the 9:16 tile frame
    (`absolute inset-0 h-full w-full object-cover`) with descriptive
    `alt="Preview of {name}"` (ADMIN-02).
  - `template.preview` absent → the EXISTING live `<SlidePreview>` +
    `makeSampleSlide` path, byte-identical to the pre-Phase-86 picker tile —
    render parity (TPLREND-05) for every code template preserved.
- **`src/components/slides/template-picker.tsx`** — the `visibleTemplates`
  tile body now delegates to `<TemplateTilePreview template={template} />`.
  The `aspect-[9/16] rounded-xl overflow-hidden` frame and the
  `group-hover:scale-105` wrapper are unchanged; the Your-Brand-Kit tile keeps
  its inline `<SlidePreview>`.
- **NEW `src/lib/render/templates/__tests__/db-template-row-preview.test.ts`**
  — 3 tests, all pass.
- **NEW `src/components/slides/__tests__/template-tile-preview.test.tsx`** — 3
  tests, all pass.

## Verification
- `npx tsc --noEmit` — no errors in the modified/new files.
- `db-template-row-preview.test.ts` — 3/3 pass (non-null preview carried, null
  → undefined, id/name still win + required-field backfill intact).
- `template-tile-preview.test.tsx` — 3/3 pass (PNG branch renders the `<img>`
  and no SlidePreview; fallback branch renders `<SlidePreview>` and no preview
  img; ADMIN-02 alt text).
- `template-picker.test.tsx` — 4/5 pass. The 1 failure (`renders visible
  Phase 56 templates ... as SlidePreview tiles`) is PRE-EXISTING: it fails
  identically with the Phase 86 changes stashed (template-naming drift,
  "Notes App Chic" not found — part of the milestone baseline). The
  TPLTHUMB-02 parity-COUNT tests — the ones this change could affect — still
  pass; code templates still render `slide-preview` tiles.

## Deviations
None — plan executed exactly as written. (The picker source-list staying on
the static `pickerTemplates` rather than the async `getPickerTemplates()`
merge was the planned scope per 86-CONTEXT.md — this plan delivers the
tile-level RENDERING; DB templates surface via the existing Phase 83 registry
path.)

## Self-Check: PASSED
