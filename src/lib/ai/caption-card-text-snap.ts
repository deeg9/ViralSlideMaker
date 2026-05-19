// quick-260519-hym — deterministic caption-card -> hook/body text-position snap.
//
// =====================================================================
// WHY THIS MODULE EXISTS
// =====================================================================
// When a generated slide has a caption card enabled (`caption_bar_enabled
// === true`), the headline (hook) text box must sit OVER the card — not
// float independently at the top of the slide. A prompt rule cannot enforce
// this reliably; the fix is a deterministic post-generation snap. Code owns
// the geometry, Gemini owns the words.
//
// `computeCaptionCardTextPositions` is the pure geometry helper: given a
// caption card's geometry it returns the in-card hook/body text positions.
// It mirrors the math of `computeCaptionBarBottomPositions`
// (style-spec-projector-constants.ts) — the SAME 0.25 / 0.60 in-card offset
// ratios and the SAME x / width constants — so the snap never drifts from
// the projector's published source of truth. The byte-equality is asserted
// by Test 2 of caption-card-text-snap.test.ts.
//
// EXTRACTION-READY (CONTEXT.md locked decision): this helper is intentionally
// a pure function over caption-card geometry so the LayoutRecipe path
// (Phase 85 `applyLayoutRecipe`) can adopt it later WITHOUT a rewrite. This
// task does NOT retrofit `applyLayoutRecipe` / the style-spec-projector path
// — a DB recipe already carries caption-card geometry and that path works.
//
// Pure module — no I/O, no Gemini, never throws.
// =====================================================================

import {
  CAPTION_BAR_BOTTOM_X,
  CAPTION_BAR_BOTTOM_WIDTH,
} from './style-spec-projector-constants'

/** Default caption-card height, percent of the 1920 frame. Mirrors the
 *  renderer's `resolveCaptionBar` default
 *  (`CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT` = 38) so the snap targets the
 *  same geometry the renderer produces. */
const DEFAULT_CAPTION_HEIGHT_PCT = 38

/** Round to 1 decimal place — keeps the snap output stable across
 *  float-precision quirks (mirrors `computeCaptionBarBottomPositions`). */
function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export interface CaptionCardGeometry {
  /** Card height, percent of the 1920 frame (10..90). */
  heightPct: number
  /** Card TOP edge, percent (0..100). */
  cardTopY: number
  /** Snap preset — retained for symmetry/clarity (the math is cardTopY-driven). */
  position: 'bottom' | 'top'
}

export interface CaptionCardTextPositions {
  hook: { x: number; y: number; width: number }
  body: { x: number; y: number; width: number }
}

/**
 * Compute the in-card hook + body text positions for a caption card given
 * its geometry. Pure / deterministic — never mutates its argument, never
 * throws.
 *
 * Math (mirrors `computeCaptionBarBottomPositions`):
 *   hookY = round1(cardTopY + heightPct * 0.25)   // hook 25% into the card (top-anchored)
 *   bodyY = round1(cardTopY + heightPct * 0.60)   // body 60% into the card (below the hook)
 *
 * Both offsets are computed from `cardTopY` (NOT `100 - heightPct`), so an
 * explicit `caption_bar_y` is honored verbatim. `position` is accepted for
 * clarity/extension symmetry but needs no per-position branch: a top-snapped
 * card simply has a small `cardTopY`, and the same offsets relative to it
 * still place the headline on top and the body below — so a `'top'` card
 * gets headline-on-top automatically.
 *
 * `x` / `width` are the published `CAPTION_BAR_BOTTOM_X` /
 * `CAPTION_BAR_BOTTOM_WIDTH` constants for both hook and body — REUSED, not
 * redeclared, so the horizontal anchor cannot drift from the projector.
 */
export function computeCaptionCardTextPositions(
  geom: CaptionCardGeometry,
): CaptionCardTextPositions {
  const { heightPct, cardTopY } = geom
  const hookY = round1(cardTopY + heightPct * 0.25)
  const bodyY = round1(cardTopY + heightPct * 0.6)
  return {
    hook: { x: CAPTION_BAR_BOTTOM_X, y: hookY, width: CAPTION_BAR_BOTTOM_WIDTH },
    body: { x: CAPTION_BAR_BOTTOM_X, y: bodyY, width: CAPTION_BAR_BOTTOM_WIDTH },
  }
}

/** Loose style-overrides shape the snap reads/writes. Kept structural so the
 *  helper composes with both the Zod-inferred `SlideContent` shape and the
 *  renderer-side `Slide` shape. */
interface LooseStyleOverrides {
  caption_bar_enabled?: unknown
  caption_bar_height_pct?: unknown
  caption_bar_y?: unknown
  caption_bar_position?: unknown
  [k: string]: unknown
}

/** Options for {@link snapHeadlineToCaptionCard}. */
export interface SnapHeadlineOptions {
  /**
   * When true, every slide whose `caption_bar_enabled` key is ABSENT
   * (`== null`) is stamped with `caption_bar_enabled: true` BEFORE the snap.
   *
   * WHY: the renderer's `resolveCaptionBar` (resolve-overlay.ts) auto-seeds
   * an enabled caption card for news-layout slides at RENDER time even when
   * the persisted data carries no `caption_bar_*` keys (the quick-260518-8o0
   * news black-headline-backdrop migration). The template-agnostic snap fires
   * only on the EXPLICIT `caption_bar_enabled === true` flag, so for a NEW
   * news generation to be snapped, generation must first STAMP that flag —
   * making the auto-seeded card explicit in the persisted data. An explicit
   * `caption_bar_enabled: false` is left untouched (CONTEXT.md locked:
   * absent != false).
   *
   * Pass this only for `category === 'news'`. Non-news slides have no caption
   * card unless one was explicitly enabled — and the snap already handles an
   * explicit `caption_bar_enabled: true` correctly.
   */
  stampNewsDefault?: boolean
}

/**
 * Snap the headline (hook) + body text boxes of every caption-card slide
 * into the caption card's geometry.
 *
 * Per slide:
 *  - If `stampNewsDefault` is set AND the slide's `caption_bar_enabled` key
 *    is absent (`== null`), the flag is stamped `true` (see
 *    {@link SnapHeadlineOptions.stampNewsDefault}).
 *  - The snap then triggers ONLY on `caption_bar_enabled === true` (strict
 *    equality — template-agnostic; no news-layout auto-seed is replicated
 *    here). When NOT enabled the slide is returned UNCHANGED — no
 *    `hook_position` / `body_position` injected, so a non-caption-card slide
 *    stays byte-identical to pre-change (TPLREND-05). An explicit
 *    `caption_bar_enabled: false` therefore never triggers.
 *  - When enabled, the card geometry is derived the SAME way the renderer's
 *    `resolveCaptionBar` does:
 *        heightPct = caption_bar_height_pct ?? 38
 *        position  = caption_bar_position  ?? 'bottom'
 *        cardTopY  = caption_bar_y ?? (position === 'top' ? 0 : 100 - heightPct)
 *    then `computeCaptionCardTextPositions` produces the hook/body positions,
 *    which are written into a NEW `style_overrides` object on a NEW slide
 *    object (the input is never mutated).
 *
 * Pure — never throws. Returns a new array of (possibly-new) slide objects.
 */
export function snapHeadlineToCaptionCard<
  T extends { style_overrides?: Record<string, unknown> | undefined },
>(slides: T[], options?: SnapHeadlineOptions): T[] {
  const stampNewsDefault = options?.stampNewsDefault === true

  return slides.map((slide) => {
    const overrides: LooseStyleOverrides = { ...(slide.style_overrides ?? {}) }

    // News-stamp: make the renderer's auto-seeded news card EXPLICIT so the
    // template-agnostic snap below can read it. Only fires when the key is
    // absent — an explicit `false` is preserved.
    if (stampNewsDefault && overrides.caption_bar_enabled == null) {
      overrides.caption_bar_enabled = true
    }

    // Template-agnostic trigger: strict `=== true` only.
    if (overrides.caption_bar_enabled !== true) {
      // Not an enabled caption card. If the news-stamp did NOT change
      // anything either, return the original slide untouched (byte-identity).
      if (!stampNewsDefault) return slide
      // stampNewsDefault was on but this slide had an explicit non-true flag
      // (e.g. false) — preserve it; nothing to snap.
      return { ...slide, style_overrides: overrides as Record<string, unknown> }
    }

    // Derive the card geometry exactly as `resolveCaptionBar` does.
    const heightPct =
      typeof overrides.caption_bar_height_pct === 'number'
        ? overrides.caption_bar_height_pct
        : DEFAULT_CAPTION_HEIGHT_PCT
    const position: 'bottom' | 'top' =
      overrides.caption_bar_position === 'top' ? 'top' : 'bottom'
    const cardTopY =
      typeof overrides.caption_bar_y === 'number'
        ? overrides.caption_bar_y
        : position === 'top'
          ? 0
          : 100 - heightPct

    const { hook, body } = computeCaptionCardTextPositions({
      heightPct,
      cardTopY,
      position,
    })

    return {
      ...slide,
      style_overrides: {
        ...overrides,
        hook_position: { x: hook.x, y: hook.y },
        body_position: { x: body.x, y: body.y },
        hook_width: hook.width,
        body_width: body.width,
      } as Record<string, unknown>,
    }
  })
}
