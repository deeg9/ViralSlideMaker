/**
 * Phase 63 Plan 03 — Smart-guides snap index (Wave B core).
 *
 * Pure module. No React. No DOM. No I/O. Reusable from server, RPC, MCP.
 *
 * Requirements covered (per .planning/REQUIREMENTS.md):
 *   - SNAP-01: 5px snap threshold (lowered from legacy 10).
 *   - SNAP-02: Element edges contributed (left/center-h/right + top/center-v/bottom).
 *   - SNAP-03: Canvas edges contributed (0/540/1080 + 0/960/1920).
 *   - SNAP-08: Sorted-edge-array index, queried via lower-bound binary search
 *     (O(log N) per query) — replaces the O(N*M) double-loop in
 *     src/hooks/use-alignment-guides.ts.
 *   - SNAP-10: Asymmetric hysteresis — enter snap at delta <= 5; exit at
 *     delta > 7. The 2-px deadband prevents guide flicker (PITFALL-5.2).
 *   - PERF-05: Pointer-move budget < 2ms at N=30 elements (verified by
 *     snap-index.bench.test.ts).
 *
 * Pitfalls referenced:
 *   - PITFALL-5.1: O(N^2) snap math collapses frame rate at N>=20.
 *     Solution: sorted edges + binary search keep per-tick work O(log N).
 *   - PITFALL-5.2: Naive single-threshold snap causes guide flicker when the
 *     pointer hovers near the threshold boundary. Asymmetric hysteresis (5
 *     enter, 7 exit) gives a 2-px stable deadband.
 *
 * Per-axis hysteresis state contract (SNAP-10):
 *   Callers MUST track X and Y hysteresis state SEPARATELY.
 *   - wasSnappedX: number | null — last X-axis snap target (or null if free)
 *   - wasSnappedY: number | null — last Y-axis snap target (or null if free)
 *   Bundling X+Y in a single helper would force a 2D state machine; the
 *   per-axis design honors the deadband independently per axis (one axis
 *   can be snapped while the other is free).
 *
 * Phase 60 carried-over gaps (revisit in later phases):
 *   - Structural-anchor TextBoxes (anchor !== 'custom') are SKIPPED.
 *     Height resolution requires a DOM ref via the rendered-height observer
 *     pattern at slide-preview.tsx:589-637. See selection-bounds.ts header.
 *   - TextBox height is not in the schema; we use 0 (degenerate top==bottom)
 *     so a horizontally-anchored TextBox still contributes a usable Y line.
 *   - Watermark size is a placeholder (18% x 5% — matches Plan 63-01
 *     selection-bounds extension); Phase 64 lifts to real measurements.
 */

import type { Slide } from '@/lib/types/slide'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** SNAP-01: enter snap when |delta| <= 5 reference px. */
export const SNAP_THRESHOLD_ENTER = 5

/** SNAP-10: exit snap when |delta| > 7 (asymmetric hysteresis). */
export const SNAP_THRESHOLD_EXIT = 7

const REF_WIDTH = 1080
const REF_HEIGHT = 1920

/** Watermark size placeholder (mirrors Plan 63-01 selection-bounds extension). */
const WATERMARK_W_PCT = 18
const WATERMARK_H_PCT = 5

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type EdgeKind =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'center-v'
  | 'bottom'
  | 'canvas-edge'
  | 'canvas-center'

export interface EdgeEntry {
  /** Reference pixels (0..1080 for X, 0..1920 for Y). */
  pos: number
  /** What part of the source contributed this edge. */
  kind: EdgeKind
  /** Element id, or 'canvas' for canvas edges. */
  sourceId: string
}

export interface SnapIndex {
  /** Sorted ascending by pos. May contain duplicates if multiple elements share a position. */
  xEdges: EdgeEntry[]
  /** Sorted ascending by pos. */
  yEdges: EdgeEntry[]
}

export interface SnapQueryResult {
  /** Edge pos in REF px, or null if no snap within threshold. */
  snappedTo: number | null
  /** Signed offset from query value to snappedTo. 0 if no snap. */
  delta: number
}

export interface HysteresisResult {
  snapped: boolean
  snappedTo: number | null
  delta: number
  /** What the caller should store as wasSnapped for the NEXT call (per axis). */
  nextWasSnapped: number | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Watermark enum -> origin% helper
// ─────────────────────────────────────────────────────────────────────────────

function watermarkOriginPct(
  pos: 'top-left' | 'bottom-left' | 'bottom-right',
): { xPct: number; yPct: number } {
  switch (pos) {
    case 'top-left':
      return { xPct: 0, yPct: 0 }
    case 'bottom-left':
      return { xPct: 0, yPct: 95 }
    case 'bottom-right':
      return { xPct: 82, yPct: 95 }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// buildSnapIndex
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a sorted-edge SnapIndex from a slide (SNAP-02, SNAP-03, SNAP-08).
 *
 * Walks `text_boxes`, `custom_images`, and `watermark`, skipping any element
 * whose id is in `excludeIds`. Custom-anchor text boxes contribute 3 X-edges
 * + 3 Y-edges; structural-anchor (top/center/bottom) text boxes are skipped
 * (Phase 60 documented gap — height resolution requires DOM ref).
 *
 * Locked elements ARE included (Figma rule — locked elements ARE valid snap
 * targets). Only `excludeIds` membership removes them.
 *
 * Multi-element drag (SNAP-09): callers pass `excludeIds` containing the
 * full set of elements being moved (e.g., union of group members), then
 * query the union AABB's edges via findNearestSnap independently per axis.
 *
 * Output edges are sorted ascending by pos. Duplicates are allowed
 * (multiple elements at the same x — common after alignment). The
 * underlying binary search handles duplicates correctly (Test SI-15).
 *
 * Complexity: O(N) edge production + O(N log N) sort = O(N log N) total.
 */
export function buildSnapIndex(
  slide: Slide,
  excludeIds: Set<string>,
  canvasW: number = REF_WIDTH,
  canvasH: number = REF_HEIGHT,
): SnapIndex {
  const xEntries: EdgeEntry[] = []
  const yEntries: EdgeEntry[] = []

  // Canvas edges (SNAP-03)
  xEntries.push({ pos: 0, kind: 'canvas-edge', sourceId: 'canvas' })
  xEntries.push({ pos: canvasW / 2, kind: 'canvas-center', sourceId: 'canvas' })
  xEntries.push({ pos: canvasW, kind: 'canvas-edge', sourceId: 'canvas' })
  yEntries.push({ pos: 0, kind: 'canvas-edge', sourceId: 'canvas' })
  yEntries.push({ pos: canvasH / 2, kind: 'canvas-center', sourceId: 'canvas' })
  yEntries.push({ pos: canvasH, kind: 'canvas-edge', sourceId: 'canvas' })

  const pushElementEdges = (
    sourceId: string,
    xPct: number,
    yPct: number,
    wPct: number,
    hPct: number,
  ): void => {
    const xPx = (xPct / 100) * canvasW
    const yPx = (yPct / 100) * canvasH
    const wPx = (wPct / 100) * canvasW
    const hPx = (hPct / 100) * canvasH
    // X axis: left, center-h, right
    xEntries.push({ pos: xPx, kind: 'left', sourceId })
    xEntries.push({ pos: xPx + wPx / 2, kind: 'center', sourceId })
    xEntries.push({ pos: xPx + wPx, kind: 'right', sourceId })
    // Y axis: top, center-v, bottom
    yEntries.push({ pos: yPx, kind: 'top', sourceId })
    yEntries.push({ pos: yPx + hPx / 2, kind: 'center-v', sourceId })
    yEntries.push({ pos: yPx + hPx, kind: 'bottom', sourceId })
  }

  // Text boxes (SNAP-02)
  for (const tb of slide.text_boxes ?? []) {
    if (excludeIds.has(tb.id)) continue
    if (tb.position.anchor !== 'custom') continue // Phase 60 gap
    const xPct = tb.position.x ?? 0
    const yPct = tb.position.y ?? 0
    const wPct = tb.position.width ?? 60
    // TextBox has no explicit height (Phase 60 gap) — use 0; degenerate
    // top==center==bottom edge entry. Callers tolerate (they query each
    // edge independently and dedupe by pos).
    pushElementEdges(tb.id, xPct, yPct, wPct, 0)
  }

  // Custom images (SNAP-02)
  for (const ci of slide.custom_images ?? []) {
    if (excludeIds.has(ci.id)) continue
    pushElementEdges(ci.id, ci.x, ci.y, ci.width, ci.height)
  }

  // Watermark (SNAP-02 + Plan 63-01 selection-bounds extension)
  if (slide.watermark && !excludeIds.has(slide.watermark.id)) {
    const enumPos = slide.watermark.position ?? 'bottom-right'
    const { xPct, yPct } = watermarkOriginPct(enumPos)
    pushElementEdges(
      slide.watermark.id,
      xPct,
      yPct,
      WATERMARK_W_PCT,
      WATERMARK_H_PCT,
    )
  }

  // Sort ascending. Array.prototype.sort is stable in V8 (TC39).
  xEntries.sort((a, b) => a.pos - b.pos)
  yEntries.sort((a, b) => a.pos - b.pos)

  return { xEdges: xEntries, yEdges: yEntries }
}

// ─────────────────────────────────────────────────────────────────────────────
// findNearestSnap — O(log N) binary search via lower_bound + neighbor check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find the nearest edge to `value` within `threshold` (SNAP-01, SNAP-08).
 *
 * Algorithm: lower_bound binary search lands on the first index where
 * pos >= value (or sortedEdges.length if all are below). Then we check
 * the two neighbors (lo - 1 and lo) and return whichever is closer
 * within threshold. With duplicates, lower_bound lands on the FIRST
 * matching duplicate, which is fine — they're equivalent for snap.
 *
 * Complexity: O(log N) for the search + O(1) for the 2-neighbor check.
 *
 * Returns { snappedTo: null, delta: 0 } when:
 *   - sortedEdges is empty
 *   - neither neighbor is within `threshold`
 */
export function findNearestSnap(
  value: number,
  sortedEdges: EdgeEntry[],
  threshold: number,
): SnapQueryResult {
  const n = sortedEdges.length
  if (n === 0) return { snappedTo: null, delta: 0 }

  // lower_bound: first index where pos >= value.
  let lo = 0
  let hi = n
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (sortedEdges[mid].pos < value) lo = mid + 1
    else hi = mid
  }

  // Candidates: indices lo - 1 and lo (the two neighbors of `value` in sort order).
  let bestPos: number | null = null
  let bestAbsDelta = Infinity
  for (const idx of [lo - 1, lo]) {
    if (idx < 0 || idx >= n) continue
    const ed = sortedEdges[idx]
    const d = ed.pos - value
    const ad = d < 0 ? -d : d
    if (ad <= threshold && ad < bestAbsDelta) {
      bestAbsDelta = ad
      bestPos = ed.pos
    }
  }

  if (bestPos === null) return { snappedTo: null, delta: 0 }
  return { snappedTo: bestPos, delta: bestPos - value }
}

// ─────────────────────────────────────────────────────────────────────────────
// snapWithHysteresis — asymmetric enter/exit state machine (SNAP-10)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asymmetric hysteresis snap (SNAP-10).
 *
 * State transitions:
 *   - prev = null (free) -> fresh search at threshold ENTER (5).
 *     - Hit  -> snap, nextWasSnapped = hit edge.
 *     - Miss -> stay free.
 *   - prev != null (snapped):
 *     - |delta| <= EXIT (7) -> stay snapped (hold zone — 2-px deadband).
 *     - |delta| >  EXIT     -> fall through to fresh search (cross-edge re-enter).
 *
 * Per-axis contract: caller passes a single scalar wasSnapped (the prior
 * snap target on THIS axis only). Helper returns a single scalar
 * nextWasSnapped. The caller stores wasSnappedX and wasSnappedY
 * SEPARATELY and calls this helper twice per pointer-move.
 *
 * @param value - Query value (REF px on a single axis).
 * @param sortedEdges - Sorted edge array for that axis (xEdges OR yEdges).
 * @param prevWasSnapped - Last-frame snap target on this axis, or null.
 * @param thresholds - Optional override for the enter/exit thresholds (REF px).
 *   Defaults to SNAP_THRESHOLD_ENTER (5) and SNAP_THRESHOLD_EXIT (7). Callers
 *   rendering at small canvas scales (e.g., a 200px-wide editor preview of a
 *   1080-wide reference canvas) widen these so the snap feels magnetic in
 *   SCREEN px rather than the over-tight default 5 ref px ≈ 1 screen px.
 */
export function snapWithHysteresis(
  value: number,
  sortedEdges: EdgeEntry[],
  prevWasSnapped: number | null,
  thresholds?: { enter?: number; exit?: number },
): HysteresisResult {
  const enter = thresholds?.enter ?? SNAP_THRESHOLD_ENTER
  const exit = thresholds?.exit ?? SNAP_THRESHOLD_EXIT
  // If we were snapped last frame, check the hold zone first.
  if (prevWasSnapped !== null) {
    const delta = prevWasSnapped - value
    const absDelta = delta < 0 ? -delta : delta
    if (absDelta <= exit) {
      // Stay snapped — within the hold deadband.
      return {
        snapped: true,
        snappedTo: prevWasSnapped,
        delta,
        nextWasSnapped: prevWasSnapped,
      }
    }
    // Fell out of the hold zone — fall through to a fresh search.
  }

  // Fresh search at the ENTER threshold.
  const r = findNearestSnap(value, sortedEdges, enter)
  if (r.snappedTo !== null) {
    return {
      snapped: true,
      snappedTo: r.snappedTo,
      delta: r.delta,
      nextWasSnapped: r.snappedTo,
    }
  }
  return {
    snapped: false,
    snappedTo: null,
    delta: 0,
    nextWasSnapped: null,
  }
}
