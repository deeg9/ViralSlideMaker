/**
 * Phase 68 Plan 02 (EDITOR-10): canonical 4-scope walker module.
 *
 * Single source of truth for ALL "walk every addressable element on a Slide"
 * patterns across the editor surface. Replaces the in-file `synthesizeRows` /
 * `computeAllLocked` / `computeAllHidden` helpers in `layers-panel.tsx` and
 * the `getGroupMembers` helper in `transforms/group-membership.ts` (now a
 * re-export from this module).
 *
 * Walks the 4 AddressableScope members in canonical order:
 *   text_boxes → custom_images → decorations → watermark
 *
 * Why this differs from `selectAll` composition order in `use-selection-model.ts`
 * (which walks watermark LAST per ARCHITECTURE.md R4): the layers-panel READING
 * order treats the watermark as a singleton trailing the freeform-positioned
 * elements; the selection-composition order also trails the watermark for the
 * same reason. Both orderings agree that watermark is last among singletons —
 * the only difference is whether decorations come BEFORE or AFTER watermark.
 * In layers-panel readings, decorations come BEFORE watermark; in selection
 * composition, decorations come BEFORE watermark too. JSDoc on
 * `addressable-scope.ts` `ALL_ADDRESSABLE_SCOPES` pins the contract.
 *
 * Pure module — no React, no DOM, no I/O. Reusable from server, RPC, future
 * MCP tools. Mirrors text-box-adapter.ts / selection-bounds.ts conventions.
 *
 * 4 scope literal mentions for PRA grep gate (Plan 68-03 PRA1..12 audits this
 * file for the 4 AddressableScope literals): 'text_boxes', 'custom_images',
 * 'decorations', 'watermark'.
 */

import type {
  Slide,
  TextBox,
  CustomImage,
  Watermark,
  Decoration,
  IconDecoration,
  ShapeDecoration,
  ShapeKind,
} from '@/lib/types/slide'
import type { AddressableScope } from './addressable-scope'
import type {
  LayerChipRow,
  LayerElementType,
  LayerGroupHeaderRow,
  LayerRow,
} from '@/components/editor/layers-panel/types'

// ─────────────────────────────────────────────────────────────────────────────
// Label helpers (lifted from layers-panel.tsx — same logic, single home)
// ─────────────────────────────────────────────────────────────────────────────

const TEXT_LABEL_MAX = 30

function textBoxLabel(tb: TextBox): string {
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
  const named = (ci as CustomImage & { name?: string }).name
  if (named && named.trim().length > 0) return named.trim()
  try {
    const u = new URL(ci.url)
    const base = u.pathname.split('/').pop()
    if (base && base.length > 0) return base
  } catch {
    // url not absolute — fall through
  }
  const parts = ci.url.split('/')
  const last = parts[parts.length - 1]
  if (last && last.length > 0) return last
  return 'Image'
}

function watermarkLabel(wm: Watermark): string {
  if (wm.customText && wm.customText.trim().length > 0) return wm.customText.trim()
  return 'Watermark'
}

/** Friendly shape-name map (for labels only — schema literal stays canonical). */
const SHAPE_KIND_LABELS: Record<ShapeKind, string> = {
  rect: 'Rectangle',
  circle: 'Circle',
  ellipse: 'Ellipse',
  triangle: 'Triangle',
  polygon: 'Polygon',
  star: 'Star',
  arrow: 'Arrow',
  line: 'Line',
}

/**
 * Phase 68 Plan 02: produce a human-readable label for a Decoration.
 *  - User-supplied `name` wins (mirror LAYERS-04 contract — same as TextBox /
 *    CustomImage label helpers above).
 *  - Icon decorations fall back to `lucideName` (e.g. 'Heart').
 *  - Shape decorations fall back to a friendly capitalized shape name
 *    (e.g. 'Rectangle' from 'rect').
 *  - Defensive default: 'Decoration' if discriminator narrowing fails.
 */
export function decorationLabel(d: Decoration): string {
  if (d.name && d.name.trim().length > 0) return d.name.trim()
  if (d.kind === 'icon') {
    const icon = d as IconDecoration
    if (icon.lucideName && icon.lucideName.trim().length > 0) {
      return icon.lucideName.trim()
    }
  }
  if (d.kind === 'shape') {
    const shape = d as ShapeDecoration
    return SHAPE_KIND_LABELS[shape.shapeKind] ?? 'Shape'
  }
  return 'Decoration'
}

// ─────────────────────────────────────────────────────────────────────────────
// AddressableElement — internal traversal record
// ─────────────────────────────────────────────────────────────────────────────

export interface AddressableElement {
  id: string
  groupId?: string
  locked: boolean
  hidden: boolean
  type: LayerElementType
  label: string
  /** Which AddressableScope this element belongs to. */
  scope: AddressableScope
}

/**
 * Walk every addressable element on the slide in canonical order:
 *   text_boxes → custom_images → decorations → watermark
 *
 * Each yielded element carries its scope literal so consumers can branch
 * scope-aware decisions without an extra type-tag.
 *
 * 4 scope literal mentions for PRA grep gate:
 *   - 'text_boxes' branch
 *   - 'custom_images' branch
 *   - 'decorations' branch
 *   - 'watermark' branch
 */
export function walkAddressableElements(slide: Slide): AddressableElement[] {
  const out: AddressableElement[] = []

  // 'text_boxes' scope
  for (const tb of slide.text_boxes ?? []) {
    out.push({
      id: tb.id,
      groupId: tb.groupId,
      locked: tb.locked === true,
      hidden: tb.hidden === true,
      type: 'text',
      label: textBoxLabel(tb),
      scope: 'text_boxes',
    })
  }

  // 'custom_images' scope
  for (const ci of slide.custom_images ?? []) {
    out.push({
      id: ci.id,
      groupId: ci.groupId,
      locked: ci.locked === true,
      hidden: ci.hidden === true,
      type: 'image',
      label: customImageLabel(ci),
      scope: 'custom_images',
    })
  }

  // 'decorations' scope
  for (const d of slide.decorations ?? []) {
    out.push({
      id: d.id,
      groupId: d.groupId,
      locked: d.locked === true,
      hidden: d.hidden === true,
      type: 'decoration',
      label: decorationLabel(d),
      scope: 'decorations',
    })
  }

  // 'watermark' scope (singleton)
  if (slide.watermark) {
    out.push({
      id: slide.watermark.id,
      groupId: slide.watermark.groupId,
      locked: slide.watermark.locked === true,
      hidden: slide.watermark.hidden === true,
      type: 'watermark',
      label: watermarkLabel(slide.watermark),
      scope: 'watermark',
    })
  }

  return out
}

/**
 * Phase 68 Plan 02 (EDITOR-10): canonical `getGroupMembers` impl. Replaces the
 * Phase 62 `transforms/group-membership.ts` impl (now re-exports this).
 *
 * Walks all 4 AddressableScopes in canonical order: text_boxes → custom_images
 * → decorations → watermark. Returns the flat array of element ids whose
 * groupId matches.
 *
 * Empty `groupId` ('' falsy) short-circuits to []: an unset groupId field is
 * undefined, not '', so '' must never match anything.
 */
export function getGroupMembers(slide: Slide, groupId: string): string[] {
  if (!groupId) return []
  const out: string[] = []
  // text_boxes scope
  for (const tb of slide.text_boxes ?? []) {
    if (tb.groupId === groupId) out.push(tb.id)
  }
  // custom_images scope
  for (const ci of slide.custom_images ?? []) {
    if (ci.groupId === groupId) out.push(ci.id)
  }
  // decorations scope
  for (const d of slide.decorations ?? []) {
    if (d.groupId === groupId) out.push(d.id)
  }
  // watermark scope (singleton)
  if (slide.watermark && slide.watermark.groupId === groupId) {
    out.push(slide.watermark.id)
  }
  return out
}

/**
 * Roll-up: are ALL listed ids on the slide locked? Walks all 4 AddressableScopes.
 * Returns false on any unlocked match OR when ids is empty.
 */
export function computeAllLocked(slide: Slide, ids: string[]): boolean {
  if (ids.length === 0) return false
  const set = new Set(ids)
  // text_boxes scope
  for (const tb of slide.text_boxes ?? []) {
    if (set.has(tb.id) && tb.locked !== true) return false
  }
  // custom_images scope
  for (const ci of slide.custom_images ?? []) {
    if (set.has(ci.id) && ci.locked !== true) return false
  }
  // decorations scope
  for (const d of slide.decorations ?? []) {
    if (set.has(d.id) && d.locked !== true) return false
  }
  // watermark scope (singleton)
  if (
    slide.watermark &&
    set.has(slide.watermark.id) &&
    slide.watermark.locked !== true
  ) {
    return false
  }
  return true
}

/**
 * Roll-up: are ALL listed ids on the slide hidden? Walks all 4 AddressableScopes.
 * Returns false on any visible match OR when ids is empty.
 */
export function computeAllHidden(slide: Slide, ids: string[]): boolean {
  if (ids.length === 0) return false
  const set = new Set(ids)
  // text_boxes scope
  for (const tb of slide.text_boxes ?? []) {
    if (set.has(tb.id) && tb.hidden !== true) return false
  }
  // custom_images scope
  for (const ci of slide.custom_images ?? []) {
    if (set.has(ci.id) && ci.hidden !== true) return false
  }
  // decorations scope
  for (const d of slide.decorations ?? []) {
    if (set.has(d.id) && d.hidden !== true) return false
  }
  // watermark scope (singleton)
  if (
    slide.watermark &&
    set.has(slide.watermark.id) &&
    slide.watermark.hidden !== true
  ) {
    return false
  }
  return true
}

/**
 * Synthesize layer-panel rows: walk every addressable element in canonical
 * order; emit a `chip` row per element. When an element carries a groupId
 * AND that group has not been emitted before, prepend a synthesized
 * `group-header` row first (using `getGroupMembers` to populate memberIds +
 * computing allLocked / allHidden over those members).
 *
 * A `Set<string>` guards against re-emitting the same group-header when
 * the cross-array walk visits non-consecutive members of the same group
 * (e.g. text_box + decoration share groupId='g_0' but live in different
 * scopes). Each group emits its header at FIRST encounter.
 */
export function synthesizeRows(slide: Slide): LayerRow[] {
  const out: LayerRow[] = []
  const emittedGroupHeaders = new Set<string>()

  const elements = walkAddressableElements(slide)

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
