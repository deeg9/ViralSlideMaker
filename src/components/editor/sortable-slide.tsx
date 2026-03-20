'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SlidePreview } from '@/components/slides/slide-preview'
import type { Slide } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'

interface SortableSlideProps {
  id: string
  slide: Slide
  template: SlideTemplate
  index: number
  isSelected: boolean
  onSelect: (index: number) => void
}

export function SortableSlide({
  id,
  slide,
  template,
  index,
  isSelected,
  onSelect,
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

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(index)}
      className={`relative w-full shrink-0 cursor-grab active:cursor-grabbing rounded-xl p-1.5 transition-all ${
        isSelected
          ? 'bg-[#fadbdb] ring-2 ring-[#3d0000]'
          : 'hover:bg-[#ffe0e0]'
      }`}
      data-testid={`sortable-slide-${index}`}
    >
      <div className="aspect-[9/16] rounded-lg overflow-hidden bg-white">
        <SlidePreview slide={slide} template={template} index={index} />
      </div>
    </button>
  )
}
