import type { SlideTemplate } from './templates'
import type { Slide, TextSegment } from '../types/slide'
import type { BrandKit } from '../types/brand-kit'
import React from 'react'
import { resolveSlideStyles, type ResolvedTextEffectStyles } from './resolve-styles'
import { resolveWatermark } from './resolve-watermark'
import { resolveForcedWatermark, type ForcedWatermarkTier } from './resolve-forced-watermark'
import { getHookFontSize, hasHookFit, clampManualHookSize } from './hook-fit'
// quick-260515-epn: re-resolve slide.template_id_override INTERNALLY so all
// server callers (single-slide /api/render + ZIP download loop) benefit
// without each having to call the helper at the call site. TPLREND-05 byte-
// identity: when no override is set, the helper returns the EXACT
// templateParam reference, so legacy slides traverse the identical render
// path with the identical template object.
import { resolvePerSlideTemplate } from './resolve-per-slide-template'
// Phase 69 Plan 02 (TPLREND-05): single source of truth for layer 5.5
// decoration → DOM markup. BOTH renderers (this satori path + slide-preview.tsx
// React preview) import renderDecoration from this exact module path.
import { renderDecoration } from './decoration-renderer'
import {
  resolveOverlayContent,
  SLOT_GEOMETRY,
  renderSegments as renderSegmentsShared,
  renderTextBlock,
  renderTightHighlight,
  resolveCaptionBar,
  renderGrain,
  renderVignette,
  renderDecorativeOverlay,
  augmentEditorialSerifPageCounterStyle,
  getNotesAppChicAccentColor,
  alignToJustifyContent,
  resolveHookTypography,
  type OverlayResolveCtx,
} from './resolve-overlay'

// TikTok/Instagram safe zones on 1080x1920 canvas
// Same constants as render-slide.ts for consistency
const SAFE = {
  x: 11, // percentage from left
  top: { hookY: 12, bodyY: 30 },
  center: { hookY: 30, bodyY: 48 },
  bottom: { hookY: 48, bodyY: 62 },
}

// Mirrors NEWS_LAYOUT in render-slide.ts and slide-preview.tsx — keep in sync.
// 260503: cover.bodyY bumped 80 → 84 to give long-hook wraps a vertical safety
// margin before they could collide with the body zone.
const NEWS_LAYOUT = {
  cover: { imageTop: 0,  imageHeight: 55, hookY: 60, bodyY: 84 },
  body:  { imageTop: 50, imageHeight: 50, hookY: 8,  bodyY: 30 },
} as const

const W = 1080
const H = 1920

/**
 * Build segment children for Satori. Satori supports inline <span style={{color}}> inside a text <div>.
 * Falls back to a plain string when no segments are provided.
 *
 * Phase 45: delegated to the shared resolve-overlay.renderSegments helper so
 * pill-aware highlight markup (mint-pill aesthetic from the Murphy reference)
 * lands automatically wherever hook/body/custom_texts segments carry
 * `highlightColor`. TPLREND-05 parity contract: identical span markup in
 * Satori PNG export and React DOM preview.
 */
function renderSegmentChildren(
  text: string,
  segments: TextSegment[] | undefined,
  baseColor: string,
  accentColor: string,
): React.ReactNode {
  return renderSegmentsShared(text, segments, baseColor, accentColor)
}

function pxX(pct: number) {
  return Math.round(W * pct / 100)
}
function pxY(pct: number) {
  return Math.round(H * pct / 100)
}

/** Build Satori-safe CSS properties from resolved text effects */
function satoriEffectStyles(effects: ResolvedTextEffectStyles): React.CSSProperties {
  const css: React.CSSProperties = {}
  if (effects.textShadow) css.textShadow = effects.textShadow
  if (effects.WebkitTextStrokeWidth) {
    css.WebkitTextStrokeWidth = effects.WebkitTextStrokeWidth
    css.WebkitTextStrokeColor = effects.WebkitTextStrokeColor
    css.paintOrder = effects.paintOrder
  }
  return css
}

/**
 * Build the CONTAINER highlight style for Satori — `full` style only.
 *
 * REND-04 (resolved by quick-260517-iiy): Satori has no
 * `box-decoration-break`, so the old tight path silently fell back to
 * full-width here — non-parity with the canvas. Tight is now rendered as
 * per-line `inline-block` pills via the shared `renderTightHighlight` helper
 * (Satori's CSS subset honors `display: flex` + `inline-block`), producing
 * pills identical to the canvas + HTML paths. So this helper returns null for
 * `tight` — the container gets NO background; the per-line pills carry it.
 */
function satoriHighlightStyle(effects: ResolvedTextEffectStyles): React.CSSProperties | null {
  if (!effects.highlight?.enabled) return null
  // Tight → per-line pills (renderTightHighlight); no container background.
  if (effects.highlight.style === 'tight') return null
  // Full → background painted on the text container.
  return {
    backgroundColor: effects.highlight.color,
    padding: `${effects.highlight.padding}px`,
  }
}

/**
 * Build a Satori-compatible React element for a slide.
 * Satori converts this JSX to SVG, which is then rasterized to PNG via resvg-wasm.
 *
 * Important Satori limitations:
 * - No z-index support; layer order = DOM order
 * - Must use inline styles (no CSS classes)
 * - Limited CSS subset (flexbox + absolute positioning)
 * - backgroundImage must use full url() syntax
 */
export function buildSlideElement(
  slide: Slide,
  templateParam: SlideTemplate,
  brandKit?: BrandKit | null,
  tier?: ForcedWatermarkTier | null,
  origin?: string,
  ctx?: { slideIndex: number; totalSlides: number; topic?: string },
): React.ReactElement {
  const overrides = slide.style_overrides ?? {}
  // quick-260515-epn: per-slide template_id_override re-resolution. When the
  // slide carries a top-level `template_id_override` (or the pre-fusion
  // `style_overrides.template_id_override`), the helper returns the registry
  // template for that id; otherwise it returns `templateParam` BY REFERENCE,
  // preserving TPLREND-05 byte-identity for every legacy slide. All downstream
  // `template.*` reads use this rebound `template` variable unchanged.
  const template = resolvePerSlideTemplate(slide, templateParam)
  const resolved = resolveSlideStyles(slide, template)

  // Phase 45: graceful-fallback render context for the shared overlay resolver.
  // Callers that omit `ctx` get counter='1/1' and slide-field='' (CONTEXT.md
  // Area 4) — no thrown errors, no behavior change for legacy callsites.
  const resolveCtx: OverlayResolveCtx = {
    slideIndex: ctx?.slideIndex ?? 0,
    totalSlides: ctx?.totalSlides ?? 1,
    topic: ctx?.topic,
    slide,
  }

  // Color-only templates force template.textColor (kill-switch: stale
  // hook_text_color/body_text_color/text_color from a prior photo template
  // don't leak through). Mirrors the resolve-styles.ts gate.
  const textColor = template.backgroundMode === 'color'
    ? template.textColor
    : overrides.text_color ?? template.textColor
  // Per-text-box alignment (modern path). Each text_boxes entry can carry its
  // own text_align; fallback chain: per-box → slide-level overrides → template.
  const hookBoxAlign = (slide.text_boxes ?? []).find((tb) => tb.role === 'hook')?.text_align
  const bodyBoxAlign = (slide.text_boxes ?? []).find((tb) => tb.role === 'body')?.text_align
  // quick-260502-pw8: per-text-box list_type / list_indent (modern path).
  // Mirrors the text_align lookup. Legacy hook/body have no list fields, so
  // when text_boxes is empty the values are undefined → renderTextBlock fast
  // path returns the byte-identical renderSegments output.
  const hookBox = (slide.text_boxes ?? []).find((tb) => tb.role === 'hook')
  const bodyBox = (slide.text_boxes ?? []).find((tb) => tb.role === 'body')
  const slideAlign = overrides.text_align ?? template.textAlign
  const hookTextAlign = hookBoxAlign ?? slideAlign
  const bodyTextAlign = bodyBoxAlign ?? slideAlign
  // Kept for unrelated callers below (custom-text path uses its own ct.text_align).
  const textAlign = slideAlign

  // Phase 45 mutual-exclusion gate: when a template declares an explicit
  // `backgroundMode` (premium tier — magazine-bold, tr3nding-news, documentary),
  // the template's choice supersedes any slide-level `style_overrides.layout`.
  // This handles the case where AI generation inadvertently fills `layout` for
  // a premium template (the field is legacy-news-only). Legacy 5 templates
  // leave backgroundMode undefined → newsZone path runs unchanged.
  const isTemplateBgMode =
    template.backgroundMode != null && template.backgroundMode !== 'color'
  // backgroundMode: 'color' is a hard kill-switch — the template promises a
  // pure-typography canvas, so any persisted `slide.background_url` (from a
  // previous template, AI generation, or manual upload) must be ignored. This
  // also forces newsZone off so legacy `style_overrides.layout` can't sneak
  // a constrained-image zone back in.
  const isColorOnlyTemplate = template.backgroundMode === 'color'
  const newsZone =
    !isTemplateBgMode && !isColorOnlyTemplate && overrides.layout
      ? NEWS_LAYOUT[overrides.layout]
      : null
  // quick-260517-iiy: constrained news-photo height — `news_image_height`
  // override ?? NEWS_LAYOUT preset, clamped to [20, 80] (threat T-iiy-01).
  // Unset → byte-identical legacy rendering (TPLREND-05). Mirrors
  // slide-preview.tsx + render-slide.ts.
  const newsImageHeight = newsZone
    ? Math.max(20, Math.min(80, overrides.news_image_height ?? newsZone.imageHeight))
    : null

  // Templates with a hook-fit registry entry auto-shrink hook size for long
  // headlines. quick-260510-export-overlap: in news layouts (where bodyY is
  // fixed by preset), manual `hook_font_size` is also clamped to 1.6× the
  // auto-fit value — without this cap, a too-big manual size wraps the hook
  // into more lines than the (bodyY - hookY) zone can hold and produces
  // exports where hook + body overlap.
  const baseHookSizePx = parseInt(template.hookFontSize, 10) || 64
  const autoFitHookPx =
    overrides.hook_font_size == null && hasHookFit(template.id)
      ? getHookFontSize(template.id, slide.hook_text, baseHookSizePx)
      : null
  const hookFontSize = overrides.hook_font_size
    ? newsZone
      ? clampManualHookSize(overrides.hook_font_size, template.id, slide.hook_text, baseHookSizePx)
      : overrides.hook_font_size
    : autoFitHookPx != null
      ? autoFitHookPx
      : baseHookSizePx
  const bodyFontSize = overrides.body_font_size
    ? overrides.body_font_size
    : parseInt(template.bodyFontSize, 10) || 32

  const accentColor = template.accentColor ?? template.textColor
  // quick-260514-laa: per-text-box accent-color override (parity with
  // slide-preview.tsx). Falls back to the template default when unset.
  const hookAccentColor = hookBox?.accent_color ?? accentColor
  const bodyAccentColor = bodyBox?.accent_color ?? accentColor
  const useBgMode = isTemplateBgMode
  const useBottomCard =
    useBgMode && template.backgroundMode === 'image-with-bottom-card'

  // Resolve text positions: news layouts win over text_position; user-supplied positions still win over both.
  const posPreset = overrides.text_position ?? template.textPosition
  const defaults = newsZone ?? SAFE[posPreset] ?? SAFE.center
  const defaultX = SAFE.x

  // Color-only templates suppress the slide-wide darkening overlay regardless
  // of any persisted style_overrides.overlay_opacity (the user-reported bug:
  // a deck switched from bold-minimal → paper-essay had a 45% black scrim
  // baked into every slide from the original generation defaults).
  const overlayOpacity = isColorOnlyTemplate
    ? 0
    : overrides.overlay_opacity != null
      ? overrides.overlay_opacity / 100
      : template.overlayOpacity
  // quick-260515-overlay-color-picker: user-controlled overlay tint color.
  // Falls back to template default. TPLREND-05 mirror of slide-preview.tsx
  // + render-slide.ts.
  const overlayColor = overrides.overlay_color ?? template.overlayColor

  const hookX = overrides.hook_position?.x ?? defaultX
  const hookY = overrides.hook_position?.y ?? defaults.hookY
  const bodyX = overrides.body_position?.x ?? defaultX
  const bodyY = overrides.body_position?.y ?? defaults.bodyY

  // Width: override wins, fall back to symmetric calc, min 20%
  const hookWidth = Math.max(20, overrides.hook_width ?? (100 - hookX * 2))
  const bodyWidthPct = Math.max(20, overrides.body_width ?? (100 - bodyX * 2))
  const hookTextWidth = pxX(hookWidth)
  const bodyTextWidth = pxX(bodyWidthPct)

  // Root background style
  const rootStyle: React.CSSProperties = {
    width: W,
    height: H,
    display: 'flex',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: template.fontFamily,
    color: textColor,
  }

  // News layouts always paint a solid background — the image renders as a constrained <img>.
  // Color-only templates always paint a solid background regardless of any
  // persisted slide.background_url (the photo is suppressed below).
  // quick-260517-h8z: user-controlled slide background color. Falls back to
  // template default. TPLREND-05 mirror of slide-preview.tsx + render-slide.ts
  // via `overrides.background_color ?? template.backgroundColor`.
  if (!slide.background_url || newsZone || isColorOnlyTemplate) {
    rootStyle.backgroundColor = overrides.background_color ?? template.backgroundColor
  }

  // quick-260515-nhf: hook casing/font/italic resolved via the shared
  // resolveHookTypography helper so the Satori PNG export agrees with the
  // editor canvas (TPLREND-05). THIS closes the export-parity bug: the old
  // hardcoded `template.headingFontFamily ?? template.fontFamily` ignored
  // `overrides.hook_font_family`, so a user's hook-font pick silently
  // reverted in the exported PNG.
  const hookTypography = resolveHookTypography(overrides, hookBox, template)

  // Hook text style — heading font falls back to body font
  // Satori (next/og) requires display:flex on divs with multiple children;
  // multi-segment hooks emit several <span> siblings so flex+wrap is mandatory.
  const hookStyle: React.CSSProperties = {
    position: 'absolute',
    left: pxX(hookX),
    top: pxY(hookY),
    width: hookTextWidth,
    display: 'flex',
    flexWrap: 'wrap',
    textAlign: hookTextAlign,
    // quick-260514-l9q: parity with slide-preview.tsx — also set
    // justify-content because browsers ignore text-align on flex containers.
    // Satori already honors text-align here, so this is defense-in-depth /
    // explicit-intent rather than a Satori bug fix; keeps the two renderers
    // byte-identical on the alignment axis.
    justifyContent: alignToJustifyContent(hookTextAlign),
    fontSize: hookFontSize,
    // 260503-0f2: respect overrides + template-level hookFontWeight to match
    // slide-preview.tsx:610. Templates using single-weight display fonts (Anton)
    // MUST set hookFontWeight: 400 so Satori does not request weight 900 (which
    // it falls back / synthesizes from 400) — divergence cause for the
    // exported-PNG-vs-preview bug on news-* + cover layout.
    fontWeight: overrides.hook_font_weight ?? template.hookFontWeight ?? 900,
    lineHeight: 1.1,
    // quick-260515-nhf: honors overrides.hook_font_family — was the
    // hardcoded `template.headingFontFamily ?? template.fontFamily` here.
    fontFamily: hookTypography.fontFamily,
  }

  // quick-260515-nhf: only SET textTransform when 'uppercase' — emitting
  // `textTransform: 'none'` where today nothing is emitted would change the
  // serialized SVG for legacy slides (TPLREND-05 byte-identity).
  if (hookTypography.textTransform === 'uppercase') {
    hookStyle.textTransform = 'uppercase'
  }
  if (hookTypography.fontStyle === 'italic') {
    hookStyle.fontStyle = 'italic'
  }

  // Apply text effects to hook
  const hookEffectCSS = satoriEffectStyles(resolved.hookEffects)
  Object.assign(hookStyle, hookEffectCSS)
  const hookHighlight = satoriHighlightStyle(resolved.hookEffects)
  if (hookHighlight) Object.assign(hookStyle, hookHighlight)

  // Body text style — same Satori multi-child constraint as hookStyle.
  const bodyStyle: React.CSSProperties = {
    position: 'absolute',
    left: pxX(bodyX),
    top: pxY(bodyY),
    width: bodyTextWidth,
    display: 'flex',
    flexWrap: 'wrap',
    textAlign: bodyTextAlign,
    // quick-260514-l9q: same parity reason as hookStyle above.
    justifyContent: alignToJustifyContent(bodyTextAlign),
    fontSize: bodyFontSize,
    fontWeight: 400,
    lineHeight: 1.5,
    opacity: 0.9,
  }

  // Apply text effects to body
  const bodyEffectCSS = satoriEffectStyles(resolved.bodyEffects)
  Object.assign(bodyStyle, bodyEffectCSS)
  const bodyHighlight = satoriHighlightStyle(resolved.bodyEffects)
  if (bodyHighlight) Object.assign(bodyStyle, bodyHighlight)

  // Brand watermark layer (260427-hut). Satori has no z-index — placement after
  // custom_images in JSX order makes it sit on top.
  //
  // Phase 60 (WMARK-04): the lazy initializer in use-slide-editor.ts mirrors
  // slide.watermark ↔ slide.style_overrides.watermark via watermark-adapter.ts.
  // resolveWatermark reads from the legacy slot — the mirror keeps both in sync,
  // so byte-identical output is preserved across the schema lift. Replacing
  // resolveWatermark wholesale belongs to a later phase; Phase 60 only adds the
  // unified element while preserving the resolver contract (RESEARCH Q1 + Q10).
  const watermark = resolveWatermark(brandKit ?? null, slide, { width: W, height: H })

  // Forced free-tier watermark (260427-wmk). Rendered last in JSX so it sits on top.
  // Satori requires absolute URLs — when origin is provided we prepend it to /logo.png.
  const forced = resolveForcedWatermark(tier, { width: W, height: H }, slide)
  const forcedLogoUrl = forced && origin && forced.logoUrl.startsWith('/')
    ? `${origin}${forced.logoUrl}`
    : forced?.logoUrl

  return (
    <div style={rootStyle}>
      {/* Background image - use <img> with objectFit instead of CSS backgroundImage
          because Satori does not support backgroundSize/backgroundPosition properly,
          causing the image to tile instead of cover.
          News layouts confine the image to a zone (top half / bottom half) instead of full-bleed.
          Phase 45: when useBgMode is active, the same image renders full-bleed
          (1080×1920 cover) — required NUMERIC pixel sizes per RESEARCH.md Pitfall 3. */}
      {slide.background_url && !isColorOnlyTemplate && (
        <img
          src={slide.background_url}
          style={{
            position: 'absolute',
            top: newsZone ? pxY(newsZone.imageTop) : 0,
            left: 0,
            width: W,
            // quick-260517-iiy: news_image_height override moves the photo /
            // caption-panel boundary; falls back to the preset.
            height: newsZone ? pxY(newsImageHeight ?? newsZone.imageHeight) : H,
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />
      )}
      {/* Phase 55 (D-13, layer 1.5): grain/noise overlay — only when template opts in.
          `origin` prepends the absolute URL Satori requires for <img>. */}
      {template.grainMode ? renderGrain(template.grainMode, origin) : null}
      {/* Overlay - rendered before text so text appears on top (Satori has no z-index) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: overlayColor,
          opacity: overlayOpacity,
        }}
      />
      {/* Phase 55 (D-13, layer 2.5): radial vignette — only when template opts in. */}
      {template.vignette ? renderVignette(template.vignette.strength) : null}
      {/* Phase 45: bottom-card layer for backgroundMode === 'image-with-bottom-card'.
          Sits ABOVE tint and BELOW overlays/hook/body per CONTEXT.md Area 1 DOM order.
          Card height locked at 38% of canvas (≈730px on 1920); padding 80px matches
          the Murphy reference. Hook+body still flow through their existing position
          resolution and naturally sit on top of this card surface. */}
      {useBottomCard &&
        (() => {
          // quick-260515-k12: caption-bar geometry/color resolved through the
          // shared resolveCaptionBar helper so the Satori PNG export cannot
          // drift from the browser preview (PARITY-01). Satori does not honor
          // `bottom: 0` + percentage height together — it anchors to the top —
          // so we convert to explicit numeric px. With zero overrides
          // `H - round(H*38/100)` = 1920 - 730 = 1190, identical to the old
          // hardcoded `round(H*0.62)` = 1190 (TPLREND-05 byte-identity).
          const captionBar = resolveCaptionBar(overrides, template)
          const barHeightPx = Math.round((H * captionBar.heightPct) / 100)
          return (
            <div
              key="bottom-card"
              style={{
                position: 'absolute',
                left: 0,
                top: captionBar.position === 'top' ? 0 : H - barHeightPx,
                width: W,
                height: barHeightPx,
                padding: 80,
                backgroundColor: captionBar.backgroundColor,
                display: 'flex',
                flexDirection: 'column',
              }}
            />
          )
        })()}
      {/* Phase 45: overlay zones (chip / counter / mid pill / bottom card surface).
          Inserted AFTER bottom-card and BEFORE the hook so headline pills stay
          top-most (CONTEXT.md Area 1 layer 4 vs layer 5). Each overlay's text is
          resolved via the shared resolveOverlayContent — same source as the React
          preview to guarantee TPLREND-05 parity. Explicit keys per RESEARCH.md
          Pitfall 6 (snapshot stability across React 19 minor versions). */}
      {template.overlays?.map((overlay, i) => {
        // quick-260514-kv9: page-counter overlay suppressed everywhere
        // (TPLREND-05 parity with the React preview short-circuit). The
        // "Slide N / total" chip lives above the canvas now (quick-260514-ku2);
        // the per-slide top-right number is redundant.
        if (overlay.content.type === 'page-counter') return null
        // Phase 56 (TPL-04, D-14): decorative overlay branch. Renders a SVG/PNG
        // asset via the shared renderDecorativeOverlay helper — both renderers
        // consume the same module (TPLREND-05 parity invariant). Decorative
        // overlays are positioned at overlay.offset.{x,y} (typically using the
        // 'free' slot, but any slot's offset is honored).
        if (overlay.content.type === 'decorative') {
          const pos = { x: overlay.offset?.x ?? 0, y: overlay.offset?.y ?? 0 }
          // Phase 57 (D-15): notes-app-chic palette tint for sticky-note-accent
          const tintColor =
            overlay.content.asset === 'sticky-note-accent'
              ? getNotesAppChicAccentColor(resolveCtx.slide, template)
              : undefined
          return (
            <React.Fragment key={`overlay-${i}-${overlay.position}-decorative`}>
              {renderDecorativeOverlay(overlay.content.asset, pos, {
                rotation: overlay.content.rotation,
                scale: overlay.content.scale,
                opacity: overlay.content.opacity,
                tintColor,
              }, origin)}
            </React.Fragment>
          )
        }
        const slot = SLOT_GEOMETRY[overlay.position]
        const offset = overlay.offset
        // Index the slot via a permissive view so the additive-nudge branches
        // remain ergonomic across the SLOT_GEOMETRY union (top-left has `left`,
        // top-right has `right`, etc.). The runtime guard on `typeof === 'number'`
        // narrows safely; the type assertion is purely structural.
        const slotAny = slot as Record<string, unknown> | null
        const slotStyle: React.CSSProperties =
          slot == null
            ? { position: 'absolute', left: offset?.x ?? 0, top: offset?.y ?? 0 }
            : {
                position: 'absolute',
                ...slot,
                // Additive nudge for slots with numeric anchors. We deliberately
                // do NOT mutate the right/bottom anchors on top-right etc. —
                // free slots are the path for fully-custom positions.
                ...(offset && slotAny && typeof slotAny.left === 'number' && offset.x
                  ? { left: (slotAny.left as number) + offset.x }
                  : {}),
                ...(offset && slotAny && typeof slotAny.top === 'number' && offset.y
                  ? { top: (slotAny.top as number) + offset.y }
                  : {}),
              }
        const text = resolveOverlayContent(overlay.content, resolveCtx)
        // quick-260514-kv9: page-counter overlay short-circuited above, so the
        // editorial-serif palette-augmentation branch is unreachable. Same
        // simplification as the React preview path for TPLREND-05 parity.
        const augmentedStyle = { ...(overlay.style ?? {}) }
        return (
          <div
            key={`overlay-${i}-${overlay.position}`}
            style={{
              ...slotStyle,
              display: 'flex',
              alignItems: 'center',
              fontSize: 28,
              fontWeight: 700,
              lineHeight: 1,
              ...(augmentedStyle as React.CSSProperties),
            }}
          >
            {text}
          </div>
        )
      })}
      {/* Hook text — Phase 64 LOCK-07: skip when text_boxes hook entry has hidden=true */}
      {!hookBox?.hidden && (
        <div style={hookStyle}>
          {resolved.hookEffects.highlight?.enabled &&
          resolved.hookEffects.highlight.style === 'tight'
            ? // quick-260517-iiy: per-line tight pills — shared with canvas/HTML.
              renderTightHighlight(
                slide.hook_text,
                slide.hook_segments,
                hookBox?.list_type,
                hookBox?.list_indent,
                isColorOnlyTemplate ? textColor : overrides.hook_text_color ?? textColor,
                hookAccentColor,
                resolved.hookEffects.highlight,
                hookTextAlign,
              )
            : renderTextBlock(
                slide.hook_text,
                slide.hook_segments,
                hookBox?.list_type,
                hookBox?.list_indent,
                isColorOnlyTemplate ? textColor : overrides.hook_text_color ?? textColor,
                hookAccentColor,
              )}
        </div>
      )}
      {/* Body text — Phase 64 LOCK-07: skip when text_boxes body entry has hidden=true */}
      {!bodyBox?.hidden && (
        <div style={bodyStyle}>
          {resolved.bodyEffects.highlight?.enabled &&
          resolved.bodyEffects.highlight.style === 'tight'
            ? // quick-260517-iiy: per-line tight pills — shared with canvas/HTML.
              renderTightHighlight(
                slide.body_text ?? '',
                slide.body_segments,
                bodyBox?.list_type,
                bodyBox?.list_indent,
                isColorOnlyTemplate ? textColor : overrides.body_text_color ?? textColor,
                bodyAccentColor,
                resolved.bodyEffects.highlight,
                bodyTextAlign,
              )
            : renderTextBlock(
                slide.body_text ?? '',
                slide.body_segments,
                bodyBox?.list_type,
                bodyBox?.list_indent,
                isColorOnlyTemplate ? textColor : overrides.body_text_color ?? textColor,
                bodyAccentColor,
              )}
        </div>
      )}
      {/* Custom images (before text so text layers on top in Satori DOM order)
          Phase 64 LOCK-07: filter ci.hidden === true. */}
      {(slide.custom_images ?? []).filter((ci) => ci.hidden !== true).map((ci) => (
        <img
          key={ci.id}
          src={ci.url}
          style={{
            position: 'absolute',
            left: pxX(ci.x),
            top: pxY(ci.y),
            width: pxX(ci.width),
            height: pxY(ci.height),
            objectFit: 'cover',
            opacity: (ci.opacity ?? 100) / 100,
            borderRadius: ci.border_radius ?? 0,
          }}
        />
      ))}
      {/* Phase 67 (DECOR-01) layer 5.5: decoration iteration site.
          Null-safe — when slide.decorations === undefined OR [], emits ZERO
          DOM nodes (idempotent absence — PTF16 byte-identity gate enforced
          by parity.template-fingerprint-decorations-undefined.test.tsx).
          Phase 69 (Plan 02): stub `_d => null` swapped for `renderDecoration(d, ctx)`
          — both renderers route through `decoration-renderer.tsx` (TPLREND-05). */}
      {(slide.decorations ?? [])
        .filter((d) => d.hidden !== true)
        .map((d) => {
          const node = renderDecoration(d, {
            slideIndex: resolveCtx.slideIndex,
            totalSlides: resolveCtx.totalSlides,
          })
          return node ? React.cloneElement(node as React.ReactElement, { key: d.id }) : null
        })}
      {/* Brand watermark — rendered after custom_images so it stacks on top in Satori DOM order.
          Phase 64 LOCK-07: also gate on slide.watermark.hidden to suppress hidden watermarks. */}
      {watermark && !slide.watermark?.hidden && (
        <img
          src={watermark.url}
          style={{
            position: 'absolute',
            left: watermark.x,
            top: watermark.y,
            width: watermark.width,
            height: 'auto',
            opacity: watermark.opacity,
          }}
        />
      )}
      {/* Custom text boxes — Phase 64 LOCK-07: hidden flag lives on the text_boxes
          mirror (Phase 49 dual-write contract). Look up by ct.id and skip when
          hidden === true. */}
      {(slide.custom_texts ?? []).filter((ct) => {
        const ctBox = (slide.text_boxes ?? []).find((tb) => tb.id === ct.id)
        return ctBox?.hidden !== true
      }).map((ct) => {
        const resolvedCt = resolved.customTexts.find(rc => rc.id === ct.id)
        const ctEffects = resolvedCt ? satoriEffectStyles(resolvedCt.resolvedEffects) : {}
        const ctHighlight = resolvedCt ? satoriHighlightStyle(resolvedCt.resolvedEffects) : null
        const ctBaseColor = ct.color ?? textColor
        return (
          <div
            key={ct.id}
            style={{
              position: 'absolute',
              left: pxX(ct.x),
              top: pxY(ct.y),
              width: pxX(ct.width),
              display: 'flex',
              flexWrap: 'wrap',
              textAlign: ct.text_align ?? 'left',
              fontSize: ct.font_size ?? 48,
              fontWeight: ct.font_weight ?? 400,
              fontStyle: ct.font_style ?? 'normal',
              lineHeight: 1.3,
              color: ctBaseColor,
              fontFamily: ct.font_family ?? template.fontFamily,
              ...ctEffects,
              ...(ctHighlight ?? {}),
            }}
          >
            {resolvedCt?.resolvedEffects.highlight?.enabled &&
            resolvedCt.resolvedEffects.highlight.style === 'tight'
              ? // quick-260517-iiy: per-line tight pills — shared with canvas/HTML.
                renderTightHighlight(
                  ct.text,
                  ct.segments,
                  ct.list_type,
                  ct.list_indent,
                  ctBaseColor,
                  accentColor,
                  resolvedCt.resolvedEffects.highlight,
                  ct.text_align,
                )
              : renderTextBlock(ct.text, ct.segments, ct.list_type, ct.list_indent, ctBaseColor, accentColor)}
          </div>
        )
      })}
      {/* Forced free-tier watermark (260427-wmk). Rendered last so it sits on top in Satori DOM order. */}
      {forced && (
        <div
          style={{
            position: 'absolute',
            left: forced.x,
            top: forced.y,
            display: 'flex',
            alignItems: 'center',
            opacity: forced.opacity,
          }}
        >
          <img
            src={forcedLogoUrl}
            style={{
              width: forced.logoSize,
              height: forced.logoSize,
              objectFit: 'contain',
              marginRight: forced.gap,
            }}
          />
          <div
            style={{
              fontSize: forced.fontSize,
              fontWeight: 700,
              color: forced.textColor,
              textShadow: forced.textShadow,
              letterSpacing: -0.2,
              lineHeight: 1,
            }}
          >
            {forced.text}
          </div>
        </div>
      )}
    </div>
  )
}
