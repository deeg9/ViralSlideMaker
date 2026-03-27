import type { Slide, CustomText } from '../types/slide'
import type { SlideTemplate } from './templates'
import { getFontEntry, getCssFallback, DEFAULT_FONT } from '../fonts/font-catalog'

// TikTok/Instagram safe zones on 1080x1920 canvas
const SAFE = {
  x: 11,
  top: { hookY: 12, bodyY: 30 },
  center: { hookY: 30, bodyY: 48 },
  bottom: { hookY: 48, bodyY: 62 },
} as const

export interface ResolvedSlideStyles {
  textColor: string
  hookTextColor: string
  bodyTextColor: string
  textAlign: 'left' | 'center' | 'right'
  hookFontSize: number
  bodyFontSize: number
  hookFontWeight: number
  bodyFontWeight: number
  hookFontStyle: 'normal' | 'italic'
  bodyFontStyle: 'normal' | 'italic'
  hookFontFamily: string
  bodyFontFamily: string
  overlayOpacity: number
  hookX: number
  hookY: number
  bodyX: number
  bodyY: number
  hookWidth: number  // percentage 0-100
  bodyWidth: number  // percentage 0-100
  customTexts: Array<CustomText & { resolvedFontFamily: string }>
}

export function resolveSlideStyles(
  slide: Slide,
  template: SlideTemplate
): ResolvedSlideStyles {
  const overrides = slide.style_overrides ?? {}

  const textColor = overrides.text_color ?? template.textColor
  const hookTextColor = overrides.hook_text_color ?? textColor
  const bodyTextColor = overrides.body_text_color ?? textColor
  const textAlign = overrides.text_align ?? template.textAlign
  const hookFontSize = overrides.hook_font_size ?? (parseInt(template.hookFontSize, 10) || 64)
  const bodyFontSize = overrides.body_font_size ?? (parseInt(template.bodyFontSize, 10) || 32)

  // Bold/italic (Phase 11)
  const hookFontWeight = overrides.hook_font_weight ?? 900
  const bodyFontWeight = overrides.body_font_weight ?? 400
  const hookFontStyle = overrides.hook_font_style ?? 'normal'
  const bodyFontStyle = overrides.body_font_style ?? 'normal'

  // Font family (Phase 12)
  const templateFont = template.fontFamily || DEFAULT_FONT
  const hookFontRaw = overrides.hook_font_family ?? templateFont
  const bodyFontRaw = overrides.body_font_family ?? templateFont
  const hookEntry = getFontEntry(hookFontRaw)
  const bodyEntry = getFontEntry(bodyFontRaw)
  const hookFontFamily = hookEntry ? `'${hookEntry.family}', ${getCssFallback(hookEntry.category)}` : `'${hookFontRaw}', sans-serif`
  const bodyFontFamily = bodyEntry ? `'${bodyEntry.family}', ${getCssFallback(bodyEntry.category)}` : `'${bodyFontRaw}', sans-serif`

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

  // Resolve custom texts
  const customTexts = (slide.custom_texts ?? []).map((ct) => {
    const ctFontRaw = ct.font_family ?? templateFont
    const ctEntry = getFontEntry(ctFontRaw)
    const resolvedFontFamily = ctEntry
      ? `'${ctEntry.family}', ${getCssFallback(ctEntry.category)}`
      : `'${ctFontRaw}', sans-serif`
    return {
      ...ct,
      font_size: ct.font_size ?? 48,
      font_weight: ct.font_weight ?? 400,
      font_style: (ct.font_style ?? 'normal') as 'normal' | 'italic',
      color: ct.color ?? textColor,
      text_align: (ct.text_align ?? 'left') as 'left' | 'center' | 'right',
      resolvedFontFamily,
    }
  })

  return {
    textColor,
    hookTextColor,
    bodyTextColor,
    textAlign,
    hookFontSize,
    bodyFontSize,
    hookFontWeight,
    bodyFontWeight,
    hookFontStyle,
    bodyFontStyle,
    hookFontFamily,
    bodyFontFamily,
    overlayOpacity,
    hookX,
    hookY,
    bodyX,
    bodyY,
    hookWidth,
    bodyWidth,
    customTexts,
  }
}
