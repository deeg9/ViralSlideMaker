'use client'

/**
 * Phase 61 (SEL-05): Marquee rectangle overlay rendered during drag-select.
 *
 * Render-only — owns NO state. Plan 61-02 owns the selecto event handlers
 * and passes the current rect (or null) as a prop. Single absolute-
 * positioned div with dashed cyan border + translucent fill +
 * pointer-events:none so clicks pass through to elements (PITFALLS Cat-2.5).
 *
 * TPLREND-05 invariant (PARITY-01): structurally inside editable={true}
 * branch in slide-preview.tsx. This component itself does NOT gate on
 * editable — the consumer (Plan 61-02) is responsible for placing it
 * inside the editable JSX after the early-return at slide-preview.tsx:665.
 * Plan 61-02 extends parity.test.tsx with a marquee fixture proving
 * editable=false never renders this testid.
 *
 * Coordinate convention: rect is in scaled-canvas pixels (selecto's native
 * coord output). The overlay sits inside the same scaled wrapper as the
 * elements, so px coords align (PITFALL-5.3 carry-forward).
 */

export interface MarqueeRect {
  x: number
  y: number
  w: number
  h: number
}

export interface MarqueeOverlayProps {
  rect: MarqueeRect | null
}

export function MarqueeOverlay({ rect }: MarqueeOverlayProps) {
  if (!rect) return null
  return (
    <div
      data-testid="marquee-overlay"
      style={{
        position: 'absolute',
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.w}px`,
        height: `${rect.h}px`,
        border: '1px dashed rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        pointerEvents: 'none',
        zIndex: 60,
      }}
    />
  )
}

export default MarqueeOverlay
