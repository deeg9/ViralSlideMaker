import type { SlideTemplate } from './index'

/**
 * "Soft Sage" — quick-260519-t3x.
 *
 * Wellness journaling / "That Girl" / quiet-aesthetic trend (2026): cream
 * paper background, sage green accent, italic display serif headlines.
 * Distinct from editorial-serif (dark B&W image bleed) — Soft Sage is
 * pure-typography on warm cream, journal-entry feel via DM Serif Display
 * italic. Picker has no quiet/wellness keeper today (paper-essay is hidden);
 * this fills that gap.
 *
 * Free-tier — DM Serif Display heading + Lora body, paper grain, no photo,
 * single page-counter overlay (free-tier overlay bucket).
 */
export const softSage: SlideTemplate = {
  id: 'soft-sage',
  name: 'Soft Sage',
  thumbnail: '/templates/soft-sage.png',
  fontFamily: "'Lora', serif",
  headingFontFamily: "'DM Serif Display', serif",
  bodyFontFamily: "'Lora', serif",
  hookFontSize: '108px',
  bodyFontSize: '34px',
  textColor: '#2A352B',
  backgroundColor: '#EFEBE0',
  overlayColor: '#000000',
  overlayOpacity: 0,
  textAlign: 'center',
  textPosition: 'center',
  hookStyle: 'italic',
  accentColor: '#7A9476',
  backgroundMode: 'color',
  grainMode: 'paper',
  paletteMode: 'fixed',
  coverLayout: {
    textPosition: 'center',
    textAlign: 'center',
    hookFontSize: '108px',
  },
  aiVoiceNote:
    'Quiet journal-entry register — italicized first-person reflections, soft and grounded. Single declarative thought per slide. No listicle tropes or hype.',
  overlays: [
    {
      position: 'top-right',
      content: { type: 'page-counter' },
      style: {
        background: 'transparent',
        color: '#7A9476',
        fontSize: '28px',
        fontWeight: 500,
      },
    },
  ],
  sample: {
    hook_text: 'rest is not the reward.',
    body_text: 'it is the soil. everything else grows from it.',
  },
}
