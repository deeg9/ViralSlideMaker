---
phase: 87-picker-generation-wiring
plan: 02
status: complete
date: 2026-05-19
requirements-completed: [WIRE-02]
---

# Plan 87-02 Summary — Generation Snap Fix + API Guard + Async backgroundMode

## What was built
- **`src/lib/render/templates/registry.ts`** — `templateCategory(id)` (async
  DB-category lookup; `null` for code/unknown ids). Added in Plan 01's edit
  pass since it shares the file with `getPickerDbTemplates`; consumed here.
- **`src/components/slides/generation-form.tsx`** — DB-aware client snap. A new
  `idBelongsToCategory(id, categoryId)` predicate (code template in the
  category's `templateIds` OR a DB template from the `dbTemplates` prop whose
  row category matches) drives BOTH snap sites: the initial `templateId` state
  and `handleCategoryChange`. A selected DB id of the matching category is no
  longer discarded.
- **`src/app/(dashboard)/project/[id]/actions.ts`** — DB-aware server snap in
  the dashboard `generateCarousel` server action. `effectiveTemplateId` keeps
  the submitted id when it is a code id in the category OR
  `isKnownTemplateId(id)` is true AND `templateCategory(id) === resolvedCategory`;
  else snaps to `categoryModule.templateIds[0]`. The existing sync
  `getTemplate(...)` calls in this file (photoTreatment/paletteMode at L233,
  backgroundMode at L320) are intentionally NOT converted — CONTEXT.md scopes
  the async conversion to `carousel.ts` (a render-shaping Phase 88 follow-up).
- **`src/lib/services/carousel.ts`** — DB-aware server snap (same logic as
  actions.ts) AND the sync `getTemplate(effectiveTemplateId).backgroundMode`
  read converted to `await resolveTemplate(effectiveTemplateId)`. The snap fix
  newly lets a DB `effectiveTemplateId` reach this read; sync code-only
  `getTemplate` would have returned `templates[0]` and reported the wrong
  `backgroundMode`. The now-unused `getTemplate` import was removed.
- **`src/app/api/v1/carousel/route.ts`** — `await isKnownTemplateId(templateId)`
  guard after the string check, before credit deduction. An unknown
  `templateId` (neither a code id nor a DB id) is rejected with HTTP 400
  (`VALIDATION_ERROR`).
- **Tests:**
  - `registry-merge.test.ts` — `describe('templateCategory')` (4 tests; added
    in Plan 01's pass).
  - `carousel-recipe-generation.test.ts` — `describe('WIRE-02 — DB templateId
    preserved (API service)')`: a matching-category DB id is persisted as
    `template_id`; a cross-category DB id snaps to the category default;
    `autoPublishOnGenerate` still fires. `makeSupabase` extended to capture
    `template_id`; `afterEach` resets the registry seam.
  - `actions-recipe-generation.test.ts` — `describe('WIRE-02 — DB templateId
    preserved (server action)')`: same three proofs on the dashboard
    server-action path.
  - NEW `src/app/api/v1/carousel/__tests__/route.test.ts` — 3 tests: unknown
    id → 400; known code id → not 400 (reaches the service, 200); known DB id
    (injected via the seam) → accepted.

## Verification
- `npx tsc --noEmit` — zero errors in any Phase 87 touched file. (20 pre-existing
  tsc errors remain in untouched test files — project baseline debt.)
- `registry-merge.test.ts` — 17/17 pass.
- `carousel-recipe-generation.test.ts` — 10/10 pass (7 original + 3 WIRE-02).
- `actions-recipe-generation.test.ts` — 7/7 pass (4 original + 3 WIRE-02).
- `route.test.ts` (NEW) — 3/3 pass.
- `template-picker.test.tsx` — 8/9 pass (the 1 failure is the pre-existing
  Phase 56 baseline test, verified red with Phase 87 changes stashed).
- **Full suite: 3265 passing / 41 failing** — exactly the v2.14-audit
  41-failure baseline (was 3238p/41f; +27 passing from new Phase 87 tests).
  ZERO NEW failures. The 41 failures are all pre-existing fixture-regen /
  regression debt in files Phase 87 never touched (template-count assertions,
  Slide field-count, Phase 50/70/74/78/79 debt).
- No render-path call site (`/api/render`, download, `publish-actions.ts`,
  `services/publish.ts`) was touched — Phase 88 scope.
- Public-by-default re-asserted: both generation paths' WIRE-02 tests assert
  `autoPublishOnGenerate` fires after a DB-template generation.

## Deviations
- 2 stale snapshot files (`parity.style-spec-absent-baseline.test.tsx.snap`,
  `parity.template-fingerprint-decorations-undefined.test.tsx.snap`) were
  auto-written by a non-`--ci` `vitest run`. These are unrelated to Phase 87
  (their tests are part of the pre-existing 41-failure baseline) — reverted
  with `git checkout`, NOT committed.
- `templateCategory` was authored in Plan 01's `registry.ts` edit (it shares
  the file with `getPickerDbTemplates`); functionally identical to this plan's
  Task 1 — see Plan 01 summary's deviation note.

## Self-Check: PASSED
