import type { SlideTemplate } from './index'

// "Documentary" — Phase 46 minimal/photo-forward divergence. Full-bleed
// photo with subtle gradient darken at bottom + minimal Inter sans-serif
// body copy. Deliberate divergence from the magazine-bold/tr3nding-news
// premium-tier siblings: NO mint accent, NO Anton display font, NO highlight
// pills on segments — minimal aesthetic locked. Story-led voice.
//
// The free-slot overlay below renders the bottom-darken gradient surface;
// the empty literal text is intentional — Phase 45's resolveOverlayContent
// returns '' and the renderer still emits the styled div. DOM order: overlays
// render BELOW hook/body in the Phase 45 layer stack, so the gradient sits
// beneath the text without occluding it. Place LAST in the array per
// 46-CONTEXT.md decision (explicit DOM-order intent).
//
// Schema-shape note: 46-UI-SPEC.md / 46-CONTEXT.md describe the gradient
// surface with explicit `width: '1080px'` + `height: '580px'` and the counter
// overlay with `opacity: 0.7`. Those keys are NOT part of the current
// `TemplateOverlay.style` union (Phase 44 is locked). They are dropped here
// to keep the validator green without a schema change:
//   - Gradient sizing is delegated to the Phase 45 free-slot wrapper at
//     offset.y = 1340 (1920 − 580); the gradient inherits the wrapper width.
//   - Counter "ghosted" feel is achieved via background: 'transparent' +
//     padding: '0' (the supported tokens) — no opacity field required.
export const documentary: SlideTemplate = {
  id: 'documentary',
  name: 'Documentary',
  thumbnail: '/templates/documentary.png',
  fontFamily: "'Inter', sans-serif",
  headingFontFamily: "'Inter', sans-serif",
  hookFontSize: '56px',
  bodyFontSize: '32px',
  textColor: '#ffffff',
  backgroundColor: '#000000',
  overlayColor: '#000000',
  overlayOpacity: 0.35,
  textAlign: 'left',
  textPosition: 'bottom',
  hookStyle: 'normal',
  accentColor: '#ffffff',
  backgroundMode: 'image-bleed',
  aiVoiceNote: 'Write in story-led documentary tone: subject-driven, considered, descriptive. Avoid breathless punctuation, hype words, or forced action verbs. Tone is the New Yorker, not BuzzFeed.',
  overlays: [
    {
      position: 'top-right',
      content: { type: 'page-counter' },
      style: {
        background: 'transparent',
        color: '#ffffff',
        padding: '0',
        fontSize: '28px',
        fontWeight: 400,
      },
    },
    {
      position: 'free',
      content: { type: 'literal', text: '' },
      offset: { x: 0, y: 1340 },
      style: {
        background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.85))',
      },
    },
  ],
  sample: {
    hook_text: 'The Last Glassblower of Murano',
    body_text: 'How four centuries of craft survive in a digital age.',
  },
}
