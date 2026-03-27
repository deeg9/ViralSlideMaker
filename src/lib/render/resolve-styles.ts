import type { Slide } from '../types/slide'
import type { SlideTemplate } from './templates'

// TikTok/Instagram safe zones on 1080x1920 canvas
const SAFE = {
  x: 11,
  top: { hookY: 12, bodyY: 30 },
  center: { hookY: 30, bodyY: 48 },
  bottom: { hookY: 48, bodyY: 62 },
} as const

export interface ResolvedSlideStyles {
  textColor: string
  textAlign: 'left' | 'center' | 'right'
  hookFontSize: number
  bodyFontSize: number
  overlayOpacity: number
  hookX: number
  hookY: number
  bodyX: number
  bodyY: number
  hookWidth: number  // percentage 0-100
  bodyWidth: number  // percentage 0-100
}

export function resolveSlideStyles(
  slide: Slide,
  template: SlideTemplate
): ResolvedSlideStyles {
  const overrides = slide.style_overrides ?? {}

  const textColor = overrides.text_color ?? template.textColor
  const textAlign = overrides.text_align ?? template.textAlign
  const hookFontSize = overrides.hook_font_size ?? (parseInt(template.hookFontSize, 10) || 64)
  const bodyFontSize = overrides.body_font_size ?? (parseInt(template.bodyFontSize, 10) || 32)

  const overlayOpacity = overrides.overlay_opacity != null
    ? overrides.overlay_opacity / 100
    : template.overlayOpacity

  const posPreset = overrides.text_position ?? template.textPosition
  const defaults = SAFE[posPreset] ?? SAFE.center
  const defaultX = SAFE.x

  const hookX = overrides.hook_position?.x ?? defaultX
  const hookY = overrides.hook_position?.y ?? defaults.hookY
  const bodyX = overrides.body_position?.x ?? defaultX
  const bodyY = overrides.body_position?.y ?? defaults.bodyY

  // Width: override wins, fall back to symmetric calc for backward compatibility
  // Minimum 20% width enforced
  const hookWidth = Math.max(20, overrides.hook_width ?? (100 - hookX * 2))
  const bodyWidth = Math.max(20, overrides.body_width ?? (100 - bodyX * 2))

  return {
    textColor,
    textAlign,
    hookFontSize,
    bodyFontSize,
    overlayOpacity,
    hookX,
    hookY,
    bodyX,
    bodyY,
    hookWidth,
    bodyWidth,
  }
}
