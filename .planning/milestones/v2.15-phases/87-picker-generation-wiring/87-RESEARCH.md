# Phase 87: Picker + Generation Wiring — Research

**Researched:** 2026-05-19
**Requirement IDs:** WIRE-01, WIRE-02

## Objective

Make a DB-backed template (the v2.14 `templates` table) reachable: it appears
in the generation picker under its category with its preview tile, and a
user-selected DB template id survives generation into the saved carousel's
`template_id` instead of being silently snapped to the category default.

## Exact current signatures (verified at HEAD)

### Registry — `src/lib/render/templates/registry.ts` (Phase 83, async)
- `resolveTemplate(id: string): Promise<SlideTemplate>` — code-wins, else DB
  row mapped via `dbRowToSlideTemplate`, else `templates[0]`. Never throws.
- `getPickerTemplates(): Promise<SlideTemplate[]>` — `[...dbTemplates,
  ...pickerTemplates]`; DB rows whose id collides with a code id are dropped.
- `isKnownTemplateId(id: string): Promise<boolean>` — true if code id OR DB id.
- `__setDbTemplateFetcher(fetcher)` / `__resetDbTemplateRegistry()` — TEST-ONLY
  seam; injects fixture rows, no live DB. ~60s TTL cache.
- `getDbRows()` is private — there is **no** public function returning the raw
  `DbTemplateRow[]` (with `category` / `created_at`).

### DB row — `src/lib/render/templates/db-template-row.ts`
- `DbTemplateRow` has `id, name, category: string|null, flat_style,
  layout_recipe, preview, created_by, created_at, updated_at`.
- `dbRowToSlideTemplate(row)` maps `id, name, preview` + flat_style blob.
  **It does NOT map `row.category` or `row.created_at`** onto the result.

### `SlideTemplate` type — `src/lib/render/templates/index.ts`
- **`SlideTemplate` has NO `category` field** and no `created_at`. It carries
  `id, name, preview?`, fonts, colors, `backgroundMode?`, etc.

## CRITICAL DESIGN GAP — flag for the planner

CONTEXT.md says: "Pass DB templates as resolved `SlideTemplate[]`" and the
picker "merges DB templates into the category-filtered list ... under the
category matching its `templates.category` column ... among DB templates,
`created_at` descending."

**`SlideTemplate` carries neither `category` nor `created_at`.** A plain
`SlideTemplate[]` therefore cannot be category-filtered or `created_at`-ordered
by the picker. The planner MUST resolve this with one of:

- **Recommended:** add a new registry helper, e.g.
  `getPickerDbTemplates(): Promise<Array<{ template: SlideTemplate;
  category: string | null; createdAt: string }>>` — returns each DB template
  paired with the row's `category` + `created_at`, code-collision rows dropped,
  newest-first (rows already arrive `created_at desc` from the fetcher). The
  project page calls it server-side and threads the array as a `dbTemplates`
  prop → `generation-form.tsx` → `TemplatePicker`.
- The picker then, for the selected `category`, builds:
  `[brandKitTile?, ...dbTemplatesWhereCategoryMatches (newest-first),
  ...categoryCodeTemplates]`.

This is a faithful interpretation of CONTEXT.md ("DB templates as resolved
`SlideTemplate[]`" + "category matching its `templates.category` column") —
the pairing structure carries the category alongside the resolved template.
Do NOT widen `SlideTemplate` with a `category` field (it is a render type, not
a picker type, and a code template has no category).

## Exact snap-logic lines to fix

### `generation-form.tsx`
- **Initial state (~L65–72):** `templateId` init keeps `currentTemplateId` only
  if `mod.templateIds.includes(currentTemplateId)` (code-only). A DB id is
  discarded → snapped to `mod.templateIds[0]`.
- **Category-change handler `handleCategoryChange` (~L156–162):** snaps if
  `!mod.templateIds.includes(templateId)` (code-only).
- **Fix:** keep the id if it is a code template in the selected category OR a DB
  template (from the threaded `dbTemplates` prop) whose `category` matches the
  selected category; else snap to `mod.templateIds[0]`. A small shared predicate
  (e.g. `idBelongsToCategory(id, category, dbTemplates)`) keeps both call sites
  in sync.

### `project/[id]/actions.ts` — dashboard server action `generateCarousel`
- **Snap (~L49–52):** `effectiveTemplateId = templateId &&
  categoryModule.templateIds.includes(templateId) ? templateId :
  categoryModule.templateIds[0]`.
- **Fix:** keep `templateId` if `await isKnownTemplateId(templateId)` AND (it is
  a code template in `categoryModule.templateIds` OR a DB template whose
  `category` matches `resolvedCategory`). Needs a DB-category check — the
  registry rows carry `category`, so either the new `getPickerDbTemplates`
  helper or a small `await templateCategory(id)` lookup. Else snap.
- Note: this is an `async` server action — `await` is already legal here.

### `src/lib/services/carousel.ts` — API-service `generateCarousel`
- **Snap (~L65–71):** same code-only pattern as actions.ts.
- **`getTemplate(effectiveTemplateId).backgroundMode` (L118–119):** sync
  code-only lookup. The snap fix newly allows a DB `effectiveTemplateId` to
  reach this — `getTemplate` would return `templates[0]` for a DB id and read
  the WRONG `backgroundMode`. **Convert to `await resolveTemplate(
  effectiveTemplateId)` and read `.backgroundMode` off that.** The function is
  already `async`. NOTE: `actions.ts` ALSO calls `getTemplate(effectiveTemplateId)`
  twice (L233 `template = getTemplate(...)` for `photoTreatment`/`paletteMode`,
  L320 `getTemplate(...).backgroundMode`). CONTEXT.md scopes the async
  conversion to `carousel.ts`; the planner should convert `carousel.ts`'s L119
  call (explicitly in scope) and MAY convert the analogous `actions.ts` reads
  for correctness — flag if it does, since CONTEXT.md only names `carousel.ts`.
  Minimum: `carousel.ts` L119.

### `src/app/api/v1/carousel/route.ts` — POST handler
- Currently validates `templateId` is a non-empty string only (L36–38). No
  registry check.
- **Fix:** after the string check, add `if (!(await isKnownTemplateId(
  templateId))) return apiError('VALIDATION_ERROR', ...unknown template id...,
  400)`. The handler is already `async`. Place it before the credit deduction.

## Picker — `src/components/slides/template-picker.tsx`
- `TemplatePickerProps` = `{ selectedId, onSelect, brandKit?, category? }`.
- `visibleTemplates` = `categoryModule.templateIds.map(id =>
  pickerTemplates.find(...)).filter(...)` — code-only, category-ordered.
- **Fix:** add a `dbTemplates` prop (the paired array above). When `category`
  resolves, `visibleTemplates` becomes
  `[...dbTemplatesForCategory (newest-first), ...categoryCodeTemplates]`.
  The "Your Brand Kit" tile is rendered separately BEFORE `visibleTemplates`
  and is unaffected. Tiles already render via `TemplateTilePreview`, which is
  DB-aware (renders a DB template's `preview` PNG) — no tile change needed.

## Data flow into the picker
- `project/[id]/page.tsx` is an `async` server component. It already fetches
  project / user / tier / brandKit. Add `const dbTemplates = await
  getPickerDbTemplates()` and pass it to `<GenerationForm dbTemplates=... />`.
- `generation-form.tsx` is a client component — accept `dbTemplates` as a prop
  and forward to `<TemplatePicker dbTemplates=... />`. No client fetch, no new
  API route (CONTEXT.md decision).

## Public-by-default — re-assert
- Both generation paths already call `autoPublishOnGenerate`:
  `actions.ts` L366, `carousel.ts` L250. The snap-logic edits do not touch
  those lines, but the helper has regressed 6× — add/keep a test asserting
  `autoPublishOnGenerate` fires on BOTH paths after a DB-template generation.

## Test structure
- Picker: `src/__tests__/components/template-picker.test.tsx` — uses
  `@testing-library/react`, `render`/`screen`, `pickerTemplates`. Polyfills via
  `src/__tests__/setup.ts`. NEW: a test rendering `<TemplatePicker
  category="news" dbTemplates={[{template, category:'news', createdAt}]} />`
  asserting the DB tile appears first in the News list (DB-first order).
- Registry: `src/lib/render/templates/__tests__/registry-merge.test.ts` —
  fixture seam `__setDbTemplateFetcher` + `makeRow(id, overrides)` with a
  `category` field. If `getPickerDbTemplates` is added, unit-test it here.
- Generation: `src/app/(dashboard)/project/[id]/__tests__/` and
  `src/lib/services/__tests__/` already test recipe generation with the
  registry fixture seam. NEW: a test per generation path asserting a DB
  `templateId` (matching category) is saved as `template_id` (snap does not
  discard it), and `autoPublishOnGenerate` is invoked.
- API route `/api/v1/carousel` has no test dir today — a new test asserting an
  unknown id → HTTP 400 and a known DB id → accepted is in scope.

## Pre-existing full-suite failure baseline (DO NOT regress)
From the v2.14 milestone audit: after Phase 86, full suite ~**3238 passing /
41 failing**. The 41 failures include 6 fixture-regen failures in
`legacy-templates-byte-identical.test.ts`, `legacy-templates-regression.test.tsx`,
`new-templates-parity.test.tsx` (caused by quick task `260518-jhg` appending
`newsOracle` as the 13th code template + retiring `news-cyan` from the picker
without regenerating fixtures — NOT a v2.14 or Phase 87 regression). Phase 87
must introduce **zero NEW failures** vs this 41-failure baseline.

## Closed-enum invariant
`templates.category` ∈ `CONTENT_CATEGORIES` (`'news' | 'facts'`). The picker
filters DB templates by string-equality of `row.category` against the selected
category — no enum widening. A DB row with a `null` or unknown category simply
never matches a category and stays out of every category-filtered list.

## Out of scope (Phase 88 — do NOT touch)
`/api/render`, `projects/[id]/download`, `publish-actions.ts`,
`services/publish.ts`, per-slide `template_id_override`, publish/fork
`template_id` preservation, render-parity / byte-identity re-verification.

## Validation Architecture

The phase is verifiable by unit/component tests with the existing registry
fixture seam (`__setDbTemplateFetcher`) — no live DB. Key proofs:
1. **WIRE-01:** `<TemplatePicker>` with `category` + a matching `dbTemplates`
   entry renders the DB tile, ordered DB-first before the category's code
   templates.
2. **WIRE-02:** each generation path (`actions.ts` server action +
   `carousel.ts` service), given a DB `templateId` whose `category` matches,
   persists `template_id` = the DB id (not snapped).
3. **API guard:** `/api/v1/carousel` rejects an unknown `templateId` with 400.
4. **Public-by-default:** `autoPublishOnGenerate` invoked on both paths.
5. **No-regression:** full suite shows no NEW failures vs the 41-failure
   baseline; the 6 fixture-regen failures remain unchanged and unrelated.
