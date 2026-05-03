/**
 * Phase 63 Plan 04 (SNAP-04 + DIFF-03): equal-spacing "==" detector for the
 * smart-guide overlay. When N>=3 elements have CONSECUTIVE equal gaps along
 * an axis (within an epsilon tolerance), Figma renders a pink double-equals
 * indicator between each pair. This pure helper computes the match.
 *
 * Pure module. No React. No DOM. No I/O. Reusable from server, RPC, MCP.
 *
 * Axis-agnostic: callers pre-extract { id, pos, size } tuples for the axis
 * being queried (X-axis: pos=x-px, size=width-px; Y-axis: pos=y-px,
 * size=height-px). Phase 60 known gap honored — TextBox height=0 produces a
 * degenerate but VALID input (Test ES11 pins).
 *
 * Algorithm:
 *   1. Sort by pos ascending (stable).
 *   2. For each consecutive pair, gap_i = pos_{i+1} - (pos_i + size_i).
 *   3. If any gap_i is negative → overlap → null.
 *   4. If max(|gap_i - gap_0|) > epsilon → unequal → null.
 *   5. Otherwise, build N-1 segments at [pos_i + size_i, pos_{i+1}].
 *
 * Complexity: O(N log N) sort + O(N) gap walk = O(N log N) total.
 *
 * Default epsilon=1 px — matches PITFALL-5.2 spirit (1-px tolerance is
 * imperceptible to users; 0-px would never match floating-point positions).
 */

export interface EqualSpacingMatch {
  /** Common gap size in axis units (REF px). */
  gapSize: number
  /**
   * Gap rect coordinates in axis units. segments[i] is the gap between
   * element i and element i+1 in the SORTED order. Length is N-1.
   */
  segments: Array<{ from: number; to: number }>
  /** Element ids sorted ascending by pos. Length N (>=3). */
  elementIds: string[]
}

export function detectEqualSpacing(
  elements: Array<{ id: string; pos: number; size: number }>,
  epsilon: number = 1,
): EqualSpacingMatch | null {
  if (elements.length < 3) return null

  // Stable sort ascending by pos. Array.prototype.sort is stable in V8 (TC39).
  const sorted = [...elements].sort((a, b) => a.pos - b.pos)

  const gaps: number[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1].pos - (sorted[i].pos + sorted[i].size)
    if (gap < 0) return null // overlap → no spacing match
    gaps.push(gap)
  }

  const first = gaps[0]
  for (const g of gaps) {
    if (Math.abs(g - first) > epsilon) return null
  }

  const segments = gaps.map((_, i) => ({
    from: sorted[i].pos + sorted[i].size,
    to: sorted[i + 1].pos,
  }))

  return {
    gapSize: first,
    segments,
    elementIds: sorted.map((e) => e.id),
  }
}
