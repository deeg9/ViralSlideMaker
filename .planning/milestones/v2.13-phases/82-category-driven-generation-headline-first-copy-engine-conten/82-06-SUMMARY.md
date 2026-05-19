# Phase 82 — Plan 06 Summary (Gap A: font-size cap)

**Status:** ✅ Complete
**Date:** 2026-05-17

## What changed

### (a) `clampManualHookSize` is now body-aware — `src/lib/render/hook-fit.ts`
- Added a 5th parameter `hasBody: boolean`.
- When `hasBody === false` (headline-only slide), the function returns
  `manualSize` UNCHANGED — there is no body zone for the headline to wrap into,
  so the overlap rationale that motivated the cap does not apply.
- `MANUAL_GROWTH_MAX` raised `1.6 → 2.6`. The cap still fires for slides that
  carry body text, but a legitimately large user pick survives instead of being
  flattened.
- Doc-comment block updated to explain the Phase 82 Gap A body-aware behavior.

### (b) `hasBody` threaded through both renderers (TPLREND-05 parity)
- `src/lib/render/render-slide-satori.tsx` and `src/components/slides/slide-preview.tsx`
  both compute the BYTE-IDENTICAL expression
  `const hasBody = typeof slide.body_text === 'string' && slide.body_text.length > 0`
  and pass it as the 5th arg to `clampManualHookSize`.
- The `newsZone` / `isNewsLayoutSlide` gates are unchanged — they still decide
  WHETHER the clamp runs; `hasBody` decides whether it CLAMPS.

### (c) Editor hook font-size max raised — `src/components/editor/text-rail/ActiveTextBoxCard.tsx`
- The non-body (hook/custom) font-size `<input>` `max` raised `240 → 400` so the
  editor can express the large headline sizes the body-aware renderer now honors.
  The body-role max stays `120`.

### (d) Tests — `src/lib/render/__tests__/hook-fit.test.ts`
- Existing `clampManualHookSize` block updated for the new 5-arg signature and
  the 2.6× cap (recalculated expected values).
- New `describe('clampManualHookSize — Phase 82 Gap A (hasBody = false)')` block:
  uncapped headline-only behavior, 190 vs 290 render distinctly, the same slide
  IS clamped when `hasBody=true`, unregistered templates pass through.

## New behavior
A headline-only news slide honors the user's manual hook size verbatim — entering
190 vs 290 in the editor now produces genuinely distinct rendered sizes, and the
headline can dominate the slide like the reference. Slides that carry body text
still get an overlap-protecting cap (now 2.6× the auto-fit, was 1.6×).

## Verification
- `npx vitest run src/lib/render/__tests__/hook-fit.test.ts` — 15/15 pass.
- `npx tsc --noEmit` — 19 errors, BYTE-IDENTICAL to HEAD baseline (all in
  pre-existing unrelated test files: auth/signup, stripe, legal, projects-delete).
  Zero new errors in any Plan 06 file.
- Render-parity: full render suite = 16 failed / 623 passed. HEAD baseline =
  16 failed / 620 passed. **Zero new render-parity failures** — the +3 passes
  are the new Gap A hook-fit tests. NO snapshot regeneration was needed: Plan 06
  only changes output for slides with a manual `hook_font_size`, and no parity
  fixture exercises that. The 16 failures are the documented pre-existing
  `quick-260515-o75` hook-casing baseline drift — unrelated to Phase 82.
