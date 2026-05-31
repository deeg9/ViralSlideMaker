'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { SlidePreview } from '@/components/slides/slide-preview'
import { getTemplate } from '@/lib/render/templates'
// quick-260515-epn: published-carousel snapshot honors per-slide
// template_id_override the same way the editor does — so a remixable explore
// card whose slide_data carries the override visually matches the original.
import { resolvePerSlideTemplate } from '@/lib/render/resolve-per-slide-template'
import type { Slide } from '@/lib/types/slide'

interface ExploreCardProps {
  slug: string
  title: string
  heroImageUrl: string | null
  slides: Slide[]
  templateId: string | null
  creatorUsername: string | null
  bookmarkCount: number
  remixCount: number
}

export function ExploreCard({
  slug,
  title,
  heroImageUrl,
  slides,
  templateId,
  creatorUsername,
  bookmarkCount,
  remixCount,
}: ExploreCardProps) {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const template = getTemplate(templateId ?? 'highlight-bar')
  const totalSlides = slides.length
  const hasMultipleSlides = totalSlides > 1
  const safeIndex = Math.min(index, Math.max(0, totalSlides - 1))
  const currentSlide = slides[safeIndex]
  const isFirst = safeIndex === 0
  const isLast = safeIndex === totalSlides - 1

  function handlePrev(e: React.MouseEvent) {
    e.stopPropagation()
    setIndex((i) => Math.max(0, i - 1))
  }

  function handleNext(e: React.MouseEvent) {
    e.stopPropagation()
    setIndex((i) => Math.min(totalSlides - 1, i + 1))
  }

  function handleCardClick() {
    router.push(`/explore/${slug}`)
  }

  return (
    <div
      onClick={handleCardClick}
      className="group cursor-pointer bg-white rounded-2xl border border-[#dbc1bc]/30 overflow-hidden hover:shadow-lg hover:border-[#3d0000]/30 transition-all"
    >
      <div className="relative aspect-[9/16] bg-[#fadbdb]">
        {isFirst && heroImageUrl ? (
          <Image
            src={heroImageUrl}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover"
            unoptimized
          />
        ) : currentSlide ? (
          <SlidePreview
            slide={currentSlide}
            template={resolvePerSlideTemplate(currentSlide, template)}
            index={safeIndex}
            slideIndex={safeIndex}
            totalSlides={totalSlides}
            editable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[#7d6161]">
            <Icon name="image" size="lg" />
          </div>
        )}

        {hasMultipleSlides && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              disabled={isFirst}
              aria-label="Previous slide"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/90 hover:bg-white shadow-md text-[#3d0000] flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0 [@media(hover:none)]:enabled:opacity-100"
            >
              <Icon name="chevron_left" size="sm" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={isLast}
              aria-label="Next slide"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/90 hover:bg-white shadow-md text-[#3d0000] flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0 [@media(hover:none)]:enabled:opacity-100"
            >
              <Icon name="chevron_right" size="sm" />
            </button>
            <span
              className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 rounded-full bg-white/90 text-[#3d0000] text-[0.6rem] font-bold tracking-wider tabular-nums opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity pointer-events-none"
              aria-live="polite"
            >
              {safeIndex + 1} / {totalSlides}
            </span>
          </>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm text-[#3d0000] line-clamp-2">{title}</h3>
        {creatorUsername && (
          <p className="text-xs text-[#7d6161] mt-1">@{creatorUsername}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-[#7d6161] mt-2">
          <span className="flex items-center gap-1">
            <Icon name="bookmark" size="sm" />
            {bookmarkCount}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="content_copy" size="sm" />
            {remixCount}
          </span>
        </div>
      </div>
    </div>
  )
}
