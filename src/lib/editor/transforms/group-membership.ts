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
