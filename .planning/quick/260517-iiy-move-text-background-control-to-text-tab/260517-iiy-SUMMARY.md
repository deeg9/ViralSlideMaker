---
quick_id: 260517-iiy
title: Move Text Background control to Text tab, fix tight highlight + drop padding slider, add height control to Caption Card
mode: quick
type: execute
status: complete
completed: 2026-05-17
tasks_total: 4
tasks_completed: 4
subsystem: editor-controls + render-parity
tags: [highlight, tight-pill, render-parity, news-layout, caption-card, tdd]
requires:
  - quick-260517-fu9 (Text Background card it removes)
  - quick-260517-h8z (SlideBackgroundControls card it renames + extends)
provides:
  - "renderTightHighlight — shared per-line tight-highlight pill helper (canvas/Satori/HTML)"
  - "SlideStyleOverrides.news_image_height — additive constrained-photo-height override"
  - "Caption Card — renamed control card with a Photo-height slider"
affects:
  - src/components/slides/slide-preview.tsx
  - src/lib/render/render-slide.ts
  - src/lib/render/render-slide-satori.tsx
  - src/lib/render/resolve-overlay.ts
key-files:
  created:
    - src/lib/render/__tests__/tight-highlight-parity.test.tsx
  modified:
    - src/components/editor/elements-panel.tsx
    - src/components/editor/slide-editor.tsx
    - src/components/editor/__tests__/elements-panel-decoration-card.test.tsx
    - src/components/editor/text-rail/text-background-controls.tsx
    - src/components/editor/text-rail/__tests__/text-background-controls.test.tsx
    - src/lib/render/resolve-overlay.ts
    - src/lib/render/resolve-styles.ts
    - src/lib/render/render-slide.ts
    - src/lib/render/render-slide-satori.tsx
    - src/components/slides/slide-preview.tsx
    - src/lib/types/slide.ts
    - src/components/editor/slide-background-controls.tsx
    - src/components/editor/__tests__/slide-background-controls.test.tsx
    - src/lib/render/__tests__/background-color-override.test.tsx
decisions:
  - "Deleted buildHighlightWrapperStyle entirely (zero callers after the tight-pill migration) rather than leaving dead code"
  - "highlight.padding field kept in the data model but no longer read by any renderer — tight pills use a fixed TIGHT_HIGHLIGHT_PADDING=8 inset"
  - "news_image_height clamped to [20,80] at each of the 3 render sites (threat T-iiy-01)"
  - "Caption Card data-testid values kept stable (test-bearing); only the visible label changed"
metrics:
  duration: ~50m
  commits: 6
  files_created: 1
  files_modified: 14
---

# Quick Task 260517-iiy: Move Text Background to Text tab, fix tight highlight, add Caption Card height — Summary

Four reworks of two editor right-rail cards: removed the duplicate highlight card from the Elements tab, dropped the highlight padding slider, fixed the broken `tight` highlight to render per-line inline-block pills with canvas/Satori/HTML parity, and added a Photo-height slider to the renamed "Caption Card".

## What shipped

**Task 1 — Removed the Text Background card from the Elements tab.** The highlight control already lived on the TEXT tab (`ActiveTextBoxCard`). Deleted the Elements-tab `textBackgroundCard` const + both mount sites, the dead `DEFAULT_TEXT_BG` const, the `activeTextBox` / `onTextBoxHighlightUpdate` props, and the `slide-editor.tsx` wiring. Removed the 5 fu9 card tests. `TextBackgroundControls` is now imported only by `ActiveTextBoxCard.tsx`.

**Task 2 — Removed the padding slider.** Deleted the `highlight-padding` range input from `text-background-controls.tsx`. `TextHighlightEffect.padding` stays in `slide.ts` so legacy slides keep their stored value; the UI just stops exposing it.

**Task 3 (TDD) — Fixed the broken `tight` highlight.** Root cause: `tight` wrapped text in ONE inline span with `box-decoration-break: clone`, which renders segment-less plain text as a continuous horizontal bar (no inline line-box to clone onto) and is unsupported by Satori (silent full-width fallback — non-parity). New shared `renderTightHighlight` helper in `resolve-overlay.ts` emits one `inline-block` padded pill per `\n`-split visual line inside a flex-column container — line-deterministic, no `box-decoration-break`, so all 3 render paths produce structurally identical per-line pills (TPLREND-05). All 6 canvas tight branches, the HTML path, and the Satori path now route through it. The dead `buildHighlightWrapperStyle` was deleted.

**Task 4 (TDD) — `news_image_height` override + Caption Card rename.** Added optional `SlideStyleOverrides.news_image_height` (percent photo height), resolved as `news_image_height ?? newsZone.imageHeight` and clamped to `[20,80]` in all 3 render paths — unset renders byte-identically (TPLREND-05). Added a Photo-height range slider (20-80, preview-on-change / commit-on-pointer-up) to `slide-background-controls.tsx`, renamed the card title "Slide Background" → "Caption Card" (testids kept stable), and wired `onSlidePreview` through `elements-panel.tsx`.

## TDD Gate Compliance

Tasks 3 and 4 each followed RED → GREEN:
- Task 3: `d426d8f` test(RED) → `e4bc35d` feat(GREEN). RED confirmed: 6 parity tests failed (`renderTightHighlight` undefined).
- Task 4: `9081d7f` test(RED) → `1afc8e2` feat(GREEN). RED confirmed: 11 tests failed (override/slider/rename absent).
No REFACTOR commits needed — implementations were clean.

## Verification

- 46 iiy-related tests pass (`tight-highlight-parity`, `background-color-override`, `slide-background-controls`, `elements-panel-decoration-card`, `text-background-controls`).
- `npx tsc --noEmit` holds the documented 19-error baseline (0 new errors).
- `npm run lint:gates` passes (PARITY-05 closed-enum + token-budget + framing gates green).
- `TextBackgroundControls` imported only by `ActiveTextBoxCard.tsx`; zero `highlight-padding` testids in `src/components`.
- ZERO new test failures introduced — all pre-existing failures confirmed identical on the clean base commit `b2bdf13` (see `deferred-items.md`).

## Deviations from Plan

None — plan executed exactly as written. One judgment call within plan scope: the plan said to "leave the function (full-width-fallback mode may still be referenced)" for `buildHighlightWrapperStyle` but also permitted deleting the `tight` branch once grep confirmed zero callers. Grep confirmed the **entire function** had zero callers, so it was deleted in full rather than left as dead code — consistent with the plan's intent.

## Deferred Issues

Pre-existing baseline failures — NOT introduced by this task, confirmed present on the clean base commit `b2bdf13`. Documented in full in `deferred-items.md`:
- 19 pre-existing tsc errors (test-file typing) — baseline held.
- 18 pre-existing render-snapshot / byte-identity failures (stale post-o75 hook-casing snapshots).
- 16 pre-existing editor-suite failures (Phase 70 meta-checks, treatment/watermark-sync, text-editor-panel regression).

## Self-Check: PASSED

- Created file `src/lib/render/__tests__/tight-highlight-parity.test.tsx` — FOUND.
- Commits `7d90113`, `690adcc`, `d426d8f`, `e4bc35d`, `9081d7f`, `1afc8e2` — all FOUND in `git log`.
- `renderTightHighlight` exported from `resolve-overlay.ts`, `news_image_height` present in `slide.ts` (2 refs) — FOUND.
