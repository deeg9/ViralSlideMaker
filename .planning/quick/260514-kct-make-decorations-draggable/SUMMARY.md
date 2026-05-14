---
slug: make-decorations-draggable
quick_id: 260514-kct
created: 2026-05-14
completed: 2026-05-14
status: complete
---

# Make decorations draggable on the canvas — Summary

## User report (verbatim)

> "Okay, next, can we understand why I can't just drag around the different shapes and icons? How come they're fixed to a certain position? How come I can't just drag them around like a text box?"

## Why decorations were "fixed"

In the editable canvas path (`src/components/slides/slide-preview.tsx`), text boxes and custom images were wrapped in `<Rnd>` (with full drag pipeline). Decorations were rendered as three sibling elements in a Fragment — visual, click-target overlay, and rotation handle — with **no drag wrapper**. The Phase 70 code comment at line 2681 acknowledged this: "Rnd wrapper, handles is owned by Phase 70+" — i.e. selection chrome + rotation handle were shipped, but the drag wrapper was deferred and nobody ever circled back.

The reducer and selection model were already ready:
- `UPDATE_DECORATION` action exists (color, size, position).
- `BULK_TRANSLATE` reducer **already handles decorations** since Phase 68 Plan 02 — the research agent missed this on a first pass; verified at `editor-reducer.ts:567-585` (locked decorations are skipped, hidden ones move).
- Decorations are first-class selection ids.

Only the canvas interaction wiring was missing.

## Fix

1. **`src/components/slides/slide-preview.tsx`** — replaced the static click-target `<div>` per decoration with an `<Rnd>` wrapper:
   - Position/size in pixels (% × REF_WIDTH / REF_HEIGHT).
   - `scale={scale}` (canvas zoom — same as text boxes).
   - `bounds="parent"`, `disableDragging={d.locked === true}`, `enableResizing={false}` (resize stays inspector-only).
   - `onDragStart` — set `draggingElementId`, snapshot drag-start for the group fan-out delta math.
   - `onDragStop` — group drag branch (via existing `onGroupDrag`) when selection spans a group containing this decoration; otherwise single-element via the new `onDecorationPositionChange(id, {x, y})` callback.
   - `onMouseDown` — replaces the old `onClick` selection wire (Rnd absorbs `onClick`; selection happens on mousedown, same UX). Preserves shift-click-to-add.
   - Rotation transform moved off the Rnd's outer style (which react-draggable reserves for `transform: translate(x, y)`) onto a new inner `decoration-visual-wrap-${d.id}` div, so rotation no longer clobbers Rnd's positioning.
   - Cloned decoration node fills the Rnd via `style.left/top/width/height` override.

2. **`src/components/editor/slide-canvas.tsx`** — added `onDecorationPositionChange` prop, forwarded to `SlidePreview`.

3. **`src/components/editor/slide-editor.tsx`** — wired the handler. Reads the current decoration's full position from `currentSlide.decorations`, dispatches `{ type: 'UPDATE_DECORATION', slideIndex, id, updates: { position: { ...existing, x, y } } }` so width/height are preserved.

4. **Tests updated** for the new architecture:
   - `slide-preview-decoration-click.test.tsx` — selection now fires from `mouseDown` instead of `click` (Rnd intercepts click for drag). Rotation transform assertion moved from outer click-target to inner `decoration-visual-wrap-${d.id}`. 6/6 tests green.
   - `slide-preview-rotation-handle.test.tsx` — Test 6 (per-tick preview) checks the inner visual-wrap's transform now. 7/7 tests green.

## Files changed

- `src/components/slides/slide-preview.tsx` — Rnd wrapper + new prop + `decorationDragStartRefs` ref.
- `src/components/editor/slide-canvas.tsx` — `onDecorationPositionChange` pass-through.
- `src/components/editor/slide-editor.tsx` — handler dispatching `UPDATE_DECORATION`.
- `src/components/slides/__tests__/slide-preview-decoration-click.test.tsx` — mousedown + visual-wrap.
- `src/components/slides/__tests__/slide-preview-rotation-handle.test.tsx` — visual-wrap.

## Verification

- `npx vitest run` (slides + editor + reducer suites): **56 of 57 test files passing**, 871 tests green. The single failing file is `phase-70-final-regression-sweep.test.ts` — pre-existing, confirmed identical on `main` without these changes (unrelated milestone-pin drift).
- `npx tsc --noEmit` on touched files: **no new errors**.

## Manual smoke checklist (user)

1. Open any project, generate or open a slide with an icon/shape.
2. Click an icon → it selects (selection ring appears).
3. Drag it anywhere on the canvas → it follows the cursor, releases at the drop location.
4. Locked decorations don't drag.
5. Right-rail W/H/X/Y inputs still work (cross-check that drag→inspector inputs stay in sync).
6. Multi-select with a text box + icon, drag the icon → both move together via BULK_TRANSLATE (was already broken in the canvas; now works because we go through the existing `onGroupDrag` path).

## Out of scope (intentional deferrals — known limitations)

- **Corner-handle resize on decorations.** Sizing is still inspector-only via W/H inputs.
- **Snap-to-other-elements** during decoration drag — text boxes have it; decorations don't yet. Drag is pixel-precise; no snap.
- **Axis-constrain on Shift-drag** — not wired for decorations.
- **Alt-duplicate** during drag — `DUPLICATE_ELEMENTS_AT` reducer would need a decoration audit.
- **Drop on trash zone to delete** — separate UX; Delete button in the DecorationCard handles it.
- **On-canvas rotation handle wiring** — `onDecorationRotate` prop is declared on `SlidePreview` but never forwarded by `SlideCanvas`/`SlideEditor`, so the rotation handle has been a dead-end since Phase 72. Out of scope for this task; flagging here for a follow-up so it can be wired (same one-line pass-through pattern) when prioritized.

## Architectural notes

- Rnd's outer `transform` is now off-limits for our styling — react-draggable owns it for positioning. Anything decorative (rotation, etc.) must live on a child element inside Rnd. Future contributors: don't put `transform: rotate(...)` on `Rnd.style`; use an inner wrapper.
- The `decoration-click-target-${d.id}` testid is preserved (now on the Rnd outer div). Existing tests that look for this id keep working; only the event type they fire (`click` → `mouseDown`) had to change.
