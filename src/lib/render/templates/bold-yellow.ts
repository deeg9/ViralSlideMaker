import type { SlideTemplate } from './index'

// "Bold Yellow" — black Bebas Neue headline on a solid yellow background.
// Brittany-Broski / shitposter style. Universally legible, very high engagement.
export const boldYellow: SlideTemplate = {
  id: 'bold-yellow',
  name: 'Bold Yellow',
  thumbnail: '/templates/bold-yellow.png',
  fontFamily: "'Bebas Neue', sans-serif",
  hookFontSize: '120px',
  bodyFontSize: '38px',
  textColor: '#000000',
  backgroundColor: '#FFD600',
  overlayColor: '#000000',
  overlayOpacity: 0,
  textAlign: 'left',
  textPosition: 'center',
  hookStyle: 'uppercase',
  // quick-260519-pbg: color-block kill-switch — suppress any persisted
  // slide.background_url so the solid yellow canvas stays the canvas.
  // Without this, enabling Stock Photos painted a Pexels image over the
  // yellow and broke the Brittany-Broski color-block identity.
  backgroundMode: 'color',
  sample: {
    hook_text: 'STOP SCROLLING',
    body_text: 'This will change how you post forever.',
  },
  preview: 'https://mzfeqsyhnxgnrdawlhcb.supabase.co/storage/v1/object/public/template-previews/code-templates/bold-yellow.png',
}
