import type { SlideTemplate } from './index'

/**
 * "Notes App Chic" — Phase 56 (TPL-02) free-tier premium template.
 *
 * Aesthetic reference: Loewe campaign carousels / Duolingo brand /
 * Brand New review style. Paper-cream background with ransom-note hook
 * (5 mixed fonts via per-segment fontFamily — TPL-07), tape-strip +
 * sticky-note + halftone-dot decorative overlays (Phase 56-01 asset
 * library + Phase 56-02 OverlayContent.decorative discriminated-union
 * variant), photocopier-grain via grainMode: 'xerox'.
 *
 * Free-tier (TPL-09) — NOT in PREMIUM_TEMPLATE_IDS. Body fontFamily
 * declared explicitly per D-04 (universal anti-Inter discipline). The
 * ransom-note effect lives on the HOOK only via segment-level overrides
 * (D-08) — body stays clean Plus Jakarta Sans.
 *
 * Cover layout (TPL-06): first slide hook moves to upper-third with
 * slightly larger fontSize (120px vs inner 110px) so the 3 decorative
 * overlays have room.
 */
export const notesAppChic: SlideTemplate = {
  id: 'notes-app-chic',
  name: 'Notes App Chic',
  thumbnail: '/templates/notes-app-chic.png',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  headingFontFamily: "'Plus Jakarta Sans', sans-serif",
  bodyFontFamily: "'Plus Jakarta Sans', sans-serif",
  hookFontSize: '110px',
  bodyFontSize: '34px',
  textColor: '#1A1A1A',
  backgroundColor: '#F4EFE3',
  overlayColor: '#000000',
  overlayOpacity: 0,
  textAlign: 'left',
  textPosition: 'center',
  hookStyle: 'normal',
  accentColor: '#FFD86B',
  backgroundMode: 'image-bleed',
  // No photoTreatment — paper texture IS the background
  grainMode: 'xerox',
  // Phase 57 (D-13, D-15, PALETTE-03): sticky-note tint uses Vibrant when
  // derived_palette is set (via getNotesAppChicAccentColor + sticky-note-accent
  // SVG); falls back to brand sticky-yellow #FFE066 otherwise.
  paletteMode: 'palette-dominant',
  coverLayout: {
    textPosition: 'top',
    textAlign: 'left',
    hookFontSize: '120px',
  },
  aiVoiceNote:
    'Personal first-person voice. Fragmented for ransom-note rhythm — short clauses, conversational tone. Like a stranger telling you about their week.',
  overlays: [
    // Tape strip top-left at slight angle
    {
      position: 'free',
      content: { type: 'decorative', asset: 'tape-strip-1', rotation: -8, scale: 1.0, opacity: 0.95 },
      offset: { x: 60, y: 40 },
    },
    // Sticky note top-right
    {
      position: 'free',
      content: { type: 'decorative', asset: 'sticky-note-yellow', rotation: 6, scale: 0.8, opacity: 1.0 },
      offset: { x: 780, y: 50 },
    },
    // Halftone dots mid-right accent
    {
      position: 'free',
      content: { type: 'decorative', asset: 'halftone-dots-light', rotation: 0, scale: 0.4, opacity: 0.30 },
      offset: { x: 720, y: 760 },
    },
    // Page counter — text in top-right (no chip)
    {
      position: 'top-right',
      content: { type: 'page-counter' },
      style: {
        background: 'transparent',
        color: '#1A1A1A',
        fontSize: '28px',
        fontWeight: 700,
      },
    },
  ],
  sample: {
    hook_text: 'I quit my job to sell paintings',
    body_text: '6 months. 47 canvases. One sold yesterday.',
    hook_segments: [
      { text: 'I quit', fontFamily: "'Playfair Display', serif" },
      { text: 'my job', fontFamily: "'Bebas Neue', sans-serif" },
      { text: 'to', fontFamily: "'Plus Jakarta Sans', sans-serif" },
      { text: 'sell', fontFamily: "'Archivo Black', sans-serif", highlightColor: '#FFD86B', highlightStyle: 'pill' },
      { text: 'paintings', fontFamily: "'DM Serif Display', serif" },
    ],
  },
}
