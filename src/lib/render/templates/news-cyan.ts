import type { SlideTemplate } from './index'

// "News Cyan" — metav3rse-style news Instagram carousels.
// Black background, oversized condensed display headline, cyan accent for keywords.
// Pairs with style_overrides.layout = 'cover' | 'body' just like News Drop, and
// shares the same Gemini prompt branch via the NEWS_TEMPLATES set.
//
// Phase 82 (R8): the News-category keeper, polished toward the reference
// news-headline style — full-bleed photojournalism image (via the legacy
// newsZone `cover`/`body` layout path, which already renders the background
// photo edge-to-edge), a dark tint under the headline for legibility, an
// oversized bold headline as the focal element, and a punchy cyan accent.
// `backgroundMode` / `overlays` are intentionally left undefined so the
// template keeps the newsZone full-bleed path and leaves room for the small
// top-anchored accessory_label (Plan 01) above the bottom-anchored headline.
// This is the ONE template whose render output changes deliberately in this
// phase — its render-parity snapshots (legacy regression + template
// fingerprint) and its byte-identical hash fixture are regenerated for this
// template only; every other template stays byte-identical.
export const newsCyan: SlideTemplate = {
  id: 'news-cyan',
  name: 'News Cyan',
  thumbnail: '/templates/news-cyan.png',
  fontFamily: "'Anton', sans-serif",
  // Phase 82 (R8): headline is the focal element — bumped 110 -> 124px so the
  // big bold headline dominates the slide, matching the reference.
  hookFontSize: '124px',
  // 260503-0f2: Anton ships single-weight (400) on Google Fonts. Force 400 so
  // Satori PNG export matches browser preview (which falls back to 400 when
  // 900 is requested but unavailable).
  hookFontWeight: 400,
  bodyFontSize: '38px',
  textColor: '#ffffff',
  backgroundColor: '#0a0a0a',
  // Phase 82 (R8): dark tint over the full-bleed photo so the big white
  // headline reads against bright news imagery (reference: dark gradient
  // under the headline). Opacity raised 0 -> 0.45.
  overlayColor: '#0a0a0a',
  overlayOpacity: 0.45,
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
  preview: 'https://mzfeqsyhnxgnrdawlhcb.supabase.co/storage/v1/object/public/template-previews/code-templates/news-cyan.png',
}
