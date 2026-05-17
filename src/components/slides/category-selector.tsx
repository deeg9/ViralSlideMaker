'use client'

// Phase 82 (R6) — the content-category selector card grid.
// Renders per 82-UI-SPEC.md: a 3-up bordered card grid mirroring the
// "Background Images" toggle pattern in generation-form.tsx. Single-select,
// always one category active. The collapsible section header is owned by
// generation-form.tsx — this component is just the card grid.

import { CATEGORIES } from '@/lib/ai/categories'
import { Icon } from '@/components/ui/icon'

interface CategorySelectorProps {
  /** Current ContentCategory id. */
  selected: string
  onSelect: (id: string) => void
  /** True while a generation is pending — locks the cards. */
  disabled?: boolean
}

/** Material Symbol per category id. */
const CATEGORY_ICON: Record<string, string> = {
  news: 'newspaper',
  facts: 'lightbulb',
}

export function CategorySelector({ selected, onSelect, disabled = false }: CategorySelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {CATEGORIES.map((category) => {
        const isSelected = selected === category.id
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            disabled={disabled}
            aria-pressed={isSelected}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              isSelected
                ? 'border-[#3d0000] bg-[#fff0f0]'
                : 'border-[#dbc1bc]/20 bg-white hover:border-[#dbc1bc]/40'
            } disabled:opacity-50`}
          >
            <Icon
              name={CATEGORY_ICON[category.id] ?? 'category'}
              size="lg"
              className={isSelected ? 'text-[#3d0000]' : 'text-[#7d6161]'}
            />
            <span
              className={`text-sm font-semibold ${
                isSelected ? 'text-[#3d0000]' : 'text-[#7d6161]'
              }`}
            >
              {category.label}
            </span>
            <span className="text-[10px] text-[#7d6161] text-center">{category.tagline}</span>
          </button>
        )
      })}
    </div>
  )
}
