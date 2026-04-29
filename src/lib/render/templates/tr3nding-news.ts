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
  fontFamily: "'Inter', sans-serif",
  headingFontFamily: "'Anton', sans-serif",
  hookFontSize: '72px',
  bodyFontSize: '32px',
  textColor: '#ffffff',
  backgroundColor: '#000000',
  overlayColor: '#000000',
  overlayOpacity: 0.15,
  textAlign: 'left',
  textPosition: 'bottom',
  hookStyle: 'uppercase',
  accentColor: '#A8E0B0',
  backgroundMode: 'image-with-bottom-card',
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
