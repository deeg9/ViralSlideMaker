---
phase: quick-260503-0f2
status: incomplete
date: 2026-05-03
---

# Quick Task 260503-0f2: Summary

**HONEST STATUS: PARTIAL FIX — user-visible bug NOT fixed.**

## What the user reported

Exported PNG (`slide-01.png`) diverges visibly from the live web UI preview on a `news-cyan` slide with a 40-char hook ("YOUR BRAIN IS OUTSOURCING THINKING TO AI") + 3-segment body. Body text overlaps the hook in the export; in the preview it sits cleanly below.

## What I actually fixed

**Pinned a JSX-level regression test.** The PARITY-04 fingerprint suite from Phase 65 was supposed to catch this — it didn't, because the original fixture uses a 16-char hook with no `style_overrides.layout='cover'`, missing the corner of the template matrix the user actually hit. Added 4 snapshot tests (PTL1a/b for news-cyan, PTL2a/b for news-drop) covering the long-hook + cover-layout scenario.

Commit: `7b40ee2 test(quick-260503-0f2): pin PARITY-04 long-hook + cover-layout fingerprint for news-*`

## What I did NOT fix

The user's actual visual bug. **Why:**

A debugger probe through both `SlidePreview editable={false}` and `buildSlideElement → renderToStaticMarkup` for the user's exact slide showed the renderers emit byte-aligned JSX:

| Metric | React preview | Satori | Match |
|---|---|---|---|
| hookFontSize | 57px (auto-shrunk from 110×0.52) | 57 | ✓ |
| hookY | 60% | 1152px (= 60% × 1920) | ✓ |
| bodyY | 80% | 1536px (= 80% × 1920) | ✓ |
| hookWidth | 78% | 842px | ✓ |
| hook span count | 7 | 7 | ✓ |
| accent color | rgb(0, 229, 255) | #00E5FF | ✓ |

The visual divergence comes from the **rasterization layer**, not the JSX layer:

1. **Anton font weight synthesis** — `font-catalog.ts:295-300` registers Anton at weight 400 only (Google Fonts ships Anton single-weight). Templates default to `fontWeight: 900`. Browser DOM falls back to weight 400 (no synthesis by default for Anton). Satori's font matcher behavior differs at this corner.
2. **Flex-wrap vs block-layout text-break algorithm** — both renderers use `display:flex; flex-wrap:wrap` on the hook container with multi-segment span children. Browser's flex-wrap and yoga's flex-wrap (Satori) agree on most inputs but diverge on text-break decisions when individual segments contain multi-word phrases — which is the exact shape of news-cyan's hook segments.

Both are pre-existing architectural asymmetries that affect THIS template + THIS hook length specifically. They're not within the scope of a single quick task to fix.

## Pre-existing v2.11 carry-forward

This bug was **NOT introduced by v2.11.** The PARITY-04 fingerprint suite that shipped in Phase 65 only locked the JSX-level contract at one specific fixture (16-char hook, default layout). Any divergence outside that one fixture was already untested. The regression-pinning fixture I added today closes that specific gap.

## Recommended follow-up (out of scope for this quick task)

Two real fixes worth scheduling:

1. **Anton single-weight handling** — either explicitly force `fontWeight: 400` on Anton-using templates (news-drop, news-cyan, magazine-bold, tr3nding-news), OR register Anton-as-Anton-Bold-fallback in font-catalog so both renderers see the same weight metadata. Touches: `src/lib/render/templates/news-cyan.ts`, `news-drop.ts`, `magazine-bold.ts`, `tr3nding-news.ts`, possibly `font-catalog.ts:295-300`. Estimated 30-60 min + visual verification across the 4 templates.

2. **Hook-block text-wrapping parity** — investigate whether switching the Satori hook container from `flex-wrap` to a different layout (e.g., `display: block` with each segment as inline-block, or `<span>` siblings inside a `<div>` with `wordBreak`) produces wrapping behavior identical to the browser. Risk: high — touches the rendering hot path; needs careful PARITY-04 fixture regression sweep across all 12 templates after change. Estimated 2-4 hours.

Both worth a /gsd-quick or v2.12 phase. Do NOT silently snapshot-update PARITY-04 — that hides drift instead of fixing it.

## Files

- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/render/__tests__/__fixtures__/parity-fingerprint-fixtures.ts` — added `longHookCoverFixtureSlide`
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/render/__tests__/parity.template-fingerprint.test.tsx` — added PTL1a/b + PTL2a/b describe block
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/render/__tests__/__snapshots__/parity.template-fingerprint.test.tsx.snap` — 4 new pinned snapshots
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/.planning/debug/export-divergence-tplrend05.md` — debugger session capture (root cause analysis + evidence + reasoning checkpoint)

## Verification

- 4 new PTL fingerprint tests pass (snapshots committed)
- 97 parity tests pass (was 93; +4 new)
- 302 render tests pass; tsc baseline maintained at 17 errors
- Zero changes to production renderers
