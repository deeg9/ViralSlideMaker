---
phase: quick-260517-fu9
plan: 01
subsystem: editor
tags: [editor, text-rail, elements-panel, highlight-effect, ui-surfacing]
requires:
  - TextBox.effects.highlight (existing TextHighlightEffect data model)
  - HighlightControls (existing inner component in ActiveTextBoxCard)
provides:
  - TextBackgroundControls (reusable extracted highlight control component)
  - ElementsPanel "Text Background" card (text-box-scoped)
affects:
  - src/components/editor/text-rail/ActiveTextBoxCard.tsx
  - src/components/editor/elements-panel.tsx
  - src/components/editor/slide-editor.tsx
tech-stack:
  added: []
  patterns:
    - Component extraction for cross-tab reuse (no new picker built)
    - Own-conditional card mount (not inheriting the slide-level-cards guard)
    - Single UPDATE_TEXT_BOX dispatch per change (KBD-09 one-undo-per-gesture)
key-files:
  created:
    - src/components/editor/text-rail/text-background-controls.tsx
    - src/components/editor/text-rail/__tests__/text-background-controls.test.tsx
  modified:
    - src/components/editor/text-rail/ActiveTextBoxCard.tsx
    - src/components/editor/elements-panel.tsx
    - src/components/editor/slide-editor.tsx
    - src/components/editor/__tests__/elements-panel-decoration-card.test.tsx
decisions:
  - "The text-background control already existed as HighlightControls — reused via extraction, not rebuilt"
  - "The Text Background card uses its OWN conditional (activeTextBox && onTextBoxHighlightUpdate) so a missing template/onSlideUpdate does not suppress it"
metrics:
  duration: ~6 min
  completed: 2026-05-17
  tasks: 2
  files: 6
---

# Quick Task 260517-fu9: Surface the Missing Text Background Color Control Summary

Surfaced the existing `TextBox.effects.highlight` ("text background") color/style/padding control under the **Elements** tab by extracting the inner `HighlightControls` into a reusable `TextBackgroundControls` component and mounting it as a text-box-scoped portlet card — no new color picker built, no data-model or renderer change.

## What Was Done

### Task 1 — Extract HighlightControls into a reusable TextBackgroundControls component (`86072d4`)
- Moved the inner `HighlightControls` function out of `ActiveTextBoxCard.tsx` into a new `'use client'` module `text-background-controls.tsx`, exported as `TextBackgroundControls`.
- Copied the `FOCUS_RING` constant value into the new file; imports `COLOR_SWATCHES`, `Icon`, and `type { TextHighlightEffect }`.
- All four `data-testid` values (`highlight-color-row`, `highlight-style-tight`, `highlight-style-full`, `highlight-padding`) and the `+ '88'` alpha-suffix convention preserved verbatim — existing `ActiveTextBoxCard` tests pass unchanged.
- `ActiveTextBoxCard` now imports and renders `<TextBackgroundControls>` inside its unchanged `<EffectRow label="Highlight">` — TEXT-tab behavior unchanged.
- Added `text-background-controls.test.tsx` (4 tests: swatch row render, swatch click → onChange color, style toggle → onChange style, padding change → onChange padding).
- Verification: `text-background-controls.test.tsx` + `ActiveTextBoxCard.test.tsx` — 32/32 green.

### Task 2 — Mount a "Text Background" card under the Elements tab and wire it through slide-editor (`1f8578b`)
- `elements-panel.tsx`: added two optional props `activeTextBox?: TextBox | null` and `onTextBoxHighlightUpdate?: (highlight: TextHighlightEffect) => void`; added module-local `DEFAULT_TEXT_BG` (matches `DEFAULT_HIGHLIGHT`).
- New `textBackgroundCard` block: a white-bordered portlet (`data-testid="elements-text-background-card"`) with an uppercase "Text Background" heading + one-line hint, rendering `<TextBackgroundControls>` bound to `activeTextBox.effects?.highlight ?? DEFAULT_TEXT_BG`. The `onChange` partial is merged with the existing highlight and passed to `onTextBoxHighlightUpdate`.
- The card has its **own conditional** (`activeTextBox && onTextBoxHighlightUpdate`) — it does NOT inherit the `slide && template && onSlideUpdate` guard that gates the Caption Bar / Watermark cards. Mounted in both selection-mode and library-mode renders, above `slideLevelCards`.
- `slide-editor.tsx`: at the `<ElementsPanel>` mount, computes the active text box via `currentSlide.text_boxes.find(tb => tb.id === selectedTextBoxId)` (mirroring `text-editor-panel.tsx`) and wires `onTextBoxHighlightUpdate` to a single `UPDATE_TEXT_BOX` dispatch with merged `effects.highlight` — one undo entry per change.
- Added 5 tests to `elements-panel-decoration-card.test.tsx` (card visible with text box / absent without / appears without slide+template guard / merged highlight dispatch / coexists with selection mode).
- Verification: `elements-panel-decoration-card.test.tsx` 11/11 green; `tsc --noEmit` = 19 errors (baseline preserved); no renderer file changed.

## Deviations from Plan

None — plan executed exactly as written. The plan listed `text-background-controls.test.tsx` in `files_modified` for Task 1 and the Elements test was added to the existing `elements-panel-decoration-card.test.tsx` (the file the plan's Task 2 verify command targets), which is the intended placement.

## Verification Results

- `npx vitest run src/components/editor/text-rail/__tests__ src/components/editor/__tests__/elements-panel-decoration-card.test.tsx` — **108/108 green** (9 files).
- `npx tsc --noEmit` — **19 errors** (preserved 19-error baseline; zero new).
- `git diff --stat` vs base — **no changes** to `slide-preview.tsx`, `render-slide-satori.tsx`, `render-slide.ts`, or `src/lib/render/templates/` — render parity (TPLREND-05) preserved by construction.
- Manual verification deferred to the running dev server: select a text box, switch to the ELEMENTS tab → "Text Background" card visible; pick a swatch → fill behind the text recolors; TEXT-tab "Highlight" row still works.

## Success Criteria

- [x] Text background color control reachable from the Elements tab without leaving it.
- [x] The control is the existing `HighlightControls` (now `TextBackgroundControls`), reused — no new color picker.
- [x] Editing from Elements or Text writes the same `TextBox.effects.highlight` field; canvas + PNG export render identically.
- [x] No data-model / schema / migration / renderer change; tsc 19-error baseline preserved.

## Known Stubs

None. The control is wired end-to-end: `TextBackgroundControls` → `ElementsPanel` card → `slide-editor` `UPDATE_TEXT_BOX` dispatch → existing reducer → existing renderers.

## Self-Check: PASSED

- FOUND: `src/components/editor/text-rail/text-background-controls.tsx`
- FOUND: `src/components/editor/text-rail/__tests__/text-background-controls.test.tsx`
- FOUND: commit `86072d4` (Task 1)
- FOUND: commit `1f8578b` (Task 2)
