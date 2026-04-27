import type { SlideTemplate } from '@/lib/render/templates/index'
import type { BrandKit } from '@/lib/types/brand-kit'

export const BRAND_KIT_TEMPLATE_ID = 'brand-kit'

function fontStack(name: string | null | undefined): string | undefined {
  if (!name) return undefined
  return `'${name}', sans-serif`
}

/**
 * Merge brand kit overrides onto a base template.
 *
 * Precedence chain:
 *   template defaults -> brand kit overrides -> per-slide style_overrides
 *   (style_overrides are handled in buildSlideHtml; this function covers the first two layers)
 *
 * Returns the template unchanged when brandKit is null.
 */
export function mergeWithBrandKit(
  template: SlideTemplate,
  brandKit: BrandKit | null
): SlideTemplate {
  if (!brandKit) return template

  // Body / general font: prefer body_font_family, fall back to legacy font_family.
  const bodyFont = fontStack(brandKit.body_font_family ?? brandKit.font_family)
  // Heading font: prefer heading_font_family; if absent, leave undefined so the
  // renderer falls back to template.fontFamily (no surprise override on built-ins).
  const headingFont = fontStack(brandKit.heading_font_family)

  return {
    ...template,
    ...(brandKit.text_color ? { textColor: brandKit.text_color } : {}),
    ...(brandKit.background_color
      ? { backgroundColor: brandKit.background_color }
      : {}),
    ...(bodyFont ? { fontFamily: bodyFont } : {}),
    ...(headingFont ? { headingFontFamily: headingFont } : {}),
    ...(brandKit.primary_color ? { overlayColor: brandKit.primary_color } : {}),
    ...(brandKit.accent_color ? { accentColor: brandKit.accent_color } : {}),
    ...(brandKit.text_align ? { textAlign: brandKit.text_align } : {}),
    ...(brandKit.text_position ? { textPosition: brandKit.text_position } : {}),
    ...(brandKit.hook_style ? { hookStyle: brandKit.hook_style } : {}),
    ...(brandKit.overlay_opacity_pct != null
      ? { overlayOpacity: brandKit.overlay_opacity_pct / 100 }
      : {}),
  }
}

/**
 * Synthesize a fully-resolved SlideTemplate from a brand kit.
 *
 * Used when project.template_id === BRAND_KIT_TEMPLATE_ID — the brand kit
 * IS the template, with neutral defaults filling any unset fields.
 *
 * Hook/body font sizes use the same defaults as bold-minimal (72/36 px) since
 * they are not part of the brand-kit data model in this iteration.
 */
export function synthesizeBrandKitTemplate(brandKit: BrandKit): SlideTemplate {
  const bodyFont = fontStack(brandKit.body_font_family ?? brandKit.font_family) ?? "'Inter', sans-serif"
  const headingFont = fontStack(brandKit.heading_font_family) ?? bodyFont

  return {
    id: BRAND_KIT_TEMPLATE_ID,
    name: brandKit.name || 'Your Brand Kit',
    thumbnail: '',
    fontFamily: bodyFont,
    headingFontFamily: headingFont,
    hookFontSize: '72px',
    bodyFontSize: '36px',
    textColor: brandKit.text_color ?? '#ffffff',
    backgroundColor: brandKit.background_color ?? '#1a1a2e',
    overlayColor: brandKit.primary_color ?? '#000000',
    overlayOpacity: brandKit.overlay_opacity_pct != null
      ? brandKit.overlay_opacity_pct / 100
      : 0,
    accentColor: brandKit.accent_color ?? brandKit.secondary_color ?? undefined,
    textAlign: brandKit.text_align ?? 'center',
    textPosition: brandKit.text_position ?? 'center',
    hookStyle: brandKit.hook_style ?? 'uppercase',
    sample: {
      hook_text: brandKit.name || 'Your Brand',
      body_text: 'Your story, your voice, your style.',
    },
  }
}
