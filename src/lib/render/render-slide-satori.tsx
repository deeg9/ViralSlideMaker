import type { SlideTemplate } from './templates'
import type { Slide } from '../types/slide'
import React from 'react'
import { resolveSlideStyles, type ResolvedTextEffectStyles } from './resolve-styles'

// TikTok/Instagram safe zones on 1080x1920 canvas
// Same constants as render-slide.ts for consistency
const SAFE = {
  x: 11, // percentage from left
  top: { hookY: 12, bodyY: 30 },
  center: { hookY: 30, bodyY: 48 },
  bottom: { hookY: 48, bodyY: 62 },
}

const W = 1080
const H = 1920

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
  template: SlideTemplate
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

  // Resolve text positions using safe-zone defaults
  const posPreset = overrides.text_position ?? template.textPosition
  const defaults = SAFE[posPreset] ?? SAFE.center
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

  if (slide.background_url) {
    rootStyle.backgroundImage = `url(${slide.background_url})`
    rootStyle.backgroundSize = 'cover'
    rootStyle.backgroundPosition = 'center'
  } else {
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

  return (
    <div style={rootStyle}>
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
      <div style={hookStyle}>{slide.hook_text}</div>
      {/* Body text */}
      <div style={bodyStyle}>{slide.body_text}</div>
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
      {/* Custom text boxes */}
      {(slide.custom_texts ?? []).map((ct) => {
        const resolvedCt = resolved.customTexts.find(rc => rc.id === ct.id)
        const ctEffects = resolvedCt ? satoriEffectStyles(resolvedCt.resolvedEffects) : {}
        const ctHighlight = resolvedCt ? satoriHighlightStyle(resolvedCt.resolvedEffects) : null
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
              color: ct.color ?? textColor,
              fontFamily: ct.font_family ?? template.fontFamily,
              ...ctEffects,
              ...(ctHighlight ?? {}),
            }}
          >
            {ct.text}
          </div>
        )
      })}
    </div>
  )
}
