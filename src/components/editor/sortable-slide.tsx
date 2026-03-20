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
      className={`relative w-full cursor-grab active:cursor-grabbing rounded-lg overflow-hidden border-2 transition-colors min-h-[44px] ${
        isSelected
          ? 'border-primary ring-2 ring-primary/30'
          : 'border-transparent hover:border-muted-foreground/30'
      }`}
      data-testid={`sortable-slide-${index}`}
    >
      <SlidePreview slide={slide} template={template} index={index} />
    </button>
  )
}
