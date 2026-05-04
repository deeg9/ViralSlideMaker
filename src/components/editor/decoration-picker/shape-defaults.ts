/**
 * SHAPES-01 (Phase 70 Plan 01 Task 3): default ShapeDecoration factory.
 *
 * Single source of truth for "what does a brand-new shape decoration look
 * like when a user clicks an Insert tile" — consumed by:
 *   - ShapePicker (this plan)            : 8-tile grid click handler
 *   - R/C/L direct-insert (Plan 70-03)   : keyboard shortcut path (KBD-10)
 *   - DecorationCard (Plan 70-04)        : reset-to-defaults baseline
 *
 * Position semantics: the `center` is in canvas-percent coordinates (0..100),
 * mirroring DecorationBase.position. Default center is the slide's geometric
 * center (50, 50). When clamping pushes the bounding box past a canvas edge
 * the box is clamped to [0, 100 - size] — never negative, never past 100.
 *
 * Color: brand primary `#3D0000` is the default fill (matches the v2.9 brand
 * palette swatch[0]). Stroke is omitted by default — a stroke is opt-in via
 * Plan 70-04 DecorationCard's stroke control.
 *
 * NEVER returns 'currentColor', CSS named colors, or CSS variables — always
 * an explicit 6-digit hex string per Phase 67 PCL12 contract.
 */
import type { ShapeDecoration, ShapeKind } from '@/lib/types/decoration'

/** Brand primary; matches v2.9 color-swatches.ts COLOR_SWATCHES[0]. */
export const DEFAULT_SHAPE_FILL = '#3D0000'

/** Default bounding box for closed shapes (rect/circle/ellipse/triangle/polygon/star/arrow). */
export const DEFAULT_SHAPE_SIZE_PCT = { width: 20, height: 20 } as const

/**
 * Lines need a non-zero bounding box (PITFALLS I.1: zero height ⇒ undetectable
 * hitbox). 30%×4% gives a horizontal line with enough vertical room to be
 * easy to grab on the canvas.
 */
export const DEFAULT_LINE_SIZE_PCT = { width: 30, height: 4 } as const

interface BuildOpts {
  /** Slide-percent center (0..100). Defaults to slide geometric center (50,50). */
  center?: { x: number; y: number }
  /**
   * Vertex / point count for polygon (5/6/8) and star (5/6) shapeKinds. Plan
   * 70-04 SHAPES-07 owns the runtime enum (DecorationCard control); the
   * picker's polygon/star tiles default to 5. Other shapeKinds ignore this.
   */
  points?: number
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value))
}

/**
 * Build a brand-new ShapeDecoration with sensible defaults. The returned id
 * is freshly minted via `crypto.randomUUID()` per call — never reuse one.
 */
export function buildDefaultShapeDecoration(
  shapeKind: ShapeKind,
  opts?: BuildOpts,
): ShapeDecoration {
  const center = opts?.center ?? { x: 50, y: 50 }
  const size = shapeKind === 'line' ? DEFAULT_LINE_SIZE_PCT : DEFAULT_SHAPE_SIZE_PCT

  const x = clamp(center.x - size.width / 2, 0, 100 - size.width)
  const y = clamp(center.y - size.height / 2, 0, 100 - size.height)

  const decoration: ShapeDecoration = {
    id: crypto.randomUUID(),
    kind: 'shape',
    shapeKind,
    position: { x, y, width: size.width, height: size.height },
    fill: DEFAULT_SHAPE_FILL,
    opacity: 1,
  }

  if (shapeKind === 'polygon') {
    decoration.points = opts?.points ?? 5
  } else if (shapeKind === 'star') {
    decoration.points = opts?.points ?? 5
  } else if (shapeKind === 'rect') {
    decoration.cornerRadius = 0
  }

  return decoration
}
