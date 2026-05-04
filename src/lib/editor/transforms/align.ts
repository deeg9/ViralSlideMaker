/**
 * Phase 63 (ALIGN-01..05, ALIGN-09, ALIGN-10): Pure align + distribute
 * transforms for the Floating Alignment Toolbar (Plan 63-02) and the
 * Cmd+Alt+H/V keyboard shortcuts (Plan 63-02).
 *
 * Pure module. No React. No DOM. No I/O. Reusable from server, RPC, and
 * future MCP `edit_slide` tools. Mirrors selection-bounds.ts and
 * text-box-adapter.ts pure-module conventions.
 *
 * Behavior contract:
 *   - alignElements(slide, ids, axis, target):
 *       - target='canvas' → 1080×1920 canvas rect (% units: 0/0/100/100).
 *       - target='selection' → computeSelectionBounds() union AABB.
 *       - Returns AlignPatch[] — one entry per MOVABLE candidate (locked +
 *         watermark + structural-anchor TextBoxes filtered OUT).
 *       - Every output x/y is integer-rounded (Math.round) — ALIGN-09.
 *       - Locked-include-bounds-not-move (ALIGN-10) is honored at THIS
 *         layer; reducer is defense-in-depth.
 *
 *   - distributeElements(slide, ids, axis):
 *       - ids.length < 3 → [] (ALIGN-06 conservative pure-fn enforcement;
 *         the toolbar disables distribute buttons at N<3 in Plan 63-02).
 *       - Sorts movable candidates by axis.
 *       - Pins outermost two; computes equal-gap math for inner candidates.
 *       - Gap-based equal spacing (Figma + Sketch + Canva consensus —
 *         PITFALL-4.6).
 *
 * PITFALLs honored:
 *   - PITFALL-4.4 (integer position drift): every numeric output passes
 *     through Math.round at the boundary of this module.
 *   - PITFALL-4.6 (gap-based vs midpoint distribute): we use the gap
 *     model — total_inner_span = (last.end - first.start) - sum(sizes);
 *     gap = total_inner_span / (N - 1). Mid-point distribute would push
 *     visually-uneven results when sizes differ.
 *
 * REQs covered:
 *   - ALIGN-01: 6-axis alignment ✓ (data layer; keyboard wiring is Plan 63-02)
 *   - ALIGN-02: Alt+A/H/D/W/V/S keyboard map (data layer; wiring 63-02)
 *   - ALIGN-03: N=1→canvas, N≥2→selection ✓
 *   - ALIGN-04: distribute horizontal/vertical ✓
 *   - ALIGN-05: gap-based equal spacing ✓
 *   - ALIGN-08: single pushHistory per dispatch (reducer responsibility — Plan 63-01 Task 3)
 *   - ALIGN-09: integer rounding ✓
 *   - ALIGN-10: locked included in bounds, excluded from move ✓
 */

import type { Slide } from '@/lib/types/slide'
import { computeSelectionBounds, type AABB } from './selection-bounds'

export type AlignAxis =
  | 'left'
  | 'center-h'
  | 'right'
  | 'top'
  | 'center-v'
  | 'bottom'

export type AlignTarget = 'canvas' | 'selection'

export type DistributeAxis = 'horizontal' | 'vertical'

export interface AlignPatch {
  id: string
  patch: { x?: number; y?: number }
}

/**
 * 1080×1920 canvas bounds in % units. The schema stores positions as
 * percentages of the reference canvas (REF_WIDTH=1080, REF_HEIGHT=1920);
 * canvas-target alignment is therefore the unit square scaled to %.
 */
const CANVAS_BOUNDS: AABB = { x: 0, y: 0, width: 100, height: 100 }

/** Internal candidate type — represents a movable element in % units. */
interface MoveCandidate {
  id: string
  x: number
  y: number
  width: number
  height: number
}

/**
 * Build the move-candidate list. Filters honored (mirrors BULK_TRANSLATE
 * skip rules at editor-reducer.ts:306-352):
 *   - Skip if id not in `ids` set.
 *   - Skip if `locked === true` (ALIGN-10 move exclusion).
 *   - Skip the watermark entirely (Watermark.position is enum-only;
 *     freeform translation requires a future schema extension — Phase 64+).
 *   - Skip TextBoxes with `position.anchor !== 'custom'` (no x/y to mutate;
 *     Phase 60 BULK_TRANSLATE skip rule preserved).
 */
function buildMoveCandidates(slide: Slide, ids: string[]): MoveCandidate[] {
  const idSet = new Set(ids)
  const out: MoveCandidate[] = []

  for (const tb of slide.text_boxes ?? []) {
    if (!idSet.has(tb.id)) continue
    if (tb.locked === true) continue
    if (tb.position.anchor !== 'custom') continue
    out.push({
      id: tb.id,
      x: tb.position.x ?? 0,
      y: tb.position.y ?? 0,
      width: tb.position.width ?? 60,
      // Phase 60 known gap: structural height resolution is a Phase 64 task.
      // For custom-anchor TextBoxes we treat height as 0 (vertical alignment
      // collapses to "align top edge"). This matches selection-bounds.ts.
      height: 0,
    })
  }

  for (const ci of slide.custom_images ?? []) {
    if (!idSet.has(ci.id)) continue
    if (ci.locked === true) continue
    out.push({ id: ci.id, x: ci.x, y: ci.y, width: ci.width, height: ci.height })
  }

  // Phase 68 Plan 02 (EDITOR-06): decorations branch. Decoration position is a
  // 4-tuple {x, y, width, height} of % numbers (mirrors CustomImage layout
  // semantics). Locked decorations are EXCLUDED from move candidates per
  // ALIGN-10 + Phase 64 LOCK-04 (locked elements participate in selection
  // bounds — see selection-bounds.ts — but never receive an alignment patch).
  for (const d of slide.decorations ?? []) {
    if (!idSet.has(d.id)) continue
    if (d.locked === true) continue
    out.push({
      id: d.id,
      x: d.position.x,
      y: d.position.y,
      width: d.position.width,
      height: d.position.height,
    })
  }

  // Watermark deliberately not added — enum-only position cannot be patched.

  return out
}

/**
 * Align every movable element in `ids` to either the canvas (1080×1920) or
 * the selection union AABB.
 *
 * Returns AlignPatch[] — one entry per MOVABLE candidate. Empty when no
 * movable candidates resolve (e.g. all-locked selection, only-watermark
 * selection, only structural-anchor selection, or empty ids).
 *
 * Integer-rounded on every output (ALIGN-09 / PITFALL-4.4).
 */
export function alignElements(
  slide: Slide,
  ids: string[],
  axis: AlignAxis,
  target: AlignTarget,
): AlignPatch[] {
  if (ids.length === 0) return []

  // Resolve target rect:
  //   target='canvas' → fixed 0/0/100/100 (1080×1920 reference)
  //   target='selection' → union AABB across all ids (locked + watermark
  //     INCLUDED per Phase 63 D-01 / ALIGN-10 read side)
  let rect: AABB
  if (target === 'canvas') {
    rect = CANVAS_BOUNDS
  } else {
    const bounds = computeSelectionBounds(slide, ids)
    if (bounds === null) return []
    rect = bounds
  }

  const candidates = buildMoveCandidates(slide, ids)
  if (candidates.length === 0) return []

  const patches: AlignPatch[] = []
  for (const cand of candidates) {
    const patch: { x?: number; y?: number } = {}
    switch (axis) {
      case 'left':
        patch.x = Math.round(rect.x)
        break
      case 'center-h':
        patch.x = Math.round(rect.x + rect.width / 2 - cand.width / 2)
        break
      case 'right':
        patch.x = Math.round(rect.x + rect.width - cand.width)
        break
      case 'top':
        patch.y = Math.round(rect.y)
        break
      case 'center-v':
        patch.y = Math.round(rect.y + rect.height / 2 - cand.height / 2)
        break
      case 'bottom':
        patch.y = Math.round(rect.y + rect.height - cand.height)
        break
    }
    patches.push({ id: cand.id, patch })
  }
  return patches
}

/**
 * Distribute the inner elements of `ids` along `axis` so all gaps between
 * adjacent (sorted) candidates are equal. The outermost two candidates
 * are pinned in place (no patch entry produced for them).
 *
 * Gap-based equal spacing (PITFALL-4.6): Figma + Sketch + Canva consensus.
 *   total_inner_span = (last.end - first.start) - sum(sizes)
 *   gap = total_inner_span / (N - 1)
 *   inner_i.position = first.start + sum(prev_sizes) + gap * i
 *
 * N<3 → returns [] (no-op signal — ALIGN-06).
 *
 * Integer-rounded on every output (ALIGN-09).
 */
export function distributeElements(
  slide: Slide,
  ids: string[],
  axis: DistributeAxis,
): AlignPatch[] {
  if (ids.length < 3) return []

  const candidates = buildMoveCandidates(slide, ids)
  if (candidates.length < 3) return []

  // Sort by axis. Horizontal → ascending x; vertical → ascending y.
  const sorted = [...candidates].sort((a, b) =>
    axis === 'horizontal' ? a.x - b.x : a.y - b.y,
  )

  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const isHorizontal = axis === 'horizontal'

  const sumSizes = sorted.reduce(
    (acc, c) => acc + (isHorizontal ? c.width : c.height),
    0,
  )
  const totalSpan =
    (isHorizontal ? last.x + last.width : last.y + last.height) -
    (isHorizontal ? first.x : first.y)
  const totalInnerSpan = totalSpan - sumSizes
  const gap = totalInnerSpan / (sorted.length - 1)

  const patches: AlignPatch[] = []
  // Walk inner candidates (i=1..n-2). Each inner element's start position
  // is first.start + (sum of preceding sizes) + (i * gap).
  let cursor = isHorizontal ? first.x + first.width : first.y + first.height
  for (let i = 1; i < sorted.length - 1; i++) {
    const cand = sorted[i]
    const newPos = Math.round(cursor + gap)
    if (isHorizontal) {
      patches.push({ id: cand.id, patch: { x: newPos } })
      cursor = newPos + cand.width
    } else {
      patches.push({ id: cand.id, patch: { y: newPos } })
      cursor = newPos + cand.height
    }
  }
  return patches
}
