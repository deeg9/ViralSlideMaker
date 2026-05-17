# Phase 82 — Gap-Closure Code Review (Plans 06 + 07)

**Reviewed:** 2026-05-17
**Scope:** source files changed by Plans 06 and 07.
**Depth:** standard (per-file analysis).

## Files reviewed
- `src/lib/render/hook-fit.ts` (Plan 06)
- `src/lib/render/render-slide-satori.tsx` (Plan 06)
- `src/components/slides/slide-preview.tsx` (Plan 06)
- `src/components/editor/text-rail/ActiveTextBoxCard.tsx` (Plan 06)
- `src/lib/ai/categories/promote-news-headline.ts` (Plan 07)
- `src/lib/ai/generate-slides.ts` (Plan 07)
- `src/lib/ai/categories/news.ts` (Plan 07)

## Findings

### CRITICAL — fixed during review

**C-1 — layout-lift discards `hook_font_size` (Gap C silently broken).**
`promoteNewsHeadline` writes `style_overrides.hook_font_size = 200` inside
`generateSlideContent`. Both generation paths then run a layout-lift on the
returned slides:
```js
const { layout, ...rest } = s
return layout ? { ...rest, style_overrides: { layout } } : rest
```
The news prompt instructs Gemini to emit `layout` on EVERY news slide
(`prompts.ts:48-50`), so the `layout` branch always fires for news — and
`{ style_overrides: { layout } }` REPLACES `style_overrides`, discarding the
`hook_font_size` Gap C just set. The persisted slide would fall back to the
~124px template default and Gap C would be invisible in production.

**Fix applied:** both layout-lifts now MERGE —
`style_overrides: { ...(rest.style_overrides ?? {}), layout }` — in
`src/lib/services/carousel.ts` and `src/app/(dashboard)/project/[id]/actions.ts`.

### Reviewed — no issues

- **hook-fit.ts** — body-aware `clampManualHookSize`: signature change is
  exhaustively threaded (only 2 production callers, both updated). `MANUAL_GROWTH_MAX`
  raise is well-documented. No edge case missed (`hasBody=false` short-circuits
  before the autoFit math).
- **Both renderers** — the `hasBody` expression is byte-identical
  (`typeof slide.body_text === 'string' && slide.body_text.length > 0`),
  satisfying the TPLREND-05 parity contract. Placed correctly relative to the
  `newsZone` / `isNewsLayoutSlide` gate.
- **ActiveTextBoxCard.tsx** — `max` raise is a pure UI bound; the renderer is
  the real clamp authority.
- **promote-news-headline.ts** — pure, never throws, defensive on
  `hook_text ?? ''`. The B2 backfill guarantee (≥ 1 pill) holds even for
  degenerate headlines (verified by test). `hook_font_size` pre-existing
  override is respected. Connector-word set matches the news.ts prompt.
- **generate-slides.ts** — wiring placed AFTER `CarouselSchema.parse` and
  BEFORE `legacyToTextBoxes`, so pills + size flow into both legacy fields and
  derived `text_boxes`. News-only branch — facts/legacy untouched. Accent-color
  fallback chain is safe.
- **news.ts** — prompt-text-only change; no schema/export drift.

## Verdict
1 Critical finding, fixed during review. No Warning/Info findings remain.
The gap-closure changes are sound.
