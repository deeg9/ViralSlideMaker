---
quick_id: 260517-h8z
title: Add a control to edit the slide background color (the "yellow panel")
mode: quick
status: complete
revised_plan: true
completed: 2026-05-17
tasks_completed: 2
tasks_total: 2
key-files:
  created:
    - src/components/editor/slide-background-controls.tsx
    - src/components/editor/__tests__/slide-background-controls.test.tsx
    - src/lib/render/__tests__/background-color-override.test.tsx
  modified:
    - src/lib/types/slide.ts
    - src/components/slides/slide-preview.tsx
    - src/lib/render/render-slide-satori.tsx
    - src/lib/render/render-slide.ts
    - src/components/editor/elements-panel.tsx
commits:
  - 5b2cb1a test(quick-260517-h8z-01) failing render-parity tests
  - 761d468 feat(quick-260517-h8z-01) resolve background_color in 3 render paths
  - f6082f8 feat(quick-260517-h8z-02) Slide Background control card
decisions:
  - The yellow region is the slide background color (template.backgroundColor),
    not the caption-bar bottom-card — the original h8z plan mis-diagnosed it.
  - background_color is an additive optional override mirroring the
    overlay_color precedent; falls back to template.backgroundColor.
  - The control is NOT gated on backgroundMode (unlike CaptionBarControls) —
    every slide has a background color, so the card is always visible.
---

# Quick Task 260517-h8z: Edit the Slide Background Color Summary

Added an optional `style_overrides.background_color` hex override resolved
identically in all three render paths, plus a "Slide Background" swatch control
in the editor ELEMENTS tab that recolors the panel visible behind a constrained
news-carousel photo (the user's reported "yellow panel").

## What Was Built

### Task 1 — `background_color` override field + 3-path resolution (TDD)

- **RED** (`5b2cb1a`): new `src/lib/render/__tests__/background-color-override.test.tsx`
  — a 6-test render-parity suite covering all three render paths (HTML, Satori
  PNG, editor canvas) with the exact production news-`cover` scenario. The 3
  byte-identity tests passed immediately; the 3 override tests failed (RED
  confirmed).
- **GREEN** (`761d468`):
  - `slide.ts`: added optional `SlideStyleOverrides.background_color` hex field,
    doc-commented mirroring the `overlay_color` precedent.
  - `slide-preview.tsx:933`: canvas `innerStyle.backgroundColor` now resolves
    `overrides.background_color ?? template.backgroundColor`.
  - `render-slide-satori.tsx:262-266`: Satori `rootStyle.backgroundColor`
    resolves the override.
  - `render-slide.ts:209-221`: introduced `const bgColor` feeding the
    color-only, newsZone, and final `else` `background-color` branches; the
    `background-image` (full-bleed photo) branch left untouched.
  - All 6 parity tests pass; no REFACTOR commit needed (changes minimal).

### Task 2 — "Slide Background" control card in the ELEMENTS tab

- **`f6082f8`**:
  - New `SlideBackgroundControls` (`slide-background-controls.tsx`): a portlet
    card mirroring the `CaptionBarControls` shell (white card,
    `border-2 border-[#3d0000]/20`, uppercase title "Slide Background",
    `data-testid="slide-background-controls"`). Body: a one-line helper text +
    the Color swatch row copied verbatim from `caption-bar-controls.tsx`
    (preset `COLOR_SWATCHES` circles + circular palette-icon button wrapping a
    hidden native `<input type="color">`). The `toColorInputValue` helper was
    copied (it is local to caption-bar-controls.tsx). A pick = one undo entry;
    no slider, so no preview/commit split.
  - `elements-panel.tsx`: mounted `<SlideBackgroundControls>` inside
    `slideLevelCards`, directly before `<CaptionBarControls>`, fed the
    per-slide-resolved template (`resolvePerSlideTemplate(slide, template)`)
    for the swatch default. The card is ALWAYS visible for any selected slide
    (no `backgroundMode` gate — the wrong gate is exactly what broke the prior
    h8z attempt).
  - New `slide-background-controls.test.tsx` — 7 tests: card renders, title +
    helper text present, swatch click dispatches a merged
    `style_overrides.background_color` patch (pre-existing overrides
    preserved), palette input emits an explicit hex, palette button present,
    swatch falls back to `template.backgroundColor` when unset, and reflects
    the resolved override when set.

## Verification

**Automated (executor ran these):**

- `npx tsc --noEmit` — 19 errors total, **0 new**; exactly the documented
  baseline. Zero errors in any file touched by this task.
- Render parity: `background-color-override.test.tsx` 6/6 green.
- Control: `slide-background-controls.test.tsx` 7/7 green.
- `npm run lint:gates` — passes (no closed-enum / token-budget / framing
  regressions).

**Human verification (orchestrator relays to user) — checkpoint:human-verify:**

1. Open project "Nvidia Chip Sales to China" in the editor, slide 1.
2. Open the ELEMENTS tab → a "SLIDE BACKGROUND" card is present (above the
   Caption Bar card).
3. Click a preset swatch (or pick a custom color via the palette button) →
   the yellow bottom panel behind the cover photo recolors live on the canvas.
4. Confirm the card appears for every selected slide, regardless of template.

## Deviations from Plan

None — the revised plan was executed exactly as written. Both tasks landed with
the specified files, testids, and fallback behavior. No deviation rules fired.

## Deferred Issues (out of scope — pre-existing, NOT caused by this task)

Verified by stashing the h8z changes and re-running on the clean base commit
`f1184fe`. See `deferred-items.md` for the full list. Summary:

- **18 render snapshot failures** (`render-slide-satori`,
  `legacy-templates-regression`, `legacy-templates-byte-identical`,
  `premium-templates`) — stale `.snap` / hash fixtures from the recent WYSIWYG
  hook-casing change (`quick-260515-o75`); the `textTransform: "uppercase"` key
  removal. Unrelated to `background_color`.
- **16 editor test failures** (`phase-70-final-regression-sweep`,
  `slide-editor.treatment-sync`, `slide-editor.watermark-sync`,
  `text-editor-panel.regression`) — stale doc fixtures, a `tsc ≤ 17` baseline
  assertion the project has drifted past (baseline is now 19), and pre-existing
  type/DOM-signature drift. None touch the h8z surfaces.

Resolution: separate fixture-refresh task tied to `quick-260515-o75` and the
Phase 70 doc sweep.

## Self-Check: PASSED

- FOUND: src/components/editor/slide-background-controls.tsx
- FOUND: src/components/editor/__tests__/slide-background-controls.test.tsx
- FOUND: src/lib/render/__tests__/background-color-override.test.tsx
- FOUND: src/lib/types/slide.ts (modified)
- FOUND: src/components/slides/slide-preview.tsx (modified)
- FOUND: src/lib/render/render-slide-satori.tsx (modified)
- FOUND: src/lib/render/render-slide.ts (modified)
- FOUND: src/components/editor/elements-panel.tsx (modified)
- FOUND commit: 5b2cb1a (test RED)
- FOUND commit: 761d468 (feat Task 1)
- FOUND commit: f6082f8 (feat Task 2)

## TDD Gate Compliance

Task 1 (`tdd: true`) followed the RED → GREEN cycle:
- RED gate: `5b2cb1a` `test(quick-260517-h8z-01)` — failing parity tests.
- GREEN gate: `761d468` `feat(quick-260517-h8z-01)` — implementation, tests pass.
- REFACTOR: not needed — the resolver changes were minimal and clean.
