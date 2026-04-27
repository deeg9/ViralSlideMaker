import type { SlideTemplate } from './index'

export const cleanSerif: SlideTemplate = {
  id: 'clean-serif',
  name: 'Clean Serif',
  thumbnail: '/templates/clean-serif.png',
  fontFamily: "'Georgia', serif",
  hookFontSize: '60px',
  bodyFontSize: '30px',
  textColor: '#2d2d2d',
  backgroundColor: '#fafafa',
  overlayColor: '#ffffff',
  overlayOpacity: 0,
  textAlign: 'center',
  textPosition: 'center',
  hookStyle: 'normal',
  sample: {
    hook_text: 'The Quiet Power of Routine',
    body_text: 'Why high performers protect their mornings.',
  },
}
