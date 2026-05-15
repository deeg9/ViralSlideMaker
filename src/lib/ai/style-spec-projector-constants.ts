// quick-260515-i56 — SINGLE source of truth for caption-bar-bottom positioning.
//
// =====================================================================
// CONTRACT (load-bearing — DO NOT VIOLATE):
// =====================================================================
// The y-band values declared here back BOTH:
//
//   1. The AI ARCHETYPE GUIDANCE block in src/lib/ai/prompts.ts (the
//      `case 'caption-bar-bottom':` branch interpolates the ranges into
//      the system prompt).
//   2. The projector's caption-bar-bottom y-override branch in
//      src/lib/ai/style-spec-projector.ts (the projected `hook_position` /
//      `body_position` y values must fall inside the published ranges).
//
// Updating either consumer in isolation will break the
// projector-output-must-sit-in-prompted-band invariant tested by
// style-spec-projector-caption-bar-bottom.test.ts and prompts.test.ts —
// the test imports the SAME constants the runtime imports, so any drift
// trips the suites. Whenever a y-band needs to move, change it HERE; both
// consumers re-read on the next call.
//
// A grep-gate inside prompts.test.ts asserts the literal numbers 70 / 76
// / 82 / 88 NEVER appear as raw integer literals inside prompts.ts — they
// must only flow through `CAPTION_BAR_BOTTOM_HOOK_Y_RANGE[0..1]` etc.
// =====================================================================
//
// =====================================================================
// WHY THESE EXACT VALUES:
// =====================================================================
//   - The magazine-bold template's bottom card occupies the lower 38% of
//     the canvas (matches render-slide-satori bottom card geometry +
//     CAPTION_HEIGHT_FRACTIONS closed-enum default at the validator).
//   - Today (pre-fix) the AI emits hook y=66.83 / body y=78.57 for this
//     archetype — both clearly OUTSIDE the dark bar's top edge (y=62).
//     DB-confirmed on project ae0ca070-058f-4fe9-85f5-5190b425c6bf.
//   - Diego's manual correction lands hook≈72-75 and body≈84-86. The
//     centered-in-bar math (25% / 60% of bar height past the top edge)
//     reproduces that placement.
//   - For default heightFraction=0.38: barTopY=62 → hookY=71.5,
//     bodyY=84.8 — both inside the published [70,76] / [82,88] bands.
//   - For heightFraction=0.4 (the closed-enum next-up value):
//     barTopY=60 → hookY=70.0, bodyY=84.0 — also inside the bands.
// =====================================================================

/**
 * Default height-fraction used by the projector when the spec omits
 * caption.heightFraction. Matches the magazine-bold template's
 * `image-with-bottom-card` bottom-card geometry (38% of the canvas).
 * NOT a member of CAPTION_HEIGHT_FRACTIONS (the closed-enum surface for
 * spec extraction) — this is the internal fallback applied AFTER the
 * Phase-B validator runs. The fallback is what fires when the validator
 * silently drops an out-of-enum value, OR when the upstream extractor
 * declines to commit on the slot.
 */
export const CAPTION_BAR_BOTTOM_DEFAULT_HEIGHT_FRACTION = 0.38

/**
 * Horizontal anchor for both hook + body text boxes in the
 * caption-bar-bottom layout. Percent (0..100). x=11 + width=78 + 11
 * = 100 — visually centered on x=50 with a 22% margin split evenly
 * across both sides. Matches Diego's manual correction position.
 */
export const CAPTION_BAR_BOTTOM_X = 11

/**
 * Width for both hook + body text boxes in the caption-bar-bottom
 * layout. Percent (0..100). See CAPTION_BAR_BOTTOM_X for the geometry
 * rationale.
 */
export const CAPTION_BAR_BOTTOM_WIDTH = 78

/**
 * Published inclusive y-range for hook text in the caption-bar-bottom
 * layout. Percent (0..100, from top). The AI prompt interpolates these
 * bounds into the ARCHETYPE GUIDANCE so Gemini steers in-band; the
 * projector then deterministically overrides whatever Gemini returned
 * with computeCaptionBarBottomPositions output (belt-and-suspenders).
 */
export const CAPTION_BAR_BOTTOM_HOOK_Y_RANGE = [70, 76] as const

/**
 * Published inclusive y-range for body text in the caption-bar-bottom
 * layout. Percent (0..100, from top). See CAPTION_BAR_BOTTOM_HOOK_Y_RANGE.
 */
export const CAPTION_BAR_BOTTOM_BODY_Y_RANGE = [82, 88] as const

/**
 * Compute the centered-in-bar hook + body positions for the
 * caption-bar-bottom layout given a heightFraction.
 *
 * Math:
 *   barTopY = (1 - heightFraction) * 100
 *   hookY   = barTopY + (heightFraction * 100) * 0.25   // 25% into the bar
 *   bodyY   = barTopY + (heightFraction * 100) * 0.60   // 60% into the bar
 *
 * Rounded to 1 decimal place so the projector output is stable across
 * float-precision quirks (purity contract). Pure / deterministic.
 *
 * @param heightFraction Optional caption-bar height fraction (0..1). When
 *   undefined, falls back to CAPTION_BAR_BOTTOM_DEFAULT_HEIGHT_FRACTION.
 */
export function computeCaptionBarBottomPositions(
  heightFraction?: number,
): {
  hook: { x: number; y: number; width: number }
  body: { x: number; y: number; width: number }
} {
  const hf = heightFraction ?? CAPTION_BAR_BOTTOM_DEFAULT_HEIGHT_FRACTION
  const barTopY = (1 - hf) * 100
  const barHeightPct = hf * 100
  const hookY = Math.round((barTopY + barHeightPct * 0.25) * 10) / 10
  const bodyY = Math.round((barTopY + barHeightPct * 0.6) * 10) / 10
  return {
    hook: { x: CAPTION_BAR_BOTTOM_X, y: hookY, width: CAPTION_BAR_BOTTOM_WIDTH },
    body: { x: CAPTION_BAR_BOTTOM_X, y: bodyY, width: CAPTION_BAR_BOTTOM_WIDTH },
  }
}
