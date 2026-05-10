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
 * quick-260510-brand-kit-scope: brand kit overrides ONLY apply to the
 * synthesized brand-kit template (id === BRAND_KIT_TEMPLATE_ID). For any
 * built-in template, this is now a passthrough — picking "news-cyan"
 * means getting news-cyan's exact design, not news-cyan with the brand
 * kit's accent + background painted over it.
 *
 * Why: previously a user with a brand kit that set
 * `accent_color: '#ff3b30'` + `background_color: '#1a1a2e'` saw the
 * editor render news-cyan correctly (cyan + black) but the export came
 * back red + navy because /api/render and the download endpoint both
 * called this merge function while the editor preview did not. The user
 * expected `news-cyan = cyan accent`, not "cyan unless you have a brand
 * kit, in which case maybe red." Brand kit theming is now reserved for
 * the explicit "Brand Kit" template path
 * (BRAND_KIT_TEMPLATE_ID → synthesizeBrandKitTemplate).
 *
 * The function is kept (rather than removed) so callers don't need to
 * change — the precedence chain still reads cleanly as
 * `template -> mergeWithBrandKit -> style_overrides`, the merge layer
 * just no-ops for built-in templates now.
 */
export function mergeWithBrandKit(
  template: SlideTemplate,
  _brandKit: BrandKit | null
): SlideTemplate {
  return template
}

/**
 * Synthesize a fully-resolved SlideTemplate from a brand kit.
 *
 * Used when project.template_id === BRAND_KIT_TEMPLATE_ID — the brand kit
 * IS the template, with neutral defaults filling any unset fields.
 *
 * Hook/body font sizes use neutral defaults (72/36 px) since they are not part
 * of the brand-kit data model in this iteration.
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
