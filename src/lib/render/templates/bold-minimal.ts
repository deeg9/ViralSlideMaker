import type { SlideTemplate } from './index'

export const boldMinimal: SlideTemplate = {
  id: 'bold-minimal',
  name: 'Bold Minimal',
  thumbnail: '/templates/bold-minimal.png',
  fontFamily: "'Inter', sans-serif",
  hookFontSize: '72px',
  bodyFontSize: '36px',
  textColor: '#ffffff',
  backgroundColor: '#000000',
  overlayColor: '#000000',
  overlayOpacity: 0,
  textAlign: 'center',
  textPosition: 'center',
  hookStyle: 'uppercase',
  sample: {
    hook_text: 'STOP DOING THIS',
    body_text: 'Your morning routine is broken.',
  },
}
