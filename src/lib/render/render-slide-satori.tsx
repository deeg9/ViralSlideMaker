import type { SlideTemplate } from './templates'
import type { Slide, TextSegment } from '../types/slide'
import type { BrandKit } from '../types/brand-kit'
import React from 'react'
import { resolveSlideStyles, type ResolvedTextEffectStyles } from './resolve-styles'
import { resolveWatermark } from './resolve-watermark'
import { resolveForcedWatermark, type ForcedWatermarkTier } from './resolve-forced-watermark'

// TikTok/Instagram safe zones on 1080x1920 canvas
// Same constants as render-slide.ts for consistency
const SAFE = {
  x: 11, // percentage from left
  top: { hookY: 12, bodyY: 30 },
  center: { hookY: 30, bodyY: 48 },
  bottom: { hookY: 48, bodyY: 62 },
}

// Mirrors NEWS_LAYOUT in render-slide.ts — keep in sync.
const NEWS_LAYOUT = {
  cover: { imageTop: 0,  imageHeight: 55, hookY: 60, bodyY: 80 },
  body:  { imageTop: 50, imageHeight: 50, hookY: 8,  bodyY: 30 },
} as const

const W = 1080
const H = 1920

/**
 * Build segment children for Satori. Satori supports inline <span style={{color}}> inside a text <div>.
 * Falls back to a plain string when no segments are provided.
 */
function renderSegmentChildren(
  text: string,
  segments: TextSegment[] | undefined,
  baseColor: string,
  accentColor: string,
): React.ReactNode {
  if (!segments || segments.length === 0) return text
  return segments.map((seg, i) => {
    const color = seg.accent ? accentColor : baseColor
    const sep = i < segments.length - 1 ? ' ' : ''
    return (
      <span key={i} style={{ color }}>
        {seg.text}
        {sep}
      </span>
    )
  })
}

function pxX(pct: number) {
  return Math.round(W * pct / 100)
}
function pxY(pct: number) {
  return Math.round(H * pct / 100)
}

/** Build Satori-safe CSS properties from resolved text effects */
function satoriEffectStyles(effects: ResolvedTextEffectStyles): React.CSSProperties {
  const css: React.CSSProperties = {}
  if (effects.textShadow) css.textShadow = effects.textShadow
  if (effects.WebkitTextStrokeWidth) {
    css.WebkitTextStrokeWidth = effects.WebkitTextStrokeWidth
    css.WebkitTextStrokeColor = effects.WebkitTextStrokeColor
    css.paintOrder = effects.paintOrder
  }
  return css
}

/**
 * Build highlight style for Satori (always full-width).
 * REND-04: Satori does not support box-decoration-break: clone,
 * so tight highlight gracefully falls back to full-width.
 */
function satoriHighlightStyle(effects: ResolvedTextEffectStyles): React.CSSProperties | null {
  if (!effects.highlight?.enabled) return null
  // REND-04: Always use full-width in Satori (tight not supported without box-decoration-break)
  return {
    backgroundColor: effects.highlight.color,
    padding: `${effects.highlight.padding}px`,
  }
}

/**
 * Build a Satori-compatible React element for a slide.
 * Satori converts this JSX to SVG, which is then rasterized to PNG via resvg-wasm.
 *
 * Important Satori limitations:
 * - No z-index support; layer order = DOM order
 * - Must use inline styles (no CSS classes)
 * - Limited CSS subset (flexbox + absolute positioning)
 * - backgroundImage must use full url() syntax
 */
export function buildSlideElement(
  slide: Slide,
  template: SlideTemplate,
  brandKit?: BrandKit | null,
  tier?: ForcedWatermarkTier | null,
  origin?: string,
): React.ReactElement {
  const overrides = slide.style_overrides ?? {}
  const resolved = resolveSlideStyles(slide, template)

  const textColor = overrides.text_color ?? template.textColor
  const textAlign = overrides.text_align ?? template.textAlign
  const hookFontSize = overrides.hook_font_size
    ? overrides.hook_font_size
    : parseInt(template.hookFontSize, 10) || 64
  const bodyFontSize = overrides.body_font_size
    ? overrides.body_font_size
    : parseInt(template.bodyFontSize, 10) || 32

  const accentColor = template.accentColor ?? template.textColor

  // News-carousel layouts override Y defaults and constrain the bg image.
  const newsZone = overrides.layout ? NEWS_LAYOUT[overrides.layout] : null

  // Resolve text positions: news layouts win over text_position; user-supplied positions still win over both.
  const posPreset = overrides.text_position ?? template.textPosition
  const defaults = newsZone ?? SAFE[posPreset] ?? SAFE.center
  const defaultX = SAFE.x

  const overlayOpacity = overrides.overlay_opacity != null
    ? overrides.overlay_opacity / 100
    : template.overlayOpacity

  const hookX = overrides.hook_position?.x ?? defaultX
  const hookY = overrides.hook_position?.y ?? defaults.hookY
  const bodyX = overrides.body_position?.x ?? defaultX
  const bodyY = overrides.body_position?.y ?? defaults.bodyY

  // Width: override wins, fall back to symmetric calc, min 20%
  const hookWidth = Math.max(20, overrides.hook_width ?? (100 - hookX * 2))
  const bodyWidthPct = Math.max(20, overrides.body_width ?? (100 - bodyX * 2))
  const hookTextWidth = pxX(hookWidth)
  const bodyTextWidth = pxX(bodyWidthPct)

  // Root background style
  const rootStyle: React.CSSProperties = {
    width: W,
    height: H,
    display: 'flex',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: template.fontFamily,
    color: textColor,
  }

  // News layouts always paint a solid background — the image renders as a constrained <img>.
  if (!slide.background_url || newsZone) {
    rootStyle.backgroundColor = template.backgroundColor
  }

  // Hook text style
  const hookStyle: React.CSSProperties = {
    position: 'absolute',
    left: pxX(hookX),
    top: pxY(hookY),
    width: hookTextWidth,
    textAlign,
    fontSize: hookFontSize,
    fontWeight: 900,
    lineHeight: 1.1,
  }

  if (template.hookStyle === 'uppercase') {
    hookStyle.textTransform = 'uppercase'
  }
  if (template.hookStyle === 'italic') {
    hookStyle.fontStyle = 'italic'
  }

  // Apply text effects to hook
  const hookEffectCSS = satoriEffectStyles(resolved.hookEffects)
  Object.assign(hookStyle, hookEffectCSS)
  const hookHighlight = satoriHighlightStyle(resolved.hookEffects)
  if (hookHighlight) Object.assign(hookStyle, hookHighlight)

  // Body text style
  const bodyStyle: React.CSSProperties = {
    position: 'absolute',
    left: pxX(bodyX),
    top: pxY(bodyY),
    width: bodyTextWidth,
    textAlign,
    fontSize: bodyFontSize,
    fontWeight: 400,
    lineHeight: 1.5,
    opacity: 0.9,
  }

  // Apply text effects to body
  const bodyEffectCSS = satoriEffectStyles(resolved.bodyEffects)
  Object.assign(bodyStyle, bodyEffectCSS)
  const bodyHighlight = satoriHighlightStyle(resolved.bodyEffects)
  if (bodyHighlight) Object.assign(bodyStyle, bodyHighlight)

  // Brand watermark layer (260427-hut). Satori has no z-index — placement after
  // custom_images in JSX order makes it sit on top.
  const watermark = resolveWatermark(brandKit ?? null, slide, { width: W, height: H })

  // Forced free-tier watermark (260427-wmk). Rendered last in JSX so it sits on top.
  // Satori requires absolute URLs — when origin is provided we prepend it to /logo.png.
  const forced = resolveForcedWatermark(tier, { width: W, height: H })
  const forcedLogoUrl = forced && origin && forced.logoUrl.startsWith('/')
    ? `${origin}${forced.logoUrl}`
    : forced?.logoUrl

  return (
    <div style={rootStyle}>
      {/* Background image - use <img> with objectFit instead of CSS backgroundImage
          because Satori does not support backgroundSize/backgroundPosition properly,
          causing the image to tile instead of cover.
          News layouts confine the image to a zone (top half / bottom half) instead of full-bleed. */}
      {slide.background_url && (
        <img
          src={slide.background_url}
          style={{
            position: 'absolute',
            top: newsZone ? pxY(newsZone.imageTop) : 0,
            left: 0,
            width: W,
            height: newsZone ? pxY(newsZone.imageHeight) : H,
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />
      )}
      {/* Overlay - rendered before text so text appears on top (Satori has no z-index) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: template.overlayColor,
          opacity: overlayOpacity,
        }}
      />
      {/* Hook text */}
      <div style={hookStyle}>
        {renderSegmentChildren(
          slide.hook_text,
          slide.hook_segments,
          overrides.hook_text_color ?? textColor,
          accentColor,
        )}
      </div>
      {/* Body text */}
      <div style={bodyStyle}>
        {renderSegmentChildren(
          slide.body_text,
          slide.body_segments,
          overrides.body_text_color ?? textColor,
          accentColor,
        )}
      </div>
      {/* Custom images (before text so text layers on top in Satori DOM order) */}
      {(slide.custom_images ?? []).map((ci) => (
        <img
          key={ci.id}
          src={ci.url}
          style={{
            position: 'absolute',
            left: pxX(ci.x),
            top: pxY(ci.y),
            width: pxX(ci.width),
            height: pxY(ci.height),
            objectFit: 'cover',
            opacity: (ci.opacity ?? 100) / 100,
            borderRadius: ci.border_radius ?? 0,
          }}
        />
      ))}
      {/* Brand watermark — rendered after custom_images so it stacks on top in Satori DOM order */}
      {watermark && (
        <img
          src={watermark.url}
          style={{
            position: 'absolute',
            left: watermark.x,
            top: watermark.y,
            width: watermark.width,
            height: 'auto',
            opacity: watermark.opacity,
          }}
        />
      )}
      {/* Custom text boxes */}
      {(slide.custom_texts ?? []).map((ct) => {
        const resolvedCt = resolved.customTexts.find(rc => rc.id === ct.id)
        const ctEffects = resolvedCt ? satoriEffectStyles(resolvedCt.resolvedEffects) : {}
        const ctHighlight = resolvedCt ? satoriHighlightStyle(resolvedCt.resolvedEffects) : null
        const ctBaseColor = ct.color ?? textColor
        return (
          <div
            key={ct.id}
            style={{
              position: 'absolute',
              left: pxX(ct.x),
              top: pxY(ct.y),
              width: pxX(ct.width),
              textAlign: ct.text_align ?? 'left',
              fontSize: ct.font_size ?? 48,
              fontWeight: ct.font_weight ?? 400,
              fontStyle: ct.font_style ?? 'normal',
              lineHeight: 1.3,
              color: ctBaseColor,
              fontFamily: ct.font_family ?? template.fontFamily,
              ...ctEffects,
              ...(ctHighlight ?? {}),
            }}
          >
            {renderSegmentChildren(ct.text, ct.segments, ctBaseColor, accentColor)}
          </div>
        )
      })}
      {/* Forced free-tier watermark (260427-wmk). Rendered last so it sits on top in Satori DOM order. */}
      {forced && (
        <div
          style={{
            position: 'absolute',
            left: forced.x,
            top: forced.y,
            display: 'flex',
            alignItems: 'center',
            opacity: forced.opacity,
          }}
        >
          <img
            src={forcedLogoUrl}
            style={{
              width: forced.logoSize,
              height: forced.logoSize,
              objectFit: 'contain',
              marginRight: forced.gap,
            }}
          />
          <div
            style={{
              fontSize: forced.fontSize,
              fontWeight: 700,
              color: forced.textColor,
              textShadow: forced.textShadow,
              letterSpacing: -0.2,
              lineHeight: 1,
            }}
          >
            {forced.text}
          </div>
        </div>
      )}
    </div>
  )
}
