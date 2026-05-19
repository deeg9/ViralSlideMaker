---
phase: 87-picker-generation-wiring
status: passed
date: 2026-05-19
requirements: [WIRE-01, WIRE-02]
---

# Phase 87 Verification — Picker + Generation Wiring

## Success criteria

### SC1 — a category='news' DB template appears in the News picker with its preview tile
**PASS.**
- New `getPickerDbTemplates()` (registry) returns each DB template paired with
  its row `category` + `created_at`. The project page server component
  (`project/[id]/page.tsx`) calls it server-side and threads the result through
  `GenerationForm` → `TemplatePicker` (no new API route, no client fetch).
- `TemplatePicker` merges DB templates whose `category` equals the selected
  category into the category-filtered visible list, DB-first, after the "Your
  Brand Kit" tile. Tiles render via the existing DB-aware `TemplateTilePreview`.
- Proven by `template-picker.test.tsx` WIRE-01 block: a `category='news'` DB
  template appears in the News picker; DB-first ordering (the DB tile precedes
  "News Oracle"); excluded from a non-matching category.

### SC2 — generating with a selected DB template id saves template_id = the DB id
**PASS.**
- The category-snap logic on all three sites — `generation-form.tsx` (initial
  `templateId` state + `handleCategoryChange`), `project/[id]/actions.ts`, and
  `services/carousel.ts` — keeps a DB template id whose row `category` matches
  the selected category instead of snapping it to `categoryModule.templateIds[0]`.
- Proven by WIRE-02 tests on BOTH generation paths: `carousel-recipe-
  generation.test.ts` and `actions-recipe-generation.test.ts` each assert a
  category-matching DB `templateId` is persisted as `projects.template_id`
  (not snapped) and a cross-category DB id IS snapped to the category default.

### SC3 — /api/v1/carousel accepts a DB template id via isKnownTemplateId
**PASS.**
- `POST /api/v1/carousel` adds `await isKnownTemplateId(templateId)` after the
  string check, before credit deduction. An unknown id → HTTP 400.
- Proven by the new `carousel/__tests__/route.test.ts`: unknown id → 400;
  known code id → 200 (not 400); known DB id (injected via the registry seam)
  → accepted.

### SC4 — switching category and back never discards a DB id of the selected category
**PASS.**
- The shared `idBelongsToCategory(id, categoryId)` predicate in
  `generation-form.tsx` drives both the initial state and `handleCategoryChange`
  — a DB id whose row category matches the (re-)selected category is kept; the
  snap fires only for genuinely cross-category ids.
- The WIRE-02 cross-category tests confirm the snap fires for a mismatched
  category and does NOT fire for a matching one.

### SC5 — a newly generated carousel still defaults to Public
**PASS.**
- Both generation paths still route through `autoPublishOnGenerate` (unchanged
  call sites). The WIRE-02 tests on both paths assert `autoPublishOnGenerate`
  is invoked after a DB-template generation.

## Must-haves

| Item | Status |
|------|--------|
| `getPickerDbTemplates()` — DB templates paired with category + created_at, code-collisions dropped, newest-first | PASS |
| `templateCategory(id)` — DB-category lookup for the server snap (null for code/unknown) | PASS |
| `TemplatePicker` merges category-matching DB templates DB-first after the Brand Kit tile | PASS |
| Project page server component fetches DB templates and threads them — no new API route, no client fetch | PASS |
| Snap keeps a category-matching DB id on all three sites (form, action, service) | PASS |
| `/api/v1/carousel` rejects an unknown templateId with HTTP 400 | PASS |
| `carousel.ts` reads `backgroundMode` via async `resolveTemplate` (not sync `getTemplate`) | PASS |
| `SlideTemplate` NOT widened with a `category` field — category travels in `PickerDbTemplate` | PASS |
| Public-by-default: `autoPublishOnGenerate` fires on both generation paths | PASS |
| Render-path call sites (`/api/render`, download, publish) untouched — Phase 88 scope | PASS |

## Tests

- Phase 87 relevant files: 45 passing / 1 pre-existing-baseline failure.
- New Phase 87 tests: 9 registry (getPickerDbTemplates + templateCategory),
  4 picker (WIRE-01), 3 carousel-service (WIRE-02), 3 server-action (WIRE-02),
  3 API-route (WIRE-02) — all 22 pass.
- Full suite: **3265 passing / 41 failing** — exactly the v2.14-audit
  41-failure baseline (was 3238p/41f; +27 passing from new Phase 87 tests).
  ZERO NEW failures. The 41 failures are pre-existing fixture-regen /
  regression debt in files Phase 87 never touched.
- `npx tsc --noEmit` — zero errors in any Phase 87 touched file (20 pre-existing
  tsc errors in untouched test files — project baseline debt, unchanged).

## Notes

- The 1 failing test in `template-picker.test.tsx` (the Phase 56
  `editorial-serif`/`notes-app-chic` name check) is a pre-existing baseline
  failure — verified red with all Phase 87 changes stashed. Part of the
  `260518-jhg` fixture-regen debt flagged in the v2.14 milestone audit; NOT a
  Phase 87 regression.
- Deferred to Phase 88 (per CONTEXT.md / DB-TEMPLATE-WIRING-SPEC.md): the three
  render-path call sites resolving a DB `template_id`, per-slide
  `template_id_override` DB-id acceptance, publish/fork `template_id`
  preservation, render-parity re-verification (WIRE-03..06). After Phase 87 a
  carousel generated on a DB template SAVES the correct DB `template_id`, but
  the editor canvas / exports may still render via the sync fallback until
  Phase 88.

## Verdict

**PASSED** — both requirements (WIRE-01, WIRE-02) satisfied, all 5 success
criteria PASS, zero new test failures vs the baseline.
