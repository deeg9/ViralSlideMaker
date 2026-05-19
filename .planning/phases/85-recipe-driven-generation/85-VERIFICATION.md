---
phase: 85-recipe-driven-generation
status: passed
date: 2026-05-18
requirements: [RECGEN-01]
---

# Phase 85 Verification — Recipe-Driven Generation

## Success criteria

### SC1 — recipe-carrying generation produces recipe-matching geometry
**PASS.** `applyLayoutRecipe` (`src/lib/ai/layout-recipe-apply.ts`) maps a
`LayoutRecipe`'s caption-card geometry → `caption_bar_*`, hook bands →
numeric `hook_position`/`hook_font_size`, and `text_align` 1:1. Both
`generateCarousel` paths run it on the generated slides before save.
Proven by `layout-recipe-apply.test.ts` (13 tests) and
`carousel-recipe-generation.test.ts` caption-card/role tests.

### SC2 — News Oracle generation comes out Oracle-shaped
**PASS.** `carousel-recipe-generation.test.ts` mocks Gemini, runs
`generateCarousel` on a recipe-carrying News Oracle fixture, and asserts:
edge-blended cover caption card (`caption_bar_blend_pct: 14`,
`caption_bar_position: 'bottom'`), big centered headline
(`hook_font_size: 176`, `text_align: 'center'`), full-bleed photo
(`background_url` set), cyan pill highlights preserved, "Trending"
accessory label preserved.

### SC3 — flat-style-only (no-recipe) generation is byte-identical
**PASS (hard gate).** `applyLayoutRecipe` is a no-op early-return for a
null/undefined recipe. `resolveLayoutRecipe` returns null for all 13 code
templates. `carousel-recipe-generation.test.ts` has a named SC3 test
asserting two no-recipe runs persist byte-identical `slide_data`
(JSON.stringify equality) and that no recipe geometry leaks onto a
no-recipe cover. `layout-recipe-apply.test.ts` proves the unit-level
byte-identical no-op path.

### SC4 — newly generated recipe-shaped carousels default to Public
**PASS (hard gate).** Both `generateCarousel` paths still call
`autoPublishOnGenerate` after the save (verified by grep + per-path
regression tests). `carousel-recipe-generation.test.ts` and
`actions-recipe-generation.test.ts` each assert
`autoPublishOnGenerate` is called exactly once, for both the recipe and
no-recipe cases.

## Must-haves

| Item | Status |
|------|--------|
| `src/lib/ai/layout-recipe-apply.ts` — `applyLayoutRecipe` exported, 196 lines, pure | PASS |
| `src/lib/ai/layout-recipe-resolve.ts` — `resolveLayoutRecipe` exported, 69 lines, never throws | PASS |
| Recipe role mapping = position + is_cta (0→cover, is_cta→cta, else body) | PASS |
| `buildSystemPrompt` recipe semantic-hint block after category, before addendum | PASS |
| Both generateCarousel paths wired through applyLayoutRecipe before save | PASS |
| Recipe-apply runs after validateAndRepair (inside generateSlideContent), before save | PASS |
| autoPublishOnGenerate preserved on both paths | PASS |
| Zero new slide/render fields — only existing caption_bar_*/hook_position/hook_font_size/text_align written | PASS |
| Zero Gemini calls in recipe application (O(slides) pure code) | PASS |
| applyLayoutRecipe has no @google/genai / @supabase / react imports | PASS |
| Closed-enum invariant — band resolvers keyed by imported union types | PASS |

## Tests
- Phase 85 new tests: 24 — `layout-recipe-apply.test.ts` (13),
  `carousel-recipe-generation.test.ts` (7), `actions-recipe-generation.test.ts` (4).
  All 24 pass.
- Full suite: 3206 passed / 41 failed / 9 skipped / 1 todo. The 41 failures
  are the documented PRE-EXISTING baseline — verified unchanged (the same
  41 fail with Phase 85 changes stashed). No regression.
- `slide-zero-new-fields` — 2 pre-existing failures (Slide interface drift
  from an earlier phase), unchanged. No new slide fields added by Phase 85.
- `npx tsc --noEmit` — zero errors in any Phase 85 file. The only tsc errors
  project-wide are in the untouched `projects-delete.test.ts` (pre-existing
  mock-typing drift).

## Notes
- Render-parity test runs auto-write 8 `news-oracle` parity snapshot
  entries — confirmed PRE-EXISTING drift (the `news-oracle` template was
  added by a prior quick task without its parity baselines; the writes
  happen identically with Phase 85 changes stashed). Reverted from the
  working tree; not a Phase 85 artifact.

## Verdict
**PASSED.** RECGEN-01 satisfied. All four success criteria proven by
tests; both hard gates (SC3 byte-identical, SC4 public-by-default) hold;
no regression to the pre-existing 41-failure baseline.
