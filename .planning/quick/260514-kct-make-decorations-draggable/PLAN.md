---
slug: make-decorations-draggable
quick_id: 260514-kct
created: 2026-05-14
status: in-progress
---

# Make decorations (icons + shapes) draggable on the canvas

## User report (verbatim)

> "Okay, next, can we understand why I can't just drag around the different shapes and icons? How come they're fixed to a certain position? How come I can't just drag them around like a text box?"

## What's actually happening

In `src/components/slides/slide-preview.tsx:2694-2796` (editable canvas path), each decoration is rendered as three sibling elements inside a `<React.Fragment>`:
- The `renderDecoration(d, ctx)` output (the visual)
- A `<div>` click-target overlay (selection only — `onClick` dispatches `selection.replaceWith([d.id])`)
- An optional `DecorationRotationHandle` (Phase 72 rotation drag)

**Nothing in this stack is wrapped in `<Rnd>`.** All other addressable elements on the canvas (hook text box at 1493–1676, body text box at 1795–1933, custom texts at 2051–2403, custom images at 2407–2627) use `<Rnd>` with `onDragStart/onDrag/onDragStop` to dispatch position updates. The decoration render site was shipped in Phase 70 with selection chrome + a Phase 72 rotation handle but **never got the drag wrapper** — comment at line 2681 acknowledges this: "Rnd wrapper, handles is owned by Phase 70+".

Position editing today is only via the right-rail W/H/X/Y inputs in `DecorationCard`.

## What's already in place (no change needed)

- **Reducer `UPDATE_DECORATION`** (`src/lib/editor/editor-reducer.ts`) — single-decoration position update, respects lock, single pushHistory entry.
- **Reducer `BULK_TRANSLATE`** (lines 534–604) — **already handles decorations** since Phase 68 Plan 02 (research agent missed this; verified at lines 567–585). Locked decorations are skipped; hidden ones still move (matches v2.11 contract). So group drag including a decoration already routes correctly through the reducer.
- **Selection model** — decorations are first-class selection ids.
- **Lock state** — `d.locked === true` honored by reducer.
- **`onDecorationRotate`** prop pattern in SlidePreview — same shape as what we need for translate; mirrors the rotation handle's `onCommit → dispatch BULK_ROTATE` flow.

## Fix — minimum viable drag

1. **`src/components/slides/slide-preview.tsx`** — in the decoration iteration site (~2694–2796), replace the click-target `<div>` with an `<Rnd>` wrapper:
   - `position` in pixels from `d.position` (%×REF_WIDTH / %×REF_HEIGHT).
   - `size` in pixels from `d.position.width/height`.
   - `scale={scale}` (canvas zoom — same as text boxes).
   - `bounds="parent"`.
   - `disableDragging={d.locked === true}`.
   - `enableResizing={false}` — resize via inspector only (kept out of scope; existing W/H inputs handle it).
   - `onDragStart` — set `setDraggingElementId(d.id)`; capture drag-start snapshot for the group fan-out delta math (mirror custom-image pattern).
   - `onDragStop` — clamp percent → 0..100; if multi-element selection includes this decoration AND `shouldGroupDrag` resolves → dispatch via `onGroupDrag({ slideIndex, ids, deltaX, deltaY })` (existing prop, BULK_TRANSLATE under the hood); else single-element via new `onDecorationPositionChange(d.id, { x, y })` callback that dispatches `UPDATE_DECORATION`.
   - `onMouseDown` — replicates current click-target select logic (shift to add, plain to replace).
   - Inside the `Rnd`, `React.cloneElement` the `renderDecoration` node with overridden `style.left=0, top=0, width=100%, height=100%` so the visual fills the Rnd parent (the renderer's outer absolute-position is what we're now responsible for, via Rnd).

2. **`src/components/editor/slide-canvas.tsx`** + **`src/components/editor/slide-editor.tsx`** — add `onDecorationPositionChange` to the prop chain; in slide-editor, the handler dispatches `{ type: 'UPDATE_DECORATION', slideIndex, id, updates: { position: { ...current, x, y } } }`.

3. **Tests:**
   - Unit-test the reducer for `UPDATE_DECORATION` with a partial position update (probably already covered — verify and add if missing).
   - Smoke verify by manual browser test (drag works visually).

## Out of scope (intentional deferrals)

- **Corner-handle resize** of decorations — exists via inspector inputs; not in this quick task.
- **Snap to other elements** during decoration drag — text boxes have it via `buildSnapIndex` + `runSnapForDrag`; not adding here to keep scope tight.
- **Axis-constrain on Shift-drag** — same reasoning.
- **Alt-duplicate** during drag — `DUPLICATE_ELEMENTS_AT` reducer would need decoration support audit; out of scope.
- **Drop on trash zone to delete** — separate UX; current Delete button in DecorationCard covers it.

These are listed in SUMMARY follow-ups so the user knows they're knowable gaps, not hidden surprises.

## Files

- `src/components/slides/slide-preview.tsx` — wrap decorations in Rnd + new prop.
- `src/components/editor/slide-canvas.tsx` — forward prop.
- `src/components/editor/slide-editor.tsx` — wire handler that dispatches UPDATE_DECORATION.
- (Optional) test file for end-to-end coverage of the new drag path.

## Risk

- Rnd's drag swallows clicks unless the user-supplied `onMouseDown` runs first. Need to preserve shift-click and primary-click selection behavior — mirror the custom-image `onMouseDown` pattern at slide-preview.tsx:2590+.
- Per-tick rendering during drag won't update `d.position` (Rnd holds local state until `onDragStop`). The rotation handle reads `d.position` directly — it'll lag behind the drag and snap to the new position on drop. Same behavior as text-box rotation handle, so consistent.
