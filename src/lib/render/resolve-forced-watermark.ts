/**
 * Forced free-tier watermark resolver (260427-wmk).
 *
 * Pure function shared by the live editor preview, the Satori PNG renderer,
 * and the ZIP download path. Returns null when the watermark must NOT render.
 *
 * Tier behavior (quick-260502-er5):
 *   - free: ALWAYS renders ViralSlideMaker mark (free tier opt-out is locked)
 *   - paid (plus/pro) + slide.style_overrides.watermark.enabled === true:
 *       renders ViralSlideMaker mark (paid users opt in to viral attribution)
 *   - paid + slide.style_overrides.watermark.customLogoUrl set:
 *       renders custom logo + optional customText (paid users brand their own)
 *   - paid + no watermark config: returns null (current default behavior)
 *
 * Coordinate convention: returned values are in canvas pixels using the
 * supplied canvas dimensions (default 1080x1920). Callers that render in a
 * scaled container can scale (x, y, logoSize, fontSize, gap) uniformly via CSS.
 */

import type { Slide } from '../types/slide'

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

// Approximate per-character advance for the watermark text. Used to compute
// `x` for bottom-right placement — Satori doesn't honor `right` CSS, so we
// have to position from the left after estimating text width. Tweaked to err
// on the side of slightly more left-margin (text never clips off-screen).
const TEXT_ADVANCE_FRAC = 0.55

export function resolveForcedWatermark(
  tier: ForcedWatermarkTier | null | undefined,
  canvas: { width: number; height: number } = { width: 1080, height: 1920 },
  slide?: Slide,
): ResolvedForcedWatermark | null {
  const wmConfig = slide?.style_overrides?.watermark
  const isFree = tier === 'free'
  const isPaid = tier === 'plus' || tier === 'pro'

  // Decide whether to render at all.
  // Free tier: always renders, ignoring `enabled: false`.
  // Paid tier: renders only when explicitly enabled OR custom logo provided.
  let renders = false
  if (isFree) {
    renders = true
  } else if (isPaid) {
    renders = wmConfig?.enabled === true || !!wmConfig?.customLogoUrl
  }
  if (!renders) return null

  // Decide content. Free tier always shows ViralSlideMaker mark — paid users
  // can override with custom logo/text.
  const useCustom = isPaid && !!wmConfig?.customLogoUrl
  const logoUrl = useCustom ? (wmConfig!.customLogoUrl as string) : '/logo.png'
  const text = useCustom
    ? (wmConfig!.customText ?? '')
    : 'ViralSlideMaker.com'

  const margin = canvas.width * SAFE_MARGIN_FRAC
  const logoSize = Math.round(canvas.width * LOGO_SIZE_FRAC)
  const fontSize = Math.round(canvas.width * FONT_SIZE_FRAC)
  const gap = Math.round(canvas.width * GAP_FRAC)

  // Position: free tier locked to bottom-left; paid tier honors override.
  const position = isPaid ? (wmConfig?.position ?? 'bottom-left') : 'bottom-left'

  let x: number
  if (position === 'bottom-right') {
    // Estimate full mark width (logo + gap + text) and right-align.
    const textWidth = Math.round(fontSize * TEXT_ADVANCE_FRAC * text.length)
    const markWidth = logoSize + (text ? gap + textWidth : 0)
    x = canvas.width - margin - markWidth
  } else {
    x = margin
  }
  const y = canvas.height - margin - logoSize

  return {
    logoUrl,
    text,
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
