# Phase 82 — Plan 09 Summary (R10 round 2, Gap E + Gap-D render-wiring)

**Status:** ✅ Complete
**Date:** 2026-05-17

## What was built

Gap E (the renderer breaks words mid-word) and the render-side wiring of Plan
08's caption-card-aware auto-fit.

### (a) Gap E — whole-word wrap in `renderSegments` (`resolve-overlay.ts`)

`renderSegments` derived ONE `<span>` per word for news headlines, and each span
carried `overflowWrap: 'break-word'` — which split a single long word mid-word
when that word was wider than the container ("ANNOUNCE" + orphaned "S"). Both the
pill branch and the plain branch now use `overflowWrap: 'normal'` (the CSS
default — never break inside a word). The hook container's `flex-wrap: wrap`
already wraps between word-spans at spaces; combined with Plan 08's auto-fit
(longest word always fits the box) no mid-word break is ever needed. `maxWidth:
'100%'` is retained.

### (b) `resolveNewsHeadlineFit` — caption-card-aware re-fit (`resolve-overlay.ts`)

New pure exported helper: given a resolved caption bar, the hook text, the
current hook font size, and whether the slide is a news-layout slide, it returns
`fitHeadlineToBox(hookText, captionCardBox(resolvedBar))` when a caption card is
ENABLED on a news-layout slide; otherwise it returns the current size unchanged.
This is the SINGLE source of truth all three render paths call so the headline
fills the k2n draggable/resizable caption card the user dragged — preview ==
export (PARITY-01 / TPLREND-05).

### (c) Wired into all three render paths

- **Satori PNG** (`render-slide-satori.tsx`) — `resolveCaptionBar` hoisted to
  the hook-sizing scope (resolved ONCE, reused by the caption-card JSX);
  `newsHeadlineFontSize = resolveNewsHeadlineFit(cc, hook, hookFontSize, newsZone != null)`
  feeds `hookStyle.fontSize`.
- **Canvas preview** (`slide-preview.tsx`) — `resolveNewsHeadlineFit` computed
  after the `hookFontSize` resolution, gated on the existing `isNewsLayoutSlide`;
  feeds `hookTextStyle.fontSize`.
- **HTML export** (`render-slide.ts`) — refactored the hook size to a numeric
  `hookFontSizePx`; `isNewsLayoutSlide = template.backgroundMode == null &&
  overrides.layout != null` (identical gate across all three renderers);
  emits `font-size: ${newsHeadlineFontSizePx}px`.

### (d) Tests

- New `src/lib/render/__tests__/news-headline-fit.test.tsx` — 6 tests:
  `renderSegments` plain + pill spans use `overflowWrap: 'normal'`;
  `resolveNewsHeadlineFit` is a no-op when the caption bar is disabled and for
  non-news slides; re-fits to the caption card box; a smaller card → smaller size.
- `src/lib/render/__tests__/` — 581 tests pass (29 files).

### (e) Render-parity

The whole-word-wrap change (`overflowWrap: break-word` → `normal`) is a
deliberate style change on every segment span, so segmented-hook render-parity
snapshots changed. Regenerated INTENTIONALLY and verified via `git diff`:

- `src/lib/render/__tests__/__snapshots__/parity.template-fingerprint.test.tsx.snap`
  — 4 snapshots (news-cyan + news-drop long-hook + cover, canvas + Satori paths).
- `src/__tests__/render/__snapshots__/render-slide-satori.test.tsx.snap` — 4
  snapshot blocks (hook mint pill, body block highlight).
- `src/__tests__/render/__snapshots__/premium-templates.test.tsx.snap` — magazine-bold
  + tr3nding-news (mint pill segments).

**Verified:** every changed snapshot line is identical to its pre-change pair
except `overflow-wrap: break-word` → `normal` (and `overflowWrap` in the Satori
JSX-tree snapshots). `git diff` of all snapshot files: **0** changed lines
without `overflowWrap`. No font-size / position / color / layout change; no
unrelated template touched. Only news-segment + premium-segment fixtures changed
— exactly the templates whose hooks use segmented (pill) rendering.

**Pre-existing baseline:** the full test suite has 43 pre-existing failures at
HEAD (the broader `quick-260515-o75` hook-casing baseline; the R10 brief's "~16"
referred to a narrower glob). After Plan 08+09 + the intentional snapshot
regeneration: **still exactly 43 failures** — zero new failures. `+6` tests pass
(the new Gap-D/E tests). `src/__tests__/render/` is back to its 5-failure
pre-existing baseline; `src/lib/render/__tests__/` is fully green (581 pass).

### (f) k2n caption-card rework intact

The caption card still renders as a draggable/resizable colored rectangle in all
three paths — the caption-card `<div>` / element markup is unchanged. Only the
HOOK font size now reads the card geometry via `resolveNewsHeadlineFit`.
`resolveCaptionBar` is read-only consumed, never modified. No circular import:
`hook-fit.ts` imports `ResolvedCaptionBar` as a TYPE only.

## Files modified
- `src/lib/render/resolve-overlay.ts`
- `src/lib/render/render-slide-satori.tsx`
- `src/lib/render/render-slide.ts`
- `src/components/slides/slide-preview.tsx`
- `src/lib/render/__tests__/news-headline-fit.test.tsx` (new)
- snapshot files (intentional regeneration — see (e))
