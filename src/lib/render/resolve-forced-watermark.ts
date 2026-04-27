/**
 * Forced free-tier watermark resolver (260427-wmk).
 *
 * Pure function shared by the live editor preview, the Satori PNG renderer,
 * and the ZIP download path. Returns null when the watermark must NOT render
 * (any tier other than 'free'). Free tier always renders — per-slide
 * hide_watermark is intentionally ignored (that flag belongs to the brand-kit
 * watermark in resolve-watermark.ts).
 *
 * Coordinate convention: returned values are in canvas pixels using the
 * supplied canvas dimensions (default 1080x1920). Callers that render in a
 * scaled container can scale (x, y, logoSize, fontSize, gap) uniformly via CSS.
 */

export type ForcedWatermarkTier = 'free' | 'plus' | 'pro'

export interface ResolvedForcedWatermark {
  logoUrl: string
  text: string
  x: number          // px from left to start of logo
  y: number          // px from top to start of logo
  logoSize: number   // px (square logo)
  fontSize: number   // px
  gap: number        // px between logo and text
  textColor: string
  textShadow: string
  opacity: number    // 0–1
}

const SAFE_MARGIN_FRAC = 0.04           // 4% safe margin from each edge
const LOGO_SIZE_FRAC = 0.045            // ~49 px on a 1080-wide canvas
const FONT_SIZE_FRAC = 0.022            // ~24 px on a 1080-wide canvas
const GAP_FRAC = 0.012                  // ~13 px between logo and text
const OPACITY = 0.55

export function resolveForcedWatermark(
  tier: ForcedWatermarkTier | null | undefined,
  canvas: { width: number; height: number } = { width: 1080, height: 1920 },
): ResolvedForcedWatermark | null {
  if (tier !== 'free') return null

  const margin = canvas.width * SAFE_MARGIN_FRAC
  const logoSize = Math.round(canvas.width * LOGO_SIZE_FRAC)
  const fontSize = Math.round(canvas.width * FONT_SIZE_FRAC)
  const gap = Math.round(canvas.width * GAP_FRAC)

  // Bottom-left placement. y aligns the logo's top edge so its bottom sits
  // (margin) above the canvas bottom.
  const x = margin
  const y = canvas.height - margin - logoSize

  return {
    logoUrl: '/logo.png',
    text: 'ViralSlideMaker.com',
    x,
    y,
    logoSize,
    fontSize,
    gap,
    textColor: '#ffffff',
    textShadow: '0px 2px 6px rgba(0,0,0,0.6)',
    opacity: OPACITY,
  }
}
