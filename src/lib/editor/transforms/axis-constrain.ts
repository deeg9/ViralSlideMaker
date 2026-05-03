// Phase 61 Plan 02 (KBD-07): axis-constrain pure helper for element drag.
// Pure module — no React, no use-client directive, no DOM access.
//
// When the user holds Shift while dragging an element, motion locks to the
// dominant axis (the one with the larger absolute delta from the drag start).
// Mirrors Figma/Canva muscle memory.
//
// Wired into the 4 element <Rnd> onDrag handlers in slide-preview.tsx
// (hook, body, custom-text, custom-image) BEFORE the existing calculateSnap
// call. Snap then refines on the FREE axis — the constrained axis stays
// locked even when snap would otherwise pull to a guide.
//
// Coordinate space is caller-defined (px in slide-preview.tsx, where data.x /
// data.y are unscaled-canvas pixels). Helper does not interpret the units.
//
// Tie-break (equal |dx| === |dy|): lock X, leave Y free. Deterministic so
// the user's exact-diagonal drag doesn't flicker between the two axes per
// frame as floating-point error nudges the comparison.

export interface DragPoint {
  x: number
  y: number
}

export function applyAxisConstrain(
  data: DragPoint,
  start: DragPoint,
  shiftHeld: boolean,
): DragPoint {
  if (!shiftHeld) return data
  const dx = Math.abs(data.x - start.x)
  const dy = Math.abs(data.y - start.y)
  return dx > dy
    ? { x: data.x, y: start.y }  // X dominant: lock Y
    : { x: start.x, y: data.y }  // Y dominant or tie: lock X
}
