import type { Slide } from '@/lib/types/slide'
import type { SelectionModel } from '@/lib/editor/use-selection-model'

/**
 * Phase 65 Plan 01 (LAYERS-01..04, LAYERS-08, LAYERS-09, LAYERS-10):
 * type contracts for the LEFT-rail Layers Panel.
 *
 * Locked decision (CONTEXT D-01): vanilla flat list — NO react-arborist /
 * react-complex-tree / react-window / react-dnd / @dnd-kit. ≤30 elements per
 * slide, click-to-select + button-reorder is sufficient. Drag-to-reorder is
 * deferred to v2.12.
 *
 * Pure type module — no React, no DOM, no I/O.
 */

/** Element type as surfaced in the layers panel chip. Maps 1:1 to the
    underlying schema slot the chip represents (TextBox / CustomImage /
    Watermark). */
export type LayerElementType = 'text' | 'image' | 'watermark'

/** A single chip row — represents ONE addressable element on the slide. */
export interface LayerChipRow {
  kind: 'chip'
  id: string
  elementType: LayerElementType
  label: string
  locked: boolean
  hidden: boolean
  /** When set, this chip is a member of the immediately-preceding
      group-header row. Hidden from the rendered list when the group is
      collapsed (panel-local state, see layers-panel.tsx). */
  groupId?: string
}

/** A synthesized group-header row — emitted ONCE per groupId in walk order
    immediately before the chip rows for its members. allLocked / allHidden
    pre-compute the per-group toggle state Plan 65-02 will wire. */
export interface LayerGroupHeaderRow {
  kind: 'group-header'
  groupId: string
  /** Member ids in `getGroupMembers` walk order: text_boxes ∪ custom_images
      ∪ watermark. */
  memberIds: string[]
  allLocked: boolean
  allHidden: boolean
}

/** Discriminated union — narrows on `row.kind`. */
export type LayerRow = LayerChipRow | LayerGroupHeaderRow

/** Top-level panel props. Selection is INJECTED from the parent (slide-
    editor.tsx already constructs the canonical SelectionModel via
    useSelectionModel at line 112). The panel READS selection.ids /
    selection.primary; it never calls useSelectionModel itself — keeps the
    "single source of truth" invariant (PITFALL-7.2 no two-way binding). */
export interface LayersPanelProps {
  slide: Slide
  selection: SelectionModel
  /** Called when a chip's inline-rename input commits a new label.
      Plan 65-02 will add onLockToggle / onVisibilityToggle / onReorder. */
  onRename(elementId: string, newName: string): void
}

/** Per-chip props — fully derived from LayersPanel. All callbacks are
    memoized at the parent so React.memo's areEqual stays referentially
    stable (verified by LM1..LM3 render-count tests). */
export interface LayerChipProps {
  row: LayerChipRow
  selected: boolean
  primary: boolean
  isEditing: boolean
  onSelect: (mode: 'replace' | 'toggle') => void
  onStartRename: () => void
  onCommitRename: (newName: string) => void
  onCancelRename: () => void
}

/** Per-group-row props. Group-collapse state lives in panel-local
    useState<Record<string, boolean>> keyed by groupId; default false
    (collapsed). */
export interface GroupRowProps {
  row: LayerGroupHeaderRow
  expanded: boolean
  onToggleExpanded: () => void
}
