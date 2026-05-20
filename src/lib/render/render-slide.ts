import type { SlideTemplate } from './templates'
import type { Slide, TextSegment } from '../types/slide'
import type { BrandKit } from '../types/brand-kit'
import { resolveSlideStyles, type ResolvedTextEffectStyles } from './resolve-styles'
import { resolveWatermark } from './resolve-watermark'
import { resolveForcedWatermark, type ForcedWatermarkTier } from './resolve-forced-watermark'
import { getHookFontSize, hasHookFit, captionCardHeadlineBox } from './hook-fit'
// quick-260515-epn: per-slide template_id_override resolved INTERNALLY so
// callers can keep passing the project-level template unchanged. TPLREND-05
// byte-identity preserved when no override is set (helper returns the EXACT
// templateParam reference).
import { resolvePerSlideTemplate } from './resolve-per-slide-template'
// quick-260515-nhf: shared hook-typography resolver — single source of truth
// for hook casing/font-family/italic precedence across all three render paths.
import {
  resolveHookTypography,
  resolveCaptionBar,
  captionCardBackgroundStyle,
  resolveNewsHeadlineFit,
} from './resolve-overlay'
// quick-260520-064: shared geometry for the 'ruled' TextHighlight style.
// Reuses RULED_HIGHLIGHT constants so the HTML export paints the flanking
// rules byte-identically to the canvas + Satori paths. (The deleted
// breaking-news-badge module is replaced by adapter-injected 'ruled' kickers.)
import { RULED_HIGHLIGHT } from './ruled-highlight'

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

// quick-260517-iiy: fixed inset for the tight-highlight pill. Mirrors
// TIGHT_HIGHLIGHT_PADDING in resolve-overlay.ts — the canvas/Satori paths use
// that const; the HTML string-builder duplicates the value here so the three
// paths emit identical pills (TPLREND-05). `effects.highlight.padding` is
// intentionally NOT read.
const TIGHT_HIGHLIGHT_PADDING = 8

/**
 * Build highlight CSS for the HTML renderer.
 *
 *   - `full`  → background painted on the text container (`containerCSS`).
 *   - `tight` → `isTight: true`; caller must render per-line pills via
 *               `buildTightHighlightHtml` instead of using the container CSS.
 *
 * quick-260517-iiy: the old `tight` path set `box-decoration-break: clone` on a
 * single wrapper span — that renders as one continuous horizontal bar for
 * segment-less plain text and is unsupported by Satori. Tight is now per-line
 * inline-block pills (see buildTightHighlightHtml) so all three render paths
 * match.
 */
function highlightCSS(
  effects: ResolvedTextEffectStyles,
  mode: 'full' | 'native',
): { containerCSS: string; isTight: boolean } {
  if (!effects.highlight?.enabled) return { containerCSS: '', isTight: false }

  if (mode === 'native' && effects.highlight.style === 'tight') {
    // Tight: caller renders per-line pills — no container background.
    return { containerCSS: '', isTight: true }
  }

  // Full-width: background on the container.
  return {
    containerCSS: `background-color: ${effects.highlight.color}; padding: ${effects.highlight.padding}px;`,
    isTight: false,
  }
}

/**
 * quick-260517-iiy: HTML equivalent of resolve-overlay.renderTightHighlight —
 * emit one `inline-block` padded pill per `\n`-split line inside a
 * `flex-direction: column` container. Line-deterministic; no
 * `box-decoration-break`. The per-line markup is byte-structurally identical
 * to the canvas + Satori paths (TPLREND-05).
 *
 * `inner` is the pre-rendered inner HTML for single-line text (e.g. segmented
 * spans). For multi-line text each line is escaped + wrapped individually.
 */
function buildTightHighlightHtml(
  text: string,
  color: string,
  textColor: string,
  textAlign: string,
  inner: string,
): string {
  const lines = text.split('\n')
  const flexAlign =
    textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start'
  const pillStyle =
    `display: inline-block; background-color: ${color}; color: ${textColor};` +
    ` padding: ${TIGHT_HIGHLIGHT_PADDING}px ${TIGHT_HIGHLIGHT_PADDING}px;` +
    ` align-self: ${flexAlign}; max-width: 100%; overflow-wrap: break-word;`
  const pills =
    lines.length === 1
      ? `<span style="${pillStyle}">${inner}</span>`
      : lines
          .map((line) => `<span style="${pillStyle}">${escapeHtml(line)}</span>`)
          .join('')
  return (
    `<span style="display: flex; flex-direction: column; width: 100%;` +
    ` gap: 8px; align-items: ${flexAlign};">${pills}</span>`
  )
}

export function buildSlideHtml(
  slide: Slide,
  templateParam: SlideTemplate,
  brandKit?: BrandKit | null,
  tier?: ForcedWatermarkTier | null,
  // Phase 88 (WIRE-04): optional DB-template lookup forwarded to
  // resolvePerSlideTemplate so a per-slide DB template_id_override resolves
  // in the HTML export. Omitted by every test / client caller —
  // byte-identical to pre-Phase-88 when absent.
  dbTemplates?: ReadonlyMap<string, SlideTemplate>,
): string {
  const overrides = slide.style_overrides ?? {}
  // quick-260515-epn: per-slide template_id_override re-resolution. Mirrors
  // the buildSlideElement (Satori) re-bind pattern so both renderers honor
  // the per-slide override identically. TPLREND-05 byte-identity preserved
  // — every legacy slide gets the exact templateParam reference back.
  const template = resolvePerSlideTemplate(slide, templateParam, dbTemplates)
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
  const hookBox = (slide.text_boxes ?? []).find((tb) => tb.role === 'hook')
  const hookBoxAlign = hookBox?.text_align
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
  // Numeric hook size (px) — the value before the `px` suffix. Used by the
  // Phase 82 Gap D caption-card re-fit below; the emitted CSS string is derived
  // from the re-fit result.
  const hookFontSizePx = overrides.hook_font_size
    ? overrides.hook_font_size
    : autoFitHookPx != null
      ? autoFitHookPx
      : baseHookSizePx
  const bodyFontSize = overrides.body_font_size ? `${overrides.body_font_size}px` : template.bodyFontSize

  // quick-260515-nhf: hook casing/font/italic resolved via the shared
  // resolveHookTypography helper so the exported HTML agrees with the editor
  // canvas + Satori PNG (TPLREND-05). Byte-identity guard: legacy slides emit
  // NO explicit hook font-family / text-transform — they keep inheriting the
  // root `template.fontFamily` (the historical HTML behavior) and stay
  // identical. An explicit font-family is emitted ONLY when the user actually
  // overrode the hook font.
  const hookTypography = resolveHookTypography(overrides, hookBox, template)
  const hookFontFamilyCss =
    overrides.hook_font_family != null
      ? `font-family: ${hookTypography.fontFamily};`
      : ''
  const hookTextTransformCss =
    hookTypography.textTransform === 'uppercase' ? 'text-transform: uppercase;' : ''
  const hookFontStyleCss = hookTypography.fontStyle === 'italic' ? 'font-style: italic;' : ''

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
  // quick-260515-overlay-color-picker: user-controlled overlay tint color.
  // Falls back to template default. TPLREND-05 mirror of slide-preview.tsx
  // + render-slide-satori.tsx.
  const overlayColor = overrides.overlay_color ?? template.overlayColor
  const newsZone =
    !isColorOnlyTemplate && overrides.layout ? NEWS_LAYOUT[overrides.layout] : null
  // quick-260518-8o0: `newsImageHeight` retired. The news photo is now a
  // full-bleed background (folded into the `background-image` branch below),
  // so it no longer has a movable photo/caption boundary — `news_image_height`
  // is dead resolver wiring and is removed from all 3 render paths.

  // quick-260517-h8z: user-controlled slide background color. Falls back to
  // template default. TPLREND-05 mirror of slide-preview.tsx +
  // render-slide-satori.tsx via `overrides.background_color ?? template.backgroundColor`.
  // quick-260518-8o0: `background_color` is KEPT — it is the RAW slide
  // background, only visible when the caption card is OFF and there is no
  // photo (the news photo is now full-bleed, see the `background-image`
  // branch below).
  const bgColor = overrides.background_color ?? template.backgroundColor
  // quick-260518-8o0: news-layout slides now go through the SAME full-bleed
  // `background-image` branch as non-news slides — the news photo is a
  // permanent full-bleed background (the caption card owns the headline
  // backdrop). `isColorOnlyTemplate` still suppresses any photo.
  const backgroundCss = isColorOnlyTemplate
    ? `background-color: ${bgColor};`
    : slide.background_url
      ? `background-image: url('${slide.background_url}'); background-size: cover; background-position: center;`
      : `background-color: ${bgColor};`

  // Resolve text positions: news layouts override Y defaults; user-supplied positions still win.
  const posPreset = overrides.text_position ?? template.textPosition
  const defaults = newsZone ?? SAFE[posPreset] ?? SAFE.center
  const defaultX = SAFE.x

  // quick-260519-hym: caption-card resolution is hoisted above hookX/hookY so a
  // news-layout caption-card headline can be positioned by the card geometry.
  // `isNewsLayoutSlide` mirrors the gate in render-slide-satori.tsx +
  // slide-preview.tsx; `captionCard` is re-used by the captionCardHtml layer.
  const isNewsLayoutSlide = template.backgroundMode == null && overrides.layout != null
  const captionCard = resolveCaptionBar(overrides, template, isNewsLayoutSlide)
  // A news-layout caption-card headline is owned by the card geometry — inset
  // to the card's fit-box width, vertically centered (hookY = card centre, with
  // translateY(-50%) in the emitted .hook CSS). Null for non-caption slides.
  const captionCardHeadline =
    captionCard.enabled && isNewsLayoutSlide ? captionCardHeadlineBox(captionCard) : null

  const hookX = captionCardHeadline?.xPct ?? overrides.hook_position?.x ?? defaultX
  const hookY = captionCardHeadline?.yCenterPct ?? overrides.hook_position?.y ?? defaults.hookY
  const bodyX = overrides.body_position?.x ?? defaultX
  const bodyY = overrides.body_position?.y ?? defaults.bodyY

  // Width: caption-card headline uses the card's fit-box width; otherwise
  // override wins, fall back to symmetric calc, min 20%.
  const hookWidth = captionCardHeadline?.widthPct
    ?? Math.max(20, overrides.hook_width ?? (100 - hookX * 2))
  const bodyWidth = Math.max(20, overrides.body_width ?? (100 - bodyX * 2))

  // quick-260518-8o0: the constrained news-photo <img> (`newsBgImageHtml`) is
  // retired — the news photo is now full-bleed via the `background-image`
  // branch of `backgroundCss` above, the same path non-news photos use.

  // quick-260517-k2n: caption card — an independent draggable/resizable colored
  // rectangle. The HTML export path previously rendered NO caption card; this
  // adds it so all THREE paths (canvas / Satori PNG / HTML) render the same
  // rectangle for the same overrides (TPLREND-05 / PARITY-01). Resolved via the
  // SAME shared resolveCaptionBar the canvas + Satori paths use.
  // quick-260518-8o0: `isNewsLayoutSlide` is passed as the 3rd arg so an
  // unedited news slide resolves enabled:true with seeded bottom-region black
  // geometry (the news black-headline-backdrop migration). With zero
  // caption_bar_* overrides AND a non-news slide the resolver still returns
  // enabled:false => no card (byte-identical to pre-change). z-index:2 sits
  // above the photo and below the hook/body text — matching the canvas
  // zIndex discipline.
  // `isNewsLayoutSlide` + `captionCard` are resolved above (hoisted so the
  // headline geometry can derive from the card).
  // quick-260518-ch8: shared helper — emits `background-color` when blend is
  // off (byte-identical to pre-change) or `background-image` (a linear-gradient)
  // when blend is on, matching the canvas + Satori paths (TPLREND-05 / PARITY-01).
  const captionCardBg = captionCardBackgroundStyle({
    backgroundColor: captionCard.backgroundColor,
    blendPct: captionCard.blendPct,
    position: captionCard.position,
  })
  const captionCardBgCss =
    'backgroundImage' in captionCardBg
      ? `background-image:${captionCardBg.backgroundImage}`
      : `background-color:${captionCardBg.backgroundColor}`
  const captionCardHtml = captionCard.enabled
    ? `<div style="position:absolute; left:${captionCard.x}%; top:${captionCard.y}%; width:${captionCard.width}%; height:${captionCard.heightPct}%; ${captionCardBgCss}; z-index:2;"></div>`
    : ''

  // quick-260520-064: the BREAKING NEWS chrome IIFE was deleted in favor of
  // an adapter-injected 'ruled' kicker TextBox (replicated pixel-for-pixel by
  // the customTextHtml branch below via the RULED_HIGHLIGHT geometry). The
  // kicker lives in slide.custom_texts (dual-write mirror) and renders through
  // the same path as every other custom-anchored text box.

  // Phase 82 Gap D (render-wiring): re-fit the news headline to the
  // quick-260517-k2n caption card when one is enabled, so the HTML export
  // matches the canvas preview + Satori PNG. `resolveNewsHeadlineFit`
  // returns `hookFontSizePx` unchanged for every non-news / no-caption-card
  // slide, so the emitted CSS string stays byte-identical for those.
  const newsHeadlineFontSizePx = resolveNewsHeadlineFit(
    captionCard, slide.hook_text, hookFontSizePx, isNewsLayoutSlide,
  )

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
    const ctHL = resolvedCt
      ? highlightCSS(resolvedCt.resolvedEffects, 'native')
      : { containerCSS: '', isTight: false }
    const ctBaseColor = ct.color ?? textColor
    const ctInner = renderSegments(ct.text, ct.segments, ctBaseColor, accentColor)

    // quick-260520-064: 'ruled' highlight — flanking horizontal rules sit on
    // either side of the text inside a centered flex row. Rules paint in the
    // box's TEXT color (NOT effects.highlight.color — Warning 4) so the
    // flanking rules track tb.color edits. Hook/body 'ruled' is intentionally
    // out of scope (Warning 5) — that branch falls through to plain text on
    // this surface. We render the 'ruled' kicker as a SELF-CONTAINED div
    // whose container has NO inline-style highlight (the rules + text together
    // are the highlight), which is why we bypass `ctHL.containerCSS` here.
    const isRuled =
      resolvedCt?.resolvedEffects.highlight?.enabled === true &&
      resolvedCt.resolvedEffects.highlight.style === 'ruled'
    if (isRuled) {
      const ctEffectInlineRuled = ctEffectStr.replace(/\n\s+/g, ' ').trim()
      const ruleHtml = `<div style="width:${RULED_HIGHLIGHT.lineLengthPx}px; height:${RULED_HIGHLIGHT.lineThicknessPx}px; background-color:${ctBaseColor};"></div>`
      const textInner = `<div style="white-space:nowrap; letter-spacing:${RULED_HIGHLIGHT.letterSpacingPx}px;">${ctInner}</div>`
      return `<div style="position:absolute; left:${ct.x}%; top:${ct.y}%; width:${ct.width}%; display:flex; align-items:center; justify-content:center; gap:${RULED_HIGHLIGHT.lineGapPx}px; text-align:${ct.text_align ?? 'left'}; font-size:${ct.font_size ?? 48}px; font-weight:${ct.font_weight ?? 400}; font-style:${ct.font_style ?? 'normal'}; line-height:1; color:${ctBaseColor}; z-index:2; font-family:'${ct.font_family ?? template.fontFamily}', sans-serif; ${ctEffectInlineRuled}">${ruleHtml}${textInner}${ruleHtml}</div>`
    }

    const ctContent =
      ctHL.isTight && resolvedCt?.resolvedEffects.highlight?.enabled
        ? buildTightHighlightHtml(
            ct.text,
            resolvedCt.resolvedEffects.highlight.color,
            ctBaseColor,
            ct.text_align ?? 'left',
            ctInner,
          )
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
      background-color: ${overlayColor};
      opacity: ${overlayOpacity};
    }
    .hook {
      position: absolute;
      left: ${hookX}%;
      top: ${hookY}%;
      width: ${hookWidth}%;
      ${captionCardHeadline ? 'transform: translateY(-50%);' : ''}
      text-align: ${hookTextAlign};
      z-index: 1;
      font-size: ${newsHeadlineFontSizePx}px;
      font-weight: 900;
      line-height: 1.1;
      ${hookFontFamilyCss}
      ${hookTextTransformCss}
      ${hookFontStyleCss}
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
  <div class="overlay"></div>
  ${captionCardHtml}
  <div class="hook">${(() => {
    const hookHL = highlightCSS(resolved.hookEffects, 'native')
    const hookBase = isColorOnlyTemplate
      ? textColor
      : overrides.hook_text_color ?? textColor
    const hookInner = renderSegments(slide.hook_text, slide.hook_segments, hookBase, accentColor)
    return hookHL.isTight && resolved.hookEffects.highlight?.enabled
      ? buildTightHighlightHtml(
          slide.hook_text,
          resolved.hookEffects.highlight.color,
          hookBase,
          hookTextAlign,
          hookInner,
        )
      : hookInner
  })()}</div>
  <div class="body">${(() => {
    const bodyHL = highlightCSS(resolved.bodyEffects, 'native')
    const bodyBase = isColorOnlyTemplate
      ? textColor
      : overrides.body_text_color ?? textColor
    const bodyInner = renderSegments(slide.body_text ?? '', slide.body_segments, bodyBase, accentColor)
    return bodyHL.isTight && resolved.bodyEffects.highlight?.enabled
      ? buildTightHighlightHtml(
          slide.body_text ?? '',
          resolved.bodyEffects.highlight.color,
          bodyBase,
          bodyTextAlign,
          bodyInner,
        )
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
