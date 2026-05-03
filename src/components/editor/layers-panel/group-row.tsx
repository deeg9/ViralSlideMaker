'use client'

import { Icon } from '@/components/ui/icon'
import type { GroupRowProps } from './types'

/**
 * Phase 65 Plan 01 (LAYERS-02): group-collapse row.
 * Phase 65 Plan 02 (LAYERS-05/06 group-scope): lock + visibility toggles
 * filled into the previously-empty group-lock-slot / group-vis-slot.
 *
 * Click on the chevron + label area calls `onToggleExpanded()`. Click on
 * the lock or vis button calls `onGroupLockToggle` / `onGroupVisibilityToggle`
 * with the full memberIds array — the parent dispatches a single SET_LOCKED
 * / SET_HIDDEN action via Plan 64-01 / 64-02. One pushHistory entry per
 * group toggle (KBD-09 / PERF-01 carry-forward).
 *
 * Group-row z-order is intentionally OUT of scope (cross-array reorder +
 * multi-id splice deferred to v2.12+ per Plan 64-03 ZA4).
 *
 * No drag handle — drag-to-reorder is OUT of scope per CONTEXT D-01.
 *
 * Toggle buttons stopPropagation so clicks don't bubble up to the
 * surrounding `<div>` and accidentally toggle expansion (GT4 pin).
 */
export function GroupRow({
  row,
  expanded,
  onToggleExpanded,
  onGroupLockToggle,
  onGroupVisibilityToggle,
}: GroupRowProps) {
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
      {/* group-lock-slot filled by Plan 65-02 — LAYERS-05 group-scope */}
      <button
        type="button"
        data-testid="group-lock-button"
        data-pressed={row.allLocked ? 'true' : 'false'}
        title="Lock group"
        aria-label={row.allLocked ? 'Unlock group' : 'Lock group'}
        aria-pressed={row.allLocked}
        onClick={(e) => {
          e.stopPropagation()
          onGroupLockToggle(row.memberIds, !row.allLocked)
        }}
        className={[
          'w-5 h-5 flex items-center justify-center rounded transition-colors focus:outline-none',
          row.allLocked
            ? 'bg-[#3d0000] text-white'
            : 'text-[#795e5e] hover:bg-[#fadbdb]',
        ].join(' ')}
      >
        <Icon name={row.allLocked ? 'lock' : 'lock_open'} size="sm" />
      </button>
      {/* group-vis-slot filled by Plan 65-02 — LAYERS-06 group-scope */}
      <button
        type="button"
        data-testid="group-vis-button"
        data-pressed={row.allHidden ? 'true' : 'false'}
        title="Toggle group visibility"
        aria-label={row.allHidden ? 'Show group' : 'Hide group'}
        aria-pressed={row.allHidden}
        onClick={(e) => {
          e.stopPropagation()
          onGroupVisibilityToggle(row.memberIds, !row.allHidden)
        }}
        className={[
          'w-5 h-5 flex items-center justify-center rounded transition-colors focus:outline-none',
          row.allHidden
            ? 'bg-[#3d0000] text-white'
            : 'text-[#795e5e] hover:bg-[#fadbdb]',
        ].join(' ')}
      >
        <Icon name={row.allHidden ? 'visibility_off' : 'visibility'} size="sm" />
      </button>
    </div>
  )
}
