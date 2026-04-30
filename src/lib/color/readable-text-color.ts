/**
 * Phase 50 (UI-REVIEW WARNING): pick a readable foreground (`#000` or `#fff`)
 * for text rendered on top of an arbitrary hex background. Keeps the contrast
 * ratio above ~4.5:1 for the common brand palette (e.g. `#3d0000` returns
 * `#fff`, `#ffeb3b` returns `#000`).
 *
 * Uses the WCAG relative-luminance formula. Accepts `#rgb`, `#rrggbb`, and
 * `#rrggbbaa`; falls back to `#fff` for anything unparseable so dark accents
 * never silently render dark text on dark fill.
 */
export function readableTextColor(bg: string): '#000' | '#fff' {
  const hex = parseHex(bg)
  if (!hex) return '#fff'
  const [r, g, b] = hex
  // Relative luminance per WCAG 2.x.
  const toLinear = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  // Threshold ~0.5 keeps mid-tone pinks readable as black text and dark
  // browns/reds readable as white text.
  return L > 0.5 ? '#000' : '#fff'
}

function parseHex(input: string): [number, number, number] | null {
  if (!input || typeof input !== 'string') return null
  let s = input.trim().replace(/^#/, '')
  if (s.length === 3) {
    s = s.split('').map((c) => c + c).join('')
  }
  if (s.length !== 6 && s.length !== 8) return null
  const r = parseInt(s.slice(0, 2), 16)
  const g = parseInt(s.slice(2, 4), 16)
  const b = parseInt(s.slice(4, 6), 16)
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null
  return [r, g, b]
}
