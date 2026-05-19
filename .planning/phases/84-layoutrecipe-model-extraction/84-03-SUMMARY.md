---
phase: 84-layoutrecipe-model-extraction
plan: 03
status: complete
requirements: [RECIPE-02]
key-files:
  created:
    - src/lib/ai/layout-recipe-extract.ts
    - src/lib/ai/__tests__/layout-recipe-extract.test.ts
    - src/lib/ai/__tests__/layout-recipe-extract.oracle.test.ts
---

# 84-03 Summary: Deterministic LayoutRecipe extraction + Oracle SC4 proof (RECIPE-02)

## What was built

Created `src/lib/ai/layout-recipe-extract.ts` — `extractLayoutRecipe`, a PURE
deterministic function turning a source carousel's `Slide[]` (+ an optional
resolved template style) into a validated `LayoutRecipe` + a flat style object.
**No Gemini call, no new AI tier** — the locked cost constraint is honored.
Mirrors the pure-deterministic contract of `projectStyleSpecToSlideOverrides`
(`src/lib/ai/style-spec-projector.ts`).

### Public entry point

```ts
export interface ExtractLayoutRecipeResult {
  recipe: LayoutRecipe
  flatStyle: Partial<SlideStyleOverrides>
}

export function extractLayoutRecipe(
  slides: Slide[],
  template?: Partial<SlideStyleOverrides>,
): ExtractLayoutRecipeResult
```

### Slide → role partition (deterministic, no inference)

Slide index 0 → `cover`; any slide with `is_cta === true` → `cta`; all others →
`body`. The index-0 rule wins over `is_cta` for the first slide. A role with
zero matching slides is OMITTED from `recipe.roles` (skip-emit) — never
synthesized.

### Representative geometry — median per numeric, mode per enum

Across N `body` slides, each numeric field is the **median** (stable ascending
sort, lower-middle element for even length, rounded to 1 decimal — a single
documented rule so output is byte-stable) and each enum field is the **mode**
(ties broken by closed-enum tuple declaration order). Robust to outliers,
fully deterministic.

`layout_mode` per role is the mode of a deterministic per-slide classification:
`caption_bar_enabled` → `caption-bar-bottom` / `caption-bar-top`; else 2
`custom_images` → `photo-collage-2up`, 4+ → `photo-collage-grid`; else
`full-bleed-text-overlay`; unclassifiable → `DEFAULT_FALLBACK_ARCHETYPE`.
`caption_card` geometry is populated only when the role's mode is a caption-bar
archetype. `hook` placement buckets the median `hook_position.y` into
`HOOK_POSITION_BANDS` and the median `hook_font_size` into
`HOOK_FONT_SIZE_BANDS`. `accent_cadence` is the ratio of body slides with any
accent signal mapped into `ACCENT_CADENCES`. `accessory_label` is enabled for a
role iff any slide of that role carries a non-empty `Slide.accessory_label`.

`flatStyle` is a SEPARATE return value (not part of `LayoutRecipe`) — the
most-common per-slide `style_overrides` values (`text_color`, font families,
`background_color`, `overlay_*`, `treatment_applied`, …), falling back to the
passed `template` partial; a field with no value is omitted (skip-emit).

### Validator round-trip + never-throws

The produced recipe is round-tripped through `parseLayoutRecipeSafe` (Plan
84-02) before return, so output is always a validated `LayoutRecipe` (numeric
geometry clamped, bad enums silent-dropped). Extraction NEVER throws — an empty
`slides` array yields `{ recipe: { schema_version: 1, accent_cadence: 'none',
roles: {} }, flatStyle: {} }`. No `Date.now`, no `Math.random`, no `console`,
no Gemini / Supabase / React import — verified by grep gates.

## Tests

`layout-recipe-extract.test.ts` — 15 unit tests (all pass): determinism
(`JSON.stringify`-equal across repeated calls), role partition, skip-emit for
`cover`-only and CTA-less carousels, caption-bar / caption-bar-top / full-bleed /
photo-collage classification, median geometry (30/40/50 → 40), numeric clamp via
the validator round-trip, accent cadence `frequent` vs `none`, accessory-label
detection, empty-input no-throw, flat-style mode + template fallback, and the
no-AI guarantee (return value is not a Promise).

`layout-recipe-extract.oracle.test.ts` — the **SC4 proof** (6 assertions, all
pass). Builds a ~6-slide Oracle-pattern `Slide[]` fixture (per quick
`260518-jhg`) and runs `extractLayoutRecipe` with the news-oracle template
style. Asserts extraction reproduces the Oracle per-slide pattern: `cover` is a
caption-bar archetype with `caption_card.enabled` and `blend_pct > 0` (the
BLENDED caption card); `body` is `full-bleed-text-overlay` with NO `caption_card`
(full-bleed photo, no card); `cta` is a caption-bar archetype with
`caption_card.enabled` (caption card + follow CTA); `schema_version === 1`;
`flatStyle` carries the Oracle accent/font flat style; the recipe is
deterministic on a second call.

## Phase boundary / SC4 scope

Phase 84 proves the recipe + flat style *capture* the Oracle per-slide pattern.
*Applying* a recipe at generation time is explicitly Phase 85 (84-CONTEXT
out-of-scope); recipe storage into the `templates` table is Phase 86. No
`templates`-table write in this plan's diff.

## Self-Check: PASSED
- `src/lib/ai/layout-recipe-extract.ts` present; exports `extractLayoutRecipe` + `ExtractLayoutRecipeResult`.
- No `@google` / `gemini` / `generateContent` import; no `Date.now` / `Math.random` / `console.` — pure & deterministic.
- Recipe round-trips through `parseLayoutRecipeSafe` before return.
- `tsc --noEmit` clean; 15/15 unit tests + 6/6 Oracle SC4 assertions pass; lint gates green.
- Full suite: 41-failure pre-existing baseline unchanged — zero regressions; +41 passing (the new Phase 84 tests).
