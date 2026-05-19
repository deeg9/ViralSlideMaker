// Phase 84 Plan 03 (RECIPE-02):
// extractLayoutRecipe — a PURE, DETERMINISTIC function that turns a source
// carousel's slide_data (Slide[]) into a validated LayoutRecipe + a flat
// style object. NO Gemini call, NO new AI model tier (locked cost
// constraint from 84-CONTEXT.md).
//
// =====================================================================
// CONTRACT (load-bearing — DO NOT VIOLATE):
// =====================================================================
//   - Pure: same (slides, template) → byte-identical JSON output across
//     N calls. No I/O, no Date.now, no Math.random, no console.
//   - Immutable: never mutates the input slides or template.
//   - Slide → role is by POSITION + the is_cta flag (deterministic, no
//     inference): index 0 → cover; any is_cta slide → cta; rest → body.
//   - Representative geometry across N body slides: median per numeric
//     field, mode per enum field — robust to outliers, deterministic.
//   - Skip-emit: a role with zero matching slides is OMITTED from
//     recipe.roles (no key). Extraction NEVER throws — an empty slide
//     array yields an empty-roles recipe.
//   - The final recipe is round-tripped through parseLayoutRecipeSafe
//     (Plan 84-02) so the output is always a validated LayoutRecipe.
//
// PHASE BOUNDARY: Phase 84 produces the recipe + flat style object only.
// Writing the recipe into the templates table is Phase 86; applying it at
// generation time is Phase 85.
// =====================================================================

import type { Slide, SlideStyleOverrides, TextSegment } from '@/lib/types/slide'
import type {
  LayoutRecipe,
  RoleLayout,
  RecipeRole,
  HookPositionBand,
  HookFontSizeBand,
  RecipeTextAlign,
  CaptionPosition,
  AccentCadence,
} from '@/lib/types/layout-recipe'
import { LAYOUT_RECIPE_VERSION } from '@/lib/types/layout-recipe'
import {
  SLIDE_ARCHETYPES,
  DEFAULT_FALLBACK_ARCHETYPE,
  type SlideArchetype,
} from '@/lib/types/style-spec-archetypes'
import { parseLayoutRecipeSafe } from '@/lib/validators/layout-recipe'

// =====================================================================
// Result type.
// =====================================================================

export interface ExtractLayoutRecipeResult {
  recipe: LayoutRecipe
  /** Carousel-wide flat style — most-common per-slide overrides, template
      fallback. A strict subset of SlideStyleOverrides (no new fields). */
  flatStyle: Partial<SlideStyleOverrides>
}

// =====================================================================
// Pure deterministic helpers.
// =====================================================================

/**
 * Median of a numeric list. Stable ascending sort; for even-length input
 * the LOWER-middle element is chosen (index floor((n-1)/2)) so output is
 * byte-stable. Result rounded to 1 decimal. Empty → undefined.
 */
function median(nums: number[]): number | undefined {
  if (nums.length === 0) return undefined
  const sorted = [...nums].sort((a, b) => a - b)
  const idx = Math.floor((sorted.length - 1) / 2)
  return Math.round(sorted[idx] * 10) / 10
}

/**
 * Most-frequent value in a list. Ties broken by earliest index in `order`
 * (declaration order of the closed-enum tuple). Empty → undefined.
 */
function mode<T>(values: readonly T[], order: readonly T[]): T | undefined {
  if (values.length === 0) return undefined
  const counts = new Map<T, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: T | undefined
  let bestCount = -1
  // Iterate in `order` so ties resolve to the earliest-declared value.
  for (const candidate of order) {
    const c = counts.get(candidate) ?? 0
    if (c > bestCount) {
      best = candidate
      bestCount = c
    }
  }
  // A value that appears but is not in `order` is ignored — closed-enum
  // discipline: only members of the tuple are valid extraction outputs.
  return bestCount > 0 ? best : undefined
}

/**
 * Classify a single slide into a SlideArchetype from its style_overrides
 * + custom_images. Deterministic heuristic — unclassifiable → fallback.
 */
function classifySlideArchetype(slide: Slide): SlideArchetype {
  const so = slide.style_overrides
  if (so?.caption_bar_enabled === true) {
    return so.caption_bar_position === 'top'
      ? 'caption-bar-top'
      : 'caption-bar-bottom'
  }
  const imageCount = slide.custom_images?.length ?? 0
  if (imageCount >= 4) return 'photo-collage-grid'
  if (imageCount === 2) return 'photo-collage-2up'
  if (slide.background_url) return 'full-bleed-text-overlay'
  return DEFAULT_FALLBACK_ARCHETYPE
}

/** Map a vertical y-percent into a HookPositionBand. Undefined → 'center'. */
function bucketHookPositionBand(y: number | undefined): HookPositionBand {
  if (y === undefined) return 'center'
  if (y < 20) return 'top'
  if (y < 40) return 'upper'
  if (y < 60) return 'center'
  if (y < 80) return 'lower'
  return 'bottom'
}

/** Map a font-size px (1080×1920 reference) into a HookFontSizeBand. */
function bucketHookFontSizeBand(px: number | undefined): HookFontSizeBand {
  if (px === undefined) return 'md'
  if (px < 48) return 'sm'
  if (px < 72) return 'md'
  if (px < 110) return 'lg'
  return 'xl'
}

/** Map a textual position keyword to a y-percent for banding. */
function textPositionToY(pos: 'top' | 'center' | 'bottom' | undefined): number | undefined {
  if (pos === 'top') return 10
  if (pos === 'center') return 50
  if (pos === 'bottom') return 90
  return undefined
}

/** True if any segment on the slide carries an accent / highlight signal. */
function slideHasAccentSignal(slide: Slide): boolean {
  const segmentLists: Array<TextSegment[] | undefined> = [
    slide.hook_segments,
    slide.body_segments,
  ]
  for (const tb of slide.text_boxes ?? []) {
    segmentLists.push(tb.segments)
  }
  for (const list of segmentLists) {
    if (!list) continue
    for (const seg of list) {
      if (seg.accent === true || seg.highlightColor || seg.highlightStyle) {
        return true
      }
    }
  }
  return false
}

// =====================================================================
// Per-role extraction.
// =====================================================================

/** Collect a defined numeric field across slides. */
function collectNumbers(
  slides: Slide[],
  pick: (so: SlideStyleOverrides | undefined) => number | undefined,
): number[] {
  const out: number[] = []
  for (const s of slides) {
    const v = pick(s.style_overrides)
    if (typeof v === 'number' && Number.isFinite(v)) out.push(v)
  }
  return out
}

/**
 * Extract one role's RoleLayout from the slides assigned to that role.
 * Returns undefined when there are no slides (skip-emit).
 */
function extractRoleLayout(slidesForRole: Slide[]): RoleLayout | undefined {
  if (slidesForRole.length === 0) return undefined

  // layout_mode — mode of per-slide classification.
  const archetypes = slidesForRole.map(classifySlideArchetype)
  const layout_mode: SlideArchetype =
    mode(archetypes, SLIDE_ARCHETYPES) ?? DEFAULT_FALLBACK_ARCHETYPE

  const role: RoleLayout = { layout_mode }

  // caption_card — only when the role's mode is a caption-bar archetype.
  if (layout_mode === 'caption-bar-bottom' || layout_mode === 'caption-bar-top') {
    const positions = slidesForRole
      .map((s) => s.style_overrides?.caption_bar_position)
      .filter((p): p is CaptionPosition => p === 'bottom' || p === 'top')
    role.caption_card = {
      enabled: true,
      x: median(collectNumbers(slidesForRole, (so) => so?.caption_bar_x)) ?? 0,
      y: median(collectNumbers(slidesForRole, (so) => so?.caption_bar_y)) ?? 0,
      width: median(collectNumbers(slidesForRole, (so) => so?.caption_bar_width)) ?? 100,
      height_pct:
        median(collectNumbers(slidesForRole, (so) => so?.caption_bar_height_pct)) ?? 38,
      blend_pct:
        median(collectNumbers(slidesForRole, (so) => so?.caption_bar_blend_pct)) ?? 0,
      opacity:
        median(collectNumbers(slidesForRole, (so) => so?.caption_bar_opacity)) ?? 0.85,
      position: mode(positions, ['bottom', 'top']) ?? 'bottom',
    }
  }

  // hook placement — banded.
  const hookYs: number[] = []
  for (const s of slidesForRole) {
    const so = s.style_overrides
    const y = so?.hook_position?.y ?? textPositionToY(so?.text_position)
    if (typeof y === 'number' && Number.isFinite(y)) hookYs.push(y)
  }
  const fontSizes = collectNumbers(slidesForRole, (so) => so?.hook_font_size)
  const aligns = slidesForRole
    .map((s) => s.style_overrides?.text_align)
    .filter((a): a is RecipeTextAlign => a === 'left' || a === 'center' || a === 'right')
  role.hook = {
    position_band: bucketHookPositionBand(median(hookYs)),
    font_size_band: bucketHookFontSizeBand(median(fontSizes)),
    text_align: mode(aligns, ['left', 'center', 'right']) ?? 'center',
  }

  // accessory_label — enabled iff any role slide carries a non-empty label.
  const hasAccessory = slidesForRole.some(
    (s) => typeof s.accessory_label === 'string' && s.accessory_label.trim().length > 0,
  )
  if (hasAccessory) {
    role.accessory_label = { enabled: true, position_band: 'top' }
  }

  return role
}

/** Carousel-wide accent cadence from the body slides' accent signals. */
function extractAccentCadence(bodySlides: Slide[]): AccentCadence {
  if (bodySlides.length === 0) return 'none'
  const withAccent = bodySlides.filter(slideHasAccentSignal).length
  const ratio = withAccent / bodySlides.length
  if (ratio === 0) return 'none'
  if (ratio <= 1 / 3) return 'sparse'
  if (ratio <= 2 / 3) return 'every-other'
  return 'frequent'
}

// =====================================================================
// Flat-style extraction.
// =====================================================================

/** String style fields lifted from the most-common per-slide override. */
const FLAT_STRING_FIELDS = [
  'text_color',
  'hook_text_color',
  'body_text_color',
  'background_color',
  'overlay_color',
  'hook_font_family',
  'body_font_family',
  'treatment_applied',
] as const

/**
 * Derive a carousel-wide flat style: most-common per-slide override value
 * per field, falling back to the passed template partial. A field with no
 * value from either source is OMITTED (skip-emit). Pure.
 */
function extractFlatStyle(
  slides: Slide[],
  template?: Partial<SlideStyleOverrides>,
): Partial<SlideStyleOverrides> {
  const out: Partial<SlideStyleOverrides> = {}

  for (const field of FLAT_STRING_FIELDS) {
    const values: string[] = []
    for (const s of slides) {
      const v = s.style_overrides?.[field]
      if (typeof v === 'string' && v.length > 0) values.push(v)
    }
    // mode over the distinct observed values; ties resolve by first-seen.
    const seenOrder = [...new Set(values)]
    const picked = mode(values, seenOrder)
    if (picked !== undefined) {
      ;(out as Record<string, unknown>)[field] = picked
    } else if (template && typeof template[field] === 'string') {
      ;(out as Record<string, unknown>)[field] = template[field]
    }
  }

  // overlay_opacity — numeric: median of per-slide values, template fallback.
  const opacities = collectNumbers(slides, (so) => so?.overlay_opacity)
  const medOpacity = median(opacities)
  if (medOpacity !== undefined) {
    out.overlay_opacity = medOpacity
  } else if (typeof template?.overlay_opacity === 'number') {
    out.overlay_opacity = template.overlay_opacity
  }

  return out
}

// =====================================================================
// extractLayoutRecipe — public entry point.
// =====================================================================

/**
 * Extract a validated LayoutRecipe + flat style from a source carousel.
 *
 * @param slides   The source carousel's slide_data.
 * @param template Optional resolved template style — fallback for flat
 *                 style fields the per-slide overrides do not cover.
 * @returns        { recipe, flatStyle } — never throws.
 */
export function extractLayoutRecipe(
  slides: Slide[],
  template?: Partial<SlideStyleOverrides>,
): ExtractLayoutRecipeResult {
  // Partition slides by role: index 0 → cover; is_cta → cta; rest → body.
  // The index-0 rule takes precedence (a slide-0 that is also is_cta →
  // cover).
  const coverSlides: Slide[] = []
  const bodySlides: Slide[] = []
  const ctaSlides: Slide[] = []
  slides.forEach((slide, index) => {
    if (index === 0) {
      coverSlides.push(slide)
    } else if (slide.is_cta === true) {
      ctaSlides.push(slide)
    } else {
      bodySlides.push(slide)
    }
  })

  const roles: LayoutRecipe['roles'] = {}
  const byRole: Array<[RecipeRole, Slide[]]> = [
    ['cover', coverSlides],
    ['body', bodySlides],
    ['cta', ctaSlides],
  ]
  for (const [role, roleSlides] of byRole) {
    const layout = extractRoleLayout(roleSlides)
    if (layout !== undefined) {
      roles[role] = layout
    }
  }

  const unvalidated: LayoutRecipe = {
    schema_version: LAYOUT_RECIPE_VERSION,
    accent_cadence: extractAccentCadence(bodySlides),
    roles,
  }

  // Round-trip through the validator so the output is always a validated
  // LayoutRecipe (numeric clamp, closed-enum silent-drop). The walker is
  // deterministic, so this preserves the purity contract.
  const parsed = parseLayoutRecipeSafe(unvalidated)
  const recipe: LayoutRecipe = parsed.ok ? parsed.recipe : unvalidated

  return {
    recipe,
    flatStyle: extractFlatStyle(slides, template),
  }
}
