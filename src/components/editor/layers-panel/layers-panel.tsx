'use client'

import { useCallback, useMemo, useState } from 'react'
import { synthesizeRows } from '@/lib/editor/addressable-element-walkers'
import { GroupRow } from './group-row'
import { LayerChip } from './layer-chip'
import type { LayerRow, LayersPanelProps } from './types'

// Phase 68 Plan 02 (EDITOR-10): re-export `synthesizeRows` from the canonical
// `addressable-element-walkers` module so existing test imports
// (`import { synthesizeRows } from '../layers-panel'`) keep working without
// requiring a coordinated test-side rewrite. The canonical implementation
// lives in `@/lib/editor/addressable-element-walkers` and walks all 4
// AddressableScopes (text_boxes / custom_images / decorations / watermark).
export { synthesizeRows } from '@/lib/editor/addressable-element-walkers'

/**
 * Phase 65 Plan 01 (LAYERS-01..04, LAYERS-08, LAYERS-09):
 * LEFT-rail layers panel. Vanilla flat list with no virtualization.
 *
 * Locked decision (CONTEXT D-01):
 *   - Vanilla layers panel: no tree/dnd library, no virtualization.
 *   - Bound: <=30 elements per slide. Simple flat list with synthesized
 *     group-collapse rows; React.memo on chip; standard DOM rendering.
 *   - Drag-to-reorder is deferred to v2.12 (would re-introduce a tree
 *     dependency THEN, not now).
 *
 * Locked invariant (PITFALL-7.2 + CONTEXT "Selection sync READ-ONLY"):
 *   The panel READS `selection: SelectionModel` from props. It NEVER
 *   calls useSelectionModel itself — the parent (slide-editor.tsx)
 *   constructs the canonical SelectionModel and injects it. Click
 *   handlers WRITE only on direct user click; no useEffect-on-selection
 *   round-trips, no two-way binding.
 */

// ───── LayersPanel ──────────────────────────────────────────────────
//
// Phase 68 Plan 02 (EDITOR-10): label helpers + synthesizeRows + roll-up
// helpers (computeAllLocked / computeAllHidden) migrated to the canonical
// `@/lib/editor/addressable-element-walkers` module. The migration is
// behavior-preserving on v2.11 fixtures (no decoration data yet) — verified
// by the existing `__tests__/layers-panel.test.tsx` LP1..LP4 + integration
// suite remaining GREEN.

export default function LayersPanel({
  slide,
  selection,
  onRename,
  onLockToggle,
  onVisibilityToggle,
  onReorder,
}: LayersPanelProps) {
  const rows = useMemo(
    () => synthesizeRows(slide),
    // Memo deps: the four element-bearing slots. Reference-stable when
    // the reducer doesn't mutate. useSlideEditor's reducer always returns
    // new array references on mutation (immutable pattern), so this
    // memo invalidates exactly when content changes.
    // Phase 70 Plan 05: include slide.decorations so decoration adds /
    // removes / mutations invalidate the row synthesis.
    [slide.text_boxes, slide.custom_images, slide.decorations, slide.watermark],
  )

  // Phase 70 Plan 05 (PARITY-18): id → Decoration lookup so each
  // decoration chip can render its miniature glyph via Phase 69
  // renderDecoration. useMemo'd map keyed on slide.decorations preserves
  // ref-stability of each Decoration value across LayersPanel re-renders;
  // LayerChip's areEqual short-circuits on `prev.decoration === next.decoration`
  // when the underlying decoration is unchanged.
  const decorationById = useMemo(() => {
    const map = new Map<string, NonNullable<typeof slide.decorations>[number]>()
    for (const d of slide.decorations ?? []) {
      map.set(d.id, d)
    }
    return map
  }, [slide.decorations])

  // Group-collapse state — keyed by groupId; default false (collapsed)
  // per CONTEXT D-02 ("Collapsed: shows 'Group (N members)'").
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const toggleGroupExpanded = useCallback((groupId: string) => {
    setExpanded((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }, [])

  // Inline-rename state — single editing slot.
  const [editingId, setEditingId] = useState<string | null>(null)

  const selectedSet = useMemo(() => new Set(selection.ids), [selection.ids])

  // Stable callback factories — memoized so React.memo's areEqual on
  // LayerChip stays referentially stable across renders. Identity
  // depends only on selection method refs (already useCallback-stable
  // in useSelectionModel) + setEditingId (stable from useState).
  const handleSelect = useCallback(
    (id: string, mode: 'replace' | 'toggle') => {
      if (mode === 'toggle') {
        selection.toggleInSelection(id)
      } else {
        selection.replaceWith([id])
      }
    },
    [selection],
  )

  const handleStartRename = useCallback((id: string) => {
    setEditingId(id)
  }, [])

  const handleCommitRename = useCallback(
    (id: string, newName: string) => {
      onRename(id, newName)
      setEditingId(null)
    },
    [onRename],
  )

  const handleCancelRename = useCallback(() => {
    setEditingId(null)
  }, [])

  // Plan 65-02 toggle callbacks — wrapped in useCallback so React.memo's
  // areEqual on LayerChip stays referentially stable (LM1..LM3 contract
  // preserved; areEqual intentionally excludes function refs but still
  // requires the parent to keep them stable).
  //
  // DECISION (locked at Plan 65-02 Task 3): unified `ids: string[]` shape
  // on onLockToggle / onVisibilityToggle. Single chip dispatches with
  // `[row.id]`; group-row passes memberIds directly through the SAME
  // callback. Group dispatch is just an N-id call — no separate parent
  // handler needed. The chip wrapper does the array-wrap; the group-row
  // wrapper passes its memberIds straight through.
  const handleChipLockToggle = useCallback(
    (ids: string[], next: boolean) => onLockToggle(ids, next),
    [onLockToggle],
  )
  const handleChipVisToggle = useCallback(
    (ids: string[], next: boolean) => onVisibilityToggle(ids, next),
    [onVisibilityToggle],
  )
  const handleChipReorder = useCallback(
    (id: string, op: 'forward' | 'backward') => onReorder(id, op),
    [onReorder],
  )
  const handleGroupLockToggle = useCallback(
    (memberIds: string[], next: boolean) => onLockToggle(memberIds, next),
    [onLockToggle],
  )
  const handleGroupVisToggle = useCallback(
    (memberIds: string[], next: boolean) => onVisibilityToggle(memberIds, next),
    [onVisibilityToggle],
  )

  // Filter: when a group-header is collapsed, hide its member chips.
  const visibleRows: LayerRow[] = useMemo(() => {
    const out: LayerRow[] = []
    for (const row of rows) {
      if (row.kind === 'chip' && row.groupId) {
        const isExpanded = expanded[row.groupId] === true
        if (!isExpanded) continue
      }
      out.push(row)
    }
    return out
  }, [rows, expanded])

  // quick-260514-layers-collapsible: the panel is an accordion that defaults
  // closed. The body (chips + group rows) stays MOUNTED but visually hidden
  // when collapsed so existing `data-testid` queries in the integration
  // tests keep finding chips without needing each test to click the header.
  // Toggle is purely cosmetic state, never persisted.
  const [bodyOpen, setBodyOpen] = useState(false)
  const chipCount = rows.filter((r) => r.kind === 'chip').length

  return (
    <aside
      data-testid="layers-panel"
      className="flex flex-col gap-1 mt-2"
      aria-label="Layers panel"
    >
      <button
        type="button"
        onClick={() => setBodyOpen((v) => !v)}
        aria-expanded={bodyOpen}
        aria-controls="layers-panel-body"
        data-testid="layers-panel-toggle"
        className="flex items-center justify-between mb-1 px-1 py-1 -mx-1 rounded hover:bg-[#fadbdb] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3d0000]/40"
      >
        <span className="flex items-center gap-1.5">
          <span
            className={`text-[10px] text-[#795e5e] inline-block transition-transform ${
              bodyOpen ? 'rotate-90' : ''
            }`}
            aria-hidden="true"
          >
            ▶
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#3d0000]">
            Layers
          </span>
        </span>
        <span className="text-[#795e5e] text-[10px]">{chipCount}</span>
      </button>
      <div id="layers-panel-body" className={bodyOpen ? '' : 'hidden'}>
      {visibleRows.length === 0 ? (
        <div className="text-[10px] text-[#795e5e] px-2 py-1">No elements</div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {visibleRows.map((row, idx) => {
            if (row.kind === 'group-header') {
              return (
                <GroupRow
                  key={`grp-${row.groupId}`}
                  row={row}
                  expanded={expanded[row.groupId] === true}
                  onToggleExpanded={() => toggleGroupExpanded(row.groupId)}
                  onGroupLockToggle={handleGroupLockToggle}
                  onGroupVisibilityToggle={handleGroupVisToggle}
                />
              )
            }
            const selected = selectedSet.has(row.id)
            const primary = selection.primary === row.id
            const isEditing = editingId === row.id
            const chipDecoration =
              row.elementType === 'decoration'
                ? (decorationById.get(row.id) ?? null)
                : null
            return (
              <LayerChip
                key={`chip-${row.id}-${idx}`}
                row={row}
                selected={selected}
                primary={primary}
                isEditing={isEditing}
                onSelect={(mode) => handleSelect(row.id, mode)}
                onStartRename={() => handleStartRename(row.id)}
                onCommitRename={(newName) => handleCommitRename(row.id, newName)}
                onCancelRename={handleCancelRename}
                onLockToggle={handleChipLockToggle}
                onVisibilityToggle={handleChipVisToggle}
                onReorder={handleChipReorder}
                decoration={chipDecoration}
              />
            )
          })}
        </div>
      )}
      </div>
    </aside>
  )
}
