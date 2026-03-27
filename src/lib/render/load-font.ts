import type { Slide } from '../types/slide'
import type { SlideTemplate } from './templates'
import { resolveSlideStyles } from './resolve-styles'
import { getFontEntry } from '../fonts/font-catalog'

// Map of "fontName:weight:style" -> ArrayBuffer
const fontCache = new Map<string, ArrayBuffer>()

/**
 * Extract the raw font name from a CSS font-family string.
 * "'Inter', sans-serif" -> "Inter"
 * "'Georgia', serif" -> "Georgia"
 */
export function extractFontName(cssFontFamily: string): string {
  const match = cssFontFamily.match(/'([^']+)'/)
  return match ? match[1] : 'Inter'
}

/**
 * Fetch a single TTF font file from Google Fonts as an ArrayBuffer.
 * Uses User-Agent trick to get TTF format (not woff2).
 * Caches in memory keyed by "name:weight:style".
 */
async function fetchFontBuffer(
  fontName: string,
  weight: number,
  style: 'normal' | 'italic'
): Promise<ArrayBuffer> {
  const cacheKey = `${fontName}:${weight}:${style}`
  const cached = fontCache.get(cacheKey)
  if (cached) return cached

  const italParam = style === 'italic' ? '1' : '0'
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:ital,wght@${italParam},${weight}&display=swap`

  // Request with a User-Agent that triggers TTF response (not woff2)
  const cssRes = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0)' },
  })
  const cssText = await cssRes.text()

  // Extract the .ttf URL from the @font-face CSS
  const ttfMatch = cssText.match(/src:\s*url\(([^)]+)\)/)
  if (!ttfMatch) {
    throw new Error(`Could not extract font URL for ${fontName} ${weight} ${style}`)
  }

  const fontRes = await fetch(ttfMatch[1])
  const buffer = await fontRes.arrayBuffer()
  fontCache.set(cacheKey, buffer)
  return buffer
}

/**
 * Load all font buffers needed for a slide's template font.
 * Returns an array suitable for ImageResponse `fonts` option.
 * Loads weights 400, 700, 900 in normal style (covers hook weight 900, body weight 400).
 *
 * Note: Georgia is a system font not available on Google Fonts.
 * Templates using Georgia fall back to Inter for Satori rendering.
 *
 * @deprecated Prefer loadFontBuffersForSlide() which loads per-slide font overrides.
 */
type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900

export async function loadFontBuffers(
  cssFontFamily: string
): Promise<Array<{ name: string; data: ArrayBuffer; weight: FontWeight; style: 'normal' | 'italic' }>> {
  const fontName = extractFontName(cssFontFamily)

  // Georgia is a system font with no Google Fonts TTF -- use Inter as fallback for Satori
  const isGoogleFont = !['Georgia', 'Times New Roman', 'Arial', 'Helvetica'].includes(fontName)
  const actualFontName = isGoogleFont ? fontName : 'Inter'

  const variants: Array<{ weight: FontWeight; style: 'normal' | 'italic' }> = [
    { weight: 400, style: 'normal' },
    { weight: 700, style: 'normal' },
    { weight: 900, style: 'normal' },
    { weight: 400, style: 'italic' },
    { weight: 700, style: 'italic' },
  ]

  const results = await Promise.all(
    variants.map(async (v) => {
      try {
        const data = await fetchFontBuffer(actualFontName, v.weight, v.style)
        return { name: actualFontName, data, weight: v.weight as FontWeight, style: v.style as 'normal' | 'italic' }
      } catch {
        // If a specific weight fails (e.g., font has no 900), skip it
        return null
      }
    })
  )

  return results.filter((r): r is NonNullable<typeof r> => r !== null)
}

/**
 * Load font buffers for a specific slide, using resolved font families.
 * Loads only the variants that actually exist per the font catalog.
 * Falls back to default variant set for fonts not in the catalog.
 */
export async function loadFontBuffersForSlide(
  slide: Slide,
  template: SlideTemplate
): Promise<Array<{ name: string; data: ArrayBuffer; weight: FontWeight; style: 'normal' | 'italic' }>> {
  const styles = resolveSlideStyles(slide, template)

  const hookFontName = extractFontName(styles.hookFontFamily)
  const bodyFontName = extractFontName(styles.bodyFontFamily)

  // Collect unique font names (hook and body may be the same)
  const uniqueFonts = new Set([hookFontName, bodyFontName])

  // System fonts that need fallback to Inter
  const systemFonts = ['Georgia', 'Times New Roman', 'Arial', 'Helvetica']

  const allResults: Array<{ name: string; data: ArrayBuffer; weight: FontWeight; style: 'normal' | 'italic' }> = []

  for (const fontName of uniqueFonts) {
    const actualFontName = systemFonts.includes(fontName) ? 'Inter' : fontName
    const entry = getFontEntry(actualFontName)

    // Use catalog variants if available, otherwise fall back to default set
    const variants: Array<{ weight: FontWeight; style: 'normal' | 'italic' }> = entry
      ? entry.variants.map(v => ({ weight: v.weight as FontWeight, style: v.style }))
      : [
          { weight: 400 as FontWeight, style: 'normal' as const },
          { weight: 700 as FontWeight, style: 'normal' as const },
          { weight: 900 as FontWeight, style: 'normal' as const },
          { weight: 400 as FontWeight, style: 'italic' as const },
          { weight: 700 as FontWeight, style: 'italic' as const },
        ]

    const results = await Promise.all(
      variants.map(async (v) => {
        try {
          const data = await fetchFontBuffer(actualFontName, v.weight, v.style)
          return { name: actualFontName, data, weight: v.weight, style: v.style }
        } catch {
          return null
        }
      })
    )

    for (const r of results) {
      if (r) allResults.push(r)
    }
  }

  return allResults
}
