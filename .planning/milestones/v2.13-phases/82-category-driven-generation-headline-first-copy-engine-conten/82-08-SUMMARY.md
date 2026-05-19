# Phase 82 — Plan 08 Summary (R10 round 2, Gap D)

**Status:** ✅ Complete
**Date:** 2026-05-17

## What was built

Gap D from the R10 round-2 visual sign-off: the generated news headline overflowed
the slide and broke mid-word because `promoteNewsHeadline` stamped a flat
`NEWS_HEADLINE_FONT_SIZE = 200` onto every news slide regardless of headline
length. Replaced the flat constant with a content-aware auto-fit.

### (a) `fitHeadlineToBox` auto-fit mechanism (`src/lib/render/hook-fit.ts`)

Pure function — no DOM, no measurement API — so it runs identically server-side
(Satori), client-side (canvas preview), and at generation time. Given a headline
and a target `HeadlineBox { widthPx, heightPx }`, it searches `[64, 240]` from the
ceiling down and returns the largest integer font size where:
- the LONGEST single word fits within `widthPx` at that size (so no word ever
  needs to break — this removes the mid-word-break at the sizing layer too), AND
- the whole-word-wrapped headline's total line height
  (`lineCount * size * 1.1`) fits within `heightPx`.

Char-width model: `CONDENSED_CHAR_ADVANCE = 0.50` (slightly conservative vs the
HOOK_FIT_REGISTRY's cited 0.45 so the fit never overflows). `HEADLINE_FIT_CEILING
= 240`, `HEADLINE_FIT_FLOOR = 64`. Whole-word greedy wrap via `wrappedLineCount`.

### (b) `captionCardBox` — the k2n caption-card integration

`captionCardBox(resolved: ResolvedCaptionBar, inset = 80)` converts a quick-260517-k2n
draggable/resizable caption card's resolved `width`/`heightPct` percents into a
pixel `HeadlineBox` on the 1080×1920 canvas, minus a symmetric 80px inset so the
headline does not touch the card edges. This is the primitive Plan 09 wires into
the renderers so a headline rendered into a caption card fills the box the user
dragged — not the default hook zone. `ResolvedCaptionBar` is imported as a
TYPE ONLY (`import type`) and the canvas dimensions are local literals, keeping
the module graph acyclic (Plan 09 has `resolve-overlay.ts` import `fitHeadlineToBox`
back).

### (c) Flat constant removed; auto-fit wired into generation (`promote-news-headline.ts`)

- `export const NEWS_HEADLINE_FONT_SIZE = 200` is **removed entirely** (0
  references remain in `src/`).
- New module constant `NEWS_DEFAULT_HEADLINE_BOX: HeadlineBox = { widthPx: 842,
  heightPx: 620 }` — the default news hook-zone box (842 ≈ 78% canvas width;
  620 the headline-only vertical zone).
- `promoteNewsHeadline`'s Gap-C block now computes
  `fitHeadlineToBox(slide.hook_text, NEWS_DEFAULT_HEADLINE_BOX)` instead of the
  flat 200. The `overrides.hook_font_size == null` guard is retained — a
  pre-existing size is respected.

### (d) Tests

- `hook-fit.test.ts` — new `describe('fitHeadlineToBox + captionCardBox — Phase
  82 Gap D')` with 6 tests: integer-in-range, short→near-ceiling,
  long→smaller+no-overflow, monotonicity, `captionCardBox` conversion, and
  small-card→smaller-fit.
- `promote-news-headline.test.ts` — Gap-C describe block rewritten as Gap-D:
  removed the `NEWS_HEADLINE_FONT_SIZE` import (compile error if kept), now
  asserts the size is content-aware (long < short), in range, short→≥200, and
  the pre-existing-override guard.
- Results: `hook-fit.test.ts` + `promote-news-headline.test.ts` — 33 tests pass.
  Full `src/lib/ai/__tests__/` + `hook-fit.test.ts` — 317 pass, 6 skipped.
  `npx tsc --noEmit` — no new error in `hook-fit.ts` or `promote-news-headline.ts`.

### (e) k2n untouched; render-parity deferred

`resolveCaptionBar` and the k2n caption-card resolver are read-only consumed —
`captionCardBox` only reads a `ResolvedCaptionBar`. `fitHeadlineToBox` /
`captionCardBox` are new functions not yet wired into any renderer, so this plan
touches no template and no committed snapshot. Render-parity verification is
deferred to Plan 09's regression task (Plan 09 wires the renderers).

## Files modified
- `src/lib/render/hook-fit.ts`
- `src/lib/ai/categories/promote-news-headline.ts`
- `src/lib/render/__tests__/hook-fit.test.ts`
- `src/lib/ai/__tests__/promote-news-headline.test.ts`
