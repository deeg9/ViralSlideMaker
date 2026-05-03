'use client'

import type { Slide } from '@/lib/types/slide'
import type { Selection } from '@/lib/editor/use-selection-model'

export interface MultiSelectTypeBarProps {
  slide: Slide
  selection: Selection
  onBulkDelete: (ids: string[]) => void
  // Phase 60 only declares this prop set. Bulk-edit handlers
  // (font, color, treatment) wire in Phase 63 (alignment).
}

/**
 * Phase 60 (SEL-12): Right-rail panel shown when N >= 2 elements are
 * selected. Replaces the single-element ActiveTextBoxCard via a ternary
 * branch in text-editor-panel.tsx.
 *
 * Phase 60 minimal surface: count + type breakdown + Delete button.
 * Property fields (font, color, treatment) arrive in Phase 63 alongside
 * the alignment toolbar.
 *
 * NOTE per PITFALL-12.3 / PITFALL-1.3: no "primary" key-object UX.
 * Right rail does NOT track which element was clicked first.
 */
export function MultiSelectTypeBar({
  slide,
  selection,
  onBulkDelete,
}: MultiSelectTypeBarProps) {
  const idSet = new Set(selection.ids)
  const textBoxCount = (slide.text_boxes ?? []).filter((tb) =>
    idSet.has(tb.id),
  ).length
  const imageCount = (slide.custom_images ?? []).filter((ci) =>
    idSet.has(ci.id),
  ).length
  const watermarkCount =
    slide.watermark && idSet.has(slide.watermark.id) ? 1 : 0
  const total = selection.ids.length

  return (
    <div
      data-testid="multi-select-type-bar"
      className="space-y-3 rounded-md border border-neutral-200 bg-white p-3"
    >
      <h3 className="text-sm font-medium">{total} elements selected</h3>
      <ul className="space-y-1 text-xs text-neutral-700">
        {textBoxCount > 0 && (
          <li>
            {textBoxCount} {textBoxCount === 1 ? 'text box' : 'text boxes'}
          </li>
        )}
        {imageCount > 0 && (
          <li>
            {imageCount} {imageCount === 1 ? 'image' : 'images'}
          </li>
        )}
        {watermarkCount > 0 && <li>1 watermark</li>}
      </ul>
      <button
        type="button"
        onClick={() => onBulkDelete(selection.ids)}
        className="w-full rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
      >
        Delete {total} elements
      </button>
    </div>
  )
}
