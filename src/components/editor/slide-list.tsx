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

interface SlideListProps {
  slides: Slide[]
  template: SlideTemplate
  selectedIndex: number
  onSelect: (index: number) => void
  onReorder: (oldIndex: number, newIndex: number) => void
}

export function SlideList({
  slides,
  template,
  selectedIndex,
  onSelect,
  onReorder,
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
      className="overflow-y-auto lg:h-full lg:flex-col flex lg:flex gap-2 p-2"
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
              isSelected={index === selectedIndex}
              onSelect={onSelect}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}
