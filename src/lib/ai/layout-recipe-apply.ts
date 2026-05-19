// Phase 85 Plan 01 (RECGEN-01):
// applyLayoutRecipe — the deterministic recipe-application core of v2.14
// Recipe-Driven Generation. Projects a validated LayoutRecipe (Phase 84)
// into the EXISTING SlideStyleOverrides shape on each generated slide so a
// carousel comes out pre-shaped: per-slide caption-card geometry, hook
// position/size, and text alignment match the recipe.
//
// This is a NEW module — it deliberately does NOT extend
// style-spec-projector.ts. That file is the StyleSpec/reference path; the
// recipe path stays separable (85-CONTEXT.md "Recipe Application Mechanism").
//
// =====================================================================
// CONTRACT (load-bearing — DO NOT VIOLATE):
// =====================================================================
//   - Pure function: same (slides, recipe) → byte-identical JSON output
//     across N calls. No I/O, no Date.now, no random, no console, no
//     Gemini SDK, no Supabase, no React imports.
//   - Immutable: never mutates the input slides or their style_overrides.
//   - Zero Gemini calls — O(slides) pure deterministic code.
//   - No-op early-return: a null/undefined recipe returns the input slides
//     unchanged. This is the SC3 back-compat guarantee — a flat-style-only
//     (no-recipe) generation is byte-identical to the pre-Phase-85 baseline.
//   - Zero new slide/render fields: writes ONLY into existing
//     SlideStyleOverrides keys (caption_bar_*, hook_position,
//     hook_font_size, text_align). The slide schema is frozen — the
//     slide-zero-new-fields test must stay green.
//   - Skip-emit semantics: when a recipe role / slot is absent, emit NO
//     overrides for it — the slide passes through with its existing
//     style_overrides untouched.
//   - accessory_label TEXT is NEVER written here — it is Gemini-authored
//     (Phase 82 R5). The recipe's accessory-label INTENT is conveyed via
//     the buildSystemPrompt hint block, not by this module.
//   - accent_cadence is a PROMPT hint only — applyLayoutRecipe does NOT
//     deterministically force hook_segments positions.
//   - Geometry maps deterministically; band fields resolve to numeric via
//     the resolver tables below — band values are never LLM-guessed.
// =====================================================================

import type { Slide } from '@/lib/types/slide'
import type {
  LayoutRecipe,
  RoleLayout,
  RecipeRole,
  HookPositionBand,
  HookFontSizeBand,
} from '@/lib/types/layout-recipe'

// =====================================================================
// Band → numeric resolvers. Keyed by the imported closed-enum union types
// so a new band value is a COMPILE error (closed-enum invariant). The
// recipe stores hook placement as coarse bands (85-CONTEXT.md); generation
// needs concrete numbers, so each band maps to a representative value.
// =====================================================================

/**
 * Hook vertical-placement band → vertical percent (0..100, from top).
 * A 5-band split of the vertical axis at representative midpoints.
 */
const HOOK_POSITION_BAND_Y: Record<HookPositionBand, number> = {
  top: 8,
  upper: 28,
  center: 46,
  lower: 66,
  bottom: 84,
}

/**
 * Hook font-size band → px value. Coarse t-shirt sizing consistent with
 * the existing news-headline range (~124px default sits between md and lg).
 */
const HOOK_FONT_SIZE_BAND_PX: Record<HookFontSizeBand, number> = {
  sm: 88,
  md: 112,
  lg: 140,
  xl: 176,
}

/** Default horizontal anchor for a recipe-resolved hook position (centered). */
const DEFAULT_HOOK_X = 50

// =====================================================================
// Role mapping — SAME position + is_cta logic as Phase 84 extraction
// (85-CONTEXT.md). Slide 0 → cover, any is_cta:true slide → cta, the rest
// → body. This is intentionally NOT assignSlideRoles() from
// role-distribution.ts — that is the unrelated 5-value
// cover/reframe/support/pivot/close content-role enum.
// =====================================================================

/** Resolve which recipe role a generated slide is shaped by. */
function recipeRoleForSlide(slide: Slide, index: number): RecipeRole {
  if (index === 0) return 'cover'
  if (slide.is_cta === true) return 'cta'
  return 'body'
}

// =====================================================================
// Per-role projection — maps one RoleLayout into a partial
// SlideStyleOverrides patch. Returns an empty object when the role carries
// no projectable slots (skip-emit).
// =====================================================================

/**
 * Build the style_overrides patch for one slide from its recipe role.
 * Pure — returns a fresh object, reads nothing outside its arguments.
 */
function projectRoleLayout(
  role: RoleLayout,
  existing: Slide['style_overrides'],
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}

  // Caption-card geometry → caption_bar_* (1:1, numeric, skip-emit when
  // the recipe role carries no caption_card slot).
  const cc = role.caption_card
  if (cc) {
    patch.caption_bar_enabled = cc.enabled
    patch.caption_bar_x = cc.x
    patch.caption_bar_y = cc.y
    patch.caption_bar_width = cc.width
    patch.caption_bar_height_pct = cc.height_pct
    patch.caption_bar_blend_pct = cc.blend_pct
    patch.caption_bar_opacity = cc.opacity
    patch.caption_bar_position = cc.position
  }

  // Hook placement → numeric hook_position / hook_font_size / text_align.
  // Bands resolve via the deterministic tables above.
  const hook = role.hook
  if (hook) {
    const resolvedY = HOOK_POSITION_BAND_Y[hook.position_band]
    // Preserve any existing horizontal anchor; default to centered.
    const existingX = existing?.hook_position?.x
    patch.hook_position = {
      x: typeof existingX === 'number' ? existingX : DEFAULT_HOOK_X,
      y: resolvedY,
    }
    patch.hook_font_size = HOOK_FONT_SIZE_BAND_PX[hook.font_size_band]
    patch.text_align = hook.text_align
  }

  // accessory_label: INTENT only — the slot/text stays Gemini-authored
  // (Phase 82 R5). applyLayoutRecipe intentionally writes NOTHING for it;
  // the recipe's accessory-label band is conveyed through the prompt hint.

  return patch
}

// =====================================================================
// applyLayoutRecipe — public entry point.
// =====================================================================

/**
 * Apply a validated LayoutRecipe to a generated carousel's slides.
 *
 * Deterministic, pure, zero-Gemini. When `recipe` is null/undefined the
 * input `slides` are returned unchanged (the no-recipe back-compat path —
 * a flat-style-only generation is byte-identical to pre-Phase-85). When a
 * recipe is present, each slide's role is resolved by position + is_cta
 * and the matching role's geometry is merged into the slide's
 * style_overrides (recipe values override template defaults; existing
 * style_overrides keys the recipe does not touch are preserved).
 *
 * @param slides  The generated, validated-and-repaired slides.
 * @param recipe  The resolved LayoutRecipe, or null when the template
 *                carries no recipe.
 * @returns       A new slides array (new objects) — or the input array
 *                unchanged on the no-recipe path.
 */
export function applyLayoutRecipe(
  slides: Slide[],
  recipe: LayoutRecipe | null | undefined,
): Slide[] {
  // No-op early-return — SC3 back-compat guarantee.
  if (!recipe) return slides

  return slides.map((slide, index) => {
    const roleKey = recipeRoleForSlide(slide, index)
    const role = recipe.roles[roleKey]
    // Skip-emit: a recipe role may be entirely absent (short carousels,
    // partial recipes). The slide passes through untouched.
    if (!role) return slide

    const patch = projectRoleLayout(role, slide.style_overrides)
    // Nothing projectable on this role → leave the slide untouched.
    if (Object.keys(patch).length === 0) return slide

    // Merge: existing style_overrides first, then recipe patch wins.
    return {
      ...slide,
      style_overrides: {
        ...(slide.style_overrides ?? {}),
        ...patch,
      },
    }
  })
}
