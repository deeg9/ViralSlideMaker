---
phase: 87-picker-generation-wiring
plan: 01
status: complete
date: 2026-05-19
requirements-completed: [WIRE-01]
---

# Plan 87-01 Summary — Picker Wiring (DB Templates in the Generation Picker)

## What was built
- **`src/lib/render/templates/registry.ts`** — added two exported helpers
  (no change to `getPickerTemplates` / `resolveTemplate` / `isKnownTemplateId`):
  - `PickerDbTemplate` interface + `getPickerDbTemplates()` — returns each DB
    template paired with the row `category` + `created_at` the picker needs to
    filter and order it (`SlideTemplate` itself carries no `category` field).
    Code-collision rows dropped; fetcher order (newest-first) preserved; never
    throws — a DB read failure degrades to `[]`.
  - `templateCategory(id)` — async DB-category lookup used by Plan 02's server
    snap (`null` for code/unknown ids). Added here in Plan 01 since it lives in
    the same file; consumed in Plan 02.
- **`src/components/slides/template-picker.tsx`** — `TemplatePicker` gains an
  optional `dbTemplates?: PickerDbTemplate[]` prop (defaults `[]`). The
  category-filtered visible list now prepends DB templates whose `category`
  equals the selected category (DB-first) before the category's code
  templates. The "Your Brand Kit" tile stays the first slot, unchanged; the
  tile-render loop is unchanged (`TemplateTilePreview` is already DB-aware).
- **`src/components/slides/generation-form.tsx`** — `GenerationForm` accepts an
  optional `dbTemplates` prop (defaults `[]`) and forwards it to
  `<TemplatePicker dbTemplates=...>`. Snap logic untouched (Plan 02).
- **`src/app/(dashboard)/project/[id]/page.tsx`** — the async server component
  calls `await getPickerDbTemplates()` (after the `hasSlides` editor branch, so
  it runs only on the generation-form path) and threads the result into
  `<GenerationForm dbTemplates=...>`. No new API route, no client fetch.
- **`src/lib/render/templates/__tests__/registry-merge.test.ts`** — added
  `describe('getPickerDbTemplates')` (5 tests) and `describe('templateCategory')`
  (4 tests).
- **`src/__tests__/components/template-picker.test.tsx`** — added
  `describe('<TemplatePicker> WIRE-01 DB-template merge')` (4 tests).

## Verification
- `npx tsc --noEmit` — zero errors in any Phase 87 touched file. (20 pre-existing
  tsc errors remain in untouched test files — project baseline test debt.)
- `registry-merge.test.ts` — 17/17 pass (8 original + 9 new).
- `template-picker.test.tsx` — the 4 new WIRE-01 tests pass; the 4 original
  TPLTHUMB-02 parity tests pass. 1 pre-existing failure (the Phase 56
  `editorial-serif`/`notes-app-chic` name test) is BASELINE — verified red with
  Phase 87 changes stashed (part of the `260518-jhg` fixture-regen debt, NOT a
  Phase 87 regression).
- `SlideTemplate` was NOT widened with a `category` field — the category travels
  in the `PickerDbTemplate` pairing structure.
- No new API route created; the project page server component is the fetch
  point.

## Deviations
- `templateCategory(id)` (a Plan 02 artifact) was added to `registry.ts` in this
  plan rather than Plan 02, because it lives in the same file as
  `getPickerDbTemplates` — adding both in one edit avoids a redundant second
  pass over the file. Plan 02 consumes it; behavior is identical to the plan.

## Self-Check: PASSED
