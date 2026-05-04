---
phase: 70-editor-ui-picker-card-layers-shapes
plan: 04
subsystem: editor
tags: [decorations, decoration-card, right-rail, react-colorful, click-to-select, shapes-controls, v2.12]
requires: [70-01, 70-03, 67-01, 68-01, 68-02, 69-01, 69-02]
provides: [CARD-01, CARD-02, CARD-03, CARD-04, CARD-05, SHAPES-06, SHAPES-07, SHAPES-08, SHAPES-09, EDITOR-14]
affects: [src/components/editor/text-editor-panel.tsx, src/components/editor/slide-editor.tsx, src/components/slides/slide-preview.tsx]
tech_stack:
  added: [react-colorful]
  patterns: [debounced-color-commit-300ms, slider-onMouseUp-commit, numeric-blur-Enter-commit, click-target-overlay]
key_files:
  created:
    - src/components/editor/text-rail/decoration-card.tsx
    - src/components/editor/text-rail/decoration-card-effects.tsx
    - src/components/editor/text-rail/__tests__/decoration-card.test.tsx
    - src/components/editor/text-rail/__tests__/decoration-card-effects.test.tsx
    - src/components/editor/__tests__/text-editor-panel-decoration-card.test.tsx
    - src/components/slides/__tests__/slide-preview-decoration-click.test.tsx
  modified:
    - src/components/editor/text-editor-panel.tsx
    - src/components/editor/slide-editor.tsx
    - src/components/slides/slide-preview.tsx
decisions:
  - 300ms-debounced commit for color pickers (KBD-09 single-pushHistory invariant)
  - onMouseUp / onTouchEnd commit for sliders (NEVER per-tick change events)
  - numeric inputs commit on blur OR Enter; NaN/non-numeric reverts (no dispatch)
  - aspect-lock is UI-only React state (NOT persisted to schema; matches Figma/Canva Shift-key model)
  - click-target overlay is a SEPARATE absolutely-positioned div (NOT inside decoration-renderer — keeps renderer pure / TPLREND-05 safe)
  - DecorationCard takes precedence over ActiveTextBoxCard when selection.primary resolves to a decoration; multi-select (N>=2) STILL takes precedence over both
metrics:
  duration_minutes: 12
  tasks_completed: 3
  tests_added: 53
  completed_date: 2026-05-03
---

# Phase 70 Plan 04: DecorationCard right-rail Inspector + click-to-select Summary

DecorationCard component (561 LOC) plus DecorationEffects sub-component (190 LOC) ship the right-rail Inspector for active decorations. TextEditorPanel composition extended to a 3-way ternary that mounts DecorationCard when `selection.primary` resolves to a decoration on the slide. slide-preview.tsx editable path emits a click-target overlay per non-hidden decoration that dispatches `selection.replaceWith([d.id])` (or `addToSelection` on Shift-click). 53 tests across 4 files GREEN; tsc baseline 17 preserved.

## What Shipped

### Task 1 — DecorationCard + DecorationEffects (commit `eb6be04`)

`decoration-card.tsx` mirrors the v2.8 ActiveTextBoxCard composition shell (`bg-[#fff0f0] border-2 border-[#3d0000]/20 focus-within:border-[#3d0000] rounded-2xl`). Sections top-to-bottom:

1. **Header** — role label (ICON/SHAPE) + `decorationLabel(d)` from Phase 68 walker
2. **Fill (CARD-02)** — react-colorful `HexAlphaColorPicker` (shape) / `HexColorPicker` (icon) + brand-kit + derived_palette swatches above (deduplicated, capped at 8) + `HexColorInput`. 300ms debounced commit.
3. **Stroke (CARD-03 + SHAPES-08)** — debounced color input + width slider 1-8px (mouseup commit) + style enum buttons solid/dashed/dotted. SHAPE only.
4. **Size + position (CARD-04)** — 4 numeric inputs (W/H/X/Y) clamped [0, 100], commit on blur/Enter, NaN reverts.
5. **Per-shape (SHAPES-06..09)** — rect cornerRadius slider [0, 50] (mouseup); polygon points enum [5, 6, 8]; star points [5, 6]; aspect-lock toggle for rect/circle/ellipse/star.
6. **DecorationEffects sub-component (CARD-05)** — drop shadow toggle + size enum (sm/md/lg) + debounced color picker; opacity slider 0-100% UI ↔ 0..1 storage (WR-01) committed on mouseup/touchend.

KBD-09 single-pushHistory invariant honored across the board: color pickers debounce 300ms, sliders fire on `onMouseUp`/`onTouchEnd` only, numeric inputs commit on blur/Enter, enum buttons commit on click. 39 tests GREEN.

### Task 2 — TextEditorPanel composition shell (commit `3e15741`)

3-way ternary in `text-editor-panel.tsx`:

```
1. selection.ids.length >= 2 && onBulkDelete → MultiSelectTypeBar
2. activeDecoration !== null → DecorationCard
3. otherwise → ActiveTextBoxCard (legacy single-box flow)
```

`activeDecoration` is resolved via `slide.decorations.find(d => d.id === selection.primary)` — stale-id fallback gracefully renders the legacy card. New `DecorationAction` discriminated union (`UPDATE_DECORATION | REMOVE_DECORATION`) and `onDecorationAction` prop wire each card edit to Phase 68 reducer cases. `slide-editor.tsx` dispatcher dispatches `UPDATE_DECORATION { slideIndex, id, updates }` per gesture. 7 new + 2 existing composition regression tests GREEN.

### Task 3 — Click-to-select wire (commit `200e7bb`)

`slide-preview.tsx` editable path (around line 2645) wraps the existing `renderDecoration` iteration in a `<React.Fragment>` and emits a sibling click-target overlay div per non-hidden decoration:

- `data-testid="decoration-click-target-{d.id}"`
- Same `left/top/width/height` as the rendered decoration (% of canvas)
- Inherits the same `transform: rotate(deg)` so hit-testing matches the visual rotation
- `onClick`: replaces selection (or adds via functional updater on Shift-click)
- `pointerEvents: 'auto'` + `cursor: 'pointer'`

PCL11 chrome-leak invariant: the overlay is ONLY in the editable={true} branch — the non-editable path (around line 1065) and Satori path are untouched. Locked decorations still receive click-targets (LOCK-04 carry-forward — selection works; drag/resize blocked downstream). 7 tests GREEN.

## Verification

| Gate | Result |
|------|--------|
| Plan tests (4 files) | 53 / 53 GREEN |
| Decoration-card tests | 26 / 26 GREEN |
| Decoration-card-effects tests | 13 / 13 GREEN |
| Composition tests | 7 / 7 GREEN (+ 2 existing regression) |
| Click-to-select tests | 7 / 7 GREEN |
| Editor regression (37 files) | 416 / 416 GREEN |
| Slide-preview regression (11 files) | 82 / 82 GREEN |
| tsc baseline | 17 (preserved — was 17 pre-plan) |
| `decoration-card.tsx` LOC | 561 (≥ 350 min) |
| `decoration-card-effects.tsx` LOC | 190 (≥ 80 min) |
| Decoration awareness (`grep -c decoration\|Decoration` in card.tsx) | 56 (≥ 10 min) |
| PCL11/13 spot-check on new files | 1 hit (comment prose only — `selection` referenced in JSDoc; comment-stripped per Plan 65-03 / Phase 69-03) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `slide.derived_palette` does not exist on `Slide` (lives under `style_overrides`)**
- **Found during:** Task 2 tsc check
- **Issue:** Plan instructions referenced `slide.style_overrides?.derived_palette` in the `<click_to_select_design>` block but my initial implementation in TextEditorPanel read it from the top-level `slide.derived_palette`. Type system caught it.
- **Fix:** Updated TextEditorPanel to pass `slide.style_overrides?.derived_palette` as the `derivedPalette` prop to DecorationCard.
- **Files modified:** `src/components/editor/text-editor-panel.tsx`
- **Commit:** Folded into `3e15741`

**2. [Rule 1 — Bug] Test fixture used wrong `TextBox` shape (legacy x/y/width without anchor)**
- **Found during:** Task 2 tsc check
- **Issue:** The plan's interface block showed `TextBox` shape with `x/y/width` fields, but the actual schema has a `position: TextBoxPosition` discriminated by `anchor: TextBoxAnchor`.
- **Fix:** Updated test fixture to `position: { anchor: 'custom', x: 10, y: 10, width: 80 }`.
- **Files modified:** `src/components/editor/__tests__/text-editor-panel-decoration-card.test.tsx`
- **Commit:** Folded into `3e15741`

### Rule 4 (architectural) deviations

None.

### Authentication gates

None — fully autonomous execution.

## Known Stubs

None. Every control wires through to a real Phase 68 reducer dispatch via `onDecorationAction`.

## Self-Check: PASSED

- [x] `src/components/editor/text-rail/decoration-card.tsx` — exists (561 LOC)
- [x] `src/components/editor/text-rail/decoration-card-effects.tsx` — exists (190 LOC)
- [x] `src/components/editor/text-rail/__tests__/decoration-card.test.tsx` — exists
- [x] `src/components/editor/text-rail/__tests__/decoration-card-effects.test.tsx` — exists
- [x] `src/components/editor/__tests__/text-editor-panel-decoration-card.test.tsx` — exists
- [x] `src/components/slides/__tests__/slide-preview-decoration-click.test.tsx` — exists
- [x] commit `eb6be04` (feat: DecorationCard) — present in `git log`
- [x] commit `3e15741` (feat: composition shell) — present in `git log`
- [x] commit `200e7bb` (feat: click-to-select) — present in `git log`
