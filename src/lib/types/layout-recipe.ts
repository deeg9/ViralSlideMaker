// Phase 84 Plan 01 (RECIPE-01):
// LayoutRecipe — the typed, role-keyed layout contract for v2.14
// Save-as-Template. Captures a carousel's per-slide structure as a set of
// role archetypes (cover / body / cta) rather than a fixed slide array, so
// a recipe scales to 1–10 slides by repeating the `body` archetype.
//
// File structure mirrors StyleSpec (src/lib/types/style-spec.ts +
// style-spec-archetypes.ts): the type lives here, the zod validator in
// src/lib/validators/layout-recipe.ts, the extraction logic in
// src/lib/ai/layout-recipe-extract.ts.
//
// =====================================================================
// CLOSED-ENUM INVARIANT (LOAD-BEARING — DO NOT VIOLATE):
// =====================================================================
// Every string field below is a closed-enum `... as const` tuple defined
// ONCE in this module and consumed downstream by:
//   - Plan 84-02 (validator):  z.enum(...) closed-enum gates + silent-drop
//   - Plan 84-03 (extractor):  mode/bucket helpers pick from these tuples
//
// Continuous geometry (caption-card x / y / width / height_pct / blend_pct
// / opacity) stays NUMERIC — bucketing it into bands would lose the
// fidelity needed to reproduce a source carousel's look. The closed-enum
// invariant is satisfied by the string discriminators; numeric fields get
// validated ranges (clamp-on-parse) in the validator.
//
// DO NOT add free-text fields (reference_artist / reference_brand /
// copy_exactly / style_freetext) — the PARITY-05 CI grep gate WILL fail.
// The closed-enum schema is the primary defense against legal risk
// (named-artist style mimicry) and prompt-injection landing zones.
// =====================================================================
//
// PHASE BOUNDARY: Phase 84 is model + extraction + validation ONLY.
// Writing an extracted recipe into a `templates` DB row is Phase 86;
// applying a recipe at generation time is Phase 85. Phase 83 already
// added the nullable `templates.layout_recipe` jsonb column — Phase 84
// only produces the object that will fill it.

import type { SlideArchetype } from '@/lib/types/style-spec-archetypes'

/**
 * Schema version literal — bump when the LayoutRecipe shape changes.
 * Cheap forward-compat (StyleSpec `schema_version: 2` precedent). Always 1
 * for the v2.14 milestone.
 */
export type LayoutRecipeVersion = 1
export const LAYOUT_RECIPE_VERSION: LayoutRecipeVersion = 1

/**
 * The 3 fixed recipe roles (closed keyset). A recipe scales to variable
 * slide counts (1–10) by repeating the `body` role; a role may be omitted
 * entirely for short carousels (skip-emit). Matches RECIPE-01 verbatim.
 */
export const RECIPE_ROLES = ['cover', 'body', 'cta'] as const
export type RecipeRole = (typeof RECIPE_ROLES)[number]

/**
 * Hook vertical-placement band (closed enum). A coarse 5-band split of the
 * 0–100 vertical axis — the spec explicitly calls for a "position band"
 * rather than raw geometry for hook placement.
 */
export const HOOK_POSITION_BANDS = ['top', 'upper', 'center', 'lower', 'bottom'] as const
export type HookPositionBand = (typeof HOOK_POSITION_BANDS)[number]

/**
 * Hook font-size band (closed enum). Coarse t-shirt sizing — the spec
 * calls for a "font-size band" rather than a raw px value.
 */
export const HOOK_FONT_SIZE_BANDS = ['sm', 'md', 'lg', 'xl'] as const
export type HookFontSizeBand = (typeof HOOK_FONT_SIZE_BANDS)[number]

/**
 * Hook text alignment (closed enum). Parity with
 * SlideStyleOverrides.text_align (`'left' | 'center' | 'right'`).
 */
export const RECIPE_TEXT_ALIGNS = ['left', 'center', 'right'] as const
export type RecipeTextAlign = (typeof RECIPE_TEXT_ALIGNS)[number]

/**
 * Caption-card vertical anchor (closed enum). Parity with
 * SlideStyleOverrides.caption_bar_position (`'bottom' | 'top'`). Declared
 * here as a tuple because the source field is an inline union, not an
 * exported tuple — this is the single-source-of-truth definition for the
 * recipe.
 */
export const CAPTION_POSITIONS = ['bottom', 'top'] as const
export type CaptionPosition = (typeof CAPTION_POSITIONS)[number]

/**
 * Accent / highlight rhythm cadence (closed enum). Describes how often the
 * carousel uses accent-colored or pill-highlighted text across its body
 * slides. Conceptual sibling of StyleSpecRhythm.cadence.
 */
export const ACCENT_CADENCES = ['none', 'sparse', 'every-other', 'frequent'] as const
export type AccentCadence = (typeof ACCENT_CADENCES)[number]

/**
 * Accessory-label vertical band (closed enum). Phase 82 accessory labels
 * are small top-anchored kickers; the band records where the label sits.
 */
export const ACCESSORY_LABEL_BANDS = ['top', 'upper', 'lower', 'bottom'] as const
export type AccessoryLabelBand = (typeof ACCESSORY_LABEL_BANDS)[number]

/**
 * Caption-card geometry — numeric with validator-clamped ranges. Mirrors
 * SlideStyleOverrides.caption_bar_{enabled, x, y, width,
 * height_pct (= caption_bar_height_pct), blend_pct, opacity, position}.
 * Numeric (not banded) so a recipe can reproduce a source carousel's
 * exact caption-card placement. Ranges enforced (clamp-on-parse) by
 * parseLayoutRecipeSafe.
 */
export interface CaptionCardGeometry {
  /** Card on/off state. */
  enabled: boolean
  /** Left edge, percent of the 1080×1920 frame (0..100). */
  x: number
  /** Top edge, percent of the frame (0..100). */
  y: number
  /** Width, percent of the frame (0..100). */
  width: number
  /** Card height, percent of the frame (0..100). */
  height_pct: number
  /** Edge-blend percent — fades the card edge that meets the photo (0..50). */
  blend_pct: number
  /** Card opacity (0..1). */
  opacity: number
  /** Vertical anchor — top or bottom of the frame. */
  position: CaptionPosition
}

/**
 * Hook placement — closed-enum bands plus the reused text-align enum.
 */
export interface HookPlacement {
  position_band: HookPositionBand
  font_size_band: HookFontSizeBand
  text_align: RecipeTextAlign
}

/**
 * Optional accessory-label slot — captures the presence + placement of a
 * Phase 82 `Slide.accessory_label` (kicker / one-liner).
 */
export interface AccessoryLabelSlot {
  enabled: boolean
  position_band: AccessoryLabelBand
}

/**
 * A single role's layout description. `layout_mode` REUSES the existing
 * 8-value SlideArchetype closed enum (style-spec-archetypes.ts) — no new
 * archetype set is introduced. The caption-card / hook / accessory-label
 * slots are all optional: extraction may classify a role's archetype
 * without committing to every slot.
 */
export interface RoleLayout {
  layout_mode: SlideArchetype
  caption_card?: CaptionCardGeometry
  hook?: HookPlacement
  accessory_label?: AccessoryLabelSlot
}

/**
 * Top-level LayoutRecipe — a role-keyed set of slide archetypes, NOT a
 * fixed N-slide array. `roles` is a partial keyset: a role may be omitted
 * for short carousels (skip-emit semantics; a missing role is never
 * synthesized). Stored later (Phase 86) in the `templates.layout_recipe`
 * jsonb column added by Phase 83.
 */
export interface LayoutRecipe {
  schema_version: LayoutRecipeVersion
  accent_cadence: AccentCadence
  roles: {
    cover?: RoleLayout
    body?: RoleLayout
    cta?: RoleLayout
  }
}
