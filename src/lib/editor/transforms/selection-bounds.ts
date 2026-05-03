/**
 * Phase 60 (SEL-13): Pure union-AABB computation for the multi-select ring.
 * Phase 63 D-01 (ALIGN-10 read side): EXTENDED to include locked elements
 * and the watermark in the union AABB. The MOVE-side filter (skip locked,
 * skip watermark) is the caller's job — see align.ts and the
 * ALIGN/DISTRIBUTE reducer cases.
 *
 * Phase 64 Plan 02 (LOCK-07): hidden elements (`hidden === true`) are
 * EXCLUDED from the union AABB so a hidden element does not pad the
 * alignment-target bounds. Hidden ≠ locked: locked is INCLUDED in bounds
 * (Phase 63 D-01 contract — alignment target uses visible footprint of every
 * selected element, locked still moves nothing on the move side); hidden is
 * NOT INCLUDED (the element is invisible — both renderers skip it — so it
 * has no rendered footprint to pad the AABB).
 *
 * No React or DOM. Reusable from any layer (server, RPC, future MCP tool).
 * Mirrors text-box-adapter.ts pure-module convention.
 *
 * Phase 63 closes Phase 60 known gaps #2 (watermark) and #3 (locked elements
 * documented "TBD" semantics). Watermark size is computed from a placeholder
 * rect (18% wide × 5% tall) anchored per the watermark.position enum
 * ('top-left' / 'bottom-left' / 'bottom-right'). True schema-derived
 * freeform watermark sizing is a Phase 64 task.
 *
 * Phase 60 known gap STILL OPEN:
 *  - Structural-anchor TextBoxes (anchor !== 'custom') are SKIPPED — height
 *    resolution requires DOM ref via the rendered-height observer pattern at
 *    slide-preview.tsx:589-637. Phase 64 lift target.
 */

import type { Slide } from '@/lib/types/slide'

export interface AABB {
  /** Percentage 0-100 of canvas width */
  x: number
  /** Percentage 0-100 of canvas height */
  y: number
  /** Percentage 0-100 of canvas width */
  width: number
  /** Percentage 0-100 of canvas height */
  height: number
}

/**
 * Phase 63 placeholder watermark size. Phase 64 lifts to schema-derived
 * freeform positioning when the watermark gains x/y/width/height. The 18%×5%
 * rect is a conservative match for the rendered watermark badge at the
 * 1080×1920 reference (~194×96 px); good enough for alignment-target bounds
 * without a render-time measurement.
 */
const WATERMARK_PLACEHOLDER_WIDTH = 18
const WATERMARK_PLACEHOLDER_HEIGHT = 5

function watermarkPlaceholderRect(
  position: 'top-left' | 'bottom-left' | 'bottom-right' | undefined,
): AABB {
  const w = WATERMARK_PLACEHOLDER_WIDTH
  const h = WATERMARK_PLACEHOLDER_HEIGHT
  switch (position) {
    case 'top-left':
      return { x: 0, y: 0, width: w, height: h }
    case 'bottom-left':
      return { x: 0, y: 100 - h, width: w, height: h }
    case 'bottom-right':
    default:
      // Default + explicit 'bottom-right'.
      return { x: 100 - w, y: 100 - h, width: w, height: h }
  }
}

/**
 * Compute the union axis-aligned bounding box (in canvas %) for the given
 * selection ids on a slide.
 *
 * Returns `null` when:
 *   - `ids` is empty
 *   - none of `ids` resolve to a contributing element on the slide
 *
 * Phase 63 D-01: locked + watermark are INCLUDED in the union AABB so
 * alignment-to-selection bounds is computed against the visible footprint
 * of every selected element. The MOVE side filters locked + watermark out
 * — see align.ts and reducer ALIGN/DISTRIBUTE cases.
 *
 * Phase 60 conservative behavior STILL HONORED:
 *   - Skip TextBoxes with `position.anchor !== 'custom'` (no x/y to resolve;
 *     DOM-ref height resolution is a Phase 64 task).
 */
export function computeSelectionBounds(
  slide: Slide,
  ids: string[],
): AABB | null {
  if (ids.length === 0) return null

  const idSet = new Set(ids)
  const rects: AABB[] = []

  for (const tb of slide.text_boxes ?? []) {
    if (!idSet.has(tb.id)) continue
    if (tb.hidden === true) continue // Phase 64 LOCK-07: hidden EXCLUDED
    if (tb.position.anchor !== 'custom') continue // Phase 64 lift target
    rects.push({
      x: tb.position.x ?? 0,
      y: tb.position.y ?? 0,
      width: tb.position.width ?? 60,
      height: 0, // Phase 64 lift target — DOM-ref-based resolution
    })
  }

  for (const ci of slide.custom_images ?? []) {
    if (!idSet.has(ci.id)) continue
    if (ci.hidden === true) continue // Phase 64 LOCK-07: hidden EXCLUDED
    // Phase 63 D-01: locked === true is INCLUDED in bounds. The reducer's
    // ALIGN / DISTRIBUTE / BULK_TRANSLATE move-side filter excludes locked
    // from translation; this read-side helper is uniform across lock state.
    rects.push({ x: ci.x, y: ci.y, width: ci.width, height: ci.height })
  }

  // Phase 63 D-01: watermark contributes a placeholder rect derived from
  // its position enum. Move-side filter is in align.ts + reducer.
  // Phase 64 LOCK-07: hidden watermark EXCLUDED (renderer skip is paired
  // with bounds skip; the two filters must agree to keep the alignment
  // target sane).
  if (
    slide.watermark &&
    idSet.has(slide.watermark.id) &&
    slide.watermark.hidden !== true
  ) {
    rects.push(watermarkPlaceholderRect(slide.watermark.position))
  }

  if (rects.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const r of rects) {
    if (r.x < minX) minX = r.x
    if (r.y < minY) minY = r.y
    const right = r.x + r.width
    const bottom = r.y + r.height
    if (right > maxX) maxX = right
    if (bottom > maxY) maxY = bottom
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
