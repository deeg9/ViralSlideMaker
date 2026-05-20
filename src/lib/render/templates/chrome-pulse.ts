import type { SlideTemplate } from './index'

/**
 * "Chrome Pulse" — quick-260519-t3x.
 *
 * Cyber-Y2K / acid-maximalism trend (2026): chrome comeback, near-black
 * canvas, hot magenta + acid lime accents. Distinct from y2k-pop (bubblegum
 * pastel on hot pink) — Chrome Pulse fills the "loud + dark" Y2K gap.
 *
 * Free-tier — Anton heading (single-weight 400 → hookFontWeight 400 for
 * Satori parity) + Plus Jakarta Sans body, image-bleed with contrast-bump
 * photo treatment, heavy grain, vignette. Page-counter chip in magenta is
 * the only overlay — a mid pill was tried but collided with wrapped Anton
 * hooks; the lime-pill accent on hook_segments carries the chip energy
 * without occupying a second slot. image-bleed (not image-with-bottom-card)
 * picked so the no-photo thumbnail still composes cleanly.
 */
export const chromePulse: SlideTemplate = {
  id: 'chrome-pulse',
  name: 'Chrome Pulse',
  thumbnail: '/templates/chrome-pulse.png',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  headingFontFamily: "'Anton', sans-serif",
  bodyFontFamily: "'Plus Jakarta Sans', sans-serif",
  hookFontSize: '116px',
  hookFontWeight: 400,
  bodyFontSize: '32px',
  textColor: '#FFFFFF',
  backgroundColor: '#0D0D14',
  overlayColor: '#0D0D14',
  overlayOpacity: 0.35,
  textAlign: 'left',
  textPosition: 'bottom',
  hookStyle: 'uppercase',
  accentColor: '#FF2DAA',
  backgroundMode: 'image-bleed',
  photoTreatment: 'contrast-bump',
  grainMode: 'heavy',
  vignette: { strength: 0.45 },
  paletteMode: 'fixed',
  aiVoiceNote:
    'Cyber Y2K voice: high-energy, slightly chaotic, numeric specifics, internet-native nouns. Lean acid + chrome — neutral middle-ground prose dies here.',
  overlays: [
    {
      position: 'top-right',
      content: { type: 'page-counter' },
      style: {
        background: 'rgba(255,45,170,0.85)',
        color: '#FFFFFF',
        padding: '8px 16px',
        borderRadius: '4px',
        fontSize: '28px',
        fontWeight: 700,
      },
    },
  ],
  sample: {
    hook_text: 'ACID IS THE NEW BLACK',
    body_text: 'Cyber-Y2K outsells minimalist core 3-to-1 on TikTok this quarter.',
    hook_segments: [
      { text: 'ACID', highlightColor: '#C7FF3C', highlightStyle: 'pill' },
      { text: 'IS THE NEW' },
      { text: 'BLACK' },
    ],
  },
}
