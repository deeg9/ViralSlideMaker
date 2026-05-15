// -----------------------------------------------------------------------------
// Quick task 260515-8xx — reactive overlap-prevention pass for AI-emitted text
// boxes.
//
// Pure module. No React. No DOM. No I/O. Safe to call server-side.
//
// Phase 60 documented gap: custom-role boxes with anchor='top'|'center'|'bottom'
// are passed through unchanged — their real height comes from a DOM ref so we
// cannot estimate it deterministically here. Only the hook+body STRUCTURAL pair
// gets normalized to custom anchors when they share a non-'custom' anchor (this
// is the Meta-workers caption-bar-bottom repro case where legacyToTextBoxes
// sets both boxes' anchor to 'bottom' and the renderer flex-stacks them, but
// with a multi-line hook the body collides visually).
//
// Reference canvas = 1080 × 1920 (REF_WIDTH / REF_HEIGHT).
// Sizes expressed as PERCENT of canvas, matching TextBoxPosition convention.
// -----------------------------------------------------------------------------

import type { TextBox, TextBoxAnchor } from '@/lib/types/slide'

// ─────────────────────────────────────────────────────────────────────────────
// Public option interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface EstimateHeightOptions {
  /** Reference canvas width in px. Default 1080. */
  canvasWidthPx?: number
  /** Reference canvas height in px. Default 1920. */
  canvasHeightPx?: number
  /** Fallback font size in px when textBox.font_size is undefined. Default 64. */
  defaultFontSizePx?: number
  /** Line-height multiplier. Default 1.2 (tight, matches our renderer baseline). */
  lineHeight?: number
  /** Avg char width as fraction of font_size. Default 0.55 (sans-serif median). */
  avgCharWidthFactor?: number
}

export interface SeparateOverlappingOptions extends EstimateHeightOptions {
  /**
   * Padding (canvas-% units) inserted BETWEEN boxes after separation.
   * Default 1 (≈19px on a 1920 canvas).
   */
  gapPct?: number
  /**
   * Max bottom edge in canvas-%. Boxes overflowing past this are clamped at the
   * bottom; in that case earlier boxes are NOT shifted up (we accept the
   * worst-case overflow rather than re-layout). Default 100.
   */
  maxYPct?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CANVAS_WIDTH_PX = 1080
const DEFAULT_CANVAS_HEIGHT_PX = 1920
const DEFAULT_FONT_SIZE_PX = 64
const DEFAULT_LINE_HEIGHT = 1.2
const DEFAULT_AVG_CHAR_WIDTH_FACTOR = 0.55
const DEFAULT_GAP_PCT = 1
const DEFAULT_MAX_Y_PCT = 100
const DEFAULT_BOX_WIDTH_PCT = 60

/**
 * Default starting positions when synthesizing custom anchors for the
 * hook+body structural pair. Picked to match the renderer's flex-zone
 * placement — the separation pass shifts them when estimated heights demand.
 */
const STRUCTURAL_ANCHOR_DEFAULTS: Record<
  Exclude<TextBoxAnchor, 'custom'>,
  { hookY: number; bodyY: number; x: number; width: number }
> = {
  top: { hookY: 8, bodyY: 35, x: 20, width: 60 },
  center: { hookY: 45, bodyY: 60, x: 20, width: 60 },
  bottom: { hookY: 70, bodyY: 85, x: 20, width: 60 },
}

// ─────────────────────────────────────────────────────────────────────────────
// Height estimation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Approximate vertical height of a text box, in canvas-% units. Pure / no DOM.
 * Splits on existing newlines first; wraps each segment by a character count
 * derived from the box's width-in-px and an avg-char-width-factor heuristic.
 */
export function estimateTextBoxHeightPct(
  textBox: TextBox,
  options: EstimateHeightOptions = {},
): number {
  const canvasWidthPx = options.canvasWidthPx ?? DEFAULT_CANVAS_WIDTH_PX
  const canvasHeightPx = options.canvasHeightPx ?? DEFAULT_CANVAS_HEIGHT_PX
  const defaultFontSizePx = options.defaultFontSizePx ?? DEFAULT_FONT_SIZE_PX
  const lineHeight = options.lineHeight ?? DEFAULT_LINE_HEIGHT
  const avgCharWidthFactor =
    options.avgCharWidthFactor ?? DEFAULT_AVG_CHAR_WIDTH_FACTOR

  const fontSizePx = textBox.font_size ?? defaultFontSizePx
  const widthPct = textBox.position.width ?? DEFAULT_BOX_WIDTH_PCT
  const widthPx = (widthPct / 100) * canvasWidthPx
  const avgCharPx = fontSizePx * avgCharWidthFactor
  const charsPerLine = Math.max(1, Math.floor(widthPx / avgCharPx))
  const text = textBox.text ?? ''
  const lines = text
    .split('\n')
    .reduce(
      (acc, segment) =>
        acc + Math.max(1, Math.ceil(segment.length / charsPerLine)),
      0,
    )
  const heightPx = lines * fontSizePx * lineHeight
  return (heightPx / canvasHeightPx) * 100
}

// ─────────────────────────────────────────────────────────────────────────────
// Structural-anchor normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * If the array contains a hook+body structural pair that share a non-'custom'
 * anchor, synthesize explicit x/y/width and switch both to anchor='custom' so
 * the separation pass can operate on them deterministically.
 *
 * Pure — returns NEW objects; never mutates input.
 *
 * Custom-role boxes carrying anchor='top'|'center'|'bottom' are NOT touched
 * (Phase 60 documented gap — those need DOM measurement).
 */
function normalizeStructuralAnchors(boxes: TextBox[]): TextBox[] {
  if (boxes.length === 0) return boxes.slice()

  const hookIndex = boxes.findIndex((b) => b.role === 'hook')
  const bodyIndex = boxes.findIndex((b) => b.role === 'body')

  if (hookIndex === -1 || bodyIndex === -1) {
    return boxes.slice()
  }

  const hook = boxes[hookIndex]
  const body = boxes[bodyIndex]

  // Both must share the SAME non-'custom' anchor for normalization to apply.
  if (
    hook.position.anchor === 'custom' ||
    body.position.anchor === 'custom' ||
    hook.position.anchor !== body.position.anchor
  ) {
    return boxes.slice()
  }

  const anchor = hook.position.anchor as Exclude<TextBoxAnchor, 'custom'>
  const defaults = STRUCTURAL_ANCHOR_DEFAULTS[anchor]

  const projected = boxes.map((b, i) => {
    if (i === hookIndex) {
      const next: TextBox = {
        ...b,
        position: {
          anchor: 'custom',
          x: defaults.x,
          y: defaults.hookY,
          width: defaults.width,
        },
      }
      return next
    }
    if (i === bodyIndex) {
      const next: TextBox = {
        ...b,
        position: {
          anchor: 'custom',
          x: defaults.x,
          y: defaults.bodyY,
          width: defaults.width,
        },
      }
      return next
    }
    return { ...b, position: { ...b.position } }
  })

  return projected
}

// ─────────────────────────────────────────────────────────────────────────────
// Separation pass
// ─────────────────────────────────────────────────────────────────────────────

interface LayoutEntry {
  index: number
  box: TextBox
  top: number
  height: number
}

function roleSortKey(role: TextBox['role']): number {
  switch (role) {
    case 'hook':
      return 0
    case 'body':
      return 1
    default:
      return 2
  }
}

/**
 * Reactive collision pass.
 *
 * For each pair of text boxes participating in the custom-anchor layout, if
 * their estimated rects overlap vertically, push the LOWER box (higher y%) so
 * its top equals the upper box's bottom + gapPct.
 *
 * Single-pass, deterministic, idempotent.
 *
 * Returns a NEW array; never mutates input. Boxes that don't participate
 * (custom-role with anchor !== 'custom' that wasn't picked up by the
 * structural normalization) are passed through unchanged.
 */
export function separateOverlappingTextBoxes(
  textBoxes: TextBox[],
  options: SeparateOverlappingOptions = {},
): TextBox[] {
  if (textBoxes.length === 0) return []

  const gapPct = options.gapPct ?? DEFAULT_GAP_PCT
  const maxYPct = options.maxYPct ?? DEFAULT_MAX_Y_PCT

  // Step 1: normalize structural hook+body anchors to custom.
  const normalized = normalizeStructuralAnchors(textBoxes)

  // Step 2: build layout entries for participating boxes.
  const entries: LayoutEntry[] = []
  for (let i = 0; i < normalized.length; i++) {
    const box = normalized[i]
    if (box.position.anchor !== 'custom') continue
    const top = box.position.y ?? 0
    const height = estimateTextBoxHeightPct(box, options)
    entries.push({ index: i, box, top, height })
  }

  if (entries.length < 2) {
    // Nothing to separate. Return a fresh array preserving normalization.
    return normalized
  }

  // Step 3: sort by top ascending; tie-break by role (hook < body < custom).
  entries.sort((a, b) => {
    if (a.top !== b.top) return a.top - b.top
    return roleSortKey(a.box.role) - roleSortKey(b.box.role)
  })

  // Step 4: sweep; track previous-bottom + gap.
  let prevBottom = -Infinity
  for (const entry of entries) {
    let top = entry.top
    if (top < prevBottom + gapPct) {
      top = prevBottom + gapPct
    }
    const bottom = top + entry.height
    entry.top = top
    prevBottom = bottom
  }

  // Step 4b: fit-pass. If the final bottom overflows maxYPct, shift the entire
  // stack upward by the overflow amount — bounded so the first top never goes
  // negative. This keeps both boxes inside the canvas when there's room; if
  // the stack is genuinely taller than maxYPct, we accept the overflow (per
  // the maxYPct option contract: clamp-rather-than-re-layout fallback).
  const stackBottom = entries[entries.length - 1].top + entries[entries.length - 1].height
  if (stackBottom > maxYPct) {
    const overflow = stackBottom - maxYPct
    const firstTop = entries[0].top
    const upwardShift = Math.min(overflow, Math.max(0, firstTop))
    if (upwardShift > 0) {
      for (const entry of entries) {
        entry.top -= upwardShift
      }
    }
  }

  // Step 5: reassemble — write the adjusted y back into each participating box.
  const result = normalized.map((box, i) => {
    const updated = entries.find((e) => e.index === i)
    if (!updated) return box
    const newPosition = {
      ...updated.box.position,
      anchor: 'custom' as const,
      x: updated.box.position.x ?? STRUCTURAL_ANCHOR_DEFAULTS.bottom.x,
      y: updated.top,
      width: updated.box.position.width ?? DEFAULT_BOX_WIDTH_PCT,
    }
    return { ...updated.box, position: newPosition }
  })

  return result
}
