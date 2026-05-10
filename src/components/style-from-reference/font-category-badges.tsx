'use client'

// Phase 76 Plan 02 (PREVIEW-03):
// Pure display component — renders hook + body font category badges
// (4-category catalog: sans-serif | serif | display | handwriting).
//
// Graceful degradation: when both fields are undefined, renders an inline
// muted "Typography: not detected" line rather than an empty section.

import type { FontEntry } from '@/lib/fonts/font-catalog'

type FontCategory = FontEntry['category']

export interface FontCategoryBadgesProps {
  hookCategory?: FontCategory
  bodyCategory?: FontCategory
}

const CATEGORY_LABELS: Record<FontCategory, string> = {
  'sans-serif': 'Sans-Serif',
  serif: 'Serif',
  display: 'Display',
  handwriting: 'Handwriting',
}

export function FontCategoryBadges({ hookCategory, bodyCategory }: FontCategoryBadgesProps) {
  if (!hookCategory && !bodyCategory) {
    return (
      <p
        data-testid="font-badge-empty"
        className="text-[12px] italic text-[#7d6161]"
      >
        Typography: not detected
      </p>
    )
  }

  return (
    <div className="space-y-1">
      <span className="text-[12px] font-semibold text-[#3d0000]">Typography</span>
      <ul
        data-testid="font-badges-list"
        role="list"
        aria-label="Extracted typography categories"
        className="flex flex-wrap gap-2"
      >
        {hookCategory && (
          <li>
            <span
              data-testid="font-badge-hook"
              className="inline-flex items-center rounded-full border border-[#3d0000] bg-white px-2.5 py-0.5 text-[11px] font-medium text-[#3d0000]"
            >
              Hook: {CATEGORY_LABELS[hookCategory]}
            </span>
          </li>
        )}
        {bodyCategory && (
          <li>
            <span
              data-testid="font-badge-body"
              className="inline-flex items-center rounded-full border border-[#e2cfcf] bg-[#fff0f0] px-2.5 py-0.5 text-[11px] font-medium text-[#3d0000]"
            >
              Body: {CATEGORY_LABELS[bodyCategory]}
            </span>
          </li>
        )}
      </ul>
    </div>
  )
}
