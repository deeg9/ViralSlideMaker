import type { SlideTemplate } from './index'

// "News Cyan" — metav3rse-style news Instagram carousels.
// Black background, oversized condensed display headline, cyan accent for keywords.
// Pairs with style_overrides.layout = 'cover' | 'body' just like News Drop, and
// shares the same Gemini prompt branch via the NEWS_TEMPLATES set.
export const newsCyan: SlideTemplate = {
  id: 'news-cyan',
  name: 'News Cyan',
  thumbnail: '/templates/news-cyan.png',
  fontFamily: "'Anton', sans-serif",
  hookFontSize: '110px',
  bodyFontSize: '38px',
  textColor: '#ffffff',
  backgroundColor: '#0a0a0a',
  overlayColor: '#000000',
  overlayOpacity: 0,
  textAlign: 'left',
  textPosition: 'bottom',
  hookStyle: 'uppercase',
  accentColor: '#00E5FF',
  sample: {
    hook_text: 'AMAZON FACES PRICE-FIXING ALLEGATIONS',
    body_text: 'FTC opens formal probe into marketplace fee structure.',
    hook_segments: [
      { text: 'AMAZON', accent: true },
      { text: 'FACES' },
      { text: 'PRICE-FIXING', accent: true },
      { text: 'ALLEGATIONS' },
    ],
    layout: 'cover',
  },
}
