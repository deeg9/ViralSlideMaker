// quick-260519-hym — deterministic caption-card -> headline text-box snap.
//
// =====================================================================
// WHY THIS MODULE EXISTS
// =====================================================================
// When a generated slide has a caption card enabled (`caption_bar_enabled
// === true`), the headline (hook) text box must sit OVER the card — not
// float independently of it. A prompt rule cannot enforce this reliably;
// the fix is a deterministic snap. Code owns the geometry, Gemini owns the
// words.
//
// The headline box geometry is derived ENTIRELY from the caption card:
//  - horizontally inset by `CAPTION_CARD_INSET_PX` (so width == the box the
//    headline auto-fit sized the font against — a narrower box would wrap to
//    extra lines and overflow the card),
//  - vertically anchored at the card's CENTER (`hook_position.y`); the three
//    render paths pair this with `transform: translateY(-50%)` for exact
//    vertical centering regardless of how many lines the headline wraps to.
//
// `captionCardHeadlineBox` (src/lib/render/hook-fit.ts) is the SINGLE source
// of truth for that geometry — the same helper the renderers call — so the
// baked `hook_position` / `hook_width` always agree with what every render
// path produces (TPLREND-05).
//
// Pure module — no I/O, no Gemini, never throws.
// =====================================================================

import {
  CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT,
  captionCardHeadlineBox,
  type CaptionCardGeometry,
} from '@/lib/render/hook-fit'

/** Default caption-card height, percent of the 1920 frame. Mirrors the
 *  renderer's `resolveCaptionBar` final fallback when no template default
 *  is supplied (`CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT` = 38). */
const DEFAULT_CAPTION_HEIGHT_PCT = CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT

/** Loose style-overrides shape the snap reads/writes. Kept structural so the
 *  helper composes with both the Zod-inferred `SlideContent` shape and the
 *  renderer-side `Slide` shape. */
interface LooseStyleOverrides {
  caption_bar_enabled?: unknown
  caption_bar_height_pct?: unknown
  caption_bar_y?: unknown
  caption_bar_x?: unknown
  caption_bar_width?: unknown
  caption_bar_position?: unknown
  [k: string]: unknown
}

/** Structural subset of `SlideTemplate` the snap reads — the
 *  `captionCardDefaults` block carries the per-template caption-card height
 *  baseline (news-oracle / chrome-pulse ship `heightPct: 42`). When omitted,
 *  the snap falls back to the global default and behavior matches pre-fix. */
interface LooseTemplateForSnap {
  captionCardDefaults?: {
    heightPct?: number
    [k: string]: unknown
  }
}

/**
 * Derive the caption card's geometry from a slide's `style_overrides`,
 * EXACTLY as the renderer's `resolveCaptionBar` does — so the snap targets the
 * same card the renderer draws.
 *
 * The fallback chain for `heightPct` mirrors `resolveCaptionBar`
 * (`resolve-overlay.ts:543-547`): explicit per-slide override → template
 * default → global reference. When `template` is omitted, the template-default
 * step is skipped — preserving the original snap behavior so existing test
 * callers stay byte-identical.
 */
function deriveCaptionCardGeometry(
  o: LooseStyleOverrides,
  template?: LooseTemplateForSnap,
): CaptionCardGeometry {
  const heightPct =
    typeof o.caption_bar_height_pct === 'number'
      ? o.caption_bar_height_pct
      : typeof template?.captionCardDefaults?.heightPct === 'number'
        ? template.captionCardDefaults.heightPct
        : DEFAULT_CAPTION_HEIGHT_PCT
  const position: 'bottom' | 'top' =
    o.caption_bar_position === 'top' ? 'top' : 'bottom'
  const y =
    typeof o.caption_bar_y === 'number'
      ? o.caption_bar_y
      : position === 'top'
        ? 0
        : 100 - heightPct
  const x = typeof o.caption_bar_x === 'number' ? o.caption_bar_x : 0
  const width =
    typeof o.caption_bar_width === 'number' ? o.caption_bar_width : 100
  return { x, y, width, heightPct }
}

/** Options for {@link snapHeadlineToCaptionCard}. */
export interface SnapHeadlineOptions {
  /**
   * When true, every slide whose `caption_bar_enabled` key is ABSENT
   * (`== null`) is stamped with `caption_bar_enabled: true` BEFORE the snap.
   *
   * WHY: the renderer's `resolveCaptionBar` (resolve-overlay.ts) auto-seeds an
   * enabled caption card for news-layout slides at RENDER time even when the
   * persisted data carries no `caption_bar_*` keys (the quick-260518-8o0 news
   * black-headline-backdrop migration). The snap fires only on the EXPLICIT
   * `caption_bar_enabled === true` flag, so for a NEW news generation to be
   * snapped, generation must first STAMP that flag — making the auto-seeded
   * card explicit in the persisted data. An explicit `caption_bar_enabled:
   * false` is left untouched (absent != false).
   *
   * Pass this only for `category === 'news'`. Non-news slides have no caption
   * card unless one was explicitly enabled.
   */
  stampNewsDefault?: boolean

  /**
   * Optional template — when supplied, the snap reads
   * `template.captionCardDefaults?.heightPct` as the per-template fallback
   * before the global 38. This fixes the Y drift between snap and renderer
   * on templates that ship a non-default card height (news-oracle and
   * chrome-pulse ship `heightPct: 42` — without this, the hook center
   * lands ~2% below the actual card center). When omitted, behavior is
   * byte-identical to the pre-fix snap.
   */
  template?: LooseTemplateForSnap
}

/**
 * Snap the headline (hook) text box of every caption-card slide into the
 * caption card's geometry.
 *
 * Per slide:
 *  - If `stampNewsDefault` is set AND the slide's `caption_bar_enabled` key is
 *    absent (`== null`), the flag is stamped `true`.
 *  - The snap then triggers ONLY on `caption_bar_enabled === true` (strict
 *    equality). When NOT enabled the slide is returned UNCHANGED — no
 *    `hook_position` injected, so a non-caption-card slide stays byte-identical
 *    to pre-change. An explicit `caption_bar_enabled: false` never triggers.
 *  - When enabled, the card geometry is derived the SAME way the renderer's
 *    `resolveCaptionBar` does, and `captionCardHeadlineBox` produces the
 *    headline box: `hook_position` = { card-inset x, card-CENTER y },
 *    `hook_width` = the card-inset width. The renderers re-derive the same box
 *    and pair the centre `y` with `translateY(-50%)`.
 *
 * Pure — never throws. Returns a new array of (possibly-new) slide objects;
 * the input slides are never mutated.
 */
export function snapHeadlineToCaptionCard<
  T extends { style_overrides?: Record<string, unknown> | undefined },
>(slides: T[], options?: SnapHeadlineOptions): T[] {
  const stampNewsDefault = options?.stampNewsDefault === true

  return slides.map((slide) => {
    const overrides: LooseStyleOverrides = { ...(slide.style_overrides ?? {}) }

    // News-stamp: make the renderer's auto-seeded news card EXPLICIT. Only
    // fires when the key is absent — an explicit `false` is preserved.
    if (stampNewsDefault && overrides.caption_bar_enabled == null) {
      overrides.caption_bar_enabled = true
    }

    // Trigger on a strict `=== true` flag only.
    if (overrides.caption_bar_enabled !== true) {
      // Not an enabled caption card. If the news-stamp changed nothing, return
      // the original slide untouched (byte-identity).
      if (!stampNewsDefault) return slide
      return { ...slide, style_overrides: overrides as Record<string, unknown> }
    }

    const card = deriveCaptionCardGeometry(overrides, options?.template)
    const box = captionCardHeadlineBox(card)

    return {
      ...slide,
      style_overrides: {
        ...overrides,
        hook_position: { x: box.xPct, y: box.yCenterPct },
        hook_width: box.widthPct,
      } as Record<string, unknown>,
    }
  })
}
