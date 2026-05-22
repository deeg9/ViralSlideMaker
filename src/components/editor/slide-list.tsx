'use client'

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { SortableSlide } from '@/components/editor/sortable-slide'
import type { Slide } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'
import { CAROUSEL_FORMATS, type CarouselFormat } from '@/lib/render/carousel-formats'

interface SlideListProps {
  slides: Slide[]
  template: SlideTemplate
  selectedIndex: number
  onSelect: (index: number) => void
  onReorder: (oldIndex: number, newIndex: number) => void
  userTier?: 'free' | 'plus' | 'pro'
  // Phase 45 — project topic forwarded to <SortableSlide> → <SlidePreview>
  // for slide-field overlay resolution. Optional (graceful fallback to '').
  topic?: string
  // Phase 90: carousel output format — keeps the thumbnail strip's aspect
  // ratio in sync with the canvas. Defaults to `tiktok`.
  format?: CarouselFormat
}

export function SlideList({
  slides,
  template,
  selectedIndex,
  onSelect,
  onReorder,
  userTier,
  topic,
  format = CAROUSEL_FORMATS.tiktok,
}: SlideListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const slideIds = slides.map((_, i) => `slide-${i}`)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = slideIds.indexOf(active.id as string)
    const newIndex = slideIds.indexOf(over.id as string)
    onReorder(oldIndex, newIndex)
  }

  return (
    <div
      className="flex flex-row lg:flex-col gap-4 overflow-x-auto lg:overflow-y-auto lg:overflow-x-hidden"
      data-testid="slide-list"
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={slideIds} strategy={verticalListSortingStrategy}>
          {slides.map((slide, index) => (
            <SortableSlide
              key={slideIds[index]}
              id={slideIds[index]}
              slide={slide}
              template={template}
              index={index}
              totalSlides={slides.length}
              topic={topic}
              isSelected={index === selectedIndex}
              onSelect={onSelect}
              userTier={userTier}
              format={format}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}
