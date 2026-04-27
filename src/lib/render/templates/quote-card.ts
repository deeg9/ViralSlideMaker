import type { SlideTemplate } from './index'

// "Quote Card" — large pull-quote in italic Lora on a deep navy background.
export const quoteCard: SlideTemplate = {
  id: 'quote-card',
  name: 'Quote Card',
  thumbnail: '/templates/quote-card.png',
  fontFamily: "'Lora', serif",
  hookFontSize: '78px',
  bodyFontSize: '32px',
  textColor: '#f5f5f5',
  backgroundColor: '#1a1a2e',
  overlayColor: '#1a1a2e',
  overlayOpacity: 0,
  textAlign: 'center',
  textPosition: 'center',
  hookStyle: 'italic',
  sample: {
    hook_text: 'Be so good they can’t ignore you.',
    body_text: '— Steve Martin',
  },
}
