import type { Slide } from '@/lib/types/slide'
import type { Decoration } from '@/lib/types/decoration'
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
    Decoration / Watermark).
    Phase 68 Plan 02 (EDITOR-10): 'decoration' added so the canonical
    `addressable-element-walkers.synthesizeRows` walker can emit chips for
    icon + shape decorations. */
export type LayerElementType = 'text' | 'image' | 'decoration' | 'watermark'

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
    "single source of truth" invariant (PITFALL-7.2 no two-way binding).

    Plan 65-02 (LAYERS-05/06/07) DECISION: unified `ids: string[]` shape
    on onLockToggle / onVisibilityToggle. Single-chip dispatch wraps in
    `[elementId]`; group-row passes `memberIds` directly. Same dispatch
    shape — eliminates the need for separate group callbacks. */
export interface LayersPanelProps {
  slide: Slide
  selection: SelectionModel
  /** Called when a chip's inline-rename input commits a new label. */
  onRename(elementId: string, newName: string): void
  /** Called when the user clicks a lock toggle (chip or group).
      Parent dispatches `{ type: 'SET_LOCKED', slideIndex, ids, locked }`
      via Plan 64-01 reducer. ids: single-chip → `[elementId]`,
      group → `memberIds`. */
  onLockToggle(ids: string[], nextLocked: boolean): void
  /** Called when the user clicks a visibility toggle (chip or group).
      Parent dispatches `{ type: 'SET_HIDDEN', slideIndex, ids, hidden }`
      via Plan 64-02 reducer. */
  onVisibilityToggle(ids: string[], nextHidden: boolean): void
  /** Called when the user clicks a chip up/down z-order arrow.
      Parent dispatches `{ type: 'Z_ORDER', slideIndex, ids: [elementId],
      op }` via Plan 64-03 reducer. Group-row z-order is intentionally
      OUT of scope (cross-array reorder + multi-id splice deferred to
      v2.12+). */
  onReorder(elementId: string, op: 'forward' | 'backward'): void
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
  /** Plan 65-02 (LAYERS-05): clicking the chip's lock button dispatches
      SET_LOCKED via Plan 64-01. The chip wraps the single id in an array
      so the panel's onLockToggle callback shape is unified across chip
      and group dispatch paths. */
  onLockToggle: (ids: string[], nextLocked: boolean) => void
  /** Plan 65-02 (LAYERS-06): clicking the chip's visibility button
      dispatches SET_HIDDEN via Plan 64-02. Element disappears from
      BOTH renderers (slide-preview + render-slide-satori). */
  onVisibilityToggle: (ids: string[], nextHidden: boolean) => void
  /** Plan 65-02 (LAYERS-07): clicking the chip's up/down arrows
      dispatches Z_ORDER 'forward' / 'backward' via Plan 64-03. The
      reducer ref-equal short-circuits on no-op (e.g. clicking up on
      the top element, or watermark single-slot per Plan 64-03 D-03). */
  onReorder: (elementId: string, op: 'forward' | 'backward') => void
  /** Phase 70 Plan 05 (PARITY-18): when row.elementType === 'decoration',
      LayersPanel resolves the actual Decoration object via slide.decorations
      lookup and passes it here. The chip then renders a 16×16 miniature glyph
      via Phase 69 renderDecoration (single source of truth — TPLREND-05).
      When null/undefined (stale id, e.g. the element was deleted but a row
      reference still exists in transit), the chip falls back to the material
      'category' icon. */
  decoration?: Decoration | null
}

/** Per-group-row props. Group-collapse state lives in panel-local
    useState<Record<string, boolean>> keyed by groupId; default false
    (collapsed). */
export interface GroupRowProps {
  row: LayerGroupHeaderRow
  expanded: boolean
  onToggleExpanded: () => void
  /** Plan 65-02: group-row lock toggle dispatches SET_LOCKED with all
      member ids in a single dispatch (one history entry — KBD-09 / PERF-01
      carry-forward). Toggle math (`!row.allLocked`) computed at the chip
      level; reducer trusts the caller-provided boolean. */
  onGroupLockToggle: (memberIds: string[], nextLocked: boolean) => void
  /** Plan 65-02: group-row visibility toggle dispatches SET_HIDDEN with
      all member ids in a single dispatch. Toggle math: `!row.allHidden`. */
  onGroupVisibilityToggle: (memberIds: string[], nextHidden: boolean) => void
}
