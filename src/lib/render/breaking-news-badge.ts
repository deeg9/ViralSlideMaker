/**
 * quick-260519-bkn: shared geometry + predicate for the "BREAKING NEWS"
 * badge on news-oracle cover slides. SINGLE source of truth so the canvas
 * preview, the Satori PNG export, and the HTML export all paint the badge
 * identically (TPLREND-05 / PARITY-01).
 *
 * Always on for `news-oracle` cover slides; never rendered elsewhere. No
 * user toggle by design — the badge is part of the news-oracle template's
 * cover chrome.
 */

/** Canvas reference: matches REF_WIDTH / REF_HEIGHT used by every render path. */
const CANVAS_W = 1080
const CANVAS_H = 1920

export const BREAKING_NEWS_BADGE = {
  /** Static copy. */
  text: 'BREAKING NEWS',
  /** Hook font (Anton) at a representative breaking-news ticker size. */
  fontSizePx: 28,
  /** Tight tracking on uppercase Anton for the ticker feel. */
  letterSpacingPx: 4,
  /** Each flanking horizontal rule (one on each side of the text). */
  lineLengthPx: 96,
  lineThicknessPx: 2,
  /** Gap between each rule and the text (applied via flex gap). */
  lineGapPx: 16,
  /** Distance from badge bottom edge to caption-card top edge, in CANVAS px. */
  bottomOffsetPx: 28,
  /** Rough total badge height; used by HTML export to compute top offset. */
  totalHeightPx: 36,
} as const

/** True iff the slide should render the breaking-news badge. */
export function shouldShowBreakingNewsBadge(
  templateId: string,
  slideRole: string | undefined | null,
): boolean {
  return templateId === 'news-oracle' && slideRole === 'cover'
}

/** Badge top edge in % of canvas height, derived from caption-card top %. */
export function breakingNewsBadgeTopPct(captionCardTopPct: number): number {
  const cardTopPx = (captionCardTopPct / 100) * CANVAS_H
  const badgeBottomPx = cardTopPx - BREAKING_NEWS_BADGE.bottomOffsetPx
  const badgeTopPx = badgeBottomPx - BREAKING_NEWS_BADGE.totalHeightPx
  return (badgeTopPx / CANVAS_H) * 100
}

/** Canvas reference width, exported so consumers can compute px↔% without
    importing private constants. */
export const BREAKING_NEWS_CANVAS_W = CANVAS_W
export const BREAKING_NEWS_CANVAS_H = CANVAS_H
