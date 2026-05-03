/**
 * Phase 60 (SEL-13): Pure union-AABB computation for the multi-select ring.
 *
 * No React or DOM. Reusable from any layer (server, RPC, future MCP tool).
 * Mirrors text-box-adapter.ts pure-module convention.
 *
 * Phase 60 known gaps (TODO when later phases revisit):
 *  - Structural-anchor TextBoxes (anchor !== 'custom') are SKIPPED — height
 *    resolution requires DOM ref via the rendered-height observer pattern at
 *    slide-preview.tsx:589-637. Phase 63 (alignment) will lift that into a
 *    shared helper.
 *  - Watermarks are SKIPPED — size is computed by resolveWatermark /
 *    resolveForcedWatermark at render time. Phase 62/63 revisit.
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
 * Compute the union axis-aligned bounding box (in canvas %) for the given
 * selection ids on a slide.
 *
 * Returns `null` when:
 *   - `ids` is empty
 *   - none of `ids` resolve to a contributing element on the slide
 *
 * Phase 60 conservative behavior (see header):
 *   - Skip TextBoxes with `position.anchor !== 'custom'` (no x/y to resolve).
 *   - Skip the watermark (enum-only position; resolveWatermark owns size).
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
    if (tb.position.anchor !== 'custom') continue // Phase 60 known gap (see header)
    rects.push({
      x: tb.position.x ?? 0,
      y: tb.position.y ?? 0,
      width: tb.position.width ?? 60,
      height: 0, // Phase 60 known gap — DOM-ref-based resolution lands later
    })
  }

  for (const ci of slide.custom_images ?? []) {
    if (!idSet.has(ci.id)) continue
    rects.push({ x: ci.x, y: ci.y, width: ci.width, height: ci.height })
  }

  // Watermark intentionally skipped — see header comment.

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
