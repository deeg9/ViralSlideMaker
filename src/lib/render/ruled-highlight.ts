// quick-260520-064: shared geometry for the 'ruled' TextHighlight style.
// Extracted from the deleted breaking-news-badge.ts so all three render
// paths paint the rules pixel-for-pixel identically (PARITY-01 / TPLREND-05).
//
// Two distinct concerns live here:
//   1. RULED_HIGHLIGHT geometry constants + the `ruledHighlightTopPctFromCaptionCardY`
//      formula (mirrors the deleted `breakingNewsBadgeTopPct` byte-identically).
//   2. `liveCaptionCardTopPct(overrides, template)` — a Y-derivation helper that
//      MIRRORS `resolveCaptionBar(...).y` (src/lib/render/resolve-overlay.ts).
//      The adapter uses it to compute the LIVE caption-card top % (honoring user
//      `caption_bar_y` / `_height_pct` / `_position` edits) without importing
//      the full resolver (and without needing the `isNewsLayoutSlide` runtime
//      flag that the resolver expects).

import type { SlideStyleOverrides } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates'
import { CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT } from '@/lib/render/hook-fit'

/** Canvas reference: matches REF_WIDTH / REF_HEIGHT used by every render path. */
export const CANVAS_W = 1080
export const CANVAS_H = 1920

export const RULED_HIGHLIGHT = {
  /** Hook font (Anton) at a representative breaking-news ticker size. */
  fontSizePx: 28,
  /** Tight tracking on uppercase for the ticker feel. */
  letterSpacingPx: 4,
  /** Each flanking horizontal rule (one on each side of the text). */
  lineLengthPx: 96,
  lineThicknessPx: 2,
  /** Gap between each rule and the text (applied via flex gap). */
  lineGapPx: 16,
  /** Distance from the kicker's bottom edge to the caption-card top, in CANVAS px. */
  bottomOffsetPx: 28,
  /** Rough total kicker height; used by HTML export to compute top offset. */
  totalHeightPx: 36,
} as const

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v))

/**
 * Top % for a 'ruled' kicker positioned ABOVE a caption card at given Y%.
 *
 * Mirrors the deleted `breakingNewsBadgeTopPct` so news-oracle cover Y is
 * pixel-identical to today's chrome (D4 parity).
 */
export function ruledHighlightTopPctFromCaptionCardY(
  captionCardTopPct: number,
): number {
  const cardTopPx = (captionCardTopPct / 100) * CANVAS_H
  const badgeBottomPx = cardTopPx - RULED_HIGHLIGHT.bottomOffsetPx
  const badgeTopPx = badgeBottomPx - RULED_HIGHLIGHT.totalHeightPx
  return (badgeTopPx / CANVAS_H) * 100
}

/**
 * D1/D4 live-caption-card-Y helper (Blocker 1 fix). MIRRORS the math in
 * `resolveCaptionBar(...)` (src/lib/render/resolve-overlay.ts:543-572)
 * — but only the Y derivation — so the adapter can compute the caption
 * card's LIVE top % without importing the full resolver (and without
 * needing the `isNewsLayoutSlide` runtime flag, which is unreachable
 * from the adapter call site).
 *
 * For news-oracle covers, this returns the same `cc.y` the deleted
 * chrome read, honoring user edits:
 *   - `caption_bar_y` (explicit drag)
 *   - `caption_bar_height_pct` (height slider)
 *   - `caption_bar_position` (top/bottom flip)
 *
 * Fallback chain:
 *   - explicit `caption_bar_y`
 *   - `position === 'top' ? 0 : 100 - heightPct`
 *   - `heightPct` from `caption_bar_height_pct`
 *   - `template.captionCardDefaults?.heightPct`
 *   - the global `CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT` default
 */
export function liveCaptionCardTopPct(
  overrides: SlideStyleOverrides | undefined,
  template: SlideTemplate,
): number {
  const o = overrides ?? {}
  const heightPct = clamp(
    o.caption_bar_height_pct
      ?? template.captionCardDefaults?.heightPct
      ?? CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT,
    10,
    90,
  )
  const position = o.caption_bar_position ?? 'bottom'
  const positionY = position === 'top' ? 0 : 100 - heightPct
  return clamp(o.caption_bar_y ?? positionY, 0, 100)
}
