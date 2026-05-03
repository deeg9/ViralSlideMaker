import type { Slide } from '@/lib/types/slide'

/**
 * Phase 62 (GROUP-02..05): pure helper — return all element ids on `slide`
 * whose groupId matches the given `groupId`. Walks text_boxes, custom_images,
 * and the slide.watermark (if present), in that order.
 *
 * No nested groups (PITFALL-3.3): the schema is flat — every element either
 * has a single groupId (string) or none (undefined). Membership is set
 * equality on the field, nothing more. The reducer's GROUP case enforces
 * the "subset of an existing group dissolves the prior group" rule so that
 * this flat-only invariant is preserved across edits; this helper is a
 * read-only consumer of that flat schema.
 *
 * Pure module — no React, no DOM, no I/O. Reusable from server, RPC, MCP.
 *
 * Empty `groupId` ('' falsy) short-circuits to []: an unset groupId field is
 * undefined, not '', so '' must never match anything. Test 5 in
 * group-membership.test.ts pins this boundary.
 */
export function getGroupMembers(slide: Slide, groupId: string): string[] {
  if (!groupId) return []
  const out: string[] = []
  for (const tb of slide.text_boxes ?? []) {
    if (tb.groupId === groupId) out.push(tb.id)
  }
  for (const ci of slide.custom_images ?? []) {
    if (ci.groupId === groupId) out.push(ci.id)
  }
  if (slide.watermark && slide.watermark.groupId === groupId) {
    out.push(slide.watermark.id)
  }
  return out
}

/**
 * Phase 62 (Plan 62-03, GROUP-09): pure helper — decides whether the current
 * onDragStop event should fan its delta out across an entire group. Returns
 * the group member ids to BULK_TRANSLATE, or `null` when the drag is a
 * single-element drag (the per-element callback path).
 *
 * Locked decisions (62-03 PLAN.md):
 *   1. `currentlyInsideGroup !== null` → null. The user has double-click-
 *      entered the group; subsequent drags target the leaf, not the group.
 *      Plan 62-02 click handlers already select the leaf in this state.
 *   2. `selection.ids.length < 2` → null. Single-element selection is a
 *      single-element drag.
 *   3. The dragged element has no groupId → null. Drag on an ungrouped
 *      element is always a single-element drag.
 *   4. The selection.ids set must EQUAL the group's full member set. A
 *      strict subset (e.g., 2 of 3 group members selected) returns null —
 *      the user's explicit subset selection is honored as a signal that
 *      they want only those elements moved, not the whole group. A
 *      superset (selection extends beyond the group) also returns null —
 *      the same drag would otherwise fan-out a delta to elements that
 *      aren't group members, violating the "single group selection ===
 *      group drag" invariant.
 *
 * Pure module — no React, no DOM. Reusable from server, RPC, MCP. The
 * shape of `selection` matches `useSelectionModel`'s `Selection` type
 * (kept duck-typed here so this transform stays decoupled from the hook).
 */
export function shouldGroupDrag(
  slide: Slide,
  selection: { ids: string[]; primary: string | null },
  currentlyInsideGroup: string | null,
  draggedElementId: string,
): string[] | null {
  if (currentlyInsideGroup !== null) return null
  if (selection.ids.length < 2) return null
  // Resolve the dragged element across all 3 element-bearing arrays. We
  // walk text_boxes ∪ custom_images ∪ watermark in the same order as
  // getGroupMembers to keep the invariant that "the first match wins"
  // is consistent with the rest of the module.
  let draggedGroupId: string | undefined
  const tb = (slide.text_boxes ?? []).find((t) => t.id === draggedElementId)
  if (tb) draggedGroupId = tb.groupId
  else {
    const ci = (slide.custom_images ?? []).find((c) => c.id === draggedElementId)
    if (ci) draggedGroupId = ci.groupId
    else if (slide.watermark && slide.watermark.id === draggedElementId) {
      draggedGroupId = slide.watermark.groupId
    }
  }
  if (!draggedGroupId) return null
  const memberIds = getGroupMembers(slide, draggedGroupId)
  // Selection must equal the group's full member set (no strict subset,
  // no superset). Set-equality via cardinality + containment.
  if (memberIds.length !== selection.ids.length) return null
  const memberSet = new Set(memberIds)
  for (const id of selection.ids) {
    if (!memberSet.has(id)) return null
  }
  return memberIds
}
