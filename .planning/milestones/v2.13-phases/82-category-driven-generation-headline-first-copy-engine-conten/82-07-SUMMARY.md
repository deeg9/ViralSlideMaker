# Phase 82 — Plan 07 Summary (Gap B + Gap C: news pills + headline size)

**Status:** ✅ Complete
**Date:** 2026-05-17

## What changed

### (a) New transform — `src/lib/ai/categories/promote-news-headline.ts`
Pure module, never throws. `promoteNewsHeadline(carousel, accentColorHex)`,
per slide:
- **Gap B1** — every existing `hook_segments` entry with `accent: true` gains
  `highlightColor = accentColorHex` + `highlightStyle: 'pill'` (mirrors the
  editor's `toggleAccent`). The renderer's PILL branch in `resolve-overlay.ts`
  only fires on `highlightColor`, so this is what turns Gemini's accents into
  visible pills instead of plain two-color text.
- **Gap B2** — when a slide has NO `hook_segments` / an empty array / none
  accented, segments are DERIVED deterministically from `hook_text`: split on
  whitespace into runs, the 1-2 longest non-connector words marked as accented
  pills (connector/stopword set never accented; degenerate headlines still get
  ≥ 1 pill). GUARANTEE: every news headline ends with ≥ 1 pill segment.
- **Gap C** — sets `style_overrides.hook_font_size = NEWS_HEADLINE_FONT_SIZE`
  (200), respecting any pre-existing override.

### (b) Wired into `src/lib/ai/generate-slides.ts`
`generateSlideContent` calls `promoteNewsHeadline` when `category === 'news'`,
AFTER `CarouselSchema.parse` and BEFORE the `legacyToTextBoxes` map — so the
pill `hook_segments` + large `hook_font_size` flow into BOTH the legacy slide
fields (read directly by both renderers) AND the derived `text_boxes`. Accent
color is read from the resolved template (`getTemplate(templateId).accentColor`
→ `news-cyan` #00E5FF / `tr3nding-news` #A8E0B0). Both generation paths
(`actions.ts` server-action + `services/carousel.ts` API route) converge on
`generateSlideContent`, so this single wiring point covers both.

### (c) News prompt tightened — `src/lib/ai/categories/news.ts`
`hook_segments` is now stated as MANDATORY / non-empty for every slide, must
reproduce the full `hook_text`, and the accented keywords are described as
rendered pills. This reduces reliance on the Task-1 backfill; the backfill
remains the hard guarantee.

### (d) Tests — `src/lib/ai/__tests__/promote-news-headline.test.ts`
10 tests: B1 pill promotion, B2 backfill (no segments / empty array / no
accented entry), no-connector-accenting, the ≥ 1-pill guarantee on degenerate
headlines, the Gap C headline size + pre-existing-override respect, idempotence.

## Gap B "no segments emitted at all" — root cause FOUND and FIXED
The user's test slide showed NO highlight at all. Root cause: `hook_segments`
is `.optional()` in both the Zod schema (`schemas.ts`) and the Gemini response
schema (`generate-slides.ts` — not in the `required` array), so Gemini can
return a headline with no segments — and on the user's run it did.
`validateAndRepair` does NOT strip news segments (its strip is
`templateId === 'documentary'` only) — it simply had nothing to work with.
The Gap B2 deterministic backfill closes this: a news headline can never reach
the renderer without pill segments now.

## New behavior
Generated News headlines render with pill-highlighted keywords (colored
background behind the word), matching the user's reference edit; every headline
has ≥ 1 highlighted keyword even when Gemini emits no segments; headlines
generate large (`hook_font_size` 200) so they dominate the slide. Facts and
legacy generation paths are byte-unchanged (news-only branch).

## Verification
- `npx vitest run src/lib/ai/__tests__/promote-news-headline.test.ts` — 10/10 pass.
- `npx vitest run src/lib/ai/__tests__/ src/lib/ai/categories/__tests__/` —
  28 files, 306 passing (was 302; +4 net from the new suite).
- `npx tsc --noEmit` — 19 errors, BYTE-IDENTICAL to HEAD baseline; zero new
  errors in any Plan 07 file.
- `npm run lint:gates` — passes (closed-enum, prompt-token-budget, framing).
- Render-parity: full render suite = 16 failed / 623 passed — UNCHANGED from
  the post-Plan-06 state. Plan 07 only mutates in-memory generation output, not
  committed template fixtures, so render-parity is unaffected. The 16 failures
  are the documented pre-existing `quick-260515-o75` baseline — no new failures,
  no snapshot regeneration needed.
