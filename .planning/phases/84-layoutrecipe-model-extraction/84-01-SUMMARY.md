---
phase: 84-layoutrecipe-model-extraction
plan: 01
status: complete
requirements: [RECIPE-01]
key-files:
  created:
    - src/lib/types/layout-recipe.ts
    - src/lib/types/__tests__/layout-recipe.test.ts
---

# 84-01 Summary: LayoutRecipe type model + closed-enum tuples (RECIPE-01)

## What was built

Created `src/lib/types/layout-recipe.ts` — the load-bearing TypeScript type
contract for the milestone's `LayoutRecipe` model. The validator (Plan 84-02)
and the deterministic extraction (Plan 84-03) both import from this module, so
it lands first (wave 1). Mirrors the `StyleSpec` type architecture
(`src/lib/types/style-spec.ts` + `style-spec-archetypes.ts`).

### Role-keyed, not a fixed slide array

A `LayoutRecipe` describes a carousel as a **partial keyset of 3 fixed roles** —
`cover` / `body` / `cta` — not a per-slide array. This is what lets the recipe
scale to any 1–10 slide count: the `body` role repeats, and a role may be
omitted entirely for short carousels (skip-emit; never synthesized). Each role
is a `RoleLayout` carrying:

| Field | Type | Purpose |
|-------|------|---------|
| `layout_mode` | `SlideArchetype` | The per-slide layout mode — REUSES the existing 8-value `SlideArchetype` enum from `style-spec-archetypes.ts` (CONTEXT locked decision — no new archetype set invented). |
| `caption_card?` | `CaptionCardGeometry` | Optional caption-card geometry. |
| `hook?` | `HookPlacement` | Optional hook placement. |
| `accessory_label?` | `AccessoryLabelSlot` | Optional Phase 82 accessory-label kicker slot. |

### Closed-enum invariant — 7 `as const` tuples

Per the milestone's load-bearing closed-enum invariant, every string field is an
`... as const` tuple defined ONCE in this module (`grep -c 'as const'` returns
7). Continuous geometry stays numeric (validated ranges live in the validator,
not bucketed):

- `RECIPE_ROLES = ['cover','body','cta']`
- `HOOK_POSITION_BANDS = ['top','upper','center','lower','bottom']`
- `HOOK_FONT_SIZE_BANDS = ['sm','md','lg','xl']`
- `RECIPE_TEXT_ALIGNS = ['left','center','right']` — parity with `SlideStyleOverrides.text_align`
- `CAPTION_POSITIONS = ['bottom','top']` — parity with `caption_bar_position` (the source field is an inline union, so this local tuple is the recipe's single source of truth)
- `ACCENT_CADENCES = ['none','sparse','every-other','frequent']`
- `ACCESSORY_LABEL_BANDS = ['top','upper','lower','bottom']`

### Numeric geometry + interfaces

`CaptionCardGeometry` mirrors the `SlideStyleOverrides.caption_bar_*` fields and
stays numeric: `enabled` (boolean), `x` / `y` / `width` / `height_pct`
(0–100 percent), `blend_pct` (0–50 edge-blend percent), `opacity` (0–1),
`position` (`CaptionPosition`). `HookPlacement` is `{ position_band,
font_size_band, text_align }`. `AccessoryLabelSlot` is `{ enabled,
position_band }`.

Top-level `LayoutRecipe` carries a `schema_version: 1` literal
(`LAYOUT_RECIPE_VERSION` / `LayoutRecipeVersion` — forward-compat, mirrors the
StyleSpec `schema_version` precedent), a top-level `accent_cadence`
(`AccentCadence` — accent/highlight rhythm), and a partial `roles` keyset.

## Tests

`src/lib/types/__tests__/layout-recipe.test.ts` — 8 type-level + tuple-shape
tests (all pass): `LAYOUT_RECIPE_VERSION === 1`; `RECIPE_ROLES` deep-equality;
each closed-enum tuple is a non-empty array of unique strings;
`RECIPE_TEXT_ALIGNS` / `CAPTION_POSITIONS` parity assertions; construction smoke
tests building a full 3-role recipe, an empty `roles: {}` recipe, and a
body-only recipe — all compile (type OK) and `JSON.stringify` round-trip.

## Phase boundary

Phase 84 is model + extraction + validation only. This plan lands the type
contract; recipe storage into the `templates.layout_recipe` JSON column is
Phase 86, and applying a recipe at generation time is Phase 85. No
`templates`-table code touched.

## Unblocks

Plans 84-02 (`parseLayoutRecipeSafe` validator) and 84-03 (deterministic
extraction) both import the types + closed-enum tuples from this module.

## Self-Check: PASSED
- `src/lib/types/layout-recipe.ts` present; `grep -c 'as const'` returns 7 (one per closed-enum tuple).
- Imports `SlideArchetype` from `@/lib/types/style-spec-archetypes`; `layout_mode: SlideArchetype` — no new archetype set.
- `schema_version: 1` literal + `LAYOUT_RECIPE_VERSION` exported; numeric caption-card geometry.
- No `reference_artist` / `reference_brand` / `copy_exactly` / `style_freetext` leakage.
- `tsc --noEmit` clean; 8/8 type tests pass; closed-enum lint gate (PARITY-05) green.
