'use client'

import type { Slide } from '@/lib/types/slide'
import { getTemplate } from '@/lib/render/templates/index'
import { SlidePreview } from './slide-preview'

interface SlideGridProps {
  slides: Slide[]
  templateId: string
}

export function SlideGrid({ slides, templateId }: SlideGridProps) {
  const template = getTemplate(templateId)

  if (slides.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <p className="text-muted-foreground">
          No slides yet. Generate a carousel to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {slides.map((slide, index) => (
        <SlidePreview
          key={index}
          slide={slide}
          template={template}
          index={index}
          slideIndex={index}
          totalSlides={slides.length}
        />
      ))}
    </div>
  )
}
