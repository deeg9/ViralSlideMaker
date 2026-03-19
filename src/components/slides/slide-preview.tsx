'use client'

import type { Slide } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'

interface SlidePreviewProps {
  slide: Slide
  template: SlideTemplate
  index: number
}

export function SlidePreview({ slide, template, index }: SlidePreviewProps) {
  const positionMap = {
    top: 'flex-start',
    center: 'center',
    bottom: 'flex-end',
  }

  return (
    <div
      data-testid="slide-preview"
      className="relative rounded-lg overflow-hidden aspect-[9/16] w-full"
      style={{
        fontFamily: template.fontFamily,
        color: template.textColor,
        backgroundColor: template.backgroundColor,
        backgroundImage: slide.background_url
          ? `url(${slide.background_url})`
          : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: template.overlayColor,
          opacity: template.overlayOpacity,
        }}
      />

      {/* Content */}
      <div
        className="relative z-10 flex flex-col h-full p-4 sm:p-6"
        style={{
          justifyContent: positionMap[template.textPosition],
          textAlign: template.textAlign,
        }}
      >
        <div className="max-w-full">
          <p
            className="font-black leading-tight mb-2 text-sm sm:text-base"
            style={{
              fontSize: undefined, // Let responsive CSS handle it
              textTransform: template.hookStyle === 'uppercase' ? 'uppercase' : undefined,
              fontStyle: template.hookStyle === 'italic' ? 'italic' : undefined,
            }}
          >
            {slide.hook_text}
          </p>
          <p className="text-xs sm:text-sm leading-relaxed opacity-90">
            {slide.body_text}
          </p>
        </div>
      </div>

      {/* Slide number badge */}
      <div className="absolute top-2 right-2 z-20 bg-black/60 text-white text-[10px] font-bold rounded-full w-6 h-6 flex items-center justify-center">
        {index + 1}
      </div>
    </div>
  )
}
