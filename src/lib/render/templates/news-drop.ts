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
  bodyFontSize: '38px',
  textColor: '#ffffff',
  backgroundColor: '#000000',
  overlayColor: '#000000',
  overlayOpacity: 0,
  textAlign: 'left',
  textPosition: 'bottom',
  hookStyle: 'uppercase',
  accentColor: '#C8FF00',
}
