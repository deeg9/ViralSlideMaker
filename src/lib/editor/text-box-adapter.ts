/**
 * Phase 49: Adapter between the legacy slide shape (hook_text + body_text + custom_texts +
 * style_overrides.hook_/body_ fields) and the unified `TextBox[]` model.
 *
 * Two pure functions:
 *   - legacyToTextBoxes(slide): derive a TextBox[] from a legacy slide
 *   - textBoxesToLegacy(boxes): inverse — produce the legacy slice that, when merged onto the
 *     original slide, reconstructs identical shape (modulo TextBox.id).
 *
 * Used by:
 *   - eager migration on slide load (slide-editor.tsx initialization path)
 *   - dual-write on save (legacy fields kept populated through v2.8 → sunset target v2.9)
 *
 * No React or state coupling; safe to call from any layer.
 */

import type {
  Slide,
  CustomText,
  SlideStyleOverrides,
  TextBox,
  TextBoxPosition,
  TextEffects,
  TextSegment,
} from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates'
// quick-260520-064: shared geometry + live-caption-card-Y helper. The adapter
// uses these to inject the news-oracle 'BREAKING NEWS' 'ruled' kicker at the
// exact pixel position the deleted chrome painted (D4 parity), honoring
// LIVE user edits to the caption card (Blocker 1 fix).
import {
  RULED_HIGHLIGHT,
  ruledHighlightTopPctFromCaptionCardY,
  liveCaptionCardTopPct,
} from '@/lib/render/ruled-highlight'

// -----------------------------------------------------------------------------
// legacyToTextBoxes
// -----------------------------------------------------------------------------

/**
 * Phase 82 (R5): font size (px in the 1080x1920 reference) for the small
 * accessory-label kicker box. Deliberately small so the headline stays the
 * dominant element — matches the reference kicker labels ("NEWS", "VIDEO: ICE").
 */
const ACCESSORY_LABEL_FONT_SIZE = 32

function hookPosition(slide: Slide): TextBoxPosition {
  const overrides = slide.style_overrides
  if (overrides?.hook_position) {
    return {
      anchor: 'custom',
      x: overrides.hook_position.x,
      y: overrides.hook_position.y,
      ...(overrides.hook_width !== undefined ? { width: overrides.hook_width } : {}),
    }
  }
  const anchor = overrides?.text_position ?? 'top'
  return {
    anchor,
    ...(overrides?.hook_width !== undefined ? { width: overrides.hook_width } : {}),
  }
}

function bodyPosition(slide: Slide): TextBoxPosition {
  const overrides = slide.style_overrides
  if (overrides?.body_position) {
    return {
      anchor: 'custom',
      x: overrides.body_position.x,
      y: overrides.body_position.y,
      ...(overrides.body_width !== undefined ? { width: overrides.body_width } : {}),
    }
  }
  // Body's anchor mirrors slide-level text_position when set; otherwise defaults 'bottom'.
  const anchor = overrides?.text_position ?? 'bottom'
  return {
    anchor,
    ...(overrides?.body_width !== undefined ? { width: overrides.body_width } : {}),
  }
}

function customTextToBox(ct: CustomText): TextBox {
  return {
    id: ct.id,
    role: 'custom',
    text: ct.text,
    ...(ct.segments !== undefined ? { segments: ct.segments } : {}),
    ...(ct.font_family !== undefined ? { font_family: ct.font_family } : {}),
    ...(ct.font_size !== undefined ? { font_size: ct.font_size } : {}),
    ...(ct.font_weight !== undefined ? { font_weight: ct.font_weight } : {}),
    ...(ct.font_style !== undefined ? { font_style: ct.font_style } : {}),
    ...(ct.color !== undefined ? { color: ct.color } : {}),
    ...(ct.text_align !== undefined ? { text_align: ct.text_align } : {}),
    ...(ct.text_effects !== undefined ? { effects: ct.text_effects } : {}),
    position: { anchor: 'custom', x: ct.x, y: ct.y, width: ct.width },
  }
}

/**
 * Derive a TextBox[] from a legacy slide shape.
 *
 * Order:
 *   - Index 0: hook (role='hook')
 *   - Index 1: body (role='body')
 *   - Index 2+: each custom_text in original order, mapped to role='custom'
 *
 * quick-260520-064: optional `template` parameter. When passed AND the slide is
 * a news-oracle cover, the adapter applies the D1 fallback:
 *   - `accessory_label === undefined` + captionCardEnabled → inject
 *     `'BREAKING NEWS'` `'ruled'` kicker (replacing the deleted chrome).
 *   - `accessory_label === ''` → user opt-out, no kicker.
 *   - `accessory_label === 'EXCLUSIVE'` (or any non-empty string) → custom
 *     `'ruled'` kicker carrying the user's text.
 * Existing one-arg callers (30+ test files) continue to receive byte-identical
 * output because the template-aware branches are gated on `template !== undefined`.
 */
export function legacyToTextBoxes(slide: Slide, template?: SlideTemplate): TextBox[] {
  const overrides = slide.style_overrides
  const boxes: TextBox[] = []

  const hook: TextBox = {
    id: crypto.randomUUID(),
    role: 'hook',
    text: slide.hook_text ?? '',
    ...(slide.hook_segments !== undefined ? { segments: slide.hook_segments } : {}),
    ...(overrides?.hook_font_family !== undefined ? { font_family: overrides.hook_font_family } : {}),
    ...(overrides?.hook_font_size !== undefined ? { font_size: overrides.hook_font_size } : {}),
    // quick-260515-nhf: hydrate the per-box casing override from the
    // persisted slide-level override so a saved slide round-trips.
    ...(overrides?.hook_text_transform !== undefined ? { text_transform: overrides.hook_text_transform } : {}),
    ...(overrides?.hook_font_weight !== undefined ? { font_weight: overrides.hook_font_weight } : {}),
    ...(overrides?.hook_font_style !== undefined ? { font_style: overrides.hook_font_style } : {}),
    ...(overrides?.hook_text_color !== undefined ? { color: overrides.hook_text_color } : {}),
    ...(overrides?.text_align !== undefined ? { text_align: overrides.text_align } : {}),
    ...(overrides?.hook_text_effects !== undefined ? { effects: overrides.hook_text_effects } : {}),
    position: hookPosition(slide),
  }
  boxes.push(hook)

  // Phase 82 (R4): body_text is optional — headline-only slides are
  // first-class. Only emit a body TextBox when body_text is a non-empty
  // string. An absent/empty body produces NO body box (the headline box is
  // still emitted). Slides that DO carry body_text behave exactly as before
  // (pre-Phase-82 byte-identity preserved).
  if (typeof slide.body_text === 'string' && slide.body_text.length > 0) {
    const body: TextBox = {
      id: crypto.randomUUID(),
      role: 'body',
      text: slide.body_text,
      ...(slide.body_segments !== undefined ? { segments: slide.body_segments } : {}),
      ...(overrides?.body_font_family !== undefined ? { font_family: overrides.body_font_family } : {}),
      ...(overrides?.body_font_size !== undefined ? { font_size: overrides.body_font_size } : {}),
      ...(overrides?.body_font_weight !== undefined ? { font_weight: overrides.body_font_weight } : {}),
      ...(overrides?.body_font_style !== undefined ? { font_style: overrides.body_font_style } : {}),
      ...(overrides?.body_text_color !== undefined ? { color: overrides.body_text_color } : {}),
      ...(overrides?.text_align !== undefined ? { text_align: overrides.text_align } : {}),
      ...(overrides?.body_text_effects !== undefined ? { effects: overrides.body_text_effects } : {}),
      position: bodyPosition(slide),
    }
    boxes.push(body)
  }

  if (slide.custom_texts && slide.custom_texts.length > 0) {
    for (const ct of slide.custom_texts) {
      boxes.push(customTextToBox(ct))
    }
  }

  // Phase 82 (R5) + quick-260520-064: accessory_label → custom-anchor TextBox.
  //
  // quick-260519-pbg (legacy precedent): when accessory_label is a non-empty
  // string, render as a small top-CENTER custom kicker with a tight black
  // highlight pill + white text (the TR3NDING pill aesthetic).
  //
  // quick-260520-064 (current): on news-oracle covers we replace the deleted
  // BREAKING NEWS chrome with an adapter-injected 'ruled' kicker that paints
  // pixel-for-pixel identically to the chrome:
  //   - accessory_label === undefined + captionCardEnabled → inject
  //     "BREAKING NEWS" (D1 fallback; matches the chrome's cc.enabled gate).
  //   - accessory_label === '' → user opt-out, NO kicker.
  //   - accessory_label === 'EXCLUSIVE' (any non-empty string) → carry the
  //     user's text, 'ruled' style on news-oracle covers, 'tight' elsewhere.
  // Other templates (no template passed, OR a non-news-oracle template) keep
  // the pre-change behavior byte-identically — back-compat for 30+ existing
  // test callers and the tr3nding-news / chrome-pulse / sunset-tabloid covers.
  // `slide.role` is set at the validator boundary but not declared on the
  // `Slide` interface — read defensively via a structural cast. This mirrors
  // how slide-preview.tsx / render-slide.ts / render-slide-satori.tsx already
  // consume it (the pre-existing TS errors on those files come from the same
  // gap; this read stays consistent with that established pattern).
  const slideRole = (slide as { role?: string }).role
  const isNewsOracleCover =
    template?.id === 'news-oracle' && slideRole === 'cover'
  const o = slide.style_overrides
  // Blocker 2 (cc.enabled gate): mirror the chrome's gate so toggling the
  // caption card OFF also removes the kicker. For news-oracle (which has
  // backgroundMode == null), the chrome's isNewsLayoutSlide reduced to
  // `o.layout != null`, so the chrome was visible iff:
  //   o.caption_bar_enabled === true ||
  //   (o.caption_bar_enabled == null && o.layout != null)
  const captionCardEnabled =
    o?.caption_bar_enabled === true ||
    (o?.caption_bar_enabled == null && o?.layout != null)

  function pushAccessoryLabelBox(
    text: string,
    style: 'tight' | 'ruled',
  ): void {
    if (style === 'ruled' && template) {
      // D4 geometry preset for news-oracle cover.
      // Blocker 1 fix: compute the LIVE caption-card top % (honors user drags /
      // height edits / top-position flips), NOT a frozen template default.
      // liveCaptionCardTopPct mirrors resolveCaptionBar's Y math (see
      // src/lib/render/resolve-overlay.ts:543-572).
      const cardTopPct = liveCaptionCardTopPct(slide.style_overrides, template)
      const y = ruledHighlightTopPctFromCaptionCardY(cardTopPct)
      boxes.push({
        id: crypto.randomUUID(),
        role: 'custom',
        text,
        font_family: template.headingFontFamily ?? template.fontFamily,
        font_size: RULED_HIGHLIGHT.fontSizePx,
        font_weight: template.hookFontWeight ?? 400,
        text_transform: 'uppercase',
        text_align: 'center',
        color: template.textColor,
        effects: {
          highlight: {
            enabled: true,
            // Informational — the renderers paint the rules using tb.color
            // (Warning 4), not highlight.color. Setting highlight.color to
            // textColor here keeps the resolved style consistent for any
            // future consumer that reads it.
            color: template.textColor,
            style: 'ruled',
            padding: 16,
          },
        },
        // y is the LIVE Y derived from the caption card; x: 0, width: 100
        // matches the deleted chrome's full-bleed flex row.
        position: { anchor: 'custom', x: 0, y, width: 100 },
      })
      return
    }
    // 'tight' fallback — the existing TR3NDING-pill default (unchanged).
    boxes.push({
      id: crypto.randomUUID(),
      role: 'custom',
      text: text.toUpperCase(),
      font_size: ACCESSORY_LABEL_FONT_SIZE,
      text_transform: 'uppercase',
      text_align: 'center',
      color: '#FFFFFF',
      effects: {
        highlight: {
          enabled: true,
          color: '#000000CC',
          style: 'tight',
          padding: 8,
        },
      },
      position: { anchor: 'custom', x: 20, y: 3, width: 60 },
    })
  }

  const label = slide.accessory_label
  if (label === undefined && isNewsOracleCover && captionCardEnabled) {
    // D1 fallback — default 'BREAKING NEWS' kicker for the news-oracle cover
    // (only when the caption card itself would render — Blocker 2).
    pushAccessoryLabelBox('BREAKING NEWS', 'ruled')
  } else if (typeof label === 'string' && label.length > 0) {
    // Explicit string — 'ruled' on news-oracle covers, 'tight' elsewhere
    // (including the case where `template` is omitted — back-compat).
    const style: 'tight' | 'ruled' = isNewsOracleCover ? 'ruled' : 'tight'
    pushAccessoryLabelBox(label, style)
  }
  // label === '' → user opt-out, do nothing.
  // label === undefined && !isNewsOracleCover → do nothing (zero new boxes
  // for non-news-oracle covers — preserves back-compat for chrome-pulse /
  // tr3nding-news / sunset-tabloid + every legacy test caller).
  // label === undefined && isNewsOracleCover && !captionCardEnabled → no
  // kicker (Blocker 2: chrome was hidden, kicker is hidden too).

  return boxes
}

// -----------------------------------------------------------------------------
// textBoxesToLegacy
// -----------------------------------------------------------------------------

export interface LegacySlice {
  hook_text: string
  body_text: string
  hook_segments?: TextSegment[]
  body_segments?: TextSegment[]
  custom_texts?: CustomText[]
  /**
   * Partial style overrides derived from hook + body TextBoxes. Caller deep-merges into the
   * existing `slide.style_overrides` to preserve non-text-box fields like `overlay_opacity`,
   * `layout`, and `hide_watermark`.
   */
  style_overrides_patch: Partial<SlideStyleOverrides>
}

function textBoxToCustomText(tb: TextBox): CustomText {
  return {
    id: tb.id,
    text: tb.text,
    x: tb.position.x ?? 0,
    y: tb.position.y ?? 0,
    width: tb.position.width ?? 60,
    ...(tb.font_family !== undefined ? { font_family: tb.font_family } : {}),
    ...(tb.font_size !== undefined ? { font_size: tb.font_size } : {}),
    ...(tb.font_weight !== undefined ? { font_weight: tb.font_weight } : {}),
    ...(tb.font_style !== undefined ? { font_style: tb.font_style } : {}),
    ...(tb.color !== undefined ? { color: tb.color } : {}),
    ...(tb.text_align !== undefined ? { text_align: tb.text_align } : {}),
    ...(tb.effects !== undefined ? { text_effects: tb.effects } : {}),
    ...(tb.segments !== undefined ? { segments: tb.segments } : {}),
  }
}

/**
 * Inverse of legacyToTextBoxes. Returns the legacy slice that, when shallow-merged onto the
 * original slide (with style_overrides_patch deep-merged into style_overrides), reconstructs
 * identical content modulo TextBox.id.
 *
 * Edge cases:
 *   - Missing hook role → hook_text = ''
 *   - Missing body role → body_text = ''
 *   - Multiple boxes with role='hook' → first is canonical, extras are coerced to custom
 *   - role='custom' boxes whose position.anchor !== 'custom' → still emitted as custom_texts
 *     using x/y/width fallbacks (caller is expected to keep anchor='custom' for custom boxes).
 */
export function textBoxesToLegacy(boxes: TextBox[]): LegacySlice {
  const hookBox = boxes.find((b) => b.role === 'hook')
  const bodyBox = boxes.find((b) => b.role === 'body')

  // Custom boxes = everything else (role='custom' OR extra hooks/bodies beyond the first).
  const customBoxes: TextBox[] = []
  let seenHook = false
  let seenBody = false
  for (const b of boxes) {
    if (b.role === 'hook' && !seenHook) {
      seenHook = true
      continue
    }
    if (b.role === 'body' && !seenBody) {
      seenBody = true
      continue
    }
    customBoxes.push(b)
  }

  const slice: LegacySlice = {
    hook_text: hookBox?.text ?? '',
    body_text: bodyBox?.text ?? '',
    style_overrides_patch: {},
  }

  if (hookBox?.segments !== undefined) {
    slice.hook_segments = hookBox.segments
  }
  if (bodyBox?.segments !== undefined) {
    slice.body_segments = bodyBox.segments
  }

  if (customBoxes.length > 0) {
    slice.custom_texts = customBoxes.map(textBoxToCustomText)
  }

  // Derive style_overrides_patch from hook + body TextBoxes.
  const patch: Partial<SlideStyleOverrides> = {}

  if (hookBox) {
    if (hookBox.font_family !== undefined) patch.hook_font_family = hookBox.font_family
    if (hookBox.font_size !== undefined) patch.hook_font_size = hookBox.font_size
    // quick-260515-nhf: dual-write the per-box casing override back to the
    // slide-level override (mirrors hook_font_family / hook_font_size above).
    if (hookBox.text_transform !== undefined) patch.hook_text_transform = hookBox.text_transform
    if (hookBox.font_weight !== undefined) patch.hook_font_weight = hookBox.font_weight
    if (hookBox.font_style !== undefined) patch.hook_font_style = hookBox.font_style
    if (hookBox.color !== undefined) patch.hook_text_color = hookBox.color
    if (hookBox.effects !== undefined) patch.hook_text_effects = hookBox.effects
    if (hookBox.position.width !== undefined) patch.hook_width = hookBox.position.width
    if (hookBox.position.anchor === 'custom') {
      if (hookBox.position.x !== undefined && hookBox.position.y !== undefined) {
        patch.hook_position = { x: hookBox.position.x, y: hookBox.position.y }
      }
    }
  }
  if (bodyBox) {
    if (bodyBox.font_family !== undefined) patch.body_font_family = bodyBox.font_family
    if (bodyBox.font_size !== undefined) patch.body_font_size = bodyBox.font_size
    if (bodyBox.font_weight !== undefined) patch.body_font_weight = bodyBox.font_weight
    if (bodyBox.font_style !== undefined) patch.body_font_style = bodyBox.font_style
    if (bodyBox.color !== undefined) patch.body_text_color = bodyBox.color
    if (bodyBox.effects !== undefined) patch.body_text_effects = bodyBox.effects
    if (bodyBox.position.width !== undefined) patch.body_width = bodyBox.position.width
    if (bodyBox.position.anchor === 'custom') {
      if (bodyBox.position.x !== undefined && bodyBox.position.y !== undefined) {
        patch.body_position = { x: bodyBox.position.x, y: bodyBox.position.y }
      }
    }
  }

  // text_align: the legacy schema had a single slide-level field. The modern
  // text_boxes model has per-box alignment, so we only emit slide-level when
  // hook and body actually match — otherwise hook's value would clobber body's
  // (the user-reported bug: hook.center forced body to also center, and
  // body.right was silently overridden by an existing hook value). When the
  // boxes diverge, the renderers fall back to per-box text_align (hook reads
  // hookBox.text_align, body reads bodyBox.text_align, both with the
  // overrides.text_align → template.textAlign chain as final fallback).
  if (
    hookBox?.text_align !== undefined &&
    hookBox.text_align === bodyBox?.text_align
  ) {
    patch.text_align = hookBox.text_align
  } else if (hookBox === undefined && bodyBox?.text_align !== undefined) {
    // Legacy compat: a slide with only a body box (no hook box) keeps the
    // historical behavior of writing body's alignment to slide-level so the
    // renderer's slide-level fallback picks it up.
    patch.text_align = bodyBox.text_align
  } else if (bodyBox === undefined && hookBox?.text_align !== undefined) {
    // Mirror of the above: hook-only slides keep emitting slide-level.
    patch.text_align = hookBox.text_align
  }

  // text_position: a single slide-level legacy field constrained to 'top'|'center'|'bottom'.
  // Round-trip safety: only emit `text_position` when hook and body share the same non-custom
  // anchor (i.e. their anchor demonstrably came from a slide-level `text_position` setting).
  // Otherwise the inverse would inject a `text_position` that the original slide never had.
  const hookAnchor = hookBox?.position.anchor
  const bodyAnchor = bodyBox?.position.anchor
  if (
    hookAnchor && hookAnchor !== 'custom' &&
    bodyAnchor && bodyAnchor !== 'custom' &&
    hookAnchor === bodyAnchor
  ) {
    patch.text_position = hookAnchor
  }

  slice.style_overrides_patch = patch
  return slice
}

// -----------------------------------------------------------------------------
// Type re-exports for convenience
// -----------------------------------------------------------------------------

export type { TextBox, TextBoxPosition, TextEffects }
