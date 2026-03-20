'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SlidePreview } from '@/components/slides/slide-preview'
import type { Slide } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'

interface SlideCanvasProps {
  slides: Slide[]
  template: SlideTemplate
  selectedIndex: number
  onSelectIndex: (index: number) => void
}

export function SlideCanvas({
  slides,
  template,
  selectedIndex,
  onSelectIndex,
}: SlideCanvasProps) {
  const currentSlide = slides[selectedIndex]
  if (!currentSlide) return null

  const isFirst = selectedIndex === 0
  const isLast = selectedIndex === slides.length - 1

  return (
    <div className="flex flex-col items-center gap-3 p-4" data-testid="slide-canvas">
      <div className="relative w-full max-w-[360px]">
        <SlidePreview
          slide={currentSlide}
          template={template}
          index={selectedIndex}
        />

        {/* Navigation arrows */}
        <button
          onClick={() => onSelectIndex(selectedIndex - 1)}
          disabled={isFirst}
          aria-label="Previous slide"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={() => onSelectIndex(selectedIndex + 1)}
          disabled={isLast}
          aria-label="Next slide"
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        Slide {selectedIndex + 1} of {slides.length}
      </p>
    </div>
  )
}
