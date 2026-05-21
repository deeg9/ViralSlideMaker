import type { SlideTemplate } from './index'

/**
 * "Chrome Pulse" — quick-260519-t3x.
 *
 * Cyber-Y2K / acid-maximalism trend (2026): chrome comeback, near-black
 * canvas, hot magenta + acid lime accents. Distinct from y2k-pop (bubblegum
 * pastel on hot pink) — Chrome Pulse fills the "loud + dark" Y2K gap.
 *
 * Free-tier — Anton heading (single-weight 400 → hookFontWeight 400 for
 * Satori parity) + Plus Jakarta Sans body, classic newsZone layout
 * (`backgroundMode` left undefined so the renderer uses news-cover
 * geometry — full-bleed photo with a dark caption-card holding the hook,
 * matching news-oracle's reference look). Page-counter chip in magenta
 * is the only overlay. Heavy grain + 0.45 vignette + contrast-bump
 * photo treatment are the chrome / acid-Y2K identity layers — they ride
 * on top of the newsZone path without modifying it.
 *
 * quick-260519-bgr (2026-05-19): bumped hookFontSize 116→130 and removed
 * the HOOK_FIT_REGISTRY entry so promoteNewsHeadline's fitHeadlineToBox
 * path stamps oracle-scale headlines (~100-130px), matching the visual
 * weight of news-oracle / tr3nding-news in the user's reference.
 * captionCardDefaults mirror news-oracle (heightPct: 42, blendPct: 15,
 * opacity: 0.80) so the dark card carries the magenta+lime accent
 * cleanly against any photo.
 */
export const chromePulse: SlideTemplate = {
  id: 'chrome-pulse',
  name: 'Chrome Pulse',
  thumbnail: '/templates/chrome-pulse.png',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  headingFontFamily: "'Anton', sans-serif",
  bodyFontFamily: "'Plus Jakarta Sans', sans-serif",
  hookFontSize: '130px',
  hookFontWeight: 400,
  bodyFontSize: '32px',
  textColor: '#FFFFFF',
  backgroundColor: '#0D0D14',
  overlayColor: '#0D0D14',
  overlayOpacity: 0.45,
  textAlign: 'left',
  textPosition: 'bottom',
  hookStyle: 'uppercase',
  // Acid lime matches the picker preview's highlight on "ACID" and the brand's
  // primary accent — generation derives highlight pill color from accentColor
  // (prompts.ts), so this MUST match the sample's highlightColor to keep the
  // generated slide visually aligned with the picker. Hot magenta survives in
  // the page-counter overlay below (hardcoded), preserving the dual-color
  // Y2K-acid identity.
  accentColor: '#C7FF3C',
  // backgroundMode left undefined — engages the classic newsZone path
  // (same as news-oracle), giving promoteNewsHeadline + the cover-layout
  // caption-card the room they need to render an oracle-scale headline.
  photoTreatment: 'contrast-bump',
  grainMode: 'heavy',
  vignette: { strength: 0.45 },
  paletteMode: 'fixed',
  captionCardDefaults: {
    heightPct: 42,
    blendPct: 15,
    opacity: 0.80,
  },
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
  preview: 'https://mzfeqsyhnxgnrdawlhcb.supabase.co/storage/v1/object/public/template-previews/code-templates/chrome-pulse.png',
}
