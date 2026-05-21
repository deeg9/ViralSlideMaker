import type { SlideTemplate } from './index'

/**
 * "Paper Essay" — pure-typography editorial template (free tier).
 *
 * Aesthetic reference: long-form Substack / mindful-essay carousels (e.g.
 * "mindful by b" — note on decision fatigue). Cream paper background,
 * warm-dark serif headlines, restrained centered composition. NO photo.
 *
 * Distinguishes from `editorial-serif` (dark + B&W image bleed) and
 * `notes-app-chic` (cream + ransom-note hook + tape/sticky decorations):
 * Paper Essay is the quiet sibling — typography only, page counter only,
 * `paletteMode: 'fixed'` so the look stays consistent across decks.
 *
 * Free-tier — NOT in PREMIUM_TEMPLATE_IDS. bodyFontFamily declared
 * explicitly per the universal anti-Inter discipline.
 */
export const paperEssay: SlideTemplate = {
  id: 'paper-essay',
  name: 'Paper Essay',
  thumbnail: '/templates/paper-essay.png',
  fontFamily: "'Lora', serif",
  headingFontFamily: "'Playfair Display', serif",
  bodyFontFamily: "'Lora', serif",
  hookFontSize: '100px',
  bodyFontSize: '34px',
  textColor: '#1F1F1F',
  backgroundColor: '#F2EBDA',
  overlayColor: '#000000',
  overlayOpacity: 0,
  textAlign: 'center',
  textPosition: 'center',
  hookStyle: 'normal',
  accentColor: '#6B6354',
  backgroundMode: 'color',
  grainMode: 'paper',
  paletteMode: 'fixed',
  coverLayout: {
    textPosition: 'center',
    textAlign: 'center',
    hookFontSize: '100px',
  },
  aiVoiceNote:
    'Editorial essay register — restrained, mindful, single-idea-per-slide. Use lowercase serif headlines and short italic sub-text. Avoid hype, listicle tropes, or hedges.',
  overlays: [
    // Inset hairline frame — Brittany "mindful by b" signature look. Sits at
    // (0,0) and covers the full canvas; the SVG itself draws a 980×1820 stroked
    // rect inset 50px on all sides. Renders before text so headlines/body paint
    // on top. Putting this first in the array keeps z-stack predictable.
    {
      position: 'free',
      content: { type: 'decorative', asset: 'paper-frame', opacity: 1 },
      offset: { x: 0, y: 0 },
    },
    {
      position: 'top-right',
      content: { type: 'page-counter' },
      style: {
        background: 'transparent',
        color: '#6B6354',
        fontSize: '28px',
        fontWeight: 500,
      },
    },
    // Editorial rule between hook and body (Brittany "mindful by b" reference).
    // The 200×6 SVG sits in the gap between the hook and body. Hook spans
    // y=576..708 (1 line) or y=576..840 (2 lines); body starts at y=922.
    // Placing the rule at y=875 gives a clean separator below 2-line hooks
    // (32px gap above body) and a bit of breathing room below 1-line hooks.
    // Same fixed-position trade-off as notes-app-chic decorative overlays —
    // 3+ line hooks may clip and require manual override.
    // Centered horizontally on the 1080-wide canvas: left = (1080 − 200) / 2 = 440.
    {
      position: 'free',
      content: { type: 'decorative', asset: 'rule-thin', opacity: 1 },
      offset: { x: 440, y: 875 },
    },
  ],
  sample: {
    hook_text: 'staying is the default.',
    body_text: 'doing nothing = you stayed. leaving takes effort.',
  },
  preview: 'https://mzfeqsyhnxgnrdawlhcb.supabase.co/storage/v1/object/public/template-previews/code-templates/paper-essay.png',
}
