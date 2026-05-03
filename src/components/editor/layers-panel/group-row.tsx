'use client'

import { Icon } from '@/components/ui/icon'
import type { GroupRowProps } from './types'

/**
 * Phase 65 Plan 01 (LAYERS-02): group-collapse row.
 *
 * CONTEXT D-02: a synthesized row emitted ONCE per groupId. Renders a
 * chevron that expands/collapses the member chips below + a "Group (N)"
 * label showing member count. Two empty data-testid slots (group-lock-slot
 * + group-vis-slot) are placeholders that Plan 65-02 will fill with
 * per-group toggle buttons (LAYERS-05 / LAYERS-06).
 *
 * Click on the toggle button (chevron + label area) calls
 * `onToggleExpanded()`. The expanded state itself lives in panel-local
 * useState<Record<string, boolean>> at LayersPanel — this component is
 * fully controlled by props (no local state).
 *
 * No drag handle — drag-to-reorder is OUT of scope per CONTEXT D-01
 * (vanilla decision). Plan 65-02 will add a button-based reorder slot.
 */
export function GroupRow({ row, expanded, onToggleExpanded }: GroupRowProps) {
  return (
    <div
      data-testid="group-row"
      data-group-id={row.groupId}
      data-expanded={expanded ? 'true' : 'false'}
      className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-[#fadbdb]/40 transition-colors"
    >
      <button
        data-testid="group-row-toggle"
        type="button"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
        className="flex items-center gap-1 flex-1 text-left text-xs text-[#3d0000] focus:outline-none"
      >
        <Icon
          name={expanded ? 'expand_more' : 'chevron_right'}
          size="sm"
          className="text-[#795e5e]"
        />
        <span className="font-semibold">
          Group ({row.memberIds.length})
        </span>
      </button>
      <div data-testid="group-lock-slot" className="w-5 h-5" />
      <div data-testid="group-vis-slot" className="w-5 h-5" />
    </div>
  )
}
