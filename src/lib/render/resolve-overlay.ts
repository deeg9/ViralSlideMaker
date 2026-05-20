import React from 'react'
import {
  fitHeadlineToBox,
  captionCardBox,
  CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT,
} from './hook-fit'
import type { OverlayContent, SlideTemplate } from './templates'
import type { DecorativeAsset } from './templates/decorative'
import type {
  Slide,
  SlideStyleOverrides,
  TextBox,
  TextHighlightEffect,
  TextSegment,
} from '@/lib/types/slide'

/**
 * Phase 45 — shared resolver foundation.
 *
 * This module is the SINGLE source of truth for overlay content resolution,
 * slot pixel anchors, segment-to-span markup (incl. highlight pills), and
 * bottom-card RGBA composition. Both render paths (Satori PNG export +
 * React DOM preview) MUST import from here so preview/export stays in sync
 * (TPLREND-05).
 *
 * Pure module — no DOM/Node deps. Safe to import on server and client.
 *
 * v2.9 LAYER ORDER (Phase 55+ DOM-order contract — both renderers MUST agree):
 *   0   Background fill / image                                  (existing)
 *   1.0 backgroundMode: image-with-bottom-card bottom-card layer (existing — Phase 45)
 *   1.5 renderGrain(template.grainMode)                          (Phase 55 — NEW; conditional)
 *   2.0 Overlay color tint                                       (existing)
 *   2.5 renderVignette(template.vignette.strength)               (Phase 55 — NEW; conditional)
 *   3.0 Hook + body text                                         (existing)
 *   4.0 Template overlays (slot-positioned)                      (existing — Phase 45)
 *
 * Layers 1.5 and 2.5 are absent unless the template declares the corresponding
 * field. Existing 8 templates leave both undefined → no behavior change in
 * Phase 55. Phase 56 templates (editorial-serif / notes-app-chic) opt in.
 *
 * NOTE: this module intentionally lives at .ts (not .tsx). The JSX-emitting
 * helper `renderSegments` uses React.createElement directly so the file
 * compiles without a TSX transform — keeps the resolver tier-neutral and
 * importable from any context.
 */

// 1080×1920 canvas constants — referenced by both renderers.
export const CANVAS = { W: 1080, H: 1920 } as const

/**
 * Pixel anchors for the 5 named overlay slots, on the 1080×1920 reference canvas.
 * Single source of truth shared by Satori (server) and React preview (client).
 *
 * - 'top-left'    → 60px inset from top-left corner.
 * - 'top-right'   → uses CSS `right: 60` (NOT computed `left: 1020`) so Satori
 *                   absolute positioning works correctly.
 * - 'mid'         → horizontally centered at 55% of canvas height.
 * - 'bottom-card' → full-width × 38% height card anchored at bottom, 80px padding.
 * - 'free'        → null (no auto-positioning); overlay.offset.{x,y} becomes
 *                   absolute pixel coordinates per CONTEXT.md Area 1.
 */
export const SLOT_GEOMETRY = {
  'top-left': { left: 60, top: 60 },
  'top-right': { right: 60, top: 60 },
  'mid': { left: '50%', top: '55%', transform: 'translateX(-50%)' },
  'bottom-card': { left: 0, right: 0, bottom: 0, height: '38%', padding: 80 },
  'free': null as null,
} as const

/**
 * Render context passed to `resolveOverlayContent`. Both Satori and React
 * preview build this from data they already own (slide array index/length +
 * project topic + the active slide).
 *
 * `topic` is optional — published carousels (anonymous explore route) don't
 * thread it; resolveOverlayContent falls back to '' so the chip slot renders
 * empty rather than throwing.
 */
export interface OverlayResolveCtx {
  slideIndex: number
  totalSlides: number
  topic?: string
  slide: Slide
}

const DEFAULT_COUNTER_FORMAT = '{currentSlide}/{totalSlides}'

/**
 * Resolve a TemplateOverlay's `content` to its display string.
 *
 * Discriminator branches:
 *   - 'literal'      → returns content.text verbatim.
 *   - 'page-counter' → substitutes {currentSlide} (1-indexed: slideIndex+1)
 *                      and {totalSlides} into the format string. Default
 *                      format '{currentSlide}/{totalSlides}'. Unknown tokens
 *                      passthrough verbatim (no DSL — Phase 44 validator
 *                      already guards format shape).
 *   - 'slide-field'  → reads from ctx (topic) or ctx.slide (hook_text/body_text).
 *                      Missing values fall back to '' for graceful degradation.
 */
export function resolveOverlayContent(
  content: OverlayContent,
  ctx: OverlayResolveCtx,
): string {
  switch (content.type) {
    case 'literal':
      return content.text
    case 'page-counter': {
      const fmt = content.format ?? DEFAULT_COUNTER_FORMAT
      return fmt
        .replace('{currentSlide}', String(ctx.slideIndex + 1))
        .replace('{totalSlides}', String(ctx.totalSlides))
    }
    case 'slide-field':
      switch (content.field) {
        case 'topic':
          return ctx.topic ?? ''
        case 'hook_text':
          return ctx.slide.hook_text ?? ''
        case 'body_text':
          return ctx.slide.body_text ?? ''
        default:
          return ''  // unknown field — graceful fallback per CONTEXT.md Area 4
      }
    default:
      return ''  // unknown type — graceful fallback per CONTEXT.md Area 4
  }
}

/**
 * Render a segmented text run as inline <span>s. Replaces the duplicated
 * renderSegmentChildren (Satori) / renderSegments (React preview) helpers
 * so highlight-pill markup stays byte-identical between the two paths
 * (TPLREND-05).
 *
 * Segment behavior:
 *   - No segments / empty array → returns the bare string (parity with
 *     existing Satori fallback).
 *   - `accent: true`            → span color = accentColor; otherwise baseColor.
 *   - `highlightColor` set      → span gains backgroundColor + padding +
 *                                 borderRadius + marginRight pill style.
 *     `highlightStyle` defaults to 'pill' (rounded 8px / 4×12 padding).
 *     `highlightStyle: 'block'` → squared (0 radius / 4×8 padding).
 *
 * PARITY CONTRACT (TPLREND-05): we deliberately do NOT set
 * `box-decoration-break: clone` even though browsers support it. Satori
 * does not support that property, so honoring it in the React preview
 * would create preview/export drift on multi-line pills.
 *
 * Implementation note: uses React.createElement directly so this module
 * stays at .ts (no TSX transform required by importers).
 */
/**
 * Pick a readable text color (black or white) for text rendered ON TOP of the
 * given background hex. Uses standard luminance threshold (≈ 0.55) — mint
 * #A8E0B0 → black; navy #001a2c → white. Murphy reference uses black on mint.
 *
 * Accepts #RGB, #RRGGBB, and #RRGGBBAA. Invalid input falls back to baseColor.
 */
export function pickContrastColor(bgHex: string, baseColor: string): string {
  let h = bgHex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length < 6) return baseColor
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return baseColor
  // sRGB relative luminance approximation (Y' formula).
  const y = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return y > 0.55 ? '#000000' : '#ffffff'
}

export function renderSegments(
  text: string,
  segments: TextSegment[] | undefined,
  baseColor: string,
  accentColor: string,
): React.ReactNode {
  if (!segments || segments.length === 0) return text
  // Use non-breaking space (U+00A0) as inter-segment separator — Satori/CSS
  // flex normalizes regular whitespace between siblings; NBSP is preserved.
  return segments.map((seg, i) => {
    const baseSegmentColor = seg.accent ? accentColor : baseColor
    const isLast = i === segments.length - 1
    // Phase 56 (TPL-07, D-23): per-segment fontFamily override for ransom-note hooks
    // (notes-app-chic). Falls back to the parent text container's fontFamily when
    // undefined — zero behavior change for legacy segments.
    const segmentFontFamily: React.CSSProperties = seg.fontFamily ? { fontFamily: seg.fontFamily } : {}
    // quick-260502-pw8: per-segment bold mark. Inline fontWeight wins over
    // the parent text-box's font_weight (Word/Figma semantics). Falls back to
    // undefined when not set so the parent's weight cascades through.
    const segmentBoldStyle: React.CSSProperties = seg.bold ? { fontWeight: 700 } : {}
    if (seg.highlightColor) {
      const isPill = (seg.highlightStyle ?? 'pill') === 'pill'
      const pillTextColor = pickContrastColor(seg.highlightColor, baseSegmentColor)
      const pillStyle: React.CSSProperties = {
        color: pillTextColor,
        backgroundColor: seg.highlightColor,
        padding: isPill ? '4px 12px' : '4px 8px',
        borderRadius: isPill ? '8px' : '0',
        marginRight: isLast ? '0' : '8px',
        // Phase 82 Gap E: words wrap ONLY at spaces — `overflow-wrap: normal`
        // (the CSS default) never splits a word mid-word. The hook container's
        // `flex-wrap: wrap` already wraps between word-spans at spaces;
        // combined with the Plan 08 headline auto-fit (the longest word always
        // fits the box) no mid-word break is ever needed. This supersedes the
        // old quick-260502-j14 `overflow-wrap: break-word` — which still split
        // a single-word news segment when that one word was wider than the
        // container ("ANNOUNCE" + orphaned "S").
        maxWidth: '100%',
        overflowWrap: 'normal',
        ...segmentFontFamily,
        ...segmentBoldStyle,
      }
      return React.createElement('span', { key: `${i}-${seg.text.slice(0, 20)}`, style: pillStyle }, seg.text)
    }
    // Plain span: append NBSP after the text (except last) so flex layout
    // preserves the inter-word gap. The space sits INSIDE the span so flex
    // child-stripping doesn't drop it.
    // Also normalize whitespace WITHIN segment text to NBSP (multi-word
    // segments like 'Folk Singer' lose their space in flex otherwise).
    const normalized = seg.text.replace(/\s+/g, ' ')
    const children = isLast ? normalized : `${normalized} `
    return React.createElement(
      'span',
      {
        key: `${i}-${seg.text.slice(0, 20)}`,
        style: {
          color: baseSegmentColor,
          // Phase 82 Gap E: whole-word wrap — `overflow-wrap: normal` never
          // splits a word mid-word. The hook container's `flex-wrap: wrap`
          // wraps between word-spans at spaces; combined with the Plan 08
          // headline auto-fit no mid-word break is needed. See the pill
          // segment style above for the full rationale (supersedes the old
          // quick-260502-j14 `overflow-wrap: break-word`).
          maxWidth: '100%',
          overflowWrap: 'normal',
          ...segmentFontFamily,
          ...segmentBoldStyle,
        },
      },
      children,
    )
  })
}

/**
 * quick-260502-pw8: paragraph-level text renderer with optional list-marker
 * prefixes and indent. The canonical Satori workaround for `<ol>/<ul>` —
 * which Satori's CSS subset does NOT support — is a `flex-direction: column`
 * container with one child `<div>` per line and a literal text marker
 * ("1. " / "• ") prepended inline to each line.
 *
 * Fast path: when both `listType` and `listIndent` are falsy, returns
 * `renderSegments(...)` UNCHANGED so legacy text boxes / non-list slides
 * stay byte-identical (TPLREND-05 parity invariant — every slide that
 * doesn't opt into lists pre-/post- this helper produces identical Satori
 * SVG output and identical browser-preview DOM).
 *
 * v1 limitation (documented): when listType is set, each line renders as
 * plain text — per-segment bold/accent/highlight inside list items is a
 * v2 follow-up. Per-segment styling outside list mode is unaffected.
 */
export function renderTextBlock(
  text: string,
  segments: TextSegment[] | undefined,
  listType: 'numbered' | 'bulleted' | undefined,
  listIndent: number | undefined,
  baseColor: string,
  accentColor: string,
): React.ReactNode {
  // Fast path — preserves byte-identity for every slide that hasn't opted
  // into lists/indents. Critical for TPLREND-05 parity.
  if (!listType && !listIndent) {
    return renderSegments(text, segments, baseColor, accentColor)
  }

  const indentPx = Math.max(0, Math.min(2, Math.floor(listIndent ?? 0))) * 32
  const lines = text.split('\n')

  // <span> + display:flex (not <div>) so the wrapper is HTML-valid inside
  // the <p> tags slide-preview.tsx wraps hook/body in. Block-level <div>
  // descendants of <p> trip React's hydration checker; flexed inline
  // elements stay valid markup AND keep flex behavior in both browsers and
  // Satori (Satori's CSS subset honors display:flex regardless of tag).
  return React.createElement(
    'span',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        gap: 8,
      },
    },
    lines.map((line, lineIdx) => {
      const marker =
        listType === 'numbered'
          ? `${lineIdx + 1}. `
          : listType === 'bulleted'
            ? '•  '
            : ''
      // Each line is its own flexed <span> so flex-column produces a real
      // line break. Text wrapping inside the line is handled by the parent
      // container's width constraint (hook/body/custom_text passes width).
      return React.createElement(
        'span',
        {
          key: `line-${lineIdx}`,
          style: {
            display: 'flex',
            paddingLeft: indentPx,
            color: baseColor,
            maxWidth: '100%',
            overflowWrap: 'break-word',
          },
        },
        `${marker}${line}`,
      )
    }),
  )
}

/**
 * quick-260517-iiy: fixed built-in inset for the `tight` highlight pill.
 *
 * The `TextHighlightEffect.padding` field stays in the data model but is NO
 * LONGER read by the renderer — the UI padding slider was removed (Task 2) and
 * legacy slides render with this consistent inset regardless of their stored
 * `padding`. Threat T-iiy-02: an out-of-range stored padding has zero rendered
 * effect, so no clamp is needed.
 */
export const TIGHT_HIGHLIGHT_PADDING = 8

/**
 * quick-260517-iiy: render a `tight` highlight as one `inline-block` padded
 * pill PER VISUAL LINE.
 *
 * ROOT CAUSE of the old bug: `tight` used to wrap text in ONE inline <span>
 * with `box-decoration-break: clone`. For segment-less plain text that span
 * held a single text node, so it rendered as a single continuous padded inline
 * run — a horizontal bar — not one pill per line. `box-decoration-break` only
 * yields per-line pills when the inline box actually breaks across line-boxes
 * via inline flow, which a single-text-node span never does. Satori has no
 * `box-decoration-break` support at all and silently fell back to full-width.
 *
 * FIX: split the text on `\n` and emit one `inline-block` padded span per
 * line, inside a `flex-direction: column` container. This is line-exact and
 * needs no `box-decoration-break`, so all three render paths (canvas / Satori
 * / HTML) produce structurally identical per-line pills (TPLREND-05).
 *
 * `alignSelf` honors text-align so each pill hugs and aligns correctly
 * (left → flex-start, center → center, right → flex-end). Satori-safe: only
 * `<span>` tags + `display: flex` / `inline-block` — no `<div>` inside `<p>`
 * (would trip React hydration — see renderTextBlock note above) and no
 * `box-decoration-break`.
 *
 * `highlight.padding` is intentionally NOT read — see TIGHT_HIGHLIGHT_PADDING.
 */
export function renderTightHighlight(
  text: string,
  segments: TextSegment[] | undefined,
  listType: 'numbered' | 'bulleted' | undefined,
  listIndent: number | undefined,
  baseColor: string,
  accentColor: string,
  highlight: TextHighlightEffect,
  textAlign: string | undefined,
): React.ReactNode {
  const indentPx = Math.max(0, Math.min(2, Math.floor(listIndent ?? 0))) * 32
  const lines = text.split('\n')
  // flex alignSelf for the per-line pill — left/center/right → flex bounds.
  const pillAlign = alignToJustifyContent(textAlign)

  return React.createElement(
    'span',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        gap: 8,
        // Container alignment matches the pill alignment so the column of
        // pills sits flush against the text-aligned edge.
        alignItems: pillAlign,
      },
    },
    lines.map((line, lineIdx) => {
      const marker =
        listType === 'numbered'
          ? `${lineIdx + 1}. `
          : listType === 'bulleted'
            ? '•  '
            : ''
      // Per-segment highlight markup is preserved for segmented text by
      // delegating to renderSegments; for a list line or segment-less line we
      // emit the bare (marker-prefixed) string. The pill background + inset
      // comes from THIS span — one independent inline-block pill per line.
      const lineChildren =
        !listType && segments && segments.length > 0 && lines.length === 1
          ? renderSegments(line, segments, baseColor, accentColor)
          : `${marker}${line}`
      return React.createElement(
        'span',
        {
          key: `tight-line-${lineIdx}`,
          style: {
            display: 'inline-block',
            backgroundColor: highlight.color,
            color: baseColor,
            padding: `${TIGHT_HIGHLIGHT_PADDING}px ${TIGHT_HIGHLIGHT_PADDING}px`,
            paddingLeft: indentPx ? indentPx + TIGHT_HIGHLIGHT_PADDING : TIGHT_HIGHLIGHT_PADDING,
            alignSelf: pillAlign,
            maxWidth: '100%',
            overflowWrap: 'break-word',
          },
        },
        lineChildren,
      )
    }),
  )
}

/**
 * Compose the bottom-card background-color string for
 * `backgroundMode === 'image-with-bottom-card'`.
 *
 *   - 8-digit hex (#RRGGBBAA)             → passthrough verbatim
 *                                           (template-supplied alpha wins).
 *   - 6-digit hex (#RRGGBB) / 3-digit hex → rgba(r, g, b, 0.85)
 *                                           (default alpha 0.85 per
 *                                            CONTEXT.md Area 3, matches
 *                                            Murphy reference).
 */
export function bottomCardBackground(hex: string): string {
  if (hex.length === 9) return hex
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, 0.85)`
}

/**
 * quick-260515-k12: clamp a number into [lo, hi]. Local helper — no shared
 * clamp is exported from this module. Used by resolveCaptionBar to bound the
 * user-supplied caption-bar height (threat T-k12-01 — a hand-edited project
 * payload cannot push an out-of-range height into the layout).
 */
function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/**
 * quick-260515-k12: compose an rgba() string from a hex color + 0..1 alpha.
 * Accepts #RGB / #RRGGBB. Invalid input falls back to rgba(0,0,0,alpha) so the
 * render never throws (threat T-k12-02 — malformed caption_bar_color hex).
 */
export function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(0, 0, 0, ${alpha})`
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export interface ResolvedCaptionBar {
  enabled: boolean           // quick-260517-k2n: card renders iff true
  heightPct: number          // 10..90
  x: number                  // left edge percent 0..100
  y: number                  // top edge  percent 0..100
  width: number              // width     percent 0..100
  backgroundColor: string    // rgba() string
  position: 'bottom' | 'top' // retained: the snap preset
  blendPct: number           // quick-260518-ch8: 0..50, clamped; 0 = blend off
}

/**
 * quick-260515-k12 / quick-260517-k2n: SINGLE source of truth for the caption
 * card's enabled state + geometry + color. Reworked from the k12 bottom-card
 * resolver into a free-form draggable/resizable rectangle overlay (it is no
 * longer backgroundMode-gated — the card renders on ANY template iff
 * `caption_bar_enabled === true`).
 *
 * All THREE render paths import this — slide-preview.tsx (browser preview /
 * canvas), render-slide-satori.tsx (Satori PNG export) and render-slide.ts
 * (HTML export) — so the paths cannot drift (PARITY-01).
 *
 * Byte-identity (TPLREND-05): with NO caption_bar_* overrides the result is
 * `enabled: false` for non-news slides — no card renders at all, identical to a
 * pre-change slide. For news-layout slides (`isNewsLayoutSlide === true`) with
 * NO `caption_bar_*` overrides the result is `enabled: true` with seeded
 * bottom-region black geometry (the quick-260518-8o0 news black-headline-
 * backdrop migration — the historical solid-black region behind a news
 * headline is now a real caption card).
 *
 * Geometry: `x`/`y`/`width` are percent of the 1080x1920 frame, clamped to
 * [0,100]; `heightPct` is clamped to [10,90] (threat T-k2n-01 — a hand-edited
 * payload cannot push an out-of-range value into any layout). `y` defaults
 * from `caption_bar_position` (top => 0, bottom => 100 - heightPct) but an
 * explicit `caption_bar_y` always wins.
 *
 * The no-color/no-opacity branch reuses `bottomCardBackground` verbatim (it
 * also handles the 8-digit-hex passthrough case) so an already-customized k12
 * slide keeps its color.
 *
 * quick-260518-8o0: the `isNewsLayoutSlide` flag (defaulting to `false`) seeds
 * the news migration. When it fires AND no explicit caption_bar_* geometry/
 * color keys are present, the seeded geometry falls out of the EXISTING
 * defaults — `heightPct = 38`, `position = 'bottom'`, `x = 0`, `width = 100`,
 * `y = 100 - heightPct`, `backgroundColor = bottomCardBackground(
 * template.backgroundColor)`. For a news template (`backgroundColor: '#000000'`)
 * that is `rgba(0, 0, 0, 0.85)` — a bottom-region black block identical to
 * today's backdrop. No extra seeding code is needed; only the `enabled` gate
 * changes.
 */
export function resolveCaptionBar(
  overrides: SlideStyleOverrides | undefined,
  template: SlideTemplate,
  isNewsLayoutSlide = false,
): ResolvedCaptionBar {
  const o = overrides ?? {}
  // quick-260519-cdf: per-template baseline (height / blend / opacity). Falls
  // back to the global constants for templates leaving captionCardDefaults
  // undefined → byte-identical to the pre-cdf code path. User-explicit
  // caption_bar_* keys still win over template defaults.
  const tplDefaults = template.captionCardDefaults
  // quick-260518-8o0: `== null` (the key is ABSENT) triggers the news-layout
  // default; an EXPLICIT `caption_bar_enabled: false` does NOT — that is what
  // lets "Toggle OFF removes the block" survive the default on news slides
  // (CONTEXT.md "Toggle OFF behavior", locked: absent != false).
  const enabled =
    o.caption_bar_enabled === true ||
    (o.caption_bar_enabled == null && isNewsLayoutSlide)
  // quick-260518-ch8: the default caption height is the SAME named constant the
  // headline auto-fit uses as its fixed reference (`captionCardBox`) — keeping
  // them in sync guarantees a default-height slide re-fits byte-identically.
  const heightPct = clamp(
    o.caption_bar_height_pct ?? tplDefaults?.heightPct ?? CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT,
    10,
    90,
  )
  // quick-260518-ch8: edge-blend amount, clamped [0,50] (threat T-ch8-01 — a
  // hand-edited payload cannot push an out-of-range gradient stop into any
  // render path). Default 0 keeps every legacy slide byte-identical (TPLREND-05).
  const blendPct = clamp(o.caption_bar_blend_pct ?? tplDefaults?.blendPct ?? 0, 0, 50)
  const hasColor = o.caption_bar_color != null
  const hasOpacity = o.caption_bar_opacity != null
  // quick-260519-cdf: when a template ships a baseline opacity, route through
  // hexToRgba directly so the alpha matches the template intent. The legacy
  // `bottomCardBackground` (alpha 0.85) is preserved as the fallback for
  // templates with no captionCardDefaults — keeping the no-color/no-opacity
  // branch byte-identical for every legacy template.
  const backgroundColor =
    !hasColor && !hasOpacity
      ? tplDefaults?.opacity != null
        ? hexToRgba(template.backgroundColor, tplDefaults.opacity)
        : bottomCardBackground(template.backgroundColor)
      : hexToRgba(
          o.caption_bar_color ?? template.backgroundColor,
          o.caption_bar_opacity ?? tplDefaults?.opacity ?? 0.85,
        )
  const position = o.caption_bar_position ?? 'bottom'
  const x = clamp(o.caption_bar_x ?? 0, 0, 100)
  const width = clamp(o.caption_bar_width ?? 100, 0, 100)
  const positionY = position === 'top' ? 0 : 100 - heightPct
  const y = clamp(o.caption_bar_y ?? positionY, 0, 100)
  return { enabled, heightPct, x, y, width, backgroundColor, position, blendPct }
}

/**
 * quick-260518-ch8: SINGLE source of truth for the caption card's background
 * fill. All THREE render paths (slide-preview.tsx canvas, render-slide-satori
 * PNG export, render-slide.ts HTML export) consume this so the edge-blend
 * gradient cannot drift between them (PARITY-01 / TPLREND-05).
 *
 * When `blendPct <= 0` the card is a solid color and this returns a plain
 * `{ backgroundColor }` — byte-identical to a pre-change slide.
 *
 * When `blendPct > 0` this returns a `{ backgroundImage }` CSS `linear-gradient`
 * that fades the card edge touching the photo from transparent into the card
 * color:
 *   - `position: 'bottom'` (card snapped to bottom; its TOP edge touches the
 *     photo) → transparent at 0%, full card color from `blendPct%` down.
 *   - `position: 'top'` (card snapped to top; its BOTTOM edge touches the
 *     photo) → full card color from the top through `100 - blendPct%`, fading
 *     to transparent at 100%.
 *
 * The gradient uses CSS `linear-gradient` ONLY — NO `filter`, `mask`,
 * `backdrop-filter` or `mix-blend-mode` (RESEARCH Pitfall #2 — Satori silently
 * drops those; a `linear-gradient` backgroundImage IS Satori-supported). The
 * `backgroundColor` passed in is the resolved rgba() string from
 * resolveCaptionBar, so the gradient already carries the user's opacity.
 */
export function captionCardBackgroundStyle(cc: {
  backgroundColor: string
  blendPct: number
  position: 'bottom' | 'top'
}): { backgroundColor: string } | { backgroundImage: string } {
  if (cc.blendPct <= 0) {
    return { backgroundColor: cc.backgroundColor }
  }
  const grad =
    cc.position === 'bottom'
      ? `linear-gradient(to bottom, transparent 0%, ${cc.backgroundColor} ${cc.blendPct}%, ${cc.backgroundColor} 100%)`
      : `linear-gradient(to bottom, ${cc.backgroundColor} 0%, ${cc.backgroundColor} ${100 - cc.blendPct}%, transparent 100%)`
  return { backgroundImage: grad }
}

/**
 * Phase 82 Gap D (render-wiring) — re-fit a news headline to an enabled
 * caption card.
 *
 * Plan 08's `promoteNewsHeadline` sizes a generated news headline to the
 * default news hook box. But the user's target is the headline contained in
 * the BOTTOM BLACK CAPTION CARD, and the quick-260517-k2n caption card is
 * draggable/resizable — the box the headline must fill is only known at render
 * time from `resolveCaptionBar`. This helper performs that render-time re-fit.
 *
 * When the slide has a caption card ENABLED and is a news-layout slide, the
 * headline font size is recomputed via `fitHeadlineToBox` against the caption
 * card's resolved box (`captionCardBox`). Otherwise the incoming size is
 * returned UNCHANGED — byte-identity for every slide without an enabled
 * caption card and every non-news slide.
 *
 * quick-260518-ch8 (checkpoint-feedback fix): the fit box's WIDTH tracks the
 * card width (Phase 82 horizontal-overflow safety — a long headline shrinks so
 * it never overflows the card / breaks mid-word), but its HEIGHT is a FIXED
 * reference (`CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT`). Dragging the Caption
 * Card Height slider therefore does NOT resize the headline — height is purely
 * the card's own visual property. Only `caption_bar_width` (and the headline
 * text itself) affects the returned size.
 *
 * SINGLE source of truth: all three render paths (canvas preview, Satori PNG
 * export, HTML export) call this on identical `resolveCaptionBar` values so
 * preview == export (PARITY-01 / TPLREND-05). Pure — no DOM, never throws.
 */
export function resolveNewsHeadlineFit(
  resolvedCaptionBar: ResolvedCaptionBar,
  hookText: string | null | undefined,
  currentHookFontSize: number,
  isNewsLayoutSlide: boolean,
): number {
  if (!resolvedCaptionBar.enabled || !isNewsLayoutSlide) return currentHookFontSize
  return fitHeadlineToBox(hookText ?? '', captionCardBox(resolvedCaptionBar))
}

/**
 * Phase 55 (D-09, D-11, D-13, PARITY-02): grain/noise overlay (layer 1.5).
 *
 * Returns an absolutely-positioned full-canvas <img> element pointing to a
 * static noise PNG. Phase 56 ships the actual assets via
 * scripts/build-textures.ts → /public/textures/grain-${intensity}.png.
 *
 * In Phase 55 the helper is never invoked at runtime — existing 8 templates
 * leave template.grainMode undefined. The placeholder paths resolve correctly
 * once Phase 56 commits the PNG asset set; no Phase 55 code change required.
 *
 * Opacity map (D-11) — locked by CONTEXT.md; tunable in Phase 56 once real
 * PNGs exist if visual targets miss:
 *   subtle: 0.04   medium: 0.08   heavy: 0.14   paper: 0.18   xerox: 0.22
 *
 * Implementation note: returns React.createElement directly so this module
 * stays at .ts (no TSX transform required by importers).
 */
/**
 * quick-260514-l9q: map a CSS `text-align` value to the equivalent flexbox
 * `justify-content` value, used by hook/body wrappers that need `display: flex`
 * (Satori's CSS subset forces flex for any element with multiple children +
 * a flex-wrap behavior). Browsers do NOT honor `text-align` on flex
 * containers — flex items are positioned by `justify-content`, not by the
 * inline-text-alignment rule. Without this helper, picking "center" align on
 * a hook text box renders left-aligned in the editor preview (the bug the
 * user reported: workaround was bumping list-indent to 1 to dodge the
 * fast-path renderer and produce a different DOM shape).
 *
 * Returned values map cleanly:
 *   left   → flex-start
 *   center → center
 *   right  → flex-end
 *
 * `undefined` and unrecognized values fall through to `flex-start` so legacy
 * slides without an explicit alignment keep their existing visual.
 */
export function alignToJustifyContent(
  align: string | undefined,
): 'flex-start' | 'center' | 'flex-end' {
  if (align === 'center') return 'center'
  if (align === 'right') return 'flex-end'
  return 'flex-start'
}

const GRAIN_OPACITY_MAP = {
  subtle: 0.04,
  medium: 0.08,
  heavy: 0.14,
  paper: 0.18,
  xerox: 0.22,
} as const

export function renderGrain(
  intensity: 'subtle' | 'medium' | 'heavy' | 'paper' | 'xerox',
  origin?: string,
): React.ReactNode {
  // Satori (next/og) rejects relative `<img src>` values with
  // "Image source must be an absolute URL". When invoked from the satori
  // render path, callers pass `origin` so we emit a fully-qualified URL.
  // Browser-side preview callers omit it and get the relative path that the
  // browser resolves against the current document origin.
  const path = `/textures/grain-${intensity}.png`
  const src = origin ? `${origin}${path}` : path
  return React.createElement('img', {
    'data-layer': 'grain',
    src,
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: CANVAS.W,
      height: CANVAS.H,
      objectFit: 'cover',
      opacity: GRAIN_OPACITY_MAP[intensity],
      pointerEvents: 'none',
    },
  })
}

/**
 * Phase 55 (D-09, D-12, D-13, PARITY-02, PARITY-04): radial vignette overlay
 * (layer 2.5).
 *
 * Returns an absolutely-positioned full-canvas <div> with inline
 * backgroundImage: radial-gradient(...). PURE CSS — NO `filter:`, NO
 * `backdrop-filter:`, NO `mix-blend-mode:` (Pitfall #2 — Satori silently
 * drops these properties; see vercel/satori#573).
 *
 * `strength` is 0-1 (0 = off, 1 = full black at edges). Inner stop at 40%
 * transparent so the slide center remains untouched; outer at 100%
 * rgba(0,0,0,strength).
 *
 * In Phase 55 the helper is never invoked at runtime — existing 8 templates
 * leave template.vignette undefined.
 */
export function renderVignette(strength: number): React.ReactNode {
  return React.createElement('div', {
    'data-layer': 'vignette',
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: CANVAS.W,
      height: CANVAS.H,
      backgroundImage: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${strength}) 100%)`,
      pointerEvents: 'none',
    },
  })
}

/**
 * Phase 56 (TPL-04, D-14): decorative SVG/PNG overlay (layer 4 — top of stack
 * alongside other template overlays).
 *
 * Returns an absolutely-positioned <img> pointing to /overlays/{asset}.{ext}.
 * Halftone-dots-* assets are PNG (raster needed for true grain quality); all
 * others are SVG. PURE inline style — NO `filter:`, NO `backdrop-filter:`, NO
 * `mix-blend-mode:` (Pitfall #2; PARITY-04). Rotation/scale apply via CSS
 * `transform` (Satori SUPPORTS transform).
 *
 * Position is pixel-absolute on the 1080×1920 reference canvas (typically
 * sourced from overlay.offset.{x,y} in the 'free' slot). `opacity` is a
 * 0..1 multiplier; rotation is degrees; scale is unitless multiplier.
 *
 * Validator (templates/validate.ts) enforces the closed-enum DecorativeAsset
 * at module load — unknown assets throw before any render.
 */
const DECORATIVE_PNG_ASSETS: ReadonlyArray<DecorativeAsset> = [
  'halftone-dots-light',
  'halftone-dots-dense',
]

export function renderDecorativeOverlay(
  asset: DecorativeAsset,
  position: { x: number; y: number },
  options?: { rotation?: number; scale?: number; opacity?: number; tintColor?: string },
  origin?: string,
): React.ReactNode {
  const ext = DECORATIVE_PNG_ASSETS.includes(asset) ? 'png' : 'svg'
  // Same Satori absolute-URL constraint as renderGrain — see comment there.
  const path = `/overlays/${asset}.${ext}`
  const src = origin ? `${origin}${path}` : path
  const rotation = options?.rotation ?? 0
  const scale = options?.scale ?? 1
  // Phase 57 (D-15): tintColor injects via CSS `color` so SVGs that use
  // fill="currentColor" pick up the dynamic accent. PNG assets ignore tintColor
  // (raster — recoloring would require a CSS filter, which is banned).
  // Satori is strict about `transform: undefined` (throws "Invalid transform
  // value") so we omit the key entirely when no transform is needed instead
  // of letting it serialize as undefined.
  // Explicit `width`/`height` on the <img> are required because Satori does
  // NOT read intrinsic dimensions from inlined SVG data URIs reliably (the
  // thumbnail-generation pipeline base64-encodes the asset). Falling back to
  // a sensible asset-specific default keeps notes-app-chic etc. unchanged
  // while letting new assets like rule-thin render at all.
  const dims = ASSET_DIMENSIONS[asset] ?? { width: 240, height: 60 }
  const style: Record<string, string | number | undefined> = {
    position: 'absolute',
    top: position.y,
    left: position.x,
    width: dims.width,
    height: dims.height,
    opacity: options?.opacity ?? 1,
    color: options?.tintColor,
    pointerEvents: 'none',
  }
  if (rotation !== 0 || scale !== 1) {
    style.transform = `rotate(${rotation}deg) scale(${scale})`
  }
  return React.createElement('img', {
    'data-layer': 'decorative',
    'data-asset': asset,
    src,
    style,
  })
}

// Intrinsic dimensions for each decorative asset, in CSS pixels. Used by the
// renderer above so Satori (and the live preview) place the asset at its
// designed size on the 1080×1920 canvas. Update whenever a new asset is added
// — the validator at templates/validate.ts will catch unknown asset ids.
const ASSET_DIMENSIONS: Partial<Record<DecorativeAsset, { width: number; height: number }>> = {
  'tape-strip-1': { width: 240, height: 60 },
  'tape-strip-2': { width: 240, height: 60 },
  'tape-strip-3': { width: 240, height: 60 },
  'sticky-note-yellow': { width: 200, height: 200 },
  'sticky-note-pink': { width: 200, height: 200 },
  'sticky-note-blue': { width: 200, height: 200 },
  'sticky-note-accent': { width: 200, height: 200 },
  'halftone-dots-light': { width: 400, height: 400 },
  'halftone-dots-dense': { width: 400, height: 400 },
  'arrow-up': { width: 80, height: 80 },
  'arrow-down': { width: 80, height: 80 },
  'arrow-left': { width: 80, height: 80 },
  'arrow-right': { width: 80, height: 80 },
  'polaroid-frame': { width: 300, height: 360 },
  'paper-torn-edge': { width: 1080, height: 40 },
  'rule-thin': { width: 200, height: 6 },
  'paper-frame': { width: 1080, height: 1920 },
}

// =====================================================================
// Phase 57 (D-07, D-09, D-14, D-16): palette-aware rendering helpers.
// Both render-slide-satori.tsx and slide-preview.tsx import from this
// module to honor TPLREND-05 (no JSX duplicated across renderers).
// =====================================================================

/**
 * Read the Vibrant role (index 0) from a slide's derived_palette.
 * Returns null when palette has not been extracted yet.
 */
export function getVibrant(slide: Slide): string | null {
  return slide.style_overrides?.derived_palette?.[0] ?? null
}

/**
 * Read the DarkMuted role (index 4) from a slide's derived_palette.
 * Returns null when palette has not been extracted yet.
 */
export function getDarkMuted(slide: Slide): string | null {
  return slide.style_overrides?.derived_palette?.[4] ?? null
}

/**
 * Resolve the page-counter chip background+text colors for the
 * editorial-serif template. When paletteMode is 'palette-dominant' AND
 * a palette is present, the chip uses Vibrant background + DarkMuted text.
 * Otherwise falls back to the cream + deep-brown brand pair.
 */
export function getEditorialSerifChipColors(
  slide: Slide,
  template: SlideTemplate,
): { background: string; text: string } {
  if (template.paletteMode !== 'palette-dominant') {
    return { background: '#F5EFE6', text: '#3d0000' }
  }
  const vibrant = getVibrant(slide)
  if (!vibrant) {
    return { background: '#F5EFE6', text: '#3d0000' }
  }
  const darkMuted = getDarkMuted(slide) ?? '#3d0000'
  return { background: vibrant, text: darkMuted }
}

/**
 * Resolve the sticky-note tint color for the notes-app-chic template.
 * When paletteMode is 'palette-dominant' AND a palette is present, returns
 * Vibrant. Otherwise returns the brand sticky-yellow.
 */
export function getNotesAppChicAccentColor(
  slide: Slide,
  template: SlideTemplate,
): string {
  if (template.paletteMode !== 'palette-dominant') return '#FFE066'
  return getVibrant(slide) ?? '#FFE066'
}

/**
 * Phase 57 (D-14, D-16): augment a page-counter overlay's style for
 * editorial-serif when paletteMode is 'palette-dominant' AND a palette
 * is set. Both renderers MUST call this helper before applying
 * overlay.style (TPLREND-05 parity invariant).
 *
 * Returns the (possibly-augmented) overlay style. When the conditions
 * for palette override are not met, returns the original style verbatim.
 */
export function augmentEditorialSerifPageCounterStyle(
  baseStyle: Record<string, unknown> | undefined,
  slide: Slide,
  template: SlideTemplate,
): Record<string, unknown> {
  if (template.id !== 'editorial-serif') return { ...(baseStyle ?? {}) }
  if (template.paletteMode !== 'palette-dominant') return { ...(baseStyle ?? {}) }
  if (!getVibrant(slide)) return { ...(baseStyle ?? {}) }
  const { background, text } = getEditorialSerifChipColors(slide, template)
  return {
    ...(baseStyle ?? {}),
    background,
    color: text,
    // Add minor padding so the colored chip reads as a chip, not raw text
    padding: '6px 12px',
    borderRadius: 6,
  }
}

/**
 * Phase 57 (D-09): per-slide grain-intensity override on top of
 * template.grainMode. Slide override wins; otherwise fall through to
 * the template's mode (only if it's one of the user-overridable values
 * 'subtle' | 'medium' | 'heavy' — paper/xerox stay template-only).
 *
 * Returns 'off' explicitly when slide override is 'off' (callers must
 * skip rendering grain in that case).
 */
export function resolveGrainIntensity(
  slide: Slide,
  template: SlideTemplate,
): 'subtle' | 'medium' | 'heavy' | 'off' | undefined {
  const override = slide.style_overrides?.grain_intensity
  if (override) return override
  if (
    template.grainMode === 'subtle' ||
    template.grainMode === 'medium' ||
    template.grainMode === 'heavy'
  ) {
    return template.grainMode
  }
  return undefined
}

// =====================================================================
// quick-260515-nhf — shared hook-typography resolver.
//
// SINGLE source of truth for hook casing / font family / italic-style
// precedence. Before this helper the three render paths each derived hook
// typography divergently — most importantly the Satori PNG export hardcoded
// `template.headingFontFamily ?? template.fontFamily` and never read
// `overrides.hook_font_family`, so a user's hook-font pick survived on the
// editor canvas but silently reverted in the exported PNG (TPLREND-05
// violation). Casing had no override path at all: a template's
// `hookStyle: 'uppercase'` force-capped the hook with nothing the inspector
// could write to undo it.
//
// Precedence (textTransform): explicit style_overrides field > per-TextBox
// field > 'none' (render the hook EXACTLY as stored — WYSIWYG).
// quick-260515-o75: the default was flipped FROM the template's hookStyle TO
// 'none' so the canvas matches the inspector. A template's
// hookStyle: 'uppercase' no longer force-caps the stored text; users opt INTO
// auto-uppercase via the per-TextBox text_transform field (ActiveTextBoxCard
// 'Uppercase' toggle). This intentionally changes legacy hook CASING to
// WYSIWYG — accepted by the user; TPLREND-05 byte-identity is NOT claimed for
// hook casing. Precedence (fontFamily / fontStyle): explicit style_overrides
// field > per-TextBox field > template default — UNCHANGED; the no-override
// branch returns EXACTLY the legacy font values so font byte-identity holds.
// =====================================================================

export interface ResolvedHookTypography {
  /** 'uppercase' force-caps the hook; 'none' leaves the stored casing as-is. */
  textTransform: 'uppercase' | 'none'
  /** CSS font-family string for the hook text. */
  fontFamily: string
  /** 'italic' only when the template (or a future override) calls for it. */
  fontStyle: 'normal' | 'italic'
}

/**
 * Resolve hook casing, font family, and italic style with explicit
 * precedence. Pure function — no DOM/Node deps; safe on server and client.
 *
 * Threat T-o75-01 (tampering): `text_transform` is the closed union
 * `'uppercase' | 'none'`. Any other value (a hand-edited / AI-emitted
 * payload) fails the strict equality checks below and falls through to the
 * `'none'` WYSIWYG default — a malformed payload degrades to render-as-stored,
 * it never injects arbitrary CSS.
 *
 * NOTE: this helper deliberately does NOT resolve hook font SIZE. Size
 * already resolves correctly via `overrides.hook_font_size ?? ...` in all
 * three render paths and is entangled with the hook-fit auto-shrink clamp;
 * folding it in here would risk that interaction. Casing + family + style
 * only.
 */
export function resolveHookTypography(
  overrides: SlideStyleOverrides | undefined,
  hookTextBox: TextBox | undefined,
  template: SlideTemplate,
): ResolvedHookTypography {
  // --- textTransform: explicit override > TextBox field > 'none' (WYSIWYG).
  // quick-260515-o75: the default is 'none' — the hook renders EXACTLY as
  // stored so the canvas matches the inspector. The template's `hookStyle`
  // no longer feeds this axis; auto-uppercase is opt-in via the two `if`
  // blocks below (per-TextBox field, then explicit override).
  let textTransform: 'uppercase' | 'none' = 'none'
  if (hookTextBox?.text_transform === 'uppercase' || hookTextBox?.text_transform === 'none') {
    textTransform = hookTextBox.text_transform
  }
  if (overrides?.hook_text_transform === 'uppercase' || overrides?.hook_text_transform === 'none') {
    textTransform = overrides.hook_text_transform
  }

  // --- fontFamily: explicit override wins; otherwise template heading font
  //     (falling back to the template body font) — the legacy editor chain.
  const fontFamily =
    overrides?.hook_font_family ?? template.headingFontFamily ?? template.fontFamily

  // --- fontStyle: template-driven only (the per-box / per-override
  //     `hook_font_style` italic toggle is applied separately at the call
  //     site, exactly as today). This mirrors the old
  //     `template.hookStyle === 'italic'` branch.
  const fontStyle: 'normal' | 'italic' =
    template.hookStyle === 'italic' ? 'italic' : 'normal'

  return { textTransform, fontFamily, fontStyle }
}
