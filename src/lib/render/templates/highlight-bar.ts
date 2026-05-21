import type { SlideTemplate } from './index'

// "Highlight Bar" — white background with bright yellow highlight bars on key text.
// Inspired by viral creator style (uses TextHighlightEffect with style: 'tight').
export const highlightBar: SlideTemplate = {
  id: 'highlight-bar',
  name: 'Highlight Bar',
  thumbnail: '/templates/highlight-bar.png',
  fontFamily: "'Inter', sans-serif",
  hookFontSize: '96px',
  bodyFontSize: '36px',
  textColor: '#000000',
  backgroundColor: '#ffffff',
  overlayColor: '#FFD600',
  overlayOpacity: 0,
  textAlign: 'left',
  textPosition: 'center',
  hookStyle: 'uppercase',
  accentColor: '#FFD600',
  sample: {
    hook_text: 'HOW I GAINED 50K FOLLOWERS',
    body_text: 'In 30 days using only carousel posts.',
  },
  preview: 'https://mzfeqsyhnxgnrdawlhcb.supabase.co/storage/v1/object/public/template-previews/code-templates/highlight-bar.png',
}
