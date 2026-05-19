---
phase: 85-recipe-driven-generation
plan: 03
status: complete
date: 2026-05-18
---

# Plan 85-03 Summary — SC2/SC3/SC4 Verification Tests

## What was built
- **`src/lib/services/__tests__/carousel-recipe-generation.test.ts`** — 7
  tests for the API-service `generateCarousel`:
  - SC2: a recipe-carrying generation comes out Oracle-shaped — cover slide
    has an edge-blended caption card (`caption_bar_blend_pct: 14`,
    `caption_bar_position: 'bottom'`), big centered headline
    (`hook_font_size: 176`, `text_align: 'center'`), full-bleed photo
    (`background_url` set), cyan pill highlights preserved, `accessory_label`
    "Trending" preserved. + cta-role routing.
  - SC3 (hard gate): two no-recipe runs persist byte-identical `slide_data`;
    a no-recipe run carries no recipe-injected geometry.
  - SC4: `autoPublishOnGenerate` called exactly once (recipe + no-recipe).
  - recipe-apply precedes the save (recipe-shaped slides persisted).
- **`src/app/(dashboard)/project/[id]/__tests__/actions-recipe-generation.test.ts`**
  — 4 tests for the dashboard server-action `generateCarousel`:
  - SC4 per-path regression guard: `autoPublishOnGenerate` called once with
    the admin client (recipe + no-recipe cases).
  - recipe-shaped `slide_data` persisted when a recipe is present;
    unmodified when absent.

Gemini mocked at `generateSlideContent`; `resolveLayoutRecipe` mocked
deterministically (no live DB); `applyLayoutRecipe` runs REAL.

## Verification
- `carousel-recipe-generation.test.ts` — 7/7 pass.
- `actions-recipe-generation.test.ts` — 4/4 pass.
- `npx tsc --noEmit` — no errors in new test files.
- `slide-zero-new-fields` — still 2 PRE-EXISTING failures, unchanged
  (confirms no new slide fields introduced by Phase 85).

## Deviations
- CONTEXT.md SC2 says "mocks Gemini" — implemented by mocking
  `generateSlideContent` (the Gemini boundary) per the existing
  `carousel-from-references.test.ts` precedent. `resolveLayoutRecipe` is
  also mocked so the recipe input is deterministic without a live DB
  template row — `applyLayoutRecipe` itself runs real, so the genuine
  projection + pipeline wiring is exercised. Not a behavioral deviation.
