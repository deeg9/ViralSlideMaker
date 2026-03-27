import type { Slide } from '../types/slide'
import type { SlideTemplate } from './templates'

export interface ResolvedSlideStyles {
  textColor: string
  textAlign: 'left' | 'center' | 'right'
  overlayOpacity: number // 0-1 (already divided)

  hookFontSize: number // px value (parsed from template string)
  hookFontFamily: string // CSS font-family string, e.g. "'Inter', sans-serif"
  hookFontWeight: number // 900 default for hook
  hookFontStyle: 'normal' | 'italic'
  hookTextTransform: 'uppercase' | 'none'
  hookX: number // percentage 0-100
  hookY: number // percentage 0-100
  hookWidth: number // percentage 0-100

  bodyFontSize: number
  bodyFontFamily: string
  bodyFontWeight: number // 400 default for body
  bodyFontStyle: 'normal' | 'italic'
  bodyX: number
  bodyY: number
  bodyWidth: number
}

/**
 * TikTok/Instagram safe zones on 1080x1920 canvas.
 * Top ~200px (10.4%), Bottom ~480px from bottom (max y ~75%), Sides ~120px (11%).
 */
export const SAFE_ZONE = {
  x: 11, // percentage from left
  top: { hookY: 12, bodyY: 30 },
  center: { hookY: 30, bodyY: 48 },
  bottom: { hookY: 48, bodyY: 62 },
}

/**
 * Single source of truth for resolving slide styles from template defaults + per-slide overrides.
 * Used by all three renderers: slide-preview.tsx (browser), render-slide-satori.tsx (Satori/PNG), render-slide.ts (HTML).
 */
export function resolveSlideStyles(slide: Slide, template: SlideTemplate): ResolvedSlideStyles {
  const overrides = slide.style_overrides ?? {}

  const textColor = overrides.text_color ?? template.textColor
  const textAlign = overrides.text_align ?? template.textAlign

  const overlayOpacity = overrides.overlay_opacity != null
    ? overrides.overlay_opacity / 100
    : template.overlayOpacity

  const hookFontSize = overrides.hook_font_size ?? (parseInt(template.hookFontSize, 10) || 64)
  const bodyFontSize = overrides.body_font_size ?? (parseInt(template.bodyFontSize, 10) || 32)

  const hookFontFamily = template.fontFamily
  const bodyFontFamily = template.fontFamily

  const hookFontWeight = overrides.hook_font_weight ?? 900
  const bodyFontWeight = overrides.body_font_weight ?? 400

  const hookFontStyle: 'normal' | 'italic' = overrides.hook_font_style ?? (template.hookStyle === 'italic' ? 'italic' : 'normal')
  const hookTextTransform: 'uppercase' | 'none' = template.hookStyle === 'uppercase' ? 'uppercase' : 'none'

  const bodyFontStyle: 'normal' | 'italic' = overrides.body_font_style ?? 'normal'

  // Resolve positions from preset + overrides
  const posPreset = overrides.text_position ?? template.textPosition
  const defaults = SAFE_ZONE[posPreset] ?? SAFE_ZONE.center
  const defaultX = SAFE_ZONE.x

  const hookX = overrides.hook_position?.x ?? defaultX
  const hookY = overrides.hook_position?.y ?? defaults.hookY
  const bodyX = overrides.body_position?.x ?? defaultX
  const bodyY = overrides.body_position?.y ?? defaults.bodyY

  // Width is symmetric: same margin on both sides
  const hookWidth = 100 - hookX * 2
  const bodyWidth = 100 - bodyX * 2

  return {
    textColor,
    textAlign,
    overlayOpacity,
    hookFontSize,
    hookFontFamily,
    hookFontWeight,
    hookFontStyle,
    hookTextTransform,
    hookX,
    hookY,
    hookWidth,
    bodyFontSize,
    bodyFontFamily,
    bodyFontWeight,
    bodyFontStyle,
    bodyX,
    bodyY,
    bodyWidth,
  }
}
