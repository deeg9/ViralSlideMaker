import type { SlideTemplate } from './index'

// "News Drop" — sovereignty.ai-style news Instagram carousels.
// Black background, oversized condensed display headline, lime accent for keywords.
// Pairs with style_overrides.layout = 'cover' | 'body' to switch between
// (image-top + text-bottom) and (text-top + image-bottom) per slide.
export const newsDrop: SlideTemplate = {
  id: 'news-drop',
  name: 'News Drop',
  thumbnail: '/templates/news-drop.png',
  fontFamily: "'Anton', sans-serif",
  hookFontSize: '110px',
  // 260503-0f2: Anton ships single-weight (400) on Google Fonts. Force 400 so
  // Satori PNG export matches browser preview.
  hookFontWeight: 400,
  bodyFontSize: '38px',
  textColor: '#ffffff',
  backgroundColor: '#000000',
  overlayColor: '#000000',
  overlayOpacity: 0,
  textAlign: 'left',
  textPosition: 'bottom',
  hookStyle: 'uppercase',
  accentColor: '#C8FF00',
  sample: {
    hook_text: 'OPENAI WINS LANDMARK COPYRIGHT CASE',
    body_text: 'Federal court rules training on public data is fair use.',
    hook_segments: [
      { text: 'OPENAI', accent: true },
      { text: 'WINS' },
      { text: 'LANDMARK' },
      { text: 'COPYRIGHT', accent: true },
      { text: 'CASE' },
    ],
    layout: 'cover',
  },
}
