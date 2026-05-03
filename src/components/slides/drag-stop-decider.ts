/**
 * Phase 66 Plan 02 (DIFF-01): pure decider for the slide-preview drag-stop
 * branch. Returns the dispatch shape the onDragStop handler should fire.
 * Pure-function for testability; the wiring inside onDragStop just forwards
 * the result to onAltDuplicate / onGroupDrag / fall-through (per-element
 * position-change).
 *
 * Why a pure helper:
 *   - The drag-stop logic for Alt+drag duplicate (group-preservation +
 *     newGroupId derivation + selection-vs-single resolution) is the SAME
 *     across all 4 Rnd-wrapped element types (hook, body, custom_text,
 *     custom_image). Factoring it out avoids ~40 LOC of duplication and
 *     makes testing trivial via synthetic Slide fixtures.
 *   - The existing `shouldGroupDrag` from
 *     `@/lib/editor/transforms/group-membership` follows the same pattern
 *     (pure helper, returns the dispatch payload's `ids` or null). DIFF-01
 *     mirrors that contract for the alt-duplicate branch.
 *
 * Inputs:
 *   - altAtStart: boolean snapshot of `modifiers.get().alt` captured in
 *     onDragStart. Mid-drag changes are intentionally ignored (v2.11
 *     simplification — RESEARCH F39 / 66-CONTEXT.md).
 *   - draggedId: id of the element that started the drag (the Rnd handle's
 *     entity).
 *   - slide: current slide schema. Used to derive group-membership for
 *     newGroupId computation.
 *   - selection: full multi-select model (ids[] + primary). When the
 *     dragged element is part of selection, the duplicate set is the FULL
 *     selection; else just [draggedId].
 *   - slideIndex: for newGroupId construction — `g_${slideIndex}_${time}`.
 *
 * Outputs:
 *   - { kind: 'alt-duplicate' } when altAtStart === true AND there is at
 *     least one valid id to duplicate. ids[] is the full selection (if
 *     dragged is part of it) or [draggedId]. newGroupId is a fresh group id
 *     when ALL listed ids share a single groupId; undefined otherwise.
 *   - { kind: 'no-op' } when altAtStart === true but no id resolves
 *     (defensive — caller falls through to the existing group-drag /
 *     per-element branch).
 */
import type { Slide } from '@/lib/types/slide'

export interface SelectionLike {
  ids: string[]
  primary: string | null
}

export type AltDragStopDecision =
  | {
      kind: 'alt-duplicate'
      ids: string[]
      newGroupId?: string
    }
  | { kind: 'no-op' }

/**
 * Decide what dispatch the drag-stop handler should fire when alt was
 * captured at drag-start. When alt was NOT captured at drag-start, callers
 * should NOT invoke this — they fall through to the existing onGroupDrag /
 * per-element branch (those are out of scope for this helper).
 */
export function decideAltDuplicate(
  altAtStart: boolean,
  draggedId: string,
  slide: Slide,
  selection: SelectionLike | undefined,
  slideIndex: number,
): AltDragStopDecision {
  if (!altAtStart) return { kind: 'no-op' }

  // Resolve the id set: full selection if the dragged element is part of it,
  // else just the dragged element.
  const ids =
    selection && selection.ids.length > 0 && selection.ids.includes(draggedId)
      ? selection.ids
      : [draggedId]
  if (ids.length === 0) return { kind: 'no-op' }

  // Group-preservation: when ALL ids share one groupId, the copies form a
  // NEW group (newGroupId fresh). Else newGroupId is undefined (copies are
  // flat). Walk the union of text_boxes ∪ custom_images ∪ watermark to find
  // each id's groupId.
  const groupIdsInSelection = new Set<string | undefined>()
  const allElements: Array<{ id: string; groupId?: string }> = [
    ...(slide.text_boxes ?? []),
    ...(slide.custom_images ?? []),
    ...(slide.watermark ? [slide.watermark] : []),
  ]
  for (const el of allElements) {
    if (ids.includes(el.id)) groupIdsInSelection.add(el.groupId)
  }
  const sharedGroupId =
    groupIdsInSelection.size === 1 &&
    [...groupIdsInSelection][0] !== undefined
      ? ([...groupIdsInSelection][0] as string)
      : undefined
  const newGroupId = sharedGroupId
    ? `g_${slideIndex}_${Date.now().toString(36)}`
    : undefined

  return { kind: 'alt-duplicate', ids, newGroupId }
}
