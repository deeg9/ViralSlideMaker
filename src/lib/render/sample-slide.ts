import type { SlideTemplate } from './templates/index'
import type { Slide } from '@/lib/types/slide'

/**
 * Build a minimal Slide from the template's `sample` for picker thumbnails
 * and the offline thumbnail generator. `background_url: null` keeps
 * the preview snappy (no remote image fetch); `is_cta: false` keeps any
 * CTA-only render branches off.
 *
 * Phase 48 — extracted from template-picker.tsx so scripts/generate-template-thumbnails.ts
 * uses the same builder and ships byte-identical sample slides.
 */
export function makeSampleSlide(template: SlideTemplate): Slide {
  const sample = template.sample
  return {
    hook_text: sample?.hook_text ?? 'Sample headline',
    body_text: sample?.body_text ?? 'Sample body text.',
    hook_segments: sample?.hook_segments,
    image_query: '',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    style_overrides: sample?.layout ? { layout: sample.layout } : {},
  }
}
