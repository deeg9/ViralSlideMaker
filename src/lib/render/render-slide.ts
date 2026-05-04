import type { SlideTemplate } from './templates'
import type { Slide, TextSegment } from '../types/slide'
import type { BrandKit } from '../types/brand-kit'
import { resolveSlideStyles, type ResolvedTextEffectStyles } from './resolve-styles'
import { resolveWatermark } from './resolve-watermark'
import { resolveForcedWatermark, type ForcedWatermarkTier } from './resolve-forced-watermark'
import { getHookFontSize, hasHookFit } from './hook-fit'

// TikTok/Instagram safe zones on 1080x1920 canvas
// Top ~200px (10.4%), Bottom ~480px from bottom (max y ~75%), Sides ~120px (11%)
const SAFE = {
  x: 11,   // percentage from left
  top: { hookY: 12, bodyY: 30 },
  center: { hookY: 30, bodyY: 48 },
  bottom: { hookY: 48, bodyY: 62 },
}

// News-carousel layouts: image fills one half, text the other.
// Returned values are percentages (0-100) on the 1080x1920 canvas.
// Cover layout: image takes ~55% top, hook+body sit in the lower-middle (not the very bottom)
// so neither the headline nor the wrapped body lines get pushed off-canvas.
// 260503: cover.bodyY bumped 80 → 84 to give long-hook wraps a vertical safety
// margin before they could collide with the body zone. Mirrors the same change
// in render-slide-satori.tsx and slide-preview.tsx.
const NEWS_LAYOUT = {
  cover: { imageTop: 0,  imageHeight: 55, hookY: 60, bodyY: 84 },
  body:  { imageTop: 50, imageHeight: 50, hookY: 8,  bodyY: 30 },
} as const

/**
 * Build a Google Fonts <link> tag for the given font-family CSS value.
 * Extracts the font name from a CSS font-family string like "'Montserrat', sans-serif"
 * and returns the appropriate Google Fonts link with weights 400, 700, 900.
 */
export function getFontLink(fontFamily: string): string {
  // Extract font name from CSS font-family (content inside single quotes, or first word)
  const match = fontFamily.match(/'([^']+)'/)
  const fontName = match ? match[1] : 'Inter'
  const encoded = fontName.replace(/\s+/g, '+')
  return `<link href="https://fonts.googleapis.com/css2?family=${encoded}:wght@400;700;900&display=swap" rel="stylesheet">`
}

/**
 * Collect all unique font families from slide (template + custom texts)
 * and generate font link tags for each.
 */
function getAllFontLinks(slide: Slide, templateFontFamily: string): string {
  const families = new Set<string>()
  // Add template font
  const templateMatch = templateFontFamily.match(/'([^']+)'/)
  families.add(templateMatch ? templateMatch[1] : 'Inter')
  // Add custom text fonts
  for (const ct of slide.custom_texts ?? []) {
    if (ct.font_family) {
      families.add(ct.font_family)
    }
  }
  return Array.from(families)
    .map((name) => {
      const encoded = name.replace(/\s+/g, '+')
      return `<link href="https://fonts.googleapis.com/css2?family=${encoded}:wght@400;700;900&display=swap" rel="stylesheet">`
    })
    .join('\n  ')
}

/** Convert resolved text effects to CSS property strings */
function effectsToCSS(effects: ResolvedTextEffectStyles): string {
  const props: string[] = []
  if (effects.textShadow) props.push(`text-shadow: ${effects.textShadow};`)
  if (effects.WebkitTextStrokeWidth) {
    props.push(`-webkit-text-stroke-width: ${effects.WebkitTextStrokeWidth};`)
    props.push(`-webkit-text-stroke-color: ${effects.WebkitTextStrokeColor};`)
    props.push(`paint-order: stroke;`)
  }
  return props.join('\n      ')
}

/** Render text-or-segments to HTML. Segments override the block color per run. */
function renderSegments(
  text: string,
  segments: TextSegment[] | undefined,
  baseColor: string,
  accentColor: string,
): string {
  if (!segments || segments.length === 0) return escapeHtml(text)
  return segments
    .map((seg, i) => {
      const color = seg.accent ? accentColor : baseColor
      const sep = i < segments.length - 1 ? ' ' : ''
      return `<span style="color:${color}">${escapeHtml(seg.text)}</span>${sep}`
    })
    .join('')
}

/** Build highlight CSS for HTML renderer. Supports both tight and full-width modes. */
function highlightCSS(effects: ResolvedTextEffectStyles, mode: 'full' | 'native'): { containerCSS: string; spanWrap: boolean; spanCSS: string } {
  if (!effects.highlight?.enabled) return { containerCSS: '', spanWrap: false, spanCSS: '' }

  if (mode === 'native' && effects.highlight.style === 'tight') {
    // Tight: wrap text in span with background + box-decoration-break: clone
    return {
      containerCSS: '',
      spanWrap: true,
      spanCSS: `background-color: ${effects.highlight.color}; padding: ${effects.highlight.padding}px; box-decoration-break: clone; -webkit-box-decoration-break: clone;`,
    }
  }

  // Full-width: background on the container
  return {
    containerCSS: `background-color: ${effects.highlight.color}; padding: ${effects.highlight.padding}px;`,
    spanWrap: false,
    spanCSS: '',
  }
}

export function buildSlideHtml(
  slide: Slide,
  template: SlideTemplate,
  brandKit?: BrandKit | null,
  tier?: ForcedWatermarkTier | null,
): string {
  const overrides = slide.style_overrides ?? {}
  const resolved = resolveSlideStyles(slide, template)

  // Color-only kill-switch (mirrors resolve-styles.ts and slide-preview.tsx):
  // ignore stale per-slide color overrides on Paper Essay / Brutalist Grid.
  const textColor = template.backgroundMode === 'color'
    ? template.textColor
    : overrides.text_color ?? template.textColor
  // Per-text-box alignment (modern path). Mirrors render-slide-satori.tsx +
  // slide-preview.tsx. The legacy adapter in text-box-adapter.ts only writes
  // slide-level overrides.text_align when hook and body share the same value,
  // so the per-box read here is the source of truth on diverged decks.
  const hookBoxAlign = (slide.text_boxes ?? []).find((tb) => tb.role === 'hook')?.text_align
  const bodyBoxAlign = (slide.text_boxes ?? []).find((tb) => tb.role === 'body')?.text_align
  const slideAlign = overrides.text_align ?? template.textAlign
  const hookTextAlign = hookBoxAlign ?? slideAlign
  const bodyTextAlign = bodyBoxAlign ?? slideAlign
  // Kept as the default for callers below that don't yet differentiate.
  const textAlign = slideAlign
  // Templates with a hook-fit registry entry auto-shrink hook size for long
  // headlines. Manual override always wins.
  const baseHookSizePx = parseInt(template.hookFontSize, 10) || 64
  const autoFitHookPx =
    overrides.hook_font_size == null && hasHookFit(template.id)
      ? getHookFontSize(template.id, slide.hook_text, baseHookSizePx)
      : null
  const hookFontSize = overrides.hook_font_size
    ? `${overrides.hook_font_size}px`
    : autoFitHookPx != null
      ? `${autoFitHookPx}px`
      : template.hookFontSize
  const bodyFontSize = overrides.body_font_size ? `${overrides.body_font_size}px` : template.bodyFontSize

  const accentColor = template.accentColor ?? template.textColor

  // News-carousel layouts (cover/body) put the background image in a constrained zone
  // and force a solid page background — overriding the full-bleed default.
  // backgroundMode: 'color' is a hard kill-switch that ignores any persisted
  // slide.background_url and forces the template's solid background — both
  // the page paint AND the constrained <img> below.
  const isColorOnlyTemplate = template.backgroundMode === 'color'

  // Color-only templates suppress the slide-wide darkening overlay regardless
  // of any persisted style_overrides.overlay_opacity — same kill-switch as
  // text-shadow/highlight stripping in resolve-styles.ts.
  const overlayOpacity = isColorOnlyTemplate
    ? 0
    : overrides.overlay_opacity != null
      ? overrides.overlay_opacity / 100
      : template.overlayOpacity
  const newsZone =
    !isColorOnlyTemplate && overrides.layout ? NEWS_LAYOUT[overrides.layout] : null

  const backgroundCss = isColorOnlyTemplate
    ? `background-color: ${template.backgroundColor};`
    : newsZone
      ? `background-color: ${template.backgroundColor};`
      : slide.background_url
        ? `background-image: url('${slide.background_url}'); background-size: cover; background-position: center;`
        : `background-color: ${template.backgroundColor};`

  // Resolve text positions: news layouts override Y defaults; user-supplied positions still win.
  const posPreset = overrides.text_position ?? template.textPosition
  const defaults = newsZone ?? SAFE[posPreset] ?? SAFE.center
  const defaultX = SAFE.x

  const hookX = overrides.hook_position?.x ?? defaultX
  const hookY = overrides.hook_position?.y ?? defaults.hookY
  const bodyX = overrides.body_position?.x ?? defaultX
  const bodyY = overrides.body_position?.y ?? defaults.bodyY

  // Width: override wins, fall back to symmetric calc, min 20%
  const hookWidth = Math.max(20, overrides.hook_width ?? (100 - hookX * 2))
  const bodyWidth = Math.max(20, overrides.body_width ?? (100 - bodyX * 2))

  // News-layout background image: rendered as a constrained <img> in the image zone
  // (instead of full-bleed). Sits at z-index:0 so text/customs stack above.
  // Suppressed entirely on color-only templates (newsZone is already null above
  // for that case, but guarding here too makes the intent explicit).
  const newsBgImageHtml = newsZone && slide.background_url && !isColorOnlyTemplate
    ? `<img src="${slide.background_url}" style="position:absolute; left:0; top:${newsZone.imageTop}%; width:100%; height:${newsZone.imageHeight}%; object-fit:cover; z-index:0;" />`
    : ''

  // Build custom image HTML
  const customImageHtml = (slide.custom_images ?? []).map((ci) =>
    `<img src="${ci.url}" style="position:absolute; left:${ci.x}%; top:${ci.y}%; width:${ci.width}%; height:${ci.height}%; object-fit:cover; opacity:${(ci.opacity ?? 100) / 100}; border-radius:${ci.border_radius ?? 0}px; z-index:1;" />`
  ).join('\n  ')

  // Brand watermark layer (260427-hut). Sits above custom_images at z-index:5.
  const watermark = resolveWatermark(brandKit ?? null, slide, { width: 1080, height: 1920 })
  const watermarkHtml = watermark
    ? `<img src="${watermark.url}" style="position:absolute; left:${watermark.x}px; top:${watermark.y}px; width:${watermark.width}px; height:auto; opacity:${watermark.opacity}; z-index:5; pointer-events:none;" />`
    : ''

  // Forced free-tier watermark (260427-wmk). z-index:6 so it sits above the brand-kit watermark.
  const forced = resolveForcedWatermark(tier, { width: 1080, height: 1920 }, slide)
  const forcedWatermarkHtml = forced
    ? `<div style="position:absolute; left:${forced.x}px; top:${forced.y}px; display:flex; align-items:center; opacity:${forced.opacity}; z-index:6; pointer-events:none;"><img src="${forced.logoUrl}" style="width:${forced.logoSize}px; height:${forced.logoSize}px; object-fit:contain; margin-right:${forced.gap}px;" /><span style="font-size:${forced.fontSize}px; font-weight:700; color:${forced.textColor}; text-shadow:${forced.textShadow}; letter-spacing:-0.2px; line-height:1;">${forced.text}</span></div>`
    : ''

  // Build custom text HTML with effects
  const customTextHtml = (slide.custom_texts ?? []).map((ct) => {
    const resolvedCt = resolved.customTexts.find(rc => rc.id === ct.id)
    const ctEffectStr = resolvedCt ? effectsToCSS(resolvedCt.resolvedEffects) : ''
    const ctHL = resolvedCt ? highlightCSS(resolvedCt.resolvedEffects, 'native') : { containerCSS: '', spanWrap: false, spanCSS: '' }
    const ctBaseColor = ct.color ?? textColor
    const ctInner = renderSegments(ct.text, ct.segments, ctBaseColor, accentColor)
    const ctContent = ctHL.spanWrap
      ? `<span style="${ctHL.spanCSS}">${ctInner}</span>`
      : ctInner

    const ctEffectInline = ctEffectStr.replace(/\n\s+/g, ' ').trim()
    const ctHighlightInline = ctHL.containerCSS.trim()

    return `<div style="position:absolute; left:${ct.x}%; top:${ct.y}%; width:${ct.width}%; text-align:${ct.text_align ?? 'left'}; font-size:${ct.font_size ?? 48}px; font-weight:${ct.font_weight ?? 400}; font-style:${ct.font_style ?? 'normal'}; line-height:1.3; color:${ctBaseColor}; z-index:2; font-family:'${ct.font_family ?? template.fontFamily}', sans-serif; ${ctEffectInline} ${ctHighlightInline}">${ctContent}</div>`
  }).join('\n  ')

  return `<!DOCTYPE html>
<html>
<head>
  <!-- Note: For server rendering with node-html-to-image, use waitUntil: 'networkidle0' to ensure font loading -->
  ${getAllFontLinks(slide, template.fontFamily)}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1080px;
      height: 1920px;
      ${backgroundCss}
      font-family: ${template.fontFamily};
      color: ${textColor};
      position: relative;
      overflow: hidden;
    }
    .overlay {
      position: absolute;
      inset: 0;
      background-color: ${template.overlayColor};
      opacity: ${overlayOpacity};
    }
    .hook {
      position: absolute;
      left: ${hookX}%;
      top: ${hookY}%;
      width: ${hookWidth}%;
      text-align: ${hookTextAlign};
      z-index: 1;
      font-size: ${hookFontSize};
      font-weight: 900;
      line-height: 1.1;
      ${template.hookStyle === 'uppercase' ? 'text-transform: uppercase;' : ''}
      ${template.hookStyle === 'italic' ? 'font-style: italic;' : ''}
      ${effectsToCSS(resolved.hookEffects)}
      ${highlightCSS(resolved.hookEffects, 'native').containerCSS}
    }
    .body {
      position: absolute;
      left: ${bodyX}%;
      top: ${bodyY}%;
      width: ${bodyWidth}%;
      text-align: ${bodyTextAlign};
      z-index: 1;
      font-size: ${bodyFontSize};
      font-weight: 400;
      line-height: 1.5;
      opacity: 0.9;
      ${effectsToCSS(resolved.bodyEffects)}
      ${highlightCSS(resolved.bodyEffects, 'native').containerCSS}
    }
  </style>
</head>
<body>
  ${newsBgImageHtml}
  <div class="overlay"></div>
  <div class="hook">${(() => {
    const hookHL = highlightCSS(resolved.hookEffects, 'native')
    const hookBase = isColorOnlyTemplate
      ? textColor
      : overrides.hook_text_color ?? textColor
    const hookInner = renderSegments(slide.hook_text, slide.hook_segments, hookBase, accentColor)
    return hookHL.spanWrap
      ? `<span style="${hookHL.spanCSS}">${hookInner}</span>`
      : hookInner
  })()}</div>
  <div class="body">${(() => {
    const bodyHL = highlightCSS(resolved.bodyEffects, 'native')
    const bodyBase = isColorOnlyTemplate
      ? textColor
      : overrides.body_text_color ?? textColor
    const bodyInner = renderSegments(slide.body_text, slide.body_segments, bodyBase, accentColor)
    return bodyHL.spanWrap
      ? `<span style="${bodyHL.spanCSS}">${bodyInner}</span>`
      : bodyInner
  })()}</div>
  ${customImageHtml}
  ${customTextHtml}
  ${watermarkHtml}
  ${forcedWatermarkHtml}
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
