import type { SlideTemplate } from './templates'
import type { Slide } from '../types/slide'
import { resolveSlideStyles, type ResolvedTextEffectStyles } from './resolve-styles'

// TikTok/Instagram safe zones on 1080x1920 canvas
// Top ~200px (10.4%), Bottom ~480px from bottom (max y ~75%), Sides ~120px (11%)
const SAFE = {
  x: 11,   // percentage from left
  top: { hookY: 12, bodyY: 30 },
  center: { hookY: 30, bodyY: 48 },
  bottom: { hookY: 48, bodyY: 62 },
}

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
  template: SlideTemplate
): string {
  const overrides = slide.style_overrides ?? {}
  const resolved = resolveSlideStyles(slide, template)

  const textColor = overrides.text_color ?? template.textColor
  const textAlign = overrides.text_align ?? template.textAlign
  const hookFontSize = overrides.hook_font_size ? `${overrides.hook_font_size}px` : template.hookFontSize
  const bodyFontSize = overrides.body_font_size ? `${overrides.body_font_size}px` : template.bodyFontSize

  const overlayOpacity = overrides.overlay_opacity != null
    ? overrides.overlay_opacity / 100
    : template.overlayOpacity

  const backgroundCss = slide.background_url
    ? `background-image: url('${slide.background_url}'); background-size: cover; background-position: center;`
    : `background-color: ${template.backgroundColor};`

  // Resolve text positions using safe-zone defaults
  const posPreset = overrides.text_position ?? template.textPosition
  const defaults = SAFE[posPreset] ?? SAFE.center
  const defaultX = SAFE.x

  const hookX = overrides.hook_position?.x ?? defaultX
  const hookY = overrides.hook_position?.y ?? defaults.hookY
  const bodyX = overrides.body_position?.x ?? defaultX
  const bodyY = overrides.body_position?.y ?? defaults.bodyY

  // Width: override wins, fall back to symmetric calc, min 20%
  const hookWidth = Math.max(20, overrides.hook_width ?? (100 - hookX * 2))
  const bodyWidth = Math.max(20, overrides.body_width ?? (100 - bodyX * 2))

  // Build custom image HTML
  const customImageHtml = (slide.custom_images ?? []).map((ci) =>
    `<img src="${ci.url}" style="position:absolute; left:${ci.x}%; top:${ci.y}%; width:${ci.width}%; height:${ci.height}%; object-fit:cover; opacity:${(ci.opacity ?? 100) / 100}; border-radius:${ci.border_radius ?? 0}px; z-index:1;" />`
  ).join('\n  ')

  // Build custom text HTML with effects
  const customTextHtml = (slide.custom_texts ?? []).map((ct) => {
    const resolvedCt = resolved.customTexts.find(rc => rc.id === ct.id)
    const ctEffectStr = resolvedCt ? effectsToCSS(resolvedCt.resolvedEffects) : ''
    const ctHL = resolvedCt ? highlightCSS(resolvedCt.resolvedEffects, 'native') : { containerCSS: '', spanWrap: false, spanCSS: '' }
    const ctContent = ctHL.spanWrap
      ? `<span style="${ctHL.spanCSS}">${escapeHtml(ct.text)}</span>`
      : escapeHtml(ct.text)

    const ctEffectInline = ctEffectStr.replace(/\n\s+/g, ' ').trim()
    const ctHighlightInline = ctHL.containerCSS.trim()

    return `<div style="position:absolute; left:${ct.x}%; top:${ct.y}%; width:${ct.width}%; text-align:${ct.text_align ?? 'left'}; font-size:${ct.font_size ?? 48}px; font-weight:${ct.font_weight ?? 400}; font-style:${ct.font_style ?? 'normal'}; line-height:1.3; color:${ct.color ?? textColor}; z-index:2; font-family:'${ct.font_family ?? template.fontFamily}', sans-serif; ${ctEffectInline} ${ctHighlightInline}">${ctContent}</div>`
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
      text-align: ${textAlign};
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
      text-align: ${textAlign};
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
  <div class="overlay"></div>
  <div class="hook">${(() => {
    const hookHL = highlightCSS(resolved.hookEffects, 'native')
    return hookHL.spanWrap
      ? `<span style="${hookHL.spanCSS}">${escapeHtml(slide.hook_text)}</span>`
      : escapeHtml(slide.hook_text)
  })()}</div>
  <div class="body">${(() => {
    const bodyHL = highlightCSS(resolved.bodyEffects, 'native')
    return bodyHL.spanWrap
      ? `<span style="${bodyHL.spanCSS}">${escapeHtml(slide.body_text)}</span>`
      : escapeHtml(slide.body_text)
  })()}</div>
  ${customImageHtml}
  ${customTextHtml}
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
