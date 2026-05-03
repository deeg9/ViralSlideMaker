'use client'

import { useCallback, useMemo, useState } from 'react'
import type { Slide, TextBox, CustomImage, Watermark } from '@/lib/types/slide'
import { getGroupMembers } from '@/lib/editor/transforms/group-membership'
import { GroupRow } from './group-row'
import { LayerChip } from './layer-chip'
import type {
  LayerChipRow,
  LayerElementType,
  LayerGroupHeaderRow,
  LayerRow,
  LayersPanelProps,
} from './types'

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

// ───── label helpers ────────────────────────────────────────────────

const TEXT_LABEL_MAX = 30

function textBoxLabel(tb: TextBox): string {
  // Plan 65-01 schema-additive: optional `name?: string` (Task 3) — when
  // set by inline rename, takes precedence over derived label.
  const named = (tb as TextBox & { name?: string }).name
  if (named && named.trim().length > 0) return named.trim()
  if (tb.text && tb.text.trim().length > 0) {
    return tb.text.trim().slice(0, TEXT_LABEL_MAX)
  }
  if (tb.role === 'hook') return 'Hook'
  if (tb.role === 'body') return 'Body'
  return 'Custom text'
}

function customImageLabel(ci: CustomImage): string {
  // Plan 65-01 schema-additive: optional `name?: string` (Task 3) — when
  // set, takes precedence over filename derivation.
  const named = (ci as CustomImage & { name?: string }).name
  if (named && named.trim().length > 0) return named.trim()
  try {
    const u = new URL(ci.url)
    const base = u.pathname.split('/').pop()
    if (base && base.length > 0) return base
  } catch {
    // url not absolute — fall through
  }
  // Best-effort: split on '/' as a relative path
  const parts = ci.url.split('/')
  const last = parts[parts.length - 1]
  if (last && last.length > 0) return last
  return 'Image'
}

function watermarkLabel(wm: Watermark): string {
  if (wm.customText && wm.customText.trim().length > 0) return wm.customText.trim()
  return 'Watermark'
}

// ───── synthesizeRows: pure helper ──────────────────────────────────

/**
 * Walk text_boxes ∪ custom_images ∪ watermark in canonical order. Emit a
 * `chip` row per element. When an element carries a groupId AND the
 * preceding-emitted row was NOT for the same group, emit a synthesized
 * `group-header` row first (using `getGroupMembers` to populate
 * memberIds + computing allLocked / allHidden from those members).
 *
 * A `Set<string>` guards against re-emitting the same group-header when
 * the cross-array walk visits non-consecutive members of the same group
 * (e.g. text_box + custom_image share groupId='g_0' but are split across
 * arrays). Each group emits its header at FIRST encounter.
 */
export function synthesizeRows(slide: Slide): LayerRow[] {
  const out: LayerRow[] = []
  const emittedGroupHeaders = new Set<string>()

  const elements: Array<{ id: string; groupId?: string; locked: boolean; hidden: boolean; type: LayerElementType; label: string }> = []

  for (const tb of slide.text_boxes ?? []) {
    elements.push({
      id: tb.id,
      groupId: tb.groupId,
      locked: tb.locked === true,
      hidden: tb.hidden === true,
      type: 'text',
      label: textBoxLabel(tb),
    })
  }
  for (const ci of slide.custom_images ?? []) {
    elements.push({
      id: ci.id,
      groupId: ci.groupId,
      locked: ci.locked === true,
      hidden: ci.hidden === true,
      type: 'image',
      label: customImageLabel(ci),
    })
  }
  if (slide.watermark) {
    elements.push({
      id: slide.watermark.id,
      groupId: slide.watermark.groupId,
      locked: slide.watermark.locked === true,
      hidden: slide.watermark.hidden === true,
      type: 'watermark',
      label: watermarkLabel(slide.watermark),
    })
  }

  for (const el of elements) {
    if (el.groupId && !emittedGroupHeaders.has(el.groupId)) {
      const memberIds = getGroupMembers(slide, el.groupId)
      const header: LayerGroupHeaderRow = {
        kind: 'group-header',
        groupId: el.groupId,
        memberIds,
        allLocked: computeAllLocked(slide, memberIds),
        allHidden: computeAllHidden(slide, memberIds),
      }
      out.push(header)
      emittedGroupHeaders.add(el.groupId)
    }
    const chip: LayerChipRow = {
      kind: 'chip',
      id: el.id,
      elementType: el.type,
      label: el.label,
      locked: el.locked,
      hidden: el.hidden,
      groupId: el.groupId,
    }
    out.push(chip)
  }

  return out
}

function computeAllLocked(slide: Slide, ids: string[]): boolean {
  if (ids.length === 0) return false
  const set = new Set(ids)
  for (const tb of slide.text_boxes ?? []) {
    if (set.has(tb.id) && tb.locked !== true) return false
  }
  for (const ci of slide.custom_images ?? []) {
    if (set.has(ci.id) && ci.locked !== true) return false
  }
  if (slide.watermark && set.has(slide.watermark.id) && slide.watermark.locked !== true) {
    return false
  }
  return true
}

function computeAllHidden(slide: Slide, ids: string[]): boolean {
  if (ids.length === 0) return false
  const set = new Set(ids)
  for (const tb of slide.text_boxes ?? []) {
    if (set.has(tb.id) && tb.hidden !== true) return false
  }
  for (const ci of slide.custom_images ?? []) {
    if (set.has(ci.id) && ci.hidden !== true) return false
  }
  if (slide.watermark && set.has(slide.watermark.id) && slide.watermark.hidden !== true) {
    return false
  }
  return true
}

// ───── LayersPanel ──────────────────────────────────────────────────

export default function LayersPanel({ slide, selection, onRename }: LayersPanelProps) {
  const rows = useMemo(
    () => synthesizeRows(slide),
    // Memo deps: the three element-bearing slots. Reference-stable when
    // the reducer doesn't mutate. useSlideEditor's reducer always returns
    // new array references on mutation (immutable pattern), so this
    // memo invalidates exactly when content changes.
    [slide.text_boxes, slide.custom_images, slide.watermark],
  )

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

  return (
    <aside
      data-testid="layers-panel"
      className="flex flex-col gap-1 mt-2"
      aria-label="Layers panel"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#3d0000]">
          Layers
        </span>
        <span className="text-[#795e5e] text-[10px]">
          {rows.filter((r) => r.kind === 'chip').length}
        </span>
      </div>
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
                />
              )
            }
            const selected = selectedSet.has(row.id)
            const primary = selection.primary === row.id
            const isEditing = editingId === row.id
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
              />
            )
          })}
        </div>
      )}
    </aside>
  )
}
