import type { SlideTemplate } from './index'

/**
 * "Sunset Tabloid" — quick-260519-t3x.
 *
 * Retro-bold / warm-tabloid trend (2026): nostalgic 70s-80s tabloid revival,
 * sun-faded warm palette. Deep-plum headline on cream with burnt-orange
 * accent pills. No photo — color-block only (sibling to bold-yellow but
 * warmer + richer accent vocabulary).
 *
 * Free-tier — Bebas Neue heading + Plus Jakarta Sans body. No overlays —
 * sits in the legacy/color-block bucket alongside bold-yellow + y2k-pop.
 */
export const sunsetTabloid: SlideTemplate = {
  id: 'sunset-tabloid',
  name: 'Sunset Tabloid',
  thumbnail: '/templates/sunset-tabloid.png',
  fontFamily: "'Bebas Neue', sans-serif",
  bodyFontFamily: "'Plus Jakarta Sans', sans-serif",
  hookFontSize: '128px',
  bodyFontSize: '36px',
  textColor: '#2D1F2E',
  backgroundColor: '#F4E8D0',
  overlayColor: '#D4571C',
  overlayOpacity: 0,
  textAlign: 'left',
  textPosition: 'center',
  hookStyle: 'uppercase',
  accentColor: '#D4571C',
  aiVoiceNote:
    'Retro-tabloid voice: declarative, punchy, slightly nostalgic. Lean into specific cultural detail and round numbers. Avoid hedges.',
  sample: {
    hook_text: 'EVERYONE FORGOT HOW TO BE BORED',
    body_text: 'And it might be killing the best ideas you never had.',
    hook_segments: [
      { text: 'EVERYONE FORGOT' },
      { text: 'HOW', accent: true, highlightStyle: 'pill' },
      { text: 'TO BE' },
      { text: 'BORED', accent: true, highlightStyle: 'pill' },
    ],
  },
}
