import type { SlideTemplate } from './index'

/**
 * "Brutalist Grid" — Phase 56 (TPL-03) free-tier premium template.
 *
 * Aesthetic reference: AIGA Eye on Design / Massimo Vignelli / Brutalism
 * architecture mag. White background + black text + single high-contrast
 * red accent (`#FF3B30`). Type-as-image hero — oversized hook
 * (180px inner / 220px cover) fills the frame in Archivo Black, body in
 * Space Grotesk. NO decorative overlays — minimalist by construction
 * (TPL-03 explicit). NO grain, NO vignette.
 *
 * 8-column grid is honored at render-time via fixed text widths (60px
 * gutters + ~960px content area on the 1080px canvas = 8 × 120px columns).
 * Schema-only encoding (D-11) — no extra grid field on SlideTemplate.
 *
 * Free-tier (TPL-09) — NOT in PREMIUM_TEMPLATE_IDS. Body fontFamily
 * declared explicitly per D-04 (universal anti-Inter discipline).
 *
 * Hook size 180/220px is intentionally ABOVE the TYPO-03 110-130px band
 * per TPL-03 type-as-image-hero requirement (D-35). Free-tier templates
 * have full discretion on hook sizes.
 *
 * `photoTreatment: 'bw'` applies when the user attaches a photo (e.g.,
 * via uploaded photos), but the default is `backgroundMode: 'color'`
 * (no photo) so the type fills the frame.
 */
export const brutalistGrid: SlideTemplate = {
  id: 'brutalist-grid',
  name: 'Brutalist Grid',
  thumbnail: '/templates/brutalist-grid.png',
  fontFamily: "'Space Grotesk', sans-serif",
  headingFontFamily: "'Archivo Black', sans-serif",
  bodyFontFamily: "'Space Grotesk', sans-serif",
  hookFontSize: '180px',
  bodyFontSize: '32px',
  textColor: '#000000',
  backgroundColor: '#FFFFFF',
  overlayColor: '#FFFFFF',
  overlayOpacity: 0,
  textAlign: 'left',
  textPosition: 'center',
  hookStyle: 'uppercase',
  accentColor: '#FF3B30',
  backgroundMode: 'color',
  photoTreatment: 'bw',
  paletteMode: 'fixed',
  // No grainMode — clean by construction
  // No vignette — minimalist
  coverLayout: {
    textPosition: 'top',
    textAlign: 'left',
    hookFontSize: '220px',
  },
  aiVoiceNote:
    'Brutalist register — short declarative statements. No hedging, no soft sells. Confident assertions, often paradoxical or pointed.',
  overlays: [
    // Topic label top-left — text only, no chip background
    {
      position: 'top-left',
      content: { type: 'slide-field', field: 'topic' },
      style: {
        background: 'transparent',
        color: '#000000',
        fontWeight: 900,
        fontSize: '24px',
        textTransform: 'uppercase',
      },
    },
    // Page counter top-right — text only, no chip
    {
      position: 'top-right',
      content: { type: 'page-counter' },
      style: {
        background: 'transparent',
        color: '#000000',
        fontSize: '24px',
        fontWeight: 900,
      },
    },
  ],
  sample: {
    hook_text: 'NO HEADLINES. JUST TYPE.',
    body_text:
      'A weekly publication for designers who refuse to decorate.',
  },
}
