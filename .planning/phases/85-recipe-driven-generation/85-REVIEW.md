---
phase: 85-recipe-driven-generation
status: clean
depth: standard
date: 2026-05-18
files_reviewed: 8
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
---

# Phase 85 Code Review — Recipe-Driven Generation

**Depth:** standard. **Scope:** 8 files changed in Phase 85 (5 source, 3 test).

## Files reviewed
- `src/lib/ai/layout-recipe-apply.ts` (new)
- `src/lib/ai/layout-recipe-resolve.ts` (new)
- `src/lib/ai/prompts.ts` (modified)
- `src/lib/services/carousel.ts` (modified)
- `src/app/(dashboard)/project/[id]/actions.ts` (modified)
- `src/lib/ai/__tests__/layout-recipe-apply.test.ts` (new)
- `src/lib/services/__tests__/carousel-recipe-generation.test.ts` (new)
- `src/app/(dashboard)/project/[id]/__tests__/actions-recipe-generation.test.ts` (new)

## Findings

### IN-01 (Info) — no-op path returns the input array by reference
`src/lib/ai/layout-recipe-apply.ts` — `applyLayoutRecipe(slides, null)`
returns the SAME `slides` array reference, whereas the recipe path returns
a fresh array of fresh objects. This is an intentional, documented
fast-path (no-op early-return) and is harmless: both `generateCarousel`
callers only READ `slides` after the call (persist via `.update()`, read
`.length`) — verified, no post-call mutation on either path. The unit test
asserts JSON byte-identity, which holds. Left as Info — no change needed;
noted only so a future caller that mutates the result is aware the no-op
path aliases its input.

## Notes (no findings — verified correct)
- **Purity / immutability:** `applyLayoutRecipe` is pure — no I/O, no
  Date/random/console, no Gemini/Supabase/React imports (grep-confirmed).
  The recipe path never mutates input slides or their `style_overrides`
  (spread-copy); proven by an immutability unit test.
- **No-op back-compat (SC3):** null/undefined recipe → early return;
  `resolveLayoutRecipe` returns null for all 13 code templates. Byte-identity
  proven by tests.
- **Closed-enum invariant:** band resolvers (`HOOK_POSITION_BAND_Y`,
  `HOOK_FONT_SIZE_BAND_PX`) are `Record<>` keyed by the imported union
  types — a new band value is a compile error. No enum literals redefined.
- **Zero new slide fields:** only existing `caption_bar_*` / `hook_position`
  / `hook_font_size` / `text_align` keys are written.
- **resolveLayoutRecipe never throws:** code-template short-circuit, then a
  try/catch around the DB call; missing row / null column / DB error /
  malformed recipe all degrade to `null`. Matches the registry.ts contract.
- **Pipeline placement:** recipe-apply runs after the font/effects steps
  (which run after `validateAndRepair` inside `generateSlideContent`) and
  immediately before the `projects` save on BOTH paths.
- **Public-by-default (SC4):** `autoPublishOnGenerate` calls on both paths
  are untouched and still run after the save; per-path regression tests
  assert one call each.
- **Prompt back-compat:** `recipeHintBlock` is the empty string when no
  recipe is supplied — `buildSystemPrompt` output is byte-identical for
  every existing caller.

## Verdict
**CLEAN.** No Critical or Warning findings. One Info note (intentional
no-op aliasing, harmless). The highest-blast-radius phase of the milestone
is implemented as a separable, pure, well-tested deterministic layer with
the SC3 back-compat and SC4 public-by-default hard gates both proven.
