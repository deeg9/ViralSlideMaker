import React from 'react'
import type { OverlayContent } from './templates'
import type { Slide, TextSegment } from '@/lib/types/slide'

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
    if (seg.highlightColor) {
      const isPill = (seg.highlightStyle ?? 'pill') === 'pill'
      const pillTextColor = pickContrastColor(seg.highlightColor, baseSegmentColor)
      const pillStyle: React.CSSProperties = {
        color: pillTextColor,
        backgroundColor: seg.highlightColor,
        padding: isPill ? '4px 12px' : '4px 8px',
        borderRadius: isPill ? '8px' : '0',
        marginRight: isLast ? '0' : '8px',
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
    return React.createElement('span', { key: `${i}-${seg.text.slice(0, 20)}`, style: { color: baseSegmentColor } }, children)
  })
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
