// Phase 61 (SEL-05): element-vs-rect intersection for marquee selection.
// Pure module — no React, no use-client directive, no DOM access.
//
// Coordinate space: rect.{x, y, w, h} are percentages of REF_WIDTH (1080) ×
// REF_HEIGHT (1920), matching the same coord space CustomImage.{x, y, w, h}
// and TextBox.position.{x, y, width} use. Plan 61-02 converts selecto's
// pixel coords to % BEFORE calling this helper.
//
// Intersect mode (Figma default; CONTEXT.md decisions; selecto hitRate=0):
// any overlap counts — even 1px. NON-overlap requires strict separation
// on at least one axis.
//
// Conservative scope (mirrors Plan 60-05 selection-bounds.ts):
//   - SKIP watermark — Watermark.position is enum, not freeform tuple.
//     Phase 62/63 may revisit if freeform watermark positioning becomes
//     a user requirement.
//   - SKIP structural-anchor TextBoxes (role !== 'custom' OR
//     position.anchor !== 'custom'). Hook/body have no x/y; height
//     resolution requires DOM ref. Phase 63 alignment will lift that.
//   - INCLUDE locked elements in Phase 61 (Phase 64 ships locked
//     semantics; for Phase 61, marquee includes them — no UX consequence
//     yet per CONTEXT.md domain.out_of_scope).
//
// TextBox height approximation: TextBox in our schema does NOT carry an
// explicit height — it's text-driven via DOM ref. Pure modules cannot
// resolve DOM-derived heights, so we use a 1-px-strip approximation
// (height = 1) at the TextBox's y-coordinate. Phase 63 alignment will
// replace this with a proper height resolver shared with selection-bounds.

import type { Slide } from '@/lib/types/slide'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function elementsInRect(slide: Slide, rect: Rect): string[] {
  if (rect.w <= 0 || rect.h <= 0) return []

  const ids: string[] = []

  // Walk in slide source order so result is stable for tests + downstream.
  for (const tb of slide.text_boxes ?? []) {
    if (tb.role !== 'custom') continue
    const p = tb.position ?? { anchor: 'custom' }
    if (p.anchor !== 'custom') continue
    if (
      typeof p.x !== 'number' ||
      typeof p.y !== 'number' ||
      typeof p.width !== 'number'
    ) {
      continue
    }
    // 1-px-strip approximation — see module header.
    if (intersects({ x: p.x, y: p.y, w: p.width, h: 1 }, rect)) {
      ids.push(tb.id)
    }
  }

  for (const ci of slide.custom_images ?? []) {
    if (
      typeof ci.x !== 'number' ||
      typeof ci.y !== 'number' ||
      typeof ci.width !== 'number' ||
      typeof ci.height !== 'number'
    ) {
      continue
    }
    if (
      intersects({ x: ci.x, y: ci.y, w: ci.width, h: ci.height }, rect)
    ) {
      ids.push(ci.id)
    }
  }

  // watermark: deliberately skipped — see module header.

  return ids
}

function intersects(a: Rect, b: Rect): boolean {
  // hitRate=0 (any overlap, including 1px). Strict separation on either
  // axis = no overlap.
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  )
}
