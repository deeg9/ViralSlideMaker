/**
 * Brand-kit watermark resolver (260427-hut).
 *
 * Pure function shared by the live editor preview, the Satori PNG renderer,
 * and the ZIP download path. Returns null when the watermark must not render
 * (no brand kit, no logo, no global position, or per-slide hide toggle).
 *
 * Coordinate convention: returned values are in canvas pixels using the
 * supplied canvas dimensions (default 1080x1920). Callers that render in a
 * scaled container can scale (x, y, width) uniformly.
 */

export type LogoPositionKey =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

export interface ResolvedWatermark {
  url: string
  x: number       // px from left
  y: number       // px from top
  width: number   // px
  height?: number // optional, intrinsic if omitted (we return square approx for placement)
  opacity: number // 0–1
}

interface BrandKitSubset {
  logo_url?: string | null
  logo_position?: string | null
  logo_size_pct?: number | null
  logo_opacity_pct?: number | null
}

interface SlideSubset {
  style_overrides?: { hide_watermark?: boolean } | null
}

interface CanvasSize {
  width: number
  height: number
}

const ALLOWED_POSITIONS: ReadonlySet<LogoPositionKey> = new Set([
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right',
])

const SAFE_MARGIN_FRAC = 0.04 // 4% safe margin from each edge

export function resolveWatermark(
  brandKit: BrandKitSubset | null | undefined,
  slide: SlideSubset | null | undefined,
  canvas: CanvasSize = { width: 1080, height: 1920 }
): ResolvedWatermark | null {
  // Short-circuit gates (in declared order).
  if (!brandKit) return null
  const url = brandKit.logo_url
  if (!url) return null
  const positionRaw = brandKit.logo_position
  if (!positionRaw) return null
  if (!ALLOWED_POSITIONS.has(positionRaw as LogoPositionKey)) return null
  if (slide?.style_overrides?.hide_watermark === true) return null

  const position = positionRaw as LogoPositionKey
  const sizePct = brandKit.logo_size_pct ?? 10
  const opacityPct = brandKit.logo_opacity_pct ?? 60

  const width = canvas.width * (sizePct / 100)
  const height = width // square approximation for placement bounds
  const opacity = opacityPct / 100
  const margin = canvas.width * SAFE_MARGIN_FRAC

  const [vBand, hBand] = position.split('-') as [
    'top' | 'middle' | 'bottom',
    'left' | 'center' | 'right',
  ]

  const x =
    hBand === 'left'
      ? margin
      : hBand === 'center'
        ? (canvas.width - width) / 2
        : canvas.width - margin - width

  const y =
    vBand === 'top'
      ? margin
      : vBand === 'middle'
        ? (canvas.height - height) / 2
        : canvas.height - margin - height

  return { url, x, y, width, height, opacity }
}
