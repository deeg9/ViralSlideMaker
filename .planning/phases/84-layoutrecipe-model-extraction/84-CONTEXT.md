# Phase 84: LayoutRecipe Model + Extraction - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

A typed `LayoutRecipe` model exists that captures a carousel's per-slide
structure as role-keyed archetypes, and a source carousel's `slide_data` can be
deterministically turned into a `LayoutRecipe` + flat style — with no new AI
call.

**In scope:** the `LayoutRecipe` TypeScript type + zod validator; the
deterministic extraction function (`slide_data` → `LayoutRecipe` + flat style);
proving extraction on the Oracle project reproduces its look (RECIPE-01,
RECIPE-02).

**Out of scope (later phases):** applying a recipe at generation time
(Phase 85); writing an extracted recipe into a `templates` DB row, the admin
authoring flow, picker previews (Phase 86). Phase 83 already added the nullable
`layout_recipe` jsonb column — Phase 84 only produces the object that will fill
it; it does not wire storage.

</domain>

<decisions>
## Implementation Decisions

### LayoutRecipe Model Shape
- Exactly 3 fixed roles — `cover` / `body` / `cta` — as a closed-enum keyset
  (matches RECIPE-01 verbatim). A recipe scales to 1–10 slides by repeating the
  `body` archetype; a role may be omitted for short carousels.
- Each role's layout-mode discriminator reuses the existing 8-value
  `SlideArchetype` closed enum (`src/lib/types/style-spec-archetypes.ts`) — do
  not invent a new archetype set.
- File structure mirrors `StyleSpec`: the type in
  `src/lib/types/layout-recipe.ts`, the validator in
  `src/lib/validators/layout-recipe.ts`, the extraction logic in `src/lib/ai/`
  (e.g. `layout-recipe-extract.ts`).
- The model carries a `schema_version: 1` literal field for forward-compat
  (StyleSpec `schema_version: 2` precedent).

### Geometry — Closed-Enum vs Numeric
- Caption-card geometry — `x`, `y`, `width`, `height_pct`, `blend_pct`,
  `opacity` — stays numeric with validated ranges (clamp on parse). This matches
  `SlideStyleOverrides.caption_bar_*` and `computeCaptionBarBottomPositions`;
  bucketing into bands would lose the fidelity needed to reproduce the Oracle
  look. The closed-enum invariant is satisfied by the string discriminators.
- Hook placement uses closed-enum bands — a position band and a font-size band
  — plus `text_align` reusing the existing `'left' | 'center' | 'right'` enum.
  (The spec explicitly calls for "position band" and "font-size band".)
- The caption-card `position` field reuses the existing `'bottom' | 'top'` enum
  (`caption_bar_position`).
- Accent/highlight rhythm is a closed-enum cadence (reuse the StyleSpec
  `rhythm.cadence` concept) plus an accent-role marker.

### Extraction Determinism
- Slide → role classification is by position + the `is_cta` flag: slide 0 →
  `cover`, any slide with `is_cta: true` → `cta`, the rest → `body`. Both fields
  already exist on the `Slide` type — fully deterministic, no inference.
- Representative geometry across N `body` slides: median per numeric field, mode
  per enum field — robust to outliers and deterministic.
- Flat style is derived from the most-common per-slide `style_overrides` values,
  falling back to the project's resolved template. The Oracle look lives in
  per-slide overrides (per the spec), so overrides are the primary source.
- An unclassifiable slide falls back to `DEFAULT_FALLBACK_ARCHETYPE`
  (`'full-bleed-text-overlay'`). A recipe may omit a role entirely (1–2-slide
  carousels) via skip-emit semantics — extraction never errors out.

### Validation & Phase Boundary
- Validation is `parseLayoutRecipeSafe` — a zod `discriminatedUnion` with
  closed-enum silent-drop and numeric range clamping, mirroring
  `parseStyleSpecSafe` (`src/lib/validators/style-spec.ts`).
- Extraction is a pure deterministic function — no Gemini call, no new AI model
  tier (locked cost constraint).
- Each archetype carries an optional accessory-label slot (enabled + position
  band), extracted from the presence of `Slide.accessory_label` (Phase 82).
- Phase 84 is model + extraction + validation only. SC4 is proven by running
  extraction on the Oracle project and showing the recipe + flat style
  reproduce the Oracle look. Writing a recipe into a `templates` row is Phase 86.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/types/style-spec-archetypes.ts` — `SLIDE_ARCHETYPES` (8-value closed
  enum: `full-bleed-text-overlay`, `caption-bar-bottom`, `caption-bar-top`,
  `photo-collage-2up`, `photo-collage-grid`, `flat-color-background`,
  `editorial-serif`, `notes-sticker`), `ArchetypeSlots` discriminated union,
  `CaptionBarSlots`, `DEFAULT_FALLBACK_ARCHETYPE = 'full-bleed-text-overlay'`.
- `src/lib/types/slide.ts` — the `Slide` type (`hook_text`, `body_text`,
  `accessory_label` [Phase 82], `is_cta`, `background_url`, `style_overrides`,
  `template_id_override`, `text_boxes`) and `SlideStyleOverrides` (caption-bar
  fields `caption_bar_enabled/x/y/width/height_pct/color/opacity/blend_pct/position`,
  `hook_position`, `body_position`, `text_position`, `text_align`).
- `src/lib/types/style-spec.ts` — `StyleSpec` type with `schema_version: 2`,
  intersected with `ArchetypeSlots`; the structural model to mirror.
- `src/lib/validators/style-spec.ts` — `parseStyleSpecSafe`, zod
  `discriminatedUnion('slideArchetype', ...)`, closed-enum sets with silent-drop
  — the validation pattern to mirror.
- `src/lib/ai/style-spec-projector-constants.ts` — `CAPTION_BAR_BOTTOM_HOOK_Y_RANGE`
  `[70,76]`, `CAPTION_BAR_BOTTOM_BODY_Y_RANGE` `[82,88]`,
  `CAPTION_BAR_BOTTOM_DEFAULT_HEIGHT_FRACTION = 0.38`,
  `computeCaptionBarBottomPositions()` — geometry source of truth.
- `src/lib/ai/style-spec-projector.ts` — `projectStyleSpecToSlideOverrides()`:
  the pure-deterministic, skip-emit projection pattern.

### Established Patterns
- Closed-enum invariant: every enum is a `... as const` tuple defined ONCE in a
  types module; numeric literal unions for discrete values (e.g.
  `CAPTION_HEIGHT_FRACTIONS = [0.3, 0.4, 0.5]`); continuous geometry stays
  numeric with ranges. A grep gate (PARITY-05) blocks local redefinition.
- Two-phase firewall (extract → `parseXxxSafe`) with silent-drop on invalid
  closed-enum values.
- Pure deterministic functions: same input → byte-identical JSON output;
  skip-emit (undefined field → no key emitted).

### Integration Points
- New files: `src/lib/types/layout-recipe.ts`,
  `src/lib/validators/layout-recipe.ts`, `src/lib/ai/layout-recipe-extract.ts`
  (names indicative).
- Input to extraction: a project's `slide_data` (`Slide[]`) plus its resolved
  template / `style_overrides`.
- Output `LayoutRecipe` will later be stored in the `templates.layout_recipe`
  jsonb column (added in Phase 83) and consumed by Phase 85 generation.
- Oracle reference: quick `260518-jhg` (News Oracle template — per-slide
  `template_id_override: 'news-drop'`, Anton, `accentColor #24ddeb`, pill
  highlights, big centered headline) and quick `260518-8o0` (news-layout
  caption-card defaulting). Cover = blended caption card; middle = full-bleed
  photo, no card; cta = caption card + follow CTA.

</code_context>

<specifics>
## Specific Ideas

- Build on existing archetype machinery — `slideArchetype`, `caption-bar-bottom`,
  `computeCaptionBarBottomPositions`, Phase 80 archetype classification,
  `style-spec-projector` — do not reinvent it.
- SC4 acceptance: extraction run on the Oracle project must produce a recipe +
  flat style that, applied to a fresh generation, reproduces the Oracle look
  (cover blended caption card; full-bleed photo middles; cta caption card +
  follow CTA).
- The `LayoutRecipe` must scale to variable slide counts (1–10) — it is a
  role-keyed archetype set, not a fixed N-slide array.

</specifics>

<deferred>
## Deferred Ideas

- Recipe-driven generation (applying a `LayoutRecipe` at generation time) —
  Phase 85.
- Writing an extracted recipe into a `templates` DB row, the admin
  Save-as-Template flow, picker previews — Phase 86.
- Editing/deleting a stored recipe — V1 is save-new-only (whole milestone).

</deferred>
