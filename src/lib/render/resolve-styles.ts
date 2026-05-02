import type { CSSProperties } from 'react'
import type { Slide, CustomText, TextEffects } from '../types/slide'
import type { SlideTemplate } from './templates'
import { getFontEntry, getCssFallback, DEFAULT_FONT } from '../fonts/font-catalog'

// TikTok/Instagram safe zones on 1080x1920 canvas
export const SAFE_ZONE = {
  x: 11,
  top: { hookY: 12, bodyY: 30 },
  center: { hookY: 30, bodyY: 48 },
  bottom: { hookY: 48, bodyY: 62 },
} as const

// Phase 19: Text effect resolution
export const SHADOW_PRESETS = {
  sm: { offsetX: 1, offsetY: 1, blur: 2 },
  md: { offsetX: 2, offsetY: 2, blur: 4 },
  lg: { offsetX: 3, offsetY: 4, blur: 8 },
} as const

export interface ResolvedTextEffectStyles {
  textShadow?: string
  WebkitTextStrokeWidth?: string
  WebkitTextStrokeColor?: string
  paintOrder?: 'stroke'
  highlight?: {
    enabled: boolean
    color: string
    style: 'tight' | 'full'
    padding: number
  }
}

export function resolveTextEffects(effects?: TextEffects): ResolvedTextEffectStyles {
  const result: ResolvedTextEffectStyles = {}

  if (effects?.shadow?.enabled) {
    const preset = SHADOW_PRESETS[effects.shadow.size]
    result.textShadow = `${preset.offsetX}px ${preset.offsetY}px ${preset.blur}px ${effects.shadow.color}`
  }

  if (effects?.outline?.enabled) {
    result.WebkitTextStrokeWidth = `${effects.outline.width}px`
    result.WebkitTextStrokeColor = effects.outline.color
    result.paintOrder = 'stroke'
  }

  if (effects?.highlight?.enabled) {
    result.highlight = {
      enabled: true,
      color: effects.highlight.color,
      style: effects.highlight.style,
      padding: effects.highlight.padding,
    }
  }

  return result
}

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
  hookTextTransform: 'uppercase' | 'none'
  overlayOpacity: number
  hookX: number
  hookY: number
  bodyX: number
  bodyY: number
  hookWidth: number  // percentage 0-100
  bodyWidth: number  // percentage 0-100
  hookEffects: ResolvedTextEffectStyles
  bodyEffects: ResolvedTextEffectStyles
  customTexts: Array<CustomText & { resolvedFontFamily: string; resolvedEffects: ResolvedTextEffectStyles }>
}

export function resolveSlideStyles(
  slide: Slide,
  template: SlideTemplate,
  slideIndex?: number
): ResolvedSlideStyles {
  const overrides = slide.style_overrides ?? {}

  // Phase 56 (TPL-06, D-25, D-26): cover-vs-inner layout. When slideIndex===0
  // AND template.coverLayout is defined, the cover-layout fields override
  // the template defaults BEFORE individual style resolution. Existing 8
  // templates leave coverLayout undefined → effectiveTemplate === template
  // (zero behavior change).
  const isCoverSlide = slideIndex === 0
  const coverLayout = template.coverLayout
  const effectiveTemplate: SlideTemplate =
    isCoverSlide && coverLayout
      ? {
          ...template,
          textPosition: coverLayout.textPosition ?? template.textPosition,
          textAlign: coverLayout.textAlign ?? template.textAlign,
          hookFontSize: coverLayout.hookFontSize ?? template.hookFontSize,
          hookStyle: coverLayout.hookStyle ?? template.hookStyle,
        }
      : template

  const textColor = overrides.text_color ?? effectiveTemplate.textColor
  const hookTextColor = overrides.hook_text_color ?? textColor
  const bodyTextColor = overrides.body_text_color ?? textColor
  const textAlign = overrides.text_align ?? effectiveTemplate.textAlign
  const hookFontSize = overrides.hook_font_size ?? (parseInt(effectiveTemplate.hookFontSize, 10) || 64)
  const bodyFontSize = overrides.body_font_size ?? (parseInt(effectiveTemplate.bodyFontSize, 10) || 32)

  // Bold/italic (Phase 11) — hookFontStyle also considers template.hookStyle
  const hookFontWeight = overrides.hook_font_weight ?? 900
  const bodyFontWeight = overrides.body_font_weight ?? 400
  const hookFontStyle = overrides.hook_font_style
    ?? (effectiveTemplate.hookStyle === 'italic' ? 'italic' : 'normal')
  const bodyFontStyle = overrides.body_font_style ?? 'normal'
  const hookTextTransform = effectiveTemplate.hookStyle === 'uppercase' ? 'uppercase' : 'none'

  // Font family (Phase 12)
  // Extract base font name from CSS font-family strings like "'Inter', sans-serif" → "Inter"
  function extractFontName(css: string): string {
    return css.replace(/^['"]|['"]$/g, '').split(',')[0].trim().replace(/^['"]|['"]$/g, '')
  }
  const templateFont = effectiveTemplate.fontFamily || DEFAULT_FONT
  const hookFontRaw = overrides.hook_font_family ?? extractFontName(templateFont)
  const bodyFontRaw = overrides.body_font_family ?? extractFontName(templateFont)
  const hookEntry = getFontEntry(hookFontRaw)
  const bodyEntry = getFontEntry(bodyFontRaw)
  const hookFontFamily = hookEntry ? `'${hookEntry.family}', ${getCssFallback(hookEntry.category)}` : `'${hookFontRaw}', sans-serif`
  const bodyFontFamily = bodyEntry ? `'${bodyEntry.family}', ${getCssFallback(bodyEntry.category)}` : `'${bodyFontRaw}', sans-serif`

  const overlayOpacity = overrides.overlay_opacity != null
    ? overrides.overlay_opacity / 100
    : effectiveTemplate.overlayOpacity

  const posPreset = overrides.text_position ?? effectiveTemplate.textPosition
  const defaults = SAFE_ZONE[posPreset] ?? SAFE_ZONE.center
  const defaultX = SAFE_ZONE.x

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
      resolvedEffects: resolveTextEffects(ct.text_effects),
    }
  })

  // Phase 19: Resolve text effects for hook and body
  const hookEffects = resolveTextEffects(overrides.hook_text_effects)
  const bodyEffects = resolveTextEffects(overrides.body_text_effects)

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
    hookTextTransform,
    overlayOpacity,
    hookX,
    hookY,
    bodyX,
    bodyY,
    hookWidth,
    bodyWidth,
    hookEffects,
    bodyEffects,
    customTexts,
  }
}

export function buildHighlightWrapperStyle(
  highlight: ResolvedTextEffectStyles['highlight'],
  mode: 'tight' | 'full-width-fallback'
): CSSProperties | null {
  if (!highlight?.enabled) return null

  const effectiveStyle = mode === 'full-width-fallback' ? 'full' : highlight.style

  if (effectiveStyle === 'tight') {
    return {
      backgroundColor: highlight.color,
      padding: `${highlight.padding}px ${highlight.padding}px`,
      boxDecorationBreak: 'clone' as const,
      WebkitBoxDecorationBreak: 'clone' as const,
    }
  }

  // full-width: background on the container div
  return {
    backgroundColor: highlight.color,
    padding: `${highlight.padding}px`,
  }
}
