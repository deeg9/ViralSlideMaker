// Phase 64 Plan 03 (ZORDER-01..07): pure z-order transforms.
//
// Pure module — no React, no use-client directive, no DOM access. Mirrors
// align.ts / selection-bounds.ts / element-rect-intersect.ts purity invariants.
// Reusable from server, RPC, and future MCP `edit_slide` tools.
//
// ZORDER-05 (Satori parity invariant): z-order is implemented EXCLUSIVELY
// via array splice. NEVER the CSS layering property (vercel/satori#41 —
// Satori has no support for it; render order = DOM order = JSX order =
// array order at line 97 render-slide-satori.tsx). Adding a `z` field
// would create two synchronization sources of truth (array order + z
// field) — a recipe for drift between the React preview and the Satori
// PNG export.
//
// ZORDER-06 (Figma multi-selection model): each selected element moves
// +1 / -1 individually with array-bound clamping. Sort discipline below
// prevents adjacent-selected elements from clobbering each other.
//
// ZORDER-07 (within-array only): operates within ONE element-type array
// (text_boxes OR custom_images). The reducer routes per-scope and dispatches
// separate calls — cross-array reorder is deferred to v3.0+ schema
// unification (CONTEXT.md domain.out_of_scope).

export type ZOrderOp = 'forward' | 'backward' | 'front' | 'back'

/**
 * Apply a z-order op to a single element-type array.
 *
 * Sort discipline (Figma multi-selection model — ZORDER-06):
 *   - 'forward' / 'front' → sort selected indices DESC (move topmost first
 *      so an adjacent-selected window doesn't get clobbered).
 *   - 'backward' / 'back' → sort selected indices ASC (move bottommost first).
 *
 * Adjacent-selected guard: forward / backward swaps are skipped when the
 * neighbor is also selected — keeps adjacent-selected windows intact (a
 * group already at the top doesn't shift; a group already at the bottom
 * doesn't shift). PITFALL-6.3 / ZA4 / ZA8 / ZA15.
 *
 * Front / back are unconditional moves (within bounds). DESC sort for front
 * and ASC sort for back ensure the order among the selected group is
 * preserved when they all move to the same edge.
 *
 * @returns A new array if anything changed; the SAME reference (===) if
 *          nothing moved (ref-equal short-circuit so callers can short-
 *          circuit at the reducer).
 */
export function applyZOrderToArray<T extends { id: string }>(
  arr: T[],
  selectedIds: Set<string>,
  op: ZOrderOp,
): T[] {
  if (arr.length === 0 || selectedIds.size === 0) return arr

  // Build the iteration order over the original array, sorted by ORIGINAL
  // index per the sort discipline above.
  const desc = op === 'forward' || op === 'front'
  const iterIds: string[] = arr
    .map((el, i) => ({ id: el.id, i }))
    .filter(({ id }) => selectedIds.has(id))
    .sort((a, b) => (desc ? b.i - a.i : a.i - b.i))
    .map(({ id }) => id)

  if (iterIds.length === 0) return arr

  const next = arr.slice()
  let changed = false

  // Helper: re-resolve current index after prior iterations may have shifted
  // elements. O(N) per lookup; algorithm is O(N²) worst-case. N ≤ 30 per
  // research budget — sub-1ms even at the ceiling.
  const idxOf = (id: string): number => next.findIndex((el) => el.id === id)

  for (const id of iterIds) {
    const i = idxOf(id)
    if (i === -1) continue

    if (op === 'forward') {
      // Swap with neighbor at i+1 ONLY if it's not also selected (ZORDER-06
      // adjacent-selected window stays intact — Figma model PITFALL-6.3).
      if (i < next.length - 1 && !selectedIds.has(next[i + 1].id)) {
        ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
        changed = true
      }
    } else if (op === 'backward') {
      if (i > 0 && !selectedIds.has(next[i - 1].id)) {
        ;[next[i], next[i - 1]] = [next[i - 1], next[i]]
        changed = true
      }
    } else if (op === 'front') {
      // Splice + push to end. DESC iteration order ensures intra-selected
      // ordering is preserved (the highest-original-idx ends up topmost).
      if (i < next.length - 1) {
        const [el] = next.splice(i, 1)
        next.push(el)
        changed = true
      }
    } else if (op === 'back') {
      // Splice + unshift. ASC iteration order ensures intra-selected
      // ordering is preserved (the lowest-original-idx ends up bottommost).
      if (i > 0) {
        const [el] = next.splice(i, 1)
        next.unshift(el)
        changed = true
      }
    }
  }

  return changed ? next : arr
}
