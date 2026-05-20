// Per-template hook auto-fit. Shrinks the hook fontSize as the headline gets
// longer so multi-line hooks stay inside each template's reserved hook zone.
//
// Calibrated per template-font: condensed display fonts (Anton) fit more chars
// per line than proportional sans (Plus Jakarta Sans) at the same px size, so
// each template declares its own thresholds. Templates not in the registry
// keep their declared `hookFontSize` unchanged (auto-opt-out).

type HookFitStep = { maxChars: number; scale: number }
type HookFitSpec = { baseSize: number; steps: HookFitStep[] }

// Curves below assume baseSize equal to the template's declared hookFontSize.
// `steps` are evaluated in order; first step where `len <= maxChars` wins.
// If none match, the last step's scale applies.
const HOOK_FIT_REGISTRY: Record<string, HookFitSpec> = {
  // News templates — Anton (condensed) at 110px on a hookWidth ≈ 78% canvas
  // (842px). Original calibration assumed 2-line wraps were OK; in practice
  // AI-generated segment-rendered hooks don't always wrap inside spans, so
  // single-line widths must fit the container. Tightened thresholds enforce
  // single-line fit at each scale step (rough char-width math: Anton at S px
  // averages ~0.45*S per char; container fits ~842/0.45*S chars = 1871/S).
  // 260503: long-hook step tightened from 0.52 → 0.45 and Infinity from 0.42 →
  // 0.38. At 0.52 (57px) the segment "IS OUTSOURCING THINKING TO" rendered as a
  // single oversized flex item that exceeded the 842px hook container in Satori
  // — Satori does not honor overflow-wrap inside flex items, so the hook content
  // visually overflowed its 60→80% cover zone and crashed into the body text.
  'news-drop': {
    baseSize: 110,
    steps: [
      { maxChars: 14, scale: 1 },
      { maxChars: 22, scale: 0.8 },
      { maxChars: 32, scale: 0.65 },
      { maxChars: 48, scale: 0.45 },
      { maxChars: Infinity, scale: 0.38 },
    ],
  },
  'news-cyan': {
    baseSize: 110,
    steps: [
      { maxChars: 14, scale: 1 },
      { maxChars: 22, scale: 0.8 },
      { maxChars: 32, scale: 0.65 },
      { maxChars: 48, scale: 0.45 },
      { maxChars: Infinity, scale: 0.38 },
    ],
  },
  // Premium magazine — Plus Jakarta Sans (proportional, wider) on a tight
  // image-with-bottom-card layout where hook + body share ~40% of canvas
  // height. Tighter curve so 4+-line wraps don't bleed into the body zone.
  'magazine-bold': {
    baseSize: 120,
    steps: [
      { maxChars: 15, scale: 1 },
      { maxChars: 28, scale: 0.7 },
      { maxChars: 42, scale: 0.55 },
      { maxChars: 60, scale: 0.45 },
      { maxChars: Infinity, scale: 0.38 },
    ],
  },
  // documentary — Plus Jakarta Sans, 110px base, hookY 48% / bodyY 62% =
  // tight 269px hook zone. Tightened 2026-05-02 to match news-template
  // calibration so multi-line wraps don't bleed into body.
  'documentary': {
    baseSize: 110,
    steps: [
      { maxChars: 14, scale: 1 },
      { maxChars: 22, scale: 0.8 },
      { maxChars: 32, scale: 0.65 },
      { maxChars: 48, scale: 0.52 },
      { maxChars: Infinity, scale: 0.42 },
    ],
  },
  // Phase 56 templates.
  // editorial-serif — Lora bold serif, 130px base, inner hookY 48 → bodyY 62
  // (269px). Cover layout is generous (346px) but inner is tightest
  // constraint. Tightened 2026-05-02.
  'editorial-serif': {
    baseSize: 130,
    steps: [
      { maxChars: 13, scale: 1 },
      { maxChars: 22, scale: 0.78 },
      { maxChars: 34, scale: 0.62 },
      { maxChars: 50, scale: 0.5 },
      { maxChars: Infinity, scale: 0.4 },
    ],
  },
  // notes-app-chic — Plus Jakarta Sans + ransom-note multi-fonts. 346px
  // hook zone is generous, but ransom-note widens lines so add safety buffer.
  'notes-app-chic': {
    baseSize: 110,
    steps: [
      { maxChars: 14, scale: 1 },
      { maxChars: 22, scale: 0.8 },
      { maxChars: 34, scale: 0.65 },
      { maxChars: 50, scale: 0.52 },
      { maxChars: Infinity, scale: 0.42 },
    ],
  },
  // brutalist-grid — Space Grotesk bold, 180px base. Even 10 chars at full
  // size overflows 842px container. Aggressive curve. (Cover layout uses
  // 220px hookFontSize but registry sees template.hookFontSize=180; cover-
  // aware baseSize is a future enhancement.)
  'brutalist-grid': {
    baseSize: 180,
    steps: [
      { maxChars: 8, scale: 1 },
      { maxChars: 14, scale: 0.75 },
      { maxChars: 22, scale: 0.55 },
      { maxChars: 32, scale: 0.42 },
      { maxChars: Infinity, scale: 0.32 },
    ],
  },
  // quick-260519-t3x templates.
  // chrome-pulse — quick-260519-bgr (2026-05-19): registry entry removed.
  // chrome-pulse now uses the classic newsZone layout (matching news-
  // oracle), so promoteNewsHeadline's fitHeadlineToBox(842x620) path
  // stamps the headline size. The previous registry curve produced
  // ~56px for a 43-char hook, which read visibly smaller than the
  // news-oracle reference (~100-130px for similar hooks).
  // tr3nding-news — quick-260520-ft0 (2026-05-20): registry entry removed.
  // tr3nding-news now uses the classic newsZone layout (matching
  // news-oracle / chrome-pulse), so promoteNewsHeadline's
  // fitHeadlineToBox(842x620) stamps the headline size. The previous
  // registry curve produced ~66px for a 42-char hook (scale 0.55 ×
  // 120), which read visibly smaller than the news-oracle reference.
  // sunset-tabloid + soft-sage — quick-260519-bgr (2026-05-19): registry
  // entries removed to match chrome-pulse's oracle-scale fix. No-photo
  // color-block templates default to template.hookFontSize directly
  // (128px Bebas / 108px DM Serif italic) — same convention as
  // bold-yellow + y2k-pop, which also stay out of the registry. Long
  // AI-emitted hooks (50+ chars) may wrap to 3+ lines instead of
  // auto-shrinking, which is the deliberate trade-off for visual punch.
}

export function getHookFontSize(
  templateId: string,
  hookText: string | null | undefined,
  baseSize: number,
): number {
  const spec = HOOK_FIT_REGISTRY[templateId]
  if (!spec) return baseSize
  const len = (hookText ?? '').trim().length
  for (const step of spec.steps) {
    if (len <= step.maxChars) return Math.round(baseSize * step.scale)
  }
  return Math.round(baseSize * spec.steps[spec.steps.length - 1].scale)
}

export function hasHookFit(templateId: string): boolean {
  return templateId in HOOK_FIT_REGISTRY
}

// Test-only export so the unit suite can iterate the registry.
export const HOOK_FIT_TEMPLATE_IDS = Object.keys(HOOK_FIT_REGISTRY)

/**
 * quick-260510-export-overlap: cap manual `hook_font_size` overrides in
 * layouts where bodyY is fixed by a preset (NEWS_LAYOUT cover/body).
 *
 * Without this cap, a user-set hook size that exceeds what auto-fit produces
 * causes the hook to wrap into more lines than the (bodyY - hookY) zone can
 * hold, and the export renders hook + body overlapping. (Reproduced on
 * news-cyan cover layout with hook_font_size: 114 — wraps to 5 lines and
 * collides with body at bodyY=84%.)
 *
 * Phase 82 Gap A: the cap is now BODY-AWARE. The overlap rationale above only
 * applies when the slide actually HAS a body — a headline crashing into the
 * body zone. Phase 82 News slides are headline-only (R4 — body_text optional,
 * headline-only is the default), so there is no body zone for the headline to
 * collide with: on those slides the manual size is honored verbatim and the
 * headline can own the whole canvas (the reference news look). The cap only
 * fires for slides that carry body text, and was raised 1.6× → 2.6× so a
 * legitimately large user pick survives instead of being flattened.
 *
 * Both renderers (render-slide-satori.tsx + slide-preview.tsx) call this
 * helper at the same point in the resolution pipeline and MUST pass the same
 * `hasBody` value (TPLREND-05 parity contract — both must produce identical
 * clamped fontSize).
 *
 * Behavior:
 *   - When `hookFit` is unknown for the template, returns `manualSize`
 *     unchanged (templates outside the registry have no calibrated cap).
 *   - When `hasBody` is false (headline-only slide), returns `manualSize`
 *     unchanged — no body zone to collide with.
 *   - When `hookFit` is registered AND `hasBody` is true, allows the manual
 *     override to grow up to MANUAL_GROWTH_MAX × the auto-fit value. Past
 *     that, the hook would wrap into the body zone.
 */
const MANUAL_GROWTH_MAX = 2.6

export function clampManualHookSize(
  manualSize: number,
  templateId: string,
  hookText: string | null | undefined,
  baseSize: number,
  hasBody: boolean,
): number {
  if (!hasHookFit(templateId)) return manualSize
  // Phase 82 Gap A: headline-only slides (no body box) have no body zone for
  // the hook to wrap into — the overlap rationale that motivated the cap does
  // not apply, so the manual size is honored verbatim. The headline can own
  // the whole canvas (the reference news look).
  if (!hasBody) return manualSize
  const autoFit = getHookFontSize(templateId, hookText, baseSize)
  const cap = Math.round(autoFit * MANUAL_GROWTH_MAX)
  return Math.min(manualSize, cap)
}

// =====================================================================
// Phase 82 Gap D — news headline auto-fit.
//
// The R10 round-2 visual sign-off found the generated news headline
// overflowing the slide and breaking mid-word: `promoteNewsHeadline` used to
// stamp a FLAT `NEWS_HEADLINE_FONT_SIZE = 200` onto every news slide, far too
// big for a long headline. The user's explicit ask was "font size logic
// relative to where the text is and where the caption card / black box is."
//
// `fitHeadlineToBox` is the pure sizing primitive: it returns the LARGEST font
// size whose longest word still fits the box width AND whose whole-word-wrapped
// lines still fit the box height. Because no candidate size lets a word exceed
// the box width, the auto-fit also removes the mid-word-break at the sizing
// layer (the renderer-side whole-word wrap is Gap E / Plan 09).
//
// `captionCardBox` derives a fit box from the quick-260517-k2n draggable /
// resizable caption card (`ResolvedCaptionBar`), so a headline rendered into a
// caption card fills the box the user dragged — never the default hook zone.
//
// Both functions are PURE — no DOM, no measurement API — so they run
// identically server-side (Satori), client-side (canvas preview), and at
// generation time. The `ResolvedCaptionBar` shape is imported as a TYPE ONLY so
// this module never takes a runtime dependency on resolve-overlay.ts (which, as
// of Plan 09, imports `fitHeadlineToBox` back — a `import type` keeps the graph
// acyclic). The 1080x1920 canvas dimensions are re-declared as local literals
// here for the same reason (they mirror `CANVAS` in resolve-overlay.ts).
// =====================================================================

import type { ResolvedCaptionBar } from './resolve-overlay'

/** A target box for headline auto-fit, in pixels on the 1080x1920 canvas. */
export interface HeadlineBox {
  widthPx: number
  heightPx: number
}

/** Largest headline font size the auto-fit will ever return. The news headline
 *  must DOMINATE the slide (reference ~142px; the user's manual edit went
 *  larger) — 240 is a generous ceiling for short headlines. */
export const HEADLINE_FIT_CEILING = 240

/** Hard minimum headline size. A pathologically long single word can force the
 *  fit down to the floor; whole-word wrapping (Gap E) keeps it readable. */
export const HEADLINE_FIT_FLOOR = 64

// Line-height of the hook text — mirrors `hookStyle.lineHeight` in both
// renderers (render-slide-satori.tsx + slide-preview.tsx).
const HEADLINE_LINE_HEIGHT = 1.1

// Average glyph advance as a fraction of font size for the condensed display
// font used by the news templates (Anton). The HOOK_FIT_REGISTRY comments cite
// ~0.45; 0.50 is intentionally a touch more conservative so the auto-fit never
// overflows the box (better to size slightly small than to clip).
const CONDENSED_CHAR_ADVANCE = 0.5

// 1080x1920 canvas — local literals (mirror `CANVAS` in resolve-overlay.ts) so
// this module keeps a type-only dependency on resolve-overlay.ts.
const CANVAS_W = 1080
const CANVAS_H = 1920

/**
 * Greedily pack words into whole-word lines and return the line count for a
 * given per-character advance and box width. A word wider than the box on its
 * own still occupies one line — callers reject that size via the longest-word
 * check below, so this never silently produces an overflowing layout.
 */
function wrappedLineCount(words: string[], charWidthPx: number, boxWidthPx: number): number {
  if (words.length === 0) return 0
  let lines = 1
  let lineWidth = 0
  for (let i = 0; i < words.length; i++) {
    const wordPx = words[i].length * charWidthPx
    // Inter-word gap (one space worth of advance) precedes every word but the
    // first on a line.
    const withGap = lineWidth === 0 ? wordPx : lineWidth + charWidthPx + wordPx
    if (lineWidth > 0 && withGap > boxWidthPx) {
      lines++
      lineWidth = wordPx
    } else {
      lineWidth = withGap
    }
  }
  return lines
}

/**
 * Compute the largest integer font size at which `headline` fits `box`:
 *  - the longest single word fits within `box.widthPx` (so no word ever needs
 *    to break — this also removes Gap E's mid-word break at the sizing layer),
 *  - the whole-word-wrapped headline's total line height fits `box.heightPx`.
 *
 * Searches `[HEADLINE_FIT_FLOOR, HEADLINE_FIT_CEILING]` from the ceiling down
 * and returns the first fitting size. If even the floor does not fit (a
 * pathologically long single word), returns `HEADLINE_FIT_FLOOR` — the hard
 * minimum. Always returns an integer. Pure — never throws on string input.
 */
export function fitHeadlineToBox(headline: string, box: HeadlineBox): number {
  const trimmed = (headline ?? '').trim()
  if (trimmed.length === 0) return HEADLINE_FIT_FLOOR
  const words = trimmed.split(/\s+/).filter(Boolean)
  const longestWordLen = words.reduce((m, w) => Math.max(m, w.length), 0)
  const boxWidthPx = Math.max(1, box.widthPx)
  const boxHeightPx = Math.max(1, box.heightPx)

  for (let size = HEADLINE_FIT_CEILING; size >= HEADLINE_FIT_FLOOR; size--) {
    const charWidthPx = size * CONDENSED_CHAR_ADVANCE
    const longestWordPx = longestWordLen * charWidthPx
    if (longestWordPx > boxWidthPx) continue
    const lines = wrappedLineCount(words, charWidthPx, boxWidthPx)
    const totalHeightPx = lines * size * HEADLINE_LINE_HEIGHT
    if (totalHeightPx <= boxHeightPx) return size
  }
  return HEADLINE_FIT_FLOOR
}

/**
 * quick-260518-ch8 — the FIXED reference height (% of the 1080x1920 frame)
 * used to derive a headline-fit box's `heightPx`. It MUST equal the default
 * `caption_bar_height_pct` (`?? 38` in `resolveCaptionBar`) so that a slide at
 * the default caption height re-fits byte-identically before and after the
 * checkpoint-feedback decoupling fix (TPLREND-05).
 *
 * The headline auto-fit deliberately does NOT read the user-controlled
 * `caption_bar_height_pct`: the Caption Card's Height slider is a pure visual
 * property of the card and must never resize the headline (or any other text
 * element). A taller card just gives the caption more empty breathing room.
 */
export const CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT = 38

/**
 * Symmetric padding (px on the 1080x1920 frame) between the caption card's
 * edges and the headline fit box. The headline never touches the card edge.
 * Single source of truth — `captionCardBox` (the fit box) AND
 * `captionCardHeadlineLayout` (the text-box placement) both use it, so the
 * box the headline is SIZED against is exactly the box it is POSITIONED into.
 */
export const CAPTION_CARD_INSET_PX = 80

/**
 * Derive a headline-fit box from a resolved (quick-260517-k2n) caption card.
 *
 * `widthPx` is coupled to the card's `width` — the Phase 82 overflow safety:
 * a long headline must shrink so it never overflows the card horizontally or
 * breaks mid-word.
 *
 * `heightPx`, however, is derived from the FIXED
 * `CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT` (38%) — NOT the user-controlled
 * `resolved.heightPct` (quick-260518-ch8 checkpoint-feedback fix). Dragging the
 * Caption Card Height slider therefore leaves the headline font size unchanged;
 * the card's height is purely the card's own visual property. At the default
 * caption height the box is byte-identical to the pre-fix box.
 *
 * Both percents map onto the 1080x1920 frame; `CAPTION_CARD_INSET_PX` is
 * subtracted symmetrically so the headline does not touch the card edges.
 * Dimensions are floored at 1 so a tiny card never yields a negative box.
 */
export function captionCardBox(
  resolved: ResolvedCaptionBar,
  inset = CAPTION_CARD_INSET_PX,
): HeadlineBox {
  const widthPx = (resolved.width / 100) * CANVAS_W - 2 * inset
  // quick-260518-ch8: heightPx uses the FIXED reference height, NOT
  // resolved.heightPct — the Height slider must not resize the headline.
  const heightPx =
    (CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT / 100) * CANVAS_H - 2 * inset
  return {
    widthPx: Math.max(1, widthPx),
    heightPx: Math.max(1, heightPx),
  }
}

/** Placement of a headline text box INSIDE a caption card. All values are
 *  percent of the 1080x1920 frame. */
export interface CaptionCardHeadlineBox {
  /** Text-box LEFT edge. */
  xPct: number
  /** Text-box width. Equals the `captionCardBox` fit-box width, so the
   *  rendered wrap matches what the headline auto-fit assumed. */
  widthPct: number
  /** The card's vertical CENTER. The renderers place the headline box's top
   *  edge here and apply `transform: translateY(-50%)`, so the (variable-
   *  height) wrapped headline ends up vertically centered in the card —
   *  exactly, with no line-count estimate. */
  yCenterPct: number
}

/** Caption-card geometry `captionCardHeadlineBox` needs — the structural
 *  subset of `ResolvedCaptionBar` (so the generation-side snap can call it
 *  with a derived object, not just the renderer's resolved bar). */
export interface CaptionCardGeometry {
  /** Card left edge, percent. */
  x: number
  /** Card top edge, percent. */
  y: number
  /** Card width, percent. */
  width: number
  /** Card height, percent. */
  heightPct: number
}

/**
 * quick-260519-hym — deterministic placement of a news / code-template
 * headline inside its caption card. The SINGLE source of truth shared by all
 * three render paths (canvas preview, Satori PNG, HTML export) AND the
 * generation-side snap, so the headline box is identical everywhere
 * (TPLREND-05).
 *
 * - `xPct` / `widthPct` inset the headline by `CAPTION_CARD_INSET_PX` on each
 *   side. `widthPct` equals `captionCardBox().widthPx` so the headline renders
 *   exactly as wide as the box its font size was fit against — without this the
 *   headline wraps to extra lines and overflows the card.
 * - `yCenterPct` is the card's vertical midpoint; the renderer pairs it with
 *   `translateY(-50%)` for exact vertical centering regardless of line count.
 *
 * Pure / deterministic — no DOM, never throws.
 */
export function captionCardHeadlineBox(
  card: CaptionCardGeometry,
): CaptionCardHeadlineBox {
  const round1 = (n: number) => Math.round(n * 10) / 10
  const xPx = (card.x / 100) * CANVAS_W + CAPTION_CARD_INSET_PX
  const widthPx = Math.max(1, (card.width / 100) * CANVAS_W - 2 * CAPTION_CARD_INSET_PX)
  return {
    xPct: round1((xPx / CANVAS_W) * 100),
    widthPct: round1((widthPx / CANVAS_W) * 100),
    yCenterPct: round1(card.y + card.heightPct / 2),
  }
}
