import type { SlideTemplate } from './index'

// "Y2K Pop" — bubbly display font on a hot-pink background with electric-blue accent.
// Bungee was the design intent; Righteous (already in font catalog) is used as a fallback
// to avoid expanding the font-loading pipeline. Solid pink stands in for the
// pink->blue gradient until the render layer supports gradient backgrounds.
export const y2kPop: SlideTemplate = {
  id: 'y2k-pop',
  name: 'Y2K Pop',
  thumbnail: '/templates/y2k-pop.png',
  fontFamily: "'Righteous', sans-serif",
  hookFontSize: '104px',
  bodyFontSize: '36px',
  textColor: '#ffffff',
  backgroundColor: '#FF1493',
  overlayColor: '#00BFFF',
  overlayOpacity: 0,
  textAlign: 'center',
  textPosition: 'center',
  hookStyle: 'uppercase',
  sample: {
    hook_text: 'TOTALLY ICONIC',
    body_text: '5 Y2K trends back in 2026.',
  },
}
