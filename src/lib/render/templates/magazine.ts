import type { SlideTemplate } from './index'

// "Magazine" — editorial serif headline, off-white background. Vogue/NYT carousel vibe.
export const magazine: SlideTemplate = {
  id: 'magazine',
  name: 'Magazine',
  thumbnail: '/templates/magazine.png',
  fontFamily: "'Playfair Display', serif",
  hookFontSize: '92px',
  bodyFontSize: '34px',
  textColor: '#1a1a1a',
  backgroundColor: '#fffbf5',
  overlayColor: '#1a1a1a',
  overlayOpacity: 0,
  textAlign: 'left',
  textPosition: 'center',
  hookStyle: 'normal',
  sample: {
    hook_text: 'The Quiet Power of Routine',
    body_text: 'Why the highest-performing people protect their mornings.',
  },
}
