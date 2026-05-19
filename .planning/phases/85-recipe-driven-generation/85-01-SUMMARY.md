---
phase: 85-recipe-driven-generation
plan: 01
status: complete
date: 2026-05-18
---

# Plan 85-01 Summary — Recipe-Apply Core

## What was built
- **NEW `src/lib/ai/layout-recipe-apply.ts`** — `applyLayoutRecipe(slides, recipe)`
  pure function. Projects a validated `LayoutRecipe` into existing
  `SlideStyleOverrides` fields:
  - Caption-card geometry → `caption_bar_*` (1:1, numeric).
  - Hook bands → numeric: `position_band` → `hook_position.y` via
    `HOOK_POSITION_BAND_Y` table (top=8…bottom=84); `font_size_band` →
    `hook_font_size` via `HOOK_FONT_SIZE_BAND_PX` (sm=88…xl=176);
    `text_align` flows through.
  - Role mapping by position + `is_cta`: slide 0 → cover, `is_cta:true` →
    cta, rest → body (same as Phase 84 extraction; NOT `assignSlideRoles`).
  - Null/undefined recipe → no-op early-return (SC3 back-compat).
  - Absent recipe role → skip-emit (slide untouched).
  - Pure, immutable, zero Gemini, zero new slide fields. `accessory_label`
    text intentionally never written (Gemini-authored).
- **`buildSystemPrompt`** — gained optional 3rd param `recipe?: LayoutRecipe`.
  When supplied, injects a recipe semantic-hint block (accent-cadence
  guidance + accessory-label intent) after `categoryBlock`, before
  `newsDropAddendum`. `ACCENT_CADENCE_GUIDANCE` Record over the closed
  `ACCENT_CADENCES` enum. Byte-identical prompt when no recipe.
- **`src/lib/ai/__tests__/layout-recipe-apply.test.ts`** — 13 tests, all pass.

## Verification
- `npx tsc --noEmit` — no errors in new/modified files.
- `layout-recipe-apply.test.ts` — 13/13 pass.
- prompts tests — 31/32 pass; the 1 failure (`all 6 hook patterns`) is
  PRE-EXISTING (fails identically with changes stashed; case-sensitive
  substring drift in baseline).
- `slide-zero-new-fields` — 2 failures are PRE-EXISTING (Slide interface
  drift from an earlier phase; verified with changes stashed). No new
  slide fields were added by this plan.

## Deviations
None.
