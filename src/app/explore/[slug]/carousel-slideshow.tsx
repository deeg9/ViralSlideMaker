'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/icon'
import { SlidePreview } from '@/components/slides/slide-preview'
// quick-260515-epn: explore detail viewer mirrors the editor — slide.template_id_override
// drives which template paints the slide so a published carousel renders
// identically to the original project.
import { resolvePerSlideTemplate } from '@/lib/render/resolve-per-slide-template'
import type { Slide } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'

interface CarouselSlideshowProps {
  slides: Slide[]
  template: SlideTemplate
  ownerTier?: 'free' | 'plus' | 'pro'
}

export function CarouselSlideshow({ slides, template, ownerTier }: CarouselSlideshowProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  if (slides.length === 0) return null
  const currentSlide = slides[selectedIndex]
  const isFirst = selectedIndex === 0
  const isLast = selectedIndex === slides.length - 1
  // quick-260515-epn: per-slide override resolution. No override → returns
  // `template` by reference (TPLREND-05 byte-identity gate).
  const perSlideTemplate = resolvePerSlideTemplate(currentSlide, template)

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-md relative">
        <div className="rounded-xl shadow-[0px_20px_40px_rgba(61,0,0,0.06)] overflow-hidden">
          <SlidePreview
            slide={currentSlide}
            template={perSlideTemplate}
            index={selectedIndex}
            slideIndex={selectedIndex}
            totalSlides={slides.length}
            // Phase 45: topic intentionally NOT passed — published_carousels is
            // a snapshot table that does not denormalize project.topic
            // (RESEARCH.md Pitfall 4 / locked behavior). Slide-field topic
            // overlays render '' in the public viewer; this is the documented
            // contract until a follow-up phase persists topic into published
            // snapshots.
            editable={false}
            userTier={ownerTier}
          />
        </div>

        <button
          onClick={() => setSelectedIndex((i) => Math.max(0, i - 1))}
          disabled={isFirst}
          aria-label="Previous slide"
          className="absolute left-1 lg:left-[-20px] top-1/2 -translate-y-1/2 z-20 bg-white/90 lg:bg-white shadow-lg hover:bg-[#fadbdb] text-[#3d0000] rounded-full p-1.5 lg:p-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed w-8 h-8 lg:w-10 lg:h-10 flex items-center justify-center"
        >
          <Icon name="chevron_left" size="sm" />
        </button>

        <button
          onClick={() => setSelectedIndex((i) => Math.min(slides.length - 1, i + 1))}
          disabled={isLast}
          aria-label="Next slide"
          className="absolute right-1 lg:right-[-20px] top-1/2 -translate-y-1/2 z-20 bg-white/90 lg:bg-white shadow-lg hover:bg-[#fadbdb] text-[#3d0000] rounded-full p-1.5 lg:p-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed w-8 h-8 lg:w-10 lg:h-10 flex items-center justify-center"
        >
          <Icon name="chevron_right" size="sm" />
        </button>
      </div>

      <div className="mt-4 bg-white px-4 py-2 rounded-full flex items-center gap-4 shadow-sm border border-[#dbc1bc]/10">
        <span className="text-[10px] font-bold text-[#3d0000] uppercase tracking-widest">
          Slide {selectedIndex + 1} / {slides.length}
        </span>
      </div>
    </div>
  )
}
