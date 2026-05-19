'use client'

// Phase 86 (ADMIN-02): the per-tile preview switch for the template picker.
//
// A DB template authored via the Save-as-Template flow carries a `preview` URL
// (a rendered cover-snapshot PNG) — its tile shows the PNG, faithful to the
// source carousel because the snapshot includes the actual photo. Every other
// template (the 13 code templates, the brand-kit synthesized template) leaves
// `preview` undefined and falls back to the existing live <SlidePreview> path.
// That fallback is BYTE-IDENTICAL to the pre-Phase-86 picker tile body —
// render parity (TPLREND-05) for code templates is preserved.

import type { SlideTemplate } from '@/lib/render/templates/index'
import type { BrandKit } from '@/lib/types/brand-kit'
import { makeSampleSlide } from '@/lib/render/sample-slide'
import { SlidePreview } from './slide-preview'

export function TemplateTilePreview({
  template,
  brandKit,
}: {
  template: SlideTemplate
  brandKit?: BrandKit | null
}) {
  if (typeof template.preview === 'string' && template.preview.length > 0) {
    // DB template with a saved cover-snapshot PNG — render the PNG faithfully
    // inside the fixed 9:16 tile frame (ADMIN-02). A plain <img> is used (not
    // next/image) because the tile frame is a fixed `absolute inset-0` box and
    // the preview URLs are arbitrary Supabase Storage URLs.
    return (
      <img
        src={template.preview}
        alt={`Preview of ${template.name}`}
        className="absolute inset-0 h-full w-full object-cover"
      />
    )
  }

  // Fallback — the existing live picker tile body, unchanged.
  return (
    <SlidePreview
      slide={makeSampleSlide(template)}
      template={template}
      index={0}
      slideIndex={0}
      totalSlides={1}
      editable={false}
      brandKit={brandKit ?? undefined}
    />
  )
}
