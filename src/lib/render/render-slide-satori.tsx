import type { SlideTemplate } from './templates'
import type { Slide } from '../types/slide'
import { resolveSlideStyles } from './resolve-styles'
import React from 'react'

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
  const styles = resolveSlideStyles(slide, template)

  // Root background style
  const rootStyle: React.CSSProperties = {
    width: W,
    height: H,
    display: 'flex',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: styles.hookFontFamily,
    color: styles.textColor,
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
    left: pxX(styles.hookX),
    top: pxY(styles.hookY),
    width: pxX(styles.hookWidth),
    textAlign: styles.textAlign,
    fontSize: styles.hookFontSize,
    fontWeight: styles.hookFontWeight,
    fontStyle: styles.hookFontStyle,
    textTransform: styles.hookTextTransform === 'uppercase' ? 'uppercase' : undefined,
    lineHeight: 1.1,
  }

  // Body text style
  const bodyStyle: React.CSSProperties = {
    position: 'absolute',
    left: pxX(styles.bodyX),
    top: pxY(styles.bodyY),
    width: pxX(styles.bodyWidth),
    textAlign: styles.textAlign,
    fontSize: styles.bodyFontSize,
    fontWeight: styles.bodyFontWeight,
    fontStyle: styles.bodyFontStyle,
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
          opacity: styles.overlayOpacity,
        }}
      />
      {/* Hook text */}
      <div style={hookStyle}>{slide.hook_text}</div>
      {/* Body text */}
      <div style={bodyStyle}>{slide.body_text}</div>
    </div>
  )
}
