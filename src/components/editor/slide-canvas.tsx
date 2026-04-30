'use client'

import { Icon } from '@/components/ui/icon'
import { SlidePreview } from '@/components/slides/slide-preview'
import type { Slide, TextPosition, CustomText } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'
import type { BrandKit } from '@/lib/types/brand-kit'

interface SlideCanvasProps {
  slides: Slide[]
  template: SlideTemplate
  selectedIndex: number
  onSelectIndex: (index: number) => void
  brandKit?: BrandKit | null
  userTier?: 'free' | 'plus' | 'pro'
  // Phase 45 — project topic forwarded for slide-field overlay resolution.
  // Optional: when omitted, slide-field topic overlays render '' per Plan 45-01.
  topic?: string
  onPositionChange?: (field: 'hook' | 'body', position: TextPosition) => void
  onWidthChange?: (field: 'hook' | 'body', width: number) => void
  onCustomTextPositionChange?: (id: string, position: TextPosition) => void
  onCustomTextWidthChange?: (id: string, width: number) => void
  onCustomTextUpdate?: (id: string, updates: Partial<CustomText>) => void
  onCustomTextSelect?: (id: string | null) => void
  onCustomTextRemove?: (id: string) => void
  selectedCustomTextId?: string | null
  onCustomImagePositionChange?: (id: string, position: { x: number; y: number }) => void
  onCustomImageSizeChange?: (id: string, size: { width: number; height: number }) => void
  onCustomImageSelect?: (id: string | null) => void
  onCustomImageRemove?: (id: string) => void
  selectedCustomImageId?: string | null
  // Phase 52 (T-01): canvas → right-rail selection wiring. Click on hook/body/custom
  // wrappers in editable mode dispatches the matching TextBox.id; right rail mirrors.
  onTextBoxSelect?: (id: string | null) => void
  selectedTextBoxId?: string | null
}

export function SlideCanvas({
  slides,
  template,
  selectedIndex,
  onSelectIndex,
  brandKit,
  userTier,
  topic,
  onPositionChange,
  onWidthChange,
  onCustomTextPositionChange,
  onCustomTextWidthChange,
  onCustomTextUpdate,
  onCustomTextSelect,
  onCustomTextRemove,
  selectedCustomTextId,
  onCustomImagePositionChange,
  onCustomImageSizeChange,
  onCustomImageSelect,
  onCustomImageRemove,
  selectedCustomImageId,
  onTextBoxSelect,
  selectedTextBoxId,
}: SlideCanvasProps) {
  const currentSlide = slides[selectedIndex]
  if (!currentSlide) return null

  const isFirst = selectedIndex === 0
  const isLast = selectedIndex === slides.length - 1

  return (
    <div
      className="bg-[#fff8f7] flex flex-col items-center justify-center p-3 lg:p-8 overflow-hidden"
      data-testid="slide-canvas"
    >
      <div className="w-full max-w-md relative">
        <div className="rounded-xl shadow-[0px_20px_40px_rgba(61,0,0,0.06)] overflow-hidden">
          <SlidePreview
            slide={currentSlide}
            template={template}
            index={selectedIndex}
            slideIndex={selectedIndex}
            totalSlides={slides.length}
            topic={topic}
            editable={true}
            brandKit={brandKit}
            userTier={userTier}
            onPositionChange={onPositionChange}
            onWidthChange={onWidthChange}
            onCustomTextPositionChange={onCustomTextPositionChange}
            onCustomTextWidthChange={onCustomTextWidthChange}
            onCustomTextUpdate={onCustomTextUpdate}
            onCustomTextSelect={onCustomTextSelect}
            onCustomTextRemove={onCustomTextRemove}
            selectedCustomTextId={selectedCustomTextId}
            onCustomImagePositionChange={onCustomImagePositionChange}
            onCustomImageSizeChange={onCustomImageSizeChange}
            onCustomImageSelect={onCustomImageSelect}
            onCustomImageRemove={onCustomImageRemove}
            selectedCustomImageId={selectedCustomImageId}
            onTextBoxSelect={onTextBoxSelect}
            selectedTextBoxId={selectedTextBoxId}
          />
        </div>

        {/* Navigation arrows */}
        <button
          onClick={() => onSelectIndex(selectedIndex - 1)}
          disabled={isFirst}
          aria-label="Previous slide"
          className="absolute left-1 lg:left-[-20px] top-1/2 -translate-y-1/2 z-20 bg-white/90 lg:bg-white shadow-lg hover:bg-[#fadbdb] text-[#3d0000] rounded-full p-1.5 lg:p-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed w-8 h-8 lg:w-10 lg:h-10 flex items-center justify-center"
        >
          <Icon name="chevron_left" size="sm" />
        </button>

        <button
          onClick={() => onSelectIndex(selectedIndex + 1)}
          disabled={isLast}
          aria-label="Next slide"
          className="absolute right-1 lg:right-[-20px] top-1/2 -translate-y-1/2 z-20 bg-white/90 lg:bg-white shadow-lg hover:bg-[#fadbdb] text-[#3d0000] rounded-full p-1.5 lg:p-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed w-8 h-8 lg:w-10 lg:h-10 flex items-center justify-center"
        >
          <Icon name="chevron_right" size="sm" />
        </button>
      </div>

      {/* Slide counter -- below the canvas */}
      <div className="mt-4 bg-white px-4 py-2 rounded-full flex items-center gap-4 shadow-sm border border-[#dbc1bc]/10">
        <span className="text-[10px] font-bold text-[#3d0000] uppercase tracking-widest">
          Slide {selectedIndex + 1} / {slides.length}
        </span>
      </div>
    </div>
  )
}
