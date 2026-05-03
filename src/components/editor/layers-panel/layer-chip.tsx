'use client'

import { memo, useRef } from 'react'
import { Icon } from '@/components/ui/icon'
import type { LayerChipProps, LayerElementType } from './types'

/**
 * Phase 65 Plan 01 (LAYERS-09 / PERF-04): individual layer chip wrapped
 * in React.memo with custom equality.
 *
 * Phase 65 Plan 02 (LAYERS-05/06/07): three button slots filled —
 *   - Lock button (data-testid="chip-lock-button") → onLockToggle
 *     dispatches SET_LOCKED via Plan 64-01.
 *   - Visibility button (data-testid="chip-vis-button") → onVisibilityToggle
 *     dispatches SET_HIDDEN via Plan 64-02.
 *   - Up/down z-order arrows (data-testid="chip-reorder-up" /
 *     "chip-reorder-down") → onReorder dispatches Z_ORDER 'forward' /
 *     'backward' via Plan 64-03. Watermark chip wires the buttons too;
 *     reducer silently absorbs single-slot scope no-op (Plan 64-03 D-03).
 *
 * Each toggle button calls `e.stopPropagation()` so clicks don't bubble
 * up to the chip's outer onClick (which would change selection — LT8
 * pins this).
 *
 * areEqual checks:
 *   - row.id (stable across re-renders unless slide ids regenerate)
 *   - row.label (changes when user renames OR underlying text changes)
 *   - row.locked / row.hidden (Plan 65-02 toggles mutate these)
 *   - selected / primary (selection-id change isolates re-render to the
 *     formerly-primary chip + the newly-primary chip; LM1 pins this)
 *   - isEditing (single inline-rename slot — flips on dblclick)
 *
 * Function-prop refs (onSelect / onStartRename / onCommitRename /
 * onCancelRename / onLockToggle / onVisibilityToggle / onReorder) MUST
 * be wrapped in useCallback at the parent (LayersPanel does this —
 * verified by LM1..LM3 render-count tests).
 *
 * Also exports `LayerChipImpl` as a named export so memo render-count
 * tests can wrap it via vi.fn() and read mockFn.mock.calls.length.
 */

function elementTypeIcon(type: LayerElementType): string {
  if (type === 'text') return 'text_fields'
  if (type === 'image') return 'image'
  return 'branding_watermark'
}

export function LayerChipImpl({
  row,
  selected,
  primary,
  isEditing,
  onSelect,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onLockToggle,
  onVisibilityToggle,
  onReorder,
}: LayerChipProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div
      data-testid="layer-chip"
      data-chip-id={row.id}
      data-element-type={row.elementType}
      data-selected={selected ? 'true' : 'false'}
      data-primary={primary ? 'true' : 'false'}
      data-locked={row.locked ? 'true' : 'false'}
      data-hidden={row.hidden ? 'true' : 'false'}
      onClick={(e) => {
        // Defensive: stop propagation so clicks on chips don't bubble to
        // outer scrollable containers (which might also handle clicks
        // via canvas-empty-onClick patterns).
        e.stopPropagation()
        onSelect(e.shiftKey ? 'toggle' : 'replace')
      }}
      className={[
        'flex items-center gap-2 px-2 py-1 rounded-md text-xs cursor-pointer transition-colors w-full',
        selected ? 'bg-[#fadbdb]' : 'hover:bg-[#fadbdb]/40',
        primary ? 'ring-1 ring-[#3d0000]' : '',
        row.groupId ? 'pl-6' : '',
      ].join(' ')}
    >
      <Icon
        name={elementTypeIcon(row.elementType)}
        size="sm"
        className="text-[#795e5e]"
      />
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          defaultValue={row.label}
          autoFocus
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => {
            onCommitRename(e.currentTarget.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onCancelRename()
            }
          }}
          className="flex-1 min-w-0 bg-white border border-[#3d0000]/30 rounded px-1 py-0.5 text-xs text-[#3d0000] focus:outline-none focus:border-[#3d0000]"
        />
      ) : (
        <span
          data-testid="chip-label"
          onDoubleClick={(e) => {
            e.stopPropagation()
            onStartRename()
          }}
          className="flex-1 min-w-0 truncate text-[#3d0000]"
        >
          {row.label}
        </span>
      )}
      {/* chip-lock-slot filled by Plan 65-02 — LAYERS-05 */}
      <button
        type="button"
        data-testid="chip-lock-button"
        data-pressed={row.locked ? 'true' : 'false'}
        title="Lock layer (⌘⇧L)"
        aria-label={row.locked ? 'Unlock layer' : 'Lock layer'}
        aria-pressed={row.locked}
        onClick={(e) => {
          e.stopPropagation()
          onLockToggle([row.id], !row.locked)
        }}
        className={[
          'w-5 h-5 flex items-center justify-center rounded transition-colors focus:outline-none',
          row.locked
            ? 'bg-[#3d0000] text-white'
            : 'text-[#795e5e] hover:bg-[#fadbdb]',
        ].join(' ')}
      >
        <Icon name={row.locked ? 'lock' : 'lock_open'} size="sm" />
      </button>
      {/* chip-vis-slot filled by Plan 65-02 — LAYERS-06 */}
      <button
        type="button"
        data-testid="chip-vis-button"
        data-pressed={row.hidden ? 'true' : 'false'}
        title="Toggle visibility"
        aria-label={row.hidden ? 'Show layer' : 'Hide layer'}
        aria-pressed={row.hidden}
        onClick={(e) => {
          e.stopPropagation()
          onVisibilityToggle([row.id], !row.hidden)
        }}
        className={[
          'w-5 h-5 flex items-center justify-center rounded transition-colors focus:outline-none',
          row.hidden
            ? 'bg-[#3d0000] text-white'
            : 'text-[#795e5e] hover:bg-[#fadbdb]',
        ].join(' ')}
      >
        <Icon name={row.hidden ? 'visibility_off' : 'visibility'} size="sm" />
      </button>
      {/* chip-reorder-slot filled by Plan 65-02 — LAYERS-07 (split into up + down) */}
      <button
        type="button"
        data-testid="chip-reorder-up"
        title="Bring forward (⌘])"
        aria-label="Bring layer forward"
        onClick={(e) => {
          e.stopPropagation()
          onReorder(row.id, 'forward')
        }}
        className="w-5 h-5 flex items-center justify-center rounded text-[#795e5e] hover:bg-[#fadbdb] transition-colors focus:outline-none"
      >
        <Icon name="arrow_upward" size="sm" />
      </button>
      <button
        type="button"
        data-testid="chip-reorder-down"
        title="Send backward (⌘[)"
        aria-label="Send layer backward"
        onClick={(e) => {
          e.stopPropagation()
          onReorder(row.id, 'backward')
        }}
        className="w-5 h-5 flex items-center justify-center rounded text-[#795e5e] hover:bg-[#fadbdb] transition-colors focus:outline-none"
      >
        <Icon name="arrow_downward" size="sm" />
      </button>
    </div>
  )
}

export function areEqual(prev: LayerChipProps, next: LayerChipProps): boolean {
  return (
    prev.row.id === next.row.id &&
    prev.row.label === next.row.label &&
    prev.row.locked === next.row.locked &&
    prev.row.hidden === next.row.hidden &&
    prev.row.elementType === next.row.elementType &&
    prev.row.groupId === next.row.groupId &&
    prev.selected === next.selected &&
    prev.primary === next.primary &&
    prev.isEditing === next.isEditing
    // Function refs (onSelect, onStartRename, onCommitRename,
    // onCancelRename) are intentionally NOT included in areEqual — the
    // parent (LayersPanel) wraps them in useCallback so identity stays
    // stable across renders. LM1..LM3 render-count tests verify this
    // contract holds.
  )
}

export const LayerChip = memo(LayerChipImpl, areEqual)
