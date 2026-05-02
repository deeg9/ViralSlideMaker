import type { SlideTemplate } from './index'

// "Magazine Bold" — Phase 46 flagship premium template matching the Murphy
// Campbell folk-singer reference (per 46-CONTEXT.md / 46-UI-SPEC.md).
// B&W photo full-bleed + top-left mint topic chip + top-right page counter
// + bottom semi-opaque black card hosting all-caps Anton hook + Inter body
// with mint highlight pills on accent spans.
//
// Schema-shape note: 46-UI-SPEC.md mentions overlay style fields beyond the
// current `TemplateOverlay.style` union (Phase 44 schema is locked). Those
// values are dropped here so the validator stays green WITHOUT a Phase 44
// schema change. The visible result is identical for this template — the
// permitted background/color/padding/borderRadius/fontSize/fontWeight/
// textTransform set fully covers magazine-bold's needs.
export const magazineBold: SlideTemplate = {
  id: 'magazine-bold',
  name: 'Magazine Bold',
  thumbnail: '/templates/magazine-bold.png',
  // Phase 54 (SLOP-05, D-13/D-14): Plus Jakarta Sans replaces Inter to escape
  // the v2.5+-AI-default-font tell. Visual reference: Murphy Campbell carousel
  // (v2.7 PROJECT.md). If aesthetic regresses, see D-15 for revert procedure.
  fontFamily: "'Plus Jakarta Sans', sans-serif",
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
  aiVoiceNote: 'Write in punchy news-style: tabloid-pitched headlines, statistics over adjectives, action verbs over states-of-being. Tone is urgent and confident, like a magazine cover line.',
  overlays: [
    {
      position: 'top-left',
      content: { type: 'slide-field', field: 'topic' },
      style: {
        background: '#A8E0B0',
        color: '#000000',
        padding: '8px 16px',
        borderRadius: '4px',
        fontSize: '28px',
        fontWeight: 700,
        textTransform: 'uppercase',
      },
    },
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
  ],
  sample: {
    hook_text: 'FOLK SINGER FIGHTS BACK AFTER AI CLONED HER VOICE',
    body_text: 'Murphy Campbell, a folk singer from Western North Carolina, sues OpenAI for copyright theft.',
    hook_segments: [
      { text: 'FOLK SINGER' },
      { text: 'FIGHTS BACK', highlightColor: '#A8E0B0', highlightStyle: 'pill' },
      { text: 'AFTER AI' },
      { text: 'CLONED HER VOICE', highlightColor: '#A8E0B0', highlightStyle: 'pill' },
    ],
  },
}
