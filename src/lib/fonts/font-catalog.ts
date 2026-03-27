export interface FontEntry {
  family: string
  category: 'sans-serif' | 'serif' | 'display' | 'handwriting'
  variants: Array<{ weight: number; style: 'normal' | 'italic' }>
}

export const DEFAULT_FONT = 'Inter'

/**
 * Curated list of ~30 Google Fonts for the font picker.
 * Each entry lists only the variants actually available on Google Fonts.
 * Variants are used by load-font.ts to avoid requesting nonexistent weight/style combos.
 */
export const FONT_CATALOG: FontEntry[] = [
  // Sans-serif
  {
    family: 'Inter',
    category: 'sans-serif',
    variants: [
      { weight: 100, style: 'normal' }, { weight: 200, style: 'normal' },
      { weight: 300, style: 'normal' }, { weight: 400, style: 'normal' },
      { weight: 500, style: 'normal' }, { weight: 600, style: 'normal' },
      { weight: 700, style: 'normal' }, { weight: 800, style: 'normal' },
      { weight: 900, style: 'normal' },
      { weight: 100, style: 'italic' }, { weight: 200, style: 'italic' },
      { weight: 300, style: 'italic' }, { weight: 400, style: 'italic' },
      { weight: 500, style: 'italic' }, { weight: 600, style: 'italic' },
      { weight: 700, style: 'italic' }, { weight: 800, style: 'italic' },
      { weight: 900, style: 'italic' },
    ],
  },
  {
    family: 'Montserrat',
    category: 'sans-serif',
    variants: [
      { weight: 100, style: 'normal' }, { weight: 200, style: 'normal' },
      { weight: 300, style: 'normal' }, { weight: 400, style: 'normal' },
      { weight: 500, style: 'normal' }, { weight: 600, style: 'normal' },
      { weight: 700, style: 'normal' }, { weight: 800, style: 'normal' },
      { weight: 900, style: 'normal' },
      { weight: 100, style: 'italic' }, { weight: 200, style: 'italic' },
      { weight: 300, style: 'italic' }, { weight: 400, style: 'italic' },
      { weight: 500, style: 'italic' }, { weight: 600, style: 'italic' },
      { weight: 700, style: 'italic' }, { weight: 800, style: 'italic' },
      { weight: 900, style: 'italic' },
    ],
  },
  {
    family: 'Roboto',
    category: 'sans-serif',
    variants: [
      { weight: 100, style: 'normal' }, { weight: 300, style: 'normal' },
      { weight: 400, style: 'normal' }, { weight: 500, style: 'normal' },
      { weight: 700, style: 'normal' }, { weight: 900, style: 'normal' },
      { weight: 100, style: 'italic' }, { weight: 300, style: 'italic' },
      { weight: 400, style: 'italic' }, { weight: 500, style: 'italic' },
      { weight: 700, style: 'italic' }, { weight: 900, style: 'italic' },
    ],
  },
  {
    family: 'Open Sans',
    category: 'sans-serif',
    variants: [
      { weight: 300, style: 'normal' }, { weight: 400, style: 'normal' },
      { weight: 500, style: 'normal' }, { weight: 600, style: 'normal' },
      { weight: 700, style: 'normal' }, { weight: 800, style: 'normal' },
      { weight: 300, style: 'italic' }, { weight: 400, style: 'italic' },
      { weight: 500, style: 'italic' }, { weight: 600, style: 'italic' },
      { weight: 700, style: 'italic' }, { weight: 800, style: 'italic' },
    ],
  },
  {
    family: 'Lato',
    category: 'sans-serif',
    variants: [
      { weight: 100, style: 'normal' }, { weight: 300, style: 'normal' },
      { weight: 400, style: 'normal' }, { weight: 700, style: 'normal' },
      { weight: 900, style: 'normal' },
      { weight: 100, style: 'italic' }, { weight: 300, style: 'italic' },
      { weight: 400, style: 'italic' }, { weight: 700, style: 'italic' },
      { weight: 900, style: 'italic' },
    ],
  },
  {
    family: 'Poppins',
    category: 'sans-serif',
    variants: [
      { weight: 100, style: 'normal' }, { weight: 200, style: 'normal' },
      { weight: 300, style: 'normal' }, { weight: 400, style: 'normal' },
      { weight: 500, style: 'normal' }, { weight: 600, style: 'normal' },
      { weight: 700, style: 'normal' }, { weight: 800, style: 'normal' },
      { weight: 900, style: 'normal' },
      { weight: 100, style: 'italic' }, { weight: 200, style: 'italic' },
      { weight: 300, style: 'italic' }, { weight: 400, style: 'italic' },
      { weight: 500, style: 'italic' }, { weight: 600, style: 'italic' },
      { weight: 700, style: 'italic' }, { weight: 800, style: 'italic' },
      { weight: 900, style: 'italic' },
    ],
  },
  {
    family: 'Nunito',
    category: 'sans-serif',
    variants: [
      { weight: 200, style: 'normal' }, { weight: 300, style: 'normal' },
      { weight: 400, style: 'normal' }, { weight: 500, style: 'normal' },
      { weight: 600, style: 'normal' }, { weight: 700, style: 'normal' },
      { weight: 800, style: 'normal' }, { weight: 900, style: 'normal' },
      { weight: 200, style: 'italic' }, { weight: 300, style: 'italic' },
      { weight: 400, style: 'italic' }, { weight: 500, style: 'italic' },
      { weight: 600, style: 'italic' }, { weight: 700, style: 'italic' },
      { weight: 800, style: 'italic' }, { weight: 900, style: 'italic' },
    ],
  },
  {
    family: 'Raleway',
    category: 'sans-serif',
    variants: [
      { weight: 100, style: 'normal' }, { weight: 200, style: 'normal' },
      { weight: 300, style: 'normal' }, { weight: 400, style: 'normal' },
      { weight: 500, style: 'normal' }, { weight: 600, style: 'normal' },
      { weight: 700, style: 'normal' }, { weight: 800, style: 'normal' },
      { weight: 900, style: 'normal' },
      { weight: 100, style: 'italic' }, { weight: 200, style: 'italic' },
      { weight: 300, style: 'italic' }, { weight: 400, style: 'italic' },
      { weight: 500, style: 'italic' }, { weight: 600, style: 'italic' },
      { weight: 700, style: 'italic' }, { weight: 800, style: 'italic' },
      { weight: 900, style: 'italic' },
    ],
  },
  {
    family: 'Work Sans',
    category: 'sans-serif',
    variants: [
      { weight: 100, style: 'normal' }, { weight: 200, style: 'normal' },
      { weight: 300, style: 'normal' }, { weight: 400, style: 'normal' },
      { weight: 500, style: 'normal' }, { weight: 600, style: 'normal' },
      { weight: 700, style: 'normal' }, { weight: 800, style: 'normal' },
      { weight: 900, style: 'normal' },
      { weight: 100, style: 'italic' }, { weight: 200, style: 'italic' },
      { weight: 300, style: 'italic' }, { weight: 400, style: 'italic' },
      { weight: 500, style: 'italic' }, { weight: 600, style: 'italic' },
      { weight: 700, style: 'italic' }, { weight: 800, style: 'italic' },
      { weight: 900, style: 'italic' },
    ],
  },
  {
    family: 'DM Sans',
    category: 'sans-serif',
    variants: [
      { weight: 100, style: 'normal' }, { weight: 200, style: 'normal' },
      { weight: 300, style: 'normal' }, { weight: 400, style: 'normal' },
      { weight: 500, style: 'normal' }, { weight: 600, style: 'normal' },
      { weight: 700, style: 'normal' }, { weight: 800, style: 'normal' },
      { weight: 900, style: 'normal' },
      { weight: 100, style: 'italic' }, { weight: 200, style: 'italic' },
      { weight: 300, style: 'italic' }, { weight: 400, style: 'italic' },
      { weight: 500, style: 'italic' }, { weight: 600, style: 'italic' },
      { weight: 700, style: 'italic' }, { weight: 800, style: 'italic' },
      { weight: 900, style: 'italic' },
    ],
  },
  {
    family: 'Plus Jakarta Sans',
    category: 'sans-serif',
    variants: [
      { weight: 200, style: 'normal' }, { weight: 300, style: 'normal' },
      { weight: 400, style: 'normal' }, { weight: 500, style: 'normal' },
      { weight: 600, style: 'normal' }, { weight: 700, style: 'normal' },
      { weight: 800, style: 'normal' },
      { weight: 200, style: 'italic' }, { weight: 300, style: 'italic' },
      { weight: 400, style: 'italic' }, { weight: 500, style: 'italic' },
      { weight: 600, style: 'italic' }, { weight: 700, style: 'italic' },
      { weight: 800, style: 'italic' },
    ],
  },
  // Serif
  {
    family: 'Playfair Display',
    category: 'serif',
    variants: [
      { weight: 400, style: 'normal' }, { weight: 500, style: 'normal' },
      { weight: 600, style: 'normal' }, { weight: 700, style: 'normal' },
      { weight: 800, style: 'normal' }, { weight: 900, style: 'normal' },
      { weight: 400, style: 'italic' }, { weight: 500, style: 'italic' },
      { weight: 600, style: 'italic' }, { weight: 700, style: 'italic' },
      { weight: 800, style: 'italic' }, { weight: 900, style: 'italic' },
    ],
  },
  {
    family: 'Merriweather',
    category: 'serif',
    variants: [
      { weight: 300, style: 'normal' }, { weight: 400, style: 'normal' },
      { weight: 700, style: 'normal' }, { weight: 900, style: 'normal' },
      { weight: 300, style: 'italic' }, { weight: 400, style: 'italic' },
      { weight: 700, style: 'italic' }, { weight: 900, style: 'italic' },
    ],
  },
  {
    family: 'Lora',
    category: 'serif',
    variants: [
      { weight: 400, style: 'normal' }, { weight: 500, style: 'normal' },
      { weight: 600, style: 'normal' }, { weight: 700, style: 'normal' },
      { weight: 400, style: 'italic' }, { weight: 500, style: 'italic' },
      { weight: 600, style: 'italic' }, { weight: 700, style: 'italic' },
    ],
  },
  {
    family: 'Crimson Text',
    category: 'serif',
    variants: [
      { weight: 400, style: 'normal' }, { weight: 600, style: 'normal' },
      { weight: 700, style: 'normal' },
      { weight: 400, style: 'italic' }, { weight: 600, style: 'italic' },
      { weight: 700, style: 'italic' },
    ],
  },
  {
    family: 'Source Serif 4',
    category: 'serif',
    variants: [
      { weight: 200, style: 'normal' }, { weight: 300, style: 'normal' },
      { weight: 400, style: 'normal' }, { weight: 500, style: 'normal' },
      { weight: 600, style: 'normal' }, { weight: 700, style: 'normal' },
      { weight: 800, style: 'normal' }, { weight: 900, style: 'normal' },
      { weight: 200, style: 'italic' }, { weight: 300, style: 'italic' },
      { weight: 400, style: 'italic' }, { weight: 500, style: 'italic' },
      { weight: 600, style: 'italic' }, { weight: 700, style: 'italic' },
      { weight: 800, style: 'italic' }, { weight: 900, style: 'italic' },
    ],
  },
  {
    family: 'Libre Baskerville',
    category: 'serif',
    variants: [
      { weight: 400, style: 'normal' }, { weight: 700, style: 'normal' },
      { weight: 400, style: 'italic' },
    ],
  },
  // Display
  {
    family: 'Bebas Neue',
    category: 'display',
    variants: [
      { weight: 400, style: 'normal' },
    ],
  },
  {
    family: 'Oswald',
    category: 'display',
    variants: [
      { weight: 200, style: 'normal' }, { weight: 300, style: 'normal' },
      { weight: 400, style: 'normal' }, { weight: 500, style: 'normal' },
      { weight: 600, style: 'normal' }, { weight: 700, style: 'normal' },
    ],
  },
  {
    family: 'Anton',
    category: 'display',
    variants: [
      { weight: 400, style: 'normal' },
    ],
  },
  {
    family: 'Alfa Slab One',
    category: 'display',
    variants: [
      { weight: 400, style: 'normal' },
    ],
  },
  {
    family: 'Righteous',
    category: 'display',
    variants: [
      { weight: 400, style: 'normal' },
    ],
  },
  {
    family: 'Passion One',
    category: 'display',
    variants: [
      { weight: 400, style: 'normal' }, { weight: 700, style: 'normal' },
      { weight: 900, style: 'normal' },
    ],
  },
  // Handwriting
  {
    family: 'Dancing Script',
    category: 'handwriting',
    variants: [
      { weight: 400, style: 'normal' }, { weight: 500, style: 'normal' },
      { weight: 600, style: 'normal' }, { weight: 700, style: 'normal' },
    ],
  },
  {
    family: 'Pacifico',
    category: 'handwriting',
    variants: [
      { weight: 400, style: 'normal' },
    ],
  },
  {
    family: 'Caveat',
    category: 'handwriting',
    variants: [
      { weight: 400, style: 'normal' }, { weight: 500, style: 'normal' },
      { weight: 600, style: 'normal' }, { weight: 700, style: 'normal' },
    ],
  },
  {
    family: 'Satisfy',
    category: 'handwriting',
    variants: [
      { weight: 400, style: 'normal' },
    ],
  },
  {
    family: 'Great Vibes',
    category: 'handwriting',
    variants: [
      { weight: 400, style: 'normal' },
    ],
  },
]

/**
 * Look up a font entry by family name (case-sensitive exact match).
 */
export function getFontEntry(family: string): FontEntry | undefined {
  return FONT_CATALOG.find((f) => f.family === family)
}

export function getCssFallback(category: FontEntry['category']): string {
  switch (category) {
    case 'serif': return 'serif'
    case 'handwriting': return 'cursive'
    case 'display': return 'system-ui'
    default: return 'sans-serif'
  }
}
