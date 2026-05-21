'use client'

import { pickerTemplates } from '@/lib/render/templates/index'
import type { SlideTemplate } from '@/lib/render/templates/index'
import type { PickerDbTemplate } from '@/lib/render/templates/registry'
import { getCategory } from '@/lib/ai/categories'
import { TemplateTilePreview } from './template-tile-preview'

interface TemplatePickerProps {
  selectedId: string
  onSelect: (id: string) => void
  /** Phase 82 (R7/R8): when set, the picker shows only the intersection of
   *  the keeper set (pickerTemplates) and this category's curated templateIds,
   *  ordered by the category's templateIds. Absent → all keepers shown. */
  category?: string
  /** Phase 87 (WIRE-01): DB-backed templates resolved server-side, each
   *  paired with its row category + created_at. The picker shows the ones
   *  whose category matches the selected category FIRST (newest-first), then
   *  that category's code templates. Defaults to [] so existing callers/tests
   *  are unchanged. */
  dbTemplates?: PickerDbTemplate[]
}

export function TemplatePicker({ selectedId, onSelect, category, dbTemplates = [] }: TemplatePickerProps) {
  // Phase 82 (R7/R8): filter to the selected category's curated subset.
  // When the category resolves, show only keeper templates the category
  // allows, in the category's templateIds order. Absent/unresolved category
  // falls back to the full keeper set (current behavior — no regression).
  const categoryModule = category ? getCategory(category) : undefined
  const categoryCodeTemplates: SlideTemplate[] = categoryModule
    ? categoryModule.templateIds
        .map((id) => pickerTemplates.find((t) => t.id === id))
        .filter((t): t is SlideTemplate => t !== undefined)
    : pickerTemplates
  // Phase 87 (WIRE-01): DB templates whose category matches the selected
  // category, DB-first then the category's code templates. dbTemplates
  // arrives newest-first (created_at desc) from getPickerDbTemplates().
  const categoryDbTemplates: SlideTemplate[] = categoryModule
    ? dbTemplates
        .filter((d) => d.category === category)
        .map((d) => d.template)
    : []
  const visibleTemplates: SlideTemplate[] = [
    ...categoryDbTemplates,
    ...categoryCodeTemplates,
  ]

  return (
    <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 -mx-4 px-4">
      {visibleTemplates.map((template) => {
        const isSelected = selectedId === template.id
        return (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template.id)}
            className="flex-none w-40 group text-left"
          >
            <div
              className={`aspect-[9/16] rounded-xl overflow-hidden mb-3 border-2 transition-all relative ${
                isSelected
                  ? 'border-[#3d0000]'
                  : 'border-transparent group-hover:border-[#dbc1bc]'
              }`}
            >
              <div className="absolute inset-0 group-hover:scale-105 transition-transform duration-500 pointer-events-none">
                {/* Phase 86 (ADMIN-02): DB templates with a saved cover-snapshot
                    PNG render the PNG; code templates fall back to the live
                    <SlidePreview> path (byte-identical to before). */}
                <TemplateTilePreview template={template} />
              </div>
            </div>
            <span className="block text-sm font-semibold text-[#3d0000]">
              {template.name}
            </span>
            <span className={`block text-[10px] uppercase tracking-wider ${
              isSelected
                ? 'text-[#3d0000] font-bold'
                : 'text-[#7d6161]'
            }`}>
              {isSelected ? 'Selected' : 'Style'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
