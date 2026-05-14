---
slug: decoration-controls-polish
date: 2026-05-14
status: complete
---

# Decoration inspector: layout + live preview + glyph-shaped drop shadow

## What changed

### Layout
- `decoration-card.tsx` — PositionField + RotationField rebuilt as bordered
  pills with a prefix-label chip (`W`, `H`, `X`, `Y`, `↻`) sitting flush
  against the input via an inline border-divider. 2×2 grid retained for
  SIZE & POSITION; ROTATION sits in one left cell so it inherits the same
  rhythm rather than spanning the whole panel.

### Live preview (no-history dispatch channel)
- `editor-actions.ts` — `UPDATE_DECORATION` gains optional `noHistory: boolean`.
- `editor-reducer.ts:425–448` — when `noHistory:true`, returns
  `{ ...state, present }` without `pushHistory`. KBD-09 still holds: the
  final commit (no flag) records exactly ONE undo entry per gesture.
- `decoration-card.tsx` — new `onPreview` prop. PositionField + RotationField
  each accept their own `onPreview` callback and fire on every onChange that
  yields a finite, in-range value.
- `decoration-card-effects.tsx` — opacity slider became controlled
  (`value={opacityDraft}`, `useEffect` re-sync from props). onChange fires
  `onPreview({ opacity: x/100 })` + updates local draft; onMouseUp /
  onTouchEnd still calls the committing `commitOpacity` via `onUpdate`.
- `elements-panel.tsx` — new `onDecorationPreview` prop piped through to
  `DecorationCard.onPreview`.
- `slide-editor.tsx` — dispatches `UPDATE_DECORATION` with `noHistory: true`
  on the preview channel.

### Glyph-shaped drop shadow
- `decoration-renderer.tsx` — `DecorationRenderCtx` gains `target?:
  'browser' | 'satori'`. `buildWrapperStyle` now branches:
  - icon decoration + `target === 'browser'` → `filter: drop-shadow(...)`
    (new `DROP_SHADOW_SIZE_MAP` mirrors box-shadow magnitudes).
  - everything else → existing `box-shadow` (correct for shapes, parity-
    safe for Satori export).
- `slide-preview.tsx` — both `renderDecoration` call sites pass
  `target: 'browser'`. `render-slide-satori.tsx` left untouched (Satori
  path uses the safe default).
- `no-css-filter-on-decoration.test.ts` — PCL13 grep gate now allow-lists
  `filter: drop-shadow(` narrowly in `decoration-renderer.tsx`. Other
  filter values (blur, brightness, sepia, etc.) stay banned in EVERY
  scanned file, including this one.

## Behavior

- Typing in W/H/X/Y/Rotation: icon updates LIVE on canvas per keystroke;
  blur/Enter commits the final value as one undo step.
- Dragging opacity slider: icon fades live; release commits one undo step.
- Toggling drop shadow ON for an icon: glyph-shaped shadow appears under
  the SVG outline in the editor. PNG export keeps the rectangular halo via
  `box-shadow` (documented Satori tradeoff the user picked).

## Tests

- 96/96 decoration-card + elements-panel + decoration-card-effects +
  decoration-card-rotation-input tests pass unchanged.
- 386/386 editor-reducer tests pass (noHistory branch additive).
- 53/53 PCL13 / no-css-filter / parity-regression-sweep tests pass.
- 45/45 decoration-renderer + integration tests pass.
- `npx tsc --noEmit` on touched files: clean (only the pre-existing
  treatment-sync.test.tsx error from before this task).

## Files touched

- `src/lib/editor/editor-actions.ts`
- `src/lib/editor/editor-reducer.ts`
- `src/lib/render/decoration-renderer.tsx`
- `src/components/slides/slide-preview.tsx`
- `src/components/editor/text-rail/decoration-card.tsx`
- `src/components/editor/text-rail/decoration-card-effects.tsx`
- `src/components/editor/elements-panel.tsx`
- `src/components/editor/slide-editor.tsx`
- `src/lib/render/__tests__/no-css-filter-on-decoration.test.ts`
