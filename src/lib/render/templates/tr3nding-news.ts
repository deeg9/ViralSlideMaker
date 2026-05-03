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
export const tr3ndingNews: SlideTemplate = {
  id: 'tr3nding-news',
  name: 'Tr3nding News',
  thumbnail: '/templates/tr3nding-news.png',
  // Phase 55 (D-23, SLOP-05 carry-forward): Inter → Plus Jakarta Sans to align with
  // magazine-bold + documentary (Phase 54 SLOP-05 covered only those two; Phase 55
  // completes the audit). Plus Jakarta Sans matches sibling premium aesthetic.
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  headingFontFamily: "'Anton', sans-serif",
  // Phase 55 (D-18, TYPO-03): premium hook size raised to 120px (mid-range of 110-130
  // per-template band; sibling cohesion with magazine-bold also at 120px).
  hookFontSize: '120px',
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
  backgroundMode: 'image-with-bottom-card',
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
      position: 'mid',
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
    body_text: 'AI infrastructure boom drives record-breaking seed round.',
    hook_segments: [
      { text: 'STARTUP RAISES' },
      { text: '$50M', highlightColor: '#A8E0B0', highlightStyle: 'pill' },
      { text: 'IN' },
      { text: '12 MINUTES', highlightColor: '#A8E0B0', highlightStyle: 'pill' },
    ],
  },
}
