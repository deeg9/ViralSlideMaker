import type { SlideTemplate } from './index'

// "Tr3nding News" — Phase 46 mid-pill variant. Sibling of magazine-bold for
// premium-tier cohesion (same mint accent + Anton/Inter pairing). Mid-pill
// content is template-configurable so future variants can use 'BREAKING',
// 'EXCLUSIVE', 'HOT TAKE', etc. without schema changes.
//
// Schema-shape note: per Phase 44 locked contract, only the fields in
// `TemplateOverlay.style` (background, color, padding, borderRadius,
// fontSize, fontWeight, textTransform) are accepted. The 40px borderRadius
// on the mid-pill produces a fully-rounded shape at the chip's line-height,
// equivalent to a `9999`-style pill without leaving the permitted union.
//
// quick-260520-ft0 (2026-05-20): pivoted off Phase 45's
// image-with-bottom-card path to the classic newsZone path used by
// news-oracle / chrome-pulse. backgroundMode dropped + hookFontSize
// bumped 120→130 + HOOK_FIT_REGISTRY entry removed (see hook-fit.ts).
// promoteNewsHeadline's fitHeadlineToBox(842x620) now stamps the
// oracle-scale headline (~100-130px) instead of the registry's
// collapsed 66px (scale 0.55 × 120) at the 42-char threshold.
// captionCardDefaults mirror news-oracle / chrome-pulse so the dark
// caption card carries the mint accent + TR3NDING kicker cleanly.
export const tr3ndingNews: SlideTemplate = {
  id: 'tr3nding-news',
  name: 'Tr3nding News',
  thumbnail: '/templates/tr3nding-news.png',
  // Phase 55 (D-23, SLOP-05 carry-forward): Inter → Plus Jakarta Sans to align with
  // magazine-bold + documentary (Phase 54 SLOP-05 covered only those two; Phase 55
  // completes the audit). Plus Jakarta Sans matches sibling premium aesthetic.
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  headingFontFamily: "'Anton', sans-serif",
  // quick-260520-ft0: bumped 120→130 to match news-oracle / chrome-pulse
  // oracle-scale base — fitHeadlineToBox stamps the live headline.
  hookFontSize: '130px',
  // 260503-0f2: Anton ships single-weight (400) on Google Fonts. Force 400 so
  // Satori PNG export matches browser preview.
  hookFontWeight: 400,
  bodyFontSize: '32px',
  textColor: '#ffffff',
  backgroundColor: '#000000',
  overlayColor: '#000000',
  overlayOpacity: 0.15,
  textAlign: 'left',
  textPosition: 'bottom',
  hookStyle: 'uppercase',
  // Phase 55 (D-22, SLOP-03): explicit body font declaration required by
  // validateTemplateRegistry on every premium-tier template.
  bodyFontFamily: "'Plus Jakarta Sans', sans-serif",
  accentColor: '#A8E0B0',
  // quick-260520-ft0: dark caption-card baseline mirroring news-oracle /
  // chrome-pulse (heightPct 42, blendPct 15, opacity 0.80). Engages the
  // classic newsZone full-bleed photo + bottom caption-card geometry now
  // that backgroundMode is undefined.
  captionCardDefaults: {
    heightPct: 42,
    blendPct: 15,
    opacity: 0.80,
  },
  aiVoiceNote: 'Write in viral-news pitch: shocking specifics, breakout moments, money/time/scale numbers prominent. Tone is breaking-news energy.',
  overlays: [
    {
      position: 'top-right',
      content: { type: 'page-counter' },
      style: {
        background: 'rgba(0,0,0,0.6)',
        color: '#ffffff',
        padding: '8px 16px',
        borderRadius: '4px',
        fontSize: '28px',
        fontWeight: 700,
      },
    },
    {
      // quick-260519-pbg: moved from 'mid' (top:55% center) to 'top-left'.
      // The mid slot landed dead-center on the photo subject's face on
      // most stock photography — turning the kicker into an occluder.
      // Top-left is the magazine-kicker convention (above the headline,
      // out of the photo's central focus zone).
      position: 'top-left',
      content: { type: 'literal', text: 'TR3NDING' },
      style: {
        background: '#000000',
        color: '#A8E0B0',
        padding: '12px 24px',
        borderRadius: '40px',
        fontSize: '28px',
        fontWeight: 700,
        textTransform: 'uppercase',
      },
    },
  ],
  sample: {
    hook_text: 'STARTUP RAISES $50M IN 12 MINUTES',
    body_text: '',
    hook_segments: [
      { text: 'STARTUP RAISES' },
      { text: '$50M', highlightColor: '#A8E0B0', highlightStyle: 'pill' },
      { text: 'IN' },
      { text: '12 MINUTES', highlightColor: '#A8E0B0', highlightStyle: 'pill' },
    ],
    // quick-260520-ft0: cover layout mirrors news-oracle so the template
    // picker thumbnail renders the headline in the bottom caption-card zone
    // (matching the real generated cover slide). Generated decks still get
    // layout='cover' stamped by promoteNewsHeadline at gen time.
    layout: 'cover',
  },
  preview: 'https://mzfeqsyhnxgnrdawlhcb.supabase.co/storage/v1/object/public/template-previews/code-templates/tr3nding-news.png',
}
