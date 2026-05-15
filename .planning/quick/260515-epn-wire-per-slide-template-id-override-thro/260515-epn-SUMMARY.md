---
phase: 260515-epn-wire-per-slide-template-id-override
plan: 01
type: execute
subsystem: render
tags: [render, template-routing, copy-style, projector-fusion, tplrend-05]
dependency_graph:
  requires:
    - quick-260514-jn5 (decoration editor surface) — unrelated; mentioned only because it's recent context
    - quick-260515-dwu (Copy Style end-to-end persistence) — upstream writes `template_id_override`; this plan reads it
  provides:
    - resolvePerSlideTemplate — single-source-of-truth helper for per-slide template routing
  affects:
    - All five render surfaces (editor canvas + thumbnails + Satori PNG + HTML preview + explore/dashboard SlidePreview wrappers)
tech_stack:
  added: []
  patterns:
    - Single-source-of-truth helper for cross-surface contract (mirror of decoration-renderer / resolve-overlay patterns)
    - Internal re-resolve at renderer boundary (Satori / HTML) so route layer keeps passing the project-level template unchanged
key_files:
  created:
    - src/lib/render/resolve-per-slide-template.ts
    - src/lib/render/__tests__/resolve-per-slide-template.test.ts
    - src/__tests__/render/per-slide-template-override.test.tsx
  modified:
    - src/lib/render/render-slide-satori.tsx
    - src/lib/render/render-slide.ts
    - src/components/editor/slide-canvas.tsx
    - src/components/editor/slide-editor.tsx
    - src/components/editor/sortable-slide.tsx
    - src/components/slides/slide-grid.tsx
    - src/components/projects/project-card.tsx
    - src/app/explore/explore-card.tsx
    - src/app/explore/[slug]/carousel-slideshow.tsx
    - src/app/api/render/route.ts
    - src/app/api/v1/projects/[id]/download/route.ts
decisions:
  - Re-resolve internally in buildSlideElement / buildSlideHtml — route layer keeps passing project-level effectiveTemplate unchanged (clean rename: template param → templateParam, immediate re-bind to const template).
  - Right-rail control panels (TextEditorPanel / LegacyTextEditorPanel / ElementsPanel) intentionally keep the PROJECT-level template so toggling per-slide override on/off is reversible from the control panel (documented in slide-editor.tsx).
  - Unknown override id silently falls back to projectTemplate (NOT templates[0] from getTemplate's forgiving lookup) — mirrors STYLESPEC-10 / EMIT-08 / PARITY-03 silent-drop discipline.
  - Helper is brand-kit-agnostic — caller (slide-editor / API route) is still responsible for synthesizing the brand-kit template before passing it in; per-slide override beats brand-kit synthesis because the helper short-circuits to the registry template by id.
metrics:
  duration: 22m
  completed: 2026-05-15
  tasks: 2
  files_created: 3
  files_modified: 11
  tests_added: 14 (8 unit + 6 integration)
  commits: 4 (RED/GREEN/RED/GREEN)
---

# Phase 260515-epn Plan 01: Wire per-slide template_id_override through all render surfaces — Summary

**One-liner:** Closes the final consumer-side link in the Copy Style chain — projector-emitted `template_id_override` now actually drives which template paints every slide across editor preview, Satori PNG export, HTML preview, explore feed, dashboard cards, and ZIP download.

## What was wired

### New single-source-of-truth helper
- **`src/lib/render/resolve-per-slide-template.ts`** — `resolvePerSlideTemplate(slide, projectTemplate)` with the precedence ladder: `slide.template_id_override` → `slide.style_overrides?.template_id_override` → `projectTemplate`. Unknown ids silently fall back to `projectTemplate` (NOT `templates[0]`). When no override is set, returns the EXACT `projectTemplate` reference — TPLREND-05 byte-identity gate.

### Server renderers (re-resolve INTERNALLY)
- **`render-slide-satori.tsx`** — `buildSlideElement` rename `template` → `templateParam`, immediate `const template = resolvePerSlideTemplate(slide, templateParam)` rebind. All downstream `template.*` reads now resolve against the per-slide template; external signature unchanged.
- **`render-slide.ts`** — `buildSlideHtml` mirrored.
- **`/api/render` + `/api/v1/projects/[id]/download`** — NO logic change required (Satori path re-resolves internally); one-line comment added at each `buildSlideElement` call noting the contract.

### Browser-preview surfaces (per-slide resolution at call site)
- **`slide-canvas.tsx`** — selected slide resolves per-slide before passing to `<SlidePreview>`. Right-rail control panels intentionally keep project-level template (control defaults remain anchored).
- **`sortable-slide.tsx`** — each thumbnail tile resolves per-slide so left-rail tiles match canvas paint.
- **`explore-card.tsx`** — published-carousel snapshot honors per-slide override.
- **`carousel-slideshow.tsx`** — explore detail viewer mirrors the editor.
- **`project-card.tsx`** — dashboard preview matches canvas; placeholder paint at `template.backgroundColor` (lazy-load fallback) intentionally unchanged.
- **`slide-grid.tsx`** — per-slide resolve inside the `.map`.

### Explanatory comments
- **`slide-editor.tsx`** — block comment above the activeTab section documenting why TextEditorPanel / LegacyTextEditorPanel / ElementsPanel keep receiving the project-level template (control-default reversibility).

## Diagnosis greps — before vs after

```bash
# Before plan: count of `resolvePerSlideTemplate` non-test references = 0
# After plan:
grep -rn "resolvePerSlideTemplate" src --include="*.ts" --include="*.tsx" \
  | grep -v __tests__ | grep -v 'resolve-per-slide-template.ts' | wc -l
# → 19  (needed ≥ 9 — wire-completeness gate ✓)

# Before plan: count of `template_id_override` references in renderer files = 0
# After plan:
grep -rn "template_id_override" \
  src/components/editor/slide-editor.tsx \
  src/components/slides/slide-preview.tsx \
  src/lib/render/render-slide.ts \
  src/lib/render/render-slide-satori.tsx | wc -l
# → 6  (needed ≥ 1 — missing-wire-fixed gate ✓)
```

## TPLREND-05 / PTF baseline / PARITY-01 invariant status

**HOLDING.** The helper returns the projectTemplate by REFERENCE (`===`) when no override is set, so every legacy slide traverses the identical render path with the identical template object — zero behavior change. Verified by:
- Test 1 of `resolve-per-slide-template.test.ts` asserts `===` (not deep-equal).
- Test 2 + Test 4 of `per-slide-template-override.test.tsx` assert the bottom-card marker is ABSENT on no-override slides (DOM + Satori VDOM).
- `render-slide-satori.test.tsx`, `render-slide.test.ts`, `premium-templates.test.tsx`, `new-templates-parity.test.tsx`, `templates.test.ts` all still pass (75 / 75 tests green in the relevant render suite).

## Tests added

- `src/lib/render/__tests__/resolve-per-slide-template.test.ts` — 8 unit tests (precedence rules, byte-identity gate, silent-drop, brand-kit precedence, Pick<> type ergonomics).
- `src/__tests__/render/per-slide-template-override.test.tsx` — 6 integration tests (DOM bottom-card present/absent + Satori VDOM bottom-card present/absent + brand-kit precedence + explore-card contract).

All 14 new tests pass. `npx vitest run` on the relevant render suite: **75 / 75 green**.

## Manual smoke

**Not run** — manual DB-backed verification (load project `8e3bf9b2-e394-43d2-9916-fd49ef8e99b4` in the editor) is documented in the plan as `not gated; recorded in SUMMARY`. Recommend the user open that project to visually confirm the magazine-bold bottom-card renders on slides where the projector wrote the override; other projects without overrides should be byte-identical to before. The integration tests lock the DOM + Satori VDOM contract that the manual smoke would visually verify.

## Deviations from plan

**None — plan executed exactly as written.**

## Deferred / out-of-scope (carried forward — pre-existing, NOT caused by this plan)

The following test failures exist on the plan-base commit (`6d417da`) and are unchanged by this plan. **All trace to the `260514-l9q-fix-hook-text-align-center` change** which added `justifyContent: flex-start` to hookStyle / bodyStyle for the alignment-center fix. The snapshot baselines were never regenerated for that fix.

1. **`src/__tests__/render/legacy-templates-regression.test.tsx`** — 5 snapshot failures (`legacy-{highlight-bar,news-drop,news-cyan,y2k-pop,bold-yellow}`). Each diff is the new `"justifyContent": "flex-start"` field in the snapshot tree.
2. **`src/lib/render/__tests__/parity*.test.tsx`** — 124 snapshot failures across 3 files. Same `justify-content: flex-start` drift in serialized DOM + HTML.
3. **`src/__tests__/projects/dashboard.test.tsx`** + **`src/__tests__/editor/responsive.test.tsx`** + **`src/__tests__/editor/slide-preview.test.tsx`** — 3 failures: `"Slide X of Y"` text (renamed to `Slide X / Y` in 260514-ku2), `lg:grid-cols-[200px_1fr_320px]` class (changed to `lg:grid-cols-[260px…` somewhere recently), and `editor-toolbar` testid that no longer exists. All pre-existing.

**Confirmation method:** `git checkout 6d417da && npx vitest run src/lib/render/__tests__/parity` → identical 124 failures. `git stash; npx vitest run …` on each suite → identical failure counts with and without my changes.

**Scope boundary applied:** per executor rules, pre-existing warnings/failures in unrelated files are out of scope. Not auto-fixed; not committed snapshot updates.

## Known follow-ups (carried forward from plan's "Out of scope" list)

- **Extraction, projector, magazine-bold template, `separateOverlappingTextBoxes` helper, Copy Style persistence + routing** — already shipped in 260515-8xx + 260515-dwu; not touched here.
- **Snapshot baseline regeneration for `260514-l9q` justify-content drift** — separate quick task. Either re-run snapshots intentionally OR adjust the hook-text-align fix to avoid the snapshot impact. Not in scope for this plan.
- **"INSPIRED BY" thumbnail bug**, **text-box overlap pill-padding bug**, **`caption.heightFraction` parameterization**, **deprecated-magazine-bold-being-picked** — out of scope (per plan), separate quick tasks.

## Commits

| # | Hash | Type | Subject |
|---|------|------|---------|
| 1 | `b75fd0f` | test | add failing tests for resolvePerSlideTemplate helper (RED) |
| 2 | `6965033` | feat | resolvePerSlideTemplate helper (single source of truth) (GREEN) |
| 3 | `5057569` | test | integration tests for per-slide override across surfaces (RED) |
| 4 | `d06394a` | feat | wire template_id_override through all render surfaces (GREEN) |

## TDD Gate Compliance

- ✓ RED commit (`test(epn): add failing tests…`) exists before GREEN for Task 1.
- ✓ GREEN commit (`feat(epn): resolvePerSlideTemplate helper…`) follows.
- ✓ RED commit (`test(epn): integration tests…`) exists before GREEN for Task 2.
- ✓ GREEN commit (`feat(epn): wire template_id_override…`) follows.

## Self-Check

Files exist (post-commit):

```
[ -f src/lib/render/resolve-per-slide-template.ts ]                         → FOUND
[ -f src/lib/render/__tests__/resolve-per-slide-template.test.ts ]          → FOUND
[ -f src/__tests__/render/per-slide-template-override.test.tsx ]            → FOUND
```

Commits exist:

```
git log --oneline | grep b75fd0f → FOUND
git log --oneline | grep 6965033 → FOUND
git log --oneline | grep 5057569 → FOUND
git log --oneline | grep d06394a → FOUND
```

## Self-Check: PASSED
