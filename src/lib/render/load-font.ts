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
 * Phase 12 (Font Picker) will replace all template fonts with Google Fonts equivalents.
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
