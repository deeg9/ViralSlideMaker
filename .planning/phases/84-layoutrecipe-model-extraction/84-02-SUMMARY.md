---
phase: 84-layoutrecipe-model-extraction
plan: 02
status: complete
requirements: [RECIPE-01]
key-files:
  created:
    - src/lib/validators/layout-recipe.ts
    - src/lib/validators/__tests__/layout-recipe.test.ts
  modified:
    - src/lib/validators/silent-drop-counter.ts
---

# 84-02 Summary: parseLayoutRecipeSafe zod validator (RECIPE-01)

## What was built

Created `src/lib/validators/layout-recipe.ts` — the zod validation firewall for
the `LayoutRecipe` model, mirroring `parseStyleSpecSafe`
(`src/lib/validators/style-spec.ts`). A two-phase firewall: a pre-clean walker
followed by a zod `safeParse`. This is the boundary that makes recipe input
safe to trust — closed-enum silent-drop, numeric range clamp, unknown-key
stripping (prompt-injection defense).

### `silent-drop-counter.ts` — new `range_clamp` reason

Extended the closed `SilentDropReason` union with one new literal,
`range_clamp` (numeric geometry clamped to its validated range — a new drop
kind not covered by the existing `unknown_enum_value` / `unknown_field` /
`parse_error`). No existing reason removed or renamed; the
`silent-drop-counter` regression test stays green.

### `layout-recipe.ts` — the two-phase firewall

**Phase 1 — `cleanRecipe(input, counter)` pre-clean walker.** Before zod runs:
- Non-object input → emit `parse_error`, caller produces `ok:false`.
- Strip unknown top-level keys (anything not `schema_version` /
  `accent_cadence` / `roles`) → `unknown_field` event per key.
- Force `schema_version` to `LAYOUT_RECIPE_VERSION`.
- `accent_cadence` not in `ACCENT_CADENCES` → `unknown_enum_value`, default
  `'none'`.
- Per role present in `input.roles`:
  - `layout_mode` not in `SLIDE_ARCHETYPES` → `unknown_enum_value`, fall back
    to `DEFAULT_FALLBACK_ARCHETYPE`.
  - `caption_card`: `clampNumber` clamps `x` [0,100], `y` [0,100], `width`
    [0,100], `height_pct` [0,100], `blend_pct` [0,50], `opacity` [0,1] —
    out-of-range → `range_clamp`; non-finite → range midpoint + `parse_error`.
    `position` not in `CAPTION_POSITIONS` → `'bottom'`; non-boolean `enabled`
    coerced to `false`.
  - `hook`: if ANY of `position_band` / `font_size_band` / `text_align` is
    invalid, emit the event(s) and OMIT the whole `hook` object (skip-emit).
  - `accessory_label`: bad `position_band` → omit the slot; non-boolean
    `enabled` → `false`.
  - Unknown keys inside roles / sub-objects stripped → `unknown_field`.
  - A role absent from `input.roles` stays absent — never synthesized.

**Phase 2 — zod schemas.** `CaptionCardGeometryZ`, `HookPlacementZ`,
`AccessoryLabelSlotZ`, `RoleLayoutZ`, `LayoutRecipeSchema` — every `z.object(...)`
terminated with `.catchall(z.never())` (mirrors `style-spec.ts` — defence in
depth: any unknown key the walker missed makes zod reject). `layout_mode`
validated via `z.enum(SLIDE_ARCHETYPES)`; `schema_version` via
`z.literal(LAYOUT_RECIPE_VERSION)`.

### Public entry point

```ts
export type ParseLayoutRecipeResult =
  | { ok: true; recipe: LayoutRecipe; counter: SilentDropCounter }
  | { ok: false; counter: SilentDropCounter; error: z.ZodError }

export function parseLayoutRecipeSafe(
  input: unknown,
  opts?: { counter?: SilentDropCounter },
): ParseLayoutRecipeResult
```

Runs the walker, then `LayoutRecipeSchema.safeParse(cleaned)`; failure emits
`parse_error` and returns `ok:false`. Every drop is silent (counted, not
thrown) — a malformed recipe degrades to a cleaned, valid one rather than
breaking the caller.

## Tests

`src/lib/validators/__tests__/layout-recipe.test.ts` — 13 tests (all pass):
valid full 3-role recipe round-trips; `roles: {}` and body-only recipes accepted
(no role required); `layout_mode: 'bogus-archetype'` falls back to
`full-bleed-text-overlay` + counter event; `opacity: 5` clamps to `1` with a
`range_clamp` event; `x: -20` → `0`, `blend_pct: 200` → `50`; unknown top-level
key `{ evil: '<script>' }` stripped; unknown nested key stripped; bad
`accent_cadence` defaults to `'none'`; non-object input → `ok:false`; non-boolean
`enabled` coerced to `false`; bad `hook.position_band` omits the `hook` object.

## Phase boundary

Validation only — no `templates`-table write (Phase 86), no recipe applied at
generation time (Phase 85).

## Unblocks

Plan 84-03's `extractLayoutRecipe` round-trips its produced recipe through
`parseLayoutRecipeSafe` before returning, so extraction output is always a
validated `LayoutRecipe`.

## Self-Check: PASSED
- `src/lib/validators/layout-recipe.ts` present; exports `parseLayoutRecipeSafe` + `ParseLayoutRecipeResult`.
- Every `z.object(` chained with `.catchall(z.never())`; `z.enum(SLIDE_ARCHETYPES)` for `layout_mode`.
- `range_clamp` added to the `SilentDropReason` union — no existing reason changed.
- No `reference_artist` / `reference_brand` / `copy_exactly` / `style_freetext` leakage.
- `tsc --noEmit` clean; 13/13 validator tests pass; `silent-drop-counter` test green; lint gates green.
