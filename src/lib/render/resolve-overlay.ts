import React from 'react'
import type { OverlayContent, SlideTemplate } from './templates'
import type { DecorativeAsset } from './templates/decorative'
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
    if (seg.highlightColor) {
      const isPill = (seg.highlightStyle ?? 'pill') === 'pill'
      const pillTextColor = pickContrastColor(seg.highlightColor, baseSegmentColor)
      const pillStyle: React.CSSProperties = {
        color: pillTextColor,
        backgroundColor: seg.highlightColor,
        padding: isPill ? '4px 12px' : '4px 8px',
        borderRadius: isPill ? '8px' : '0',
        marginRight: isLast ? '0' : '8px',
        // Prevent a single long-word pill from extending past the hook
        // container's flex bounds and bleeding past the 1080px canvas.
        maxWidth: '100%',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        ...segmentFontFamily,
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
      { key: `${i}-${seg.text.slice(0, 20)}`, style: { color: baseSegmentColor, ...segmentFontFamily } },
      children,
    )
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
const GRAIN_OPACITY_MAP = {
  subtle: 0.04,
  medium: 0.08,
  heavy: 0.14,
  paper: 0.18,
  xerox: 0.22,
} as const

export function renderGrain(
  intensity: 'subtle' | 'medium' | 'heavy' | 'paper' | 'xerox',
): React.ReactNode {
  return React.createElement('img', {
    'data-layer': 'grain',
    src: `/textures/grain-${intensity}.png`,
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
): React.ReactNode {
  const ext = DECORATIVE_PNG_ASSETS.includes(asset) ? 'png' : 'svg'
  const src = `/overlays/${asset}.${ext}`
  const rotation = options?.rotation ?? 0
  const scale = options?.scale ?? 1
  const transform =
    rotation !== 0 || scale !== 1 ? `rotate(${rotation}deg) scale(${scale})` : undefined
  // Phase 57 (D-15): tintColor injects via CSS `color` so SVGs that use
  // fill="currentColor" pick up the dynamic accent. PNG assets ignore tintColor
  // (raster — recoloring would require a CSS filter, which is banned).
  return React.createElement('img', {
    'data-layer': 'decorative',
    'data-asset': asset,
    src,
    style: {
      position: 'absolute',
      top: position.y,
      left: position.x,
      transform,
      opacity: options?.opacity ?? 1,
      color: options?.tintColor,
      pointerEvents: 'none',
    },
  })
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
