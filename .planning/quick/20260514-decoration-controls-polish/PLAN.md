---
slug: decoration-controls-polish
date: 2026-05-14
status: complete
---

# Decoration inspector: layout + live preview + glyph-shaped drop shadow

Three problems on the Elements inspector card after the icon-pill landed:

1. W/H/X/Y inputs balloon to full panel width (PositionField `flex-1` inside
   a 2-col grid cell). Rotation is `w-full` with no relationship to the
   position grid.
2. Position / rotation / opacity inputs commit only on blur / Enter /
   mouseup. No live preview while interacting → reads as "doesn't work."
3. Drop-shadow toggle DOES dispatch and the renderer DOES apply
   `box-shadow` — but for icon glyphs that's a rectangular halo around the
   bounding box, not a glyph-shaped shadow. User reads as broken.

## Approach

- **Layout:** rebuild PositionField + RotationField as bordered pills with a
  prefix-label chip (`W`, `H`, `X`, `Y`, `↻`) flush against the input.
  2×2 grid retained for SIZE & POSITION; ROTATION pill sits in a single
  left cell so it inherits the same grid rhythm.
- **Live preview:** extend `UPDATE_DECORATION` with an optional
  `noHistory: boolean` flag. Reducer branches: noHistory:true → mutate
  `present` without pushHistory; default → pushHistory as before. Pipe an
  `onPreview` callback through DecorationCard → ElementsPanel → slide-editor;
  the editor dispatches with noHistory:true. PositionField/RotationField
  emit on every keystroke; opacity slider becomes controlled (`value`,
  not `defaultValue`) with onChange→preview + onMouseUp→commit.
- **Glyph-shaped drop shadow:** target-branch the renderer. Browser path
  (slide-preview.tsx) → `filter: drop-shadow(...)` for icons. Satori path →
  `box-shadow` fallback (rectangular halo on PNG export, the parity tradeoff
  the user accepted). Narrow allow-list update to the PCL13 grep gate
  (no-css-filter-on-decoration.test.ts) so only `filter: drop-shadow(` is
  permitted in decoration-renderer.tsx — every other filter value stays
  banned in every scanned file.

## Tasks

1. `editor-actions.ts` + `editor-reducer.ts` — add noHistory flag + branch.
2. `decoration-renderer.tsx` — add `target` to ctx; branch wrapper-style
   shadow strategy on `kind==='icon' && target==='browser'`.
3. `slide-preview.tsx` (×2 call sites) — pass `target: 'browser'`.
4. `no-css-filter-on-decoration.test.ts` — allow `filter: drop-shadow(`
   narrowly in decoration-renderer.tsx.
5. `decoration-card.tsx` — PositionField + RotationField visual rebuild,
   `onPreview` prop + dispatch wiring.
6. `decoration-card-effects.tsx` — controlled opacity slider; onChange→preview,
   onMouseUp→commit.
7. `elements-panel.tsx` — pipe `onDecorationPreview` to DecorationCard.
8. `slide-editor.tsx` — dispatch UPDATE_DECORATION with noHistory:true.
