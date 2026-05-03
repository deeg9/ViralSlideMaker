// Phase 61 (SEL-14): rect normalization for marquee selection.
// Pure module — no React, no use-client directive, no DOM access.
//
// Imported by element-rect-intersect.ts and (Plan 61-02) the selecto
// pointer-event handler. All 4 drag directions normalize to a single
// canonical {x, y, w, h} with non-negative w and h. Per PITFALLS Cat-2.3:
// intersection math against negative-dimension rects silently drops
// candidates; centralizing the normalization here prevents that whole
// class of bug.
//
// Coordinate space is caller-defined — this helper does not interpret
// the numbers (px or %). It only swaps endpoints so {w, h} are
// non-negative.

export interface NormalizedRect {
  x: number
  y: number
  w: number
  h: number
}

export function normalizeRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): NormalizedRect {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    w: Math.abs(x1 - x0),
    h: Math.abs(y1 - y0),
  }
}
