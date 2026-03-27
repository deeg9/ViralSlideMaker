import type { SlideTemplate } from './templates'
import type { Slide } from '../types/slide'
import React from 'react'

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

  // Bold/italic overrides
  const hookFontWeight = overrides.hook_font_weight ?? 900
  const bodyFontWeight = overrides.body_font_weight ?? 400
  const hookFontStyle = overrides.hook_font_style ?? (template.hookStyle === 'italic' ? 'italic' : 'normal')
  const bodyFontStyle = overrides.body_font_style ?? 'normal'

  const hookX = overrides.hook_position?.x ?? defaultX
  const hookY = overrides.hook_position?.y ?? defaults.hookY
  const bodyX = overrides.body_position?.x ?? defaultX
  const bodyY = overrides.body_position?.y ?? defaults.bodyY

  // Width is symmetric: same margin on both sides
  const textWidth = pxX(100 - hookX * 2)

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
    width: textWidth,
    textAlign,
    fontSize: hookFontSize,
    fontWeight: hookFontWeight,
    fontStyle: hookFontStyle,
    lineHeight: 1.1,
  }

  if (template.hookStyle === 'uppercase') {
    hookStyle.textTransform = 'uppercase'
  }

  // Body text style
  const bodyStyle: React.CSSProperties = {
    position: 'absolute',
    left: pxX(bodyX),
    top: pxY(bodyY),
    width: textWidth,
    textAlign,
    fontSize: bodyFontSize,
    fontWeight: bodyFontWeight,
    fontStyle: bodyFontStyle,
    lineHeight: 1.5,
    opacity: 0.9,
  }

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
    </div>
  )
}
