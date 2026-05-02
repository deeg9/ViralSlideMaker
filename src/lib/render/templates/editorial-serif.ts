import type { SlideTemplate } from './index'

/**
 * "Editorial Serif" — Phase 56 (TPL-01) free-tier premium template.
 *
 * Aesthetic reference: NYT / SSENSE / A24 magazine-style carousels.
 * Restrained, declarative single-sentence copy on a B&W bleed photo with
 * Playfair Display headlines and Lora body. Cream `#F5EFE6` accent — text
 * + page counter only, no chips. `photoTreatment: 'bw'` runs server-side
 * via Phase 54's treat.ts at generation time. `grainMode: 'medium'` adds
 * a subtle 0.08 opacity print-grain overlay (Phase 55 renderGrain helper).
 *
 * Free-tier (TPL-09) — NOT in PREMIUM_TEMPLATE_IDS. Validator does not
 * require bodyFontFamily, but we declare it explicitly (D-04) per the
 * universal anti-Inter discipline (Anti-Pattern #1).
 *
 * Cover layout (TPL-06): first slide hook moves to upper-third for the
 * "magazine cover headline" feel; inner slides keep the bottom-left hook.
 */
export const editorialSerif: SlideTemplate = {
  id: 'editorial-serif',
  name: 'Editorial Serif',
  thumbnail: '/templates/editorial-serif.png',
  fontFamily: "'Lora', serif",
  headingFontFamily: "'Playfair Display', serif",
  bodyFontFamily: "'Lora', serif",
  hookFontSize: '130px',
  bodyFontSize: '36px',
  textColor: '#F5EFE6',
  backgroundColor: '#0A0A0A',
  overlayColor: '#000000',
  overlayOpacity: 0.25,
  textAlign: 'left',
  textPosition: 'bottom',
  hookStyle: 'normal',
  accentColor: '#F5EFE6',
  backgroundMode: 'image-bleed',
  photoTreatment: 'bw',
  grainMode: 'medium',
  // Phase 57 (D-13, PALETTE-03): page-counter chip uses Vibrant background +
  // DarkMuted text via getEditorialSerifChipColors when derived_palette is set;
  // falls back to cream + deep-brown brand pair otherwise.
  paletteMode: 'palette-dominant',
  coverLayout: {
    textPosition: 'top',
    textAlign: 'left',
    hookFontSize: '130px',
  },
  aiVoiceNote:
    'Editorial register — restrained, declarative single sentences. Avoid hedges and filler. Reference cultural / institutional / personal nuance over listicle tropes.',
  overlays: [
    {
      position: 'top-right',
      content: { type: 'page-counter' },
      style: {
        background: 'transparent',
        color: '#F5EFE6',
        fontSize: '28px',
        fontWeight: 700,
      },
    },
  ],
  sample: {
    hook_text: 'The quietest revolutions begin in living rooms',
    body_text:
      "Why community kitchens are 2026's most quietly radical institution.",
  },
}
