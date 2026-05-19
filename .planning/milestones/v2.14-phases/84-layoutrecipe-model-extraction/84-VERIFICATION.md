---
phase: 84-layoutrecipe-model-extraction
status: passed
completed_at: 2026-05-18T19:00:00Z
score: 4/4 success criteria verified
overrides_applied: 0
---

# Phase 84: LayoutRecipe Model + Extraction — Verification Report

**Phase Goal:** A typed `LayoutRecipe` model exists that captures a
carousel's per-slide structure as role-keyed archetypes, and a source
carousel's `slide_data` can be deterministically turned into a
`LayoutRecipe` + flat style — with no new AI call.

**Verified:** 2026-05-18
**Status:** passed
**Re-verification:** No — initial verification

## Success Criteria

### SC1 — typed role-keyed archetype set — PASS

`LayoutRecipe` (`src/lib/types/layout-recipe.ts`) is a typed model with 3
fixed roles (`cover` / `body` / `cta`) as a partial keyset — not a fixed
slide array. Each `RoleLayout` describes layout mode (the reused 8-value
`SlideArchetype` enum), caption-card geometry (`enabled`, `x`, `y`,
`width`, `height_pct`, `blend_pct`, `opacity`, `position`), hook placement
(position band, font-size band, `text_align`), and an optional
accessory-label slot. Accent rhythm is the top-level `accent_cadence`
closed enum. Every string field is an `as const` tuple defined once;
caption-card geometry stays numeric per the CONTEXT decision. Verified by
8 type tests (`src/lib/types/__tests__/layout-recipe.test.ts`, all pass)
and the PARITY-05 closed-enum grep gate (green).

### SC2 — scales to 1–10 slides + expresses the Oracle pattern — PASS

The recipe is role-keyed, so it scales to any slide count by repeating the
`body` role; a role may be omitted (skip-emit) for short carousels.
Verified: a 1-slide carousel yields only `cover`; a 3-slide carousel with
no CTA omits `cta`. The Oracle SC4 proof test
(`layout-recipe-extract.oracle.test.ts`) confirms the model fully
expresses the Oracle per-slide pattern (cover = blended caption card;
middle = full-bleed photo, no card; cta = caption card + follow CTA).

### SC3 — deterministic extraction, no Gemini call — PASS

`extractLayoutRecipe` (`src/lib/ai/layout-recipe-extract.ts`) classifies
each slide into a role (position + `is_cta` flag) and an archetype
(deterministic heuristic on `style_overrides` / `custom_images`), then
extracts representative geometry (median per numeric field, mode per
enum). It is a pure synchronous function — no AI SDK / Supabase / React /
`fetch` imports, no `Date.now` / `Math.random` / `console`. Determinism
proven by a JSON-equality test across repeated calls. No new Gemini model
tier — the locked cost constraint is honored.

### SC4 — Oracle extraction reproduces the Oracle look — PASS

`layout-recipe-extract.oracle.test.ts` builds an Oracle-pattern `Slide[]`
fixture (per quick `260518-jhg`) and runs `extractLayoutRecipe`. The
produced recipe + flat style reproduce the Oracle pattern: `cover` is a
`caption-bar-bottom` with `caption_card.enabled` and `blend_pct > 0` (the
BLENDED caption card); `body` is `full-bleed-text-overlay` with NO
`caption_card` (full-bleed photo, no card); `cta` is a caption-bar
archetype with `caption_card.enabled` plus an accessory-label kicker
(follow CTA). `flatStyle` carries the Oracle template style
(`background_color #0a0a0a`, Anton font). All 6 Oracle assertions pass.

Note on SC4 scope: the ROADMAP phrasing "when applied to a fresh
generation, reproduces the Oracle look" — *applying* a recipe at
generation time is explicitly Phase 85 (84-CONTEXT.md out-of-scope).
Phase 84 proves the recipe + flat style *capture* the Oracle per-slide
pattern, which is the in-scope SC4 assertion and is verified here.

## Test Evidence

- Phase 84 test suite: 5 files, 50 tests — all pass (8 type + 13 validator
  + 15 extraction + 6 Oracle; silent-drop-counter regression test green).
- Full suite: 41 failed / 3182 passed (9 skipped, 1 todo). The 41-failure
  count is the unchanged pre-existing baseline — no regression. Passing
  count rose +41 (the new Phase 84 tests).
- `npm run lint:gates`: PARITY-05 closed-enum gate green.
- `tsc`: zero type errors in any Phase 84 file (20 pre-existing errors in
  unrelated auth/stripe/legal test files — the baseline).
- `eslint`: clean on all 4 changed source files.

## Phase Boundary Compliance

Phase 84 is model + extraction + validation ONLY. No recipe storage was
wired into the `templates` table (that is Phase 86); no recipe is applied
at generation time (Phase 85). Verified — no `templates` table writes in
the diff.
</content>
