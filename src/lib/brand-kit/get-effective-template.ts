import type { SlideTemplate } from '@/lib/render/templates/index'
import type { BrandKit } from '@/lib/types/brand-kit'

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

  return {
    ...template,
    ...(brandKit.text_color ? { textColor: brandKit.text_color } : {}),
    ...(brandKit.background_color
      ? { backgroundColor: brandKit.background_color }
      : {}),
    ...(brandKit.font_family
      ? { fontFamily: `'${brandKit.font_family}', sans-serif` }
      : {}),
    ...(brandKit.primary_color
      ? { overlayColor: brandKit.primary_color }
      : {}),
  }
}
