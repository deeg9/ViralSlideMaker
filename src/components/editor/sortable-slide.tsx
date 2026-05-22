'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SlidePreview, ASPECT_CLASS } from '@/components/slides/slide-preview'
import type { Slide } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'
import { CAROUSEL_FORMATS, type CarouselFormat } from '@/lib/render/carousel-formats'
// quick-260515-epn: each thumbnail resolves its own template via
// resolvePerSlideTemplate so a slide carrying `template_id_override`
// (typically projector-emitted from Copy Style → archetype) renders in the
// thumbnail with the right archetype-matched template, matching the canvas
// preview. Otherwise users would see a stale thumbnail of a slide that
// renders differently on the canvas.
import { resolvePerSlideTemplate } from '@/lib/render/resolve-per-slide-template'

interface SortableSlideProps {
  id: string
  slide: Slide
  template: SlideTemplate
  index: number
  // Phase 45 — totalSlides + topic threaded through to <SlidePreview> for
  // page-counter / slide-field overlay resolution. totalSlides is required
  // so the slide-list pass can never accidentally drop it; topic is optional.
  totalSlides: number
  topic?: string
  isSelected: boolean
  onSelect: (index: number) => void
  userTier?: 'free' | 'plus' | 'pro'
  // Phase 90: carousel output format — drives the thumbnail aspect ratio so
  // the strip matches the canvas. Defaults to `tiktok`.
  format?: CarouselFormat
}

export function SortableSlide({
  id,
  slide,
  template,
  index,
  totalSlides,
  topic,
  isSelected,
  onSelect,
  userTier,
  format = CAROUSEL_FORMATS.tiktok,
}: SortableSlideProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // quick-260515-epn: resolve per-slide template_id_override at the thumbnail
  // boundary so the left-rail tile and the center canvas show the same
  // template for the same slide. No override → returns `template` by reference
  // (TPLREND-05 byte-identity).
  const perSlideTemplate = resolvePerSlideTemplate(slide, template)

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(index)}
      className={`relative w-20 lg:w-full shrink-0 cursor-grab active:cursor-grabbing rounded-xl p-1.5 transition-all ${
        isSelected
          ? 'bg-[#fadbdb] ring-2 ring-[#3d0000]'
          : 'hover:bg-[#ffe0e0]'
      }`}
      data-testid={`sortable-slide-${index}`}
    >
      <div className={`${ASPECT_CLASS[format.id]} rounded-lg overflow-hidden bg-white`}>
        <SlidePreview
          slide={slide}
          template={perSlideTemplate}
          index={index}
          slideIndex={index}
          totalSlides={totalSlides}
          topic={topic}
          userTier={userTier}
          format={format}
        />
      </div>
    </button>
  )
}
