---
quick_id: 260520-ft0
description: Fix tr3nding-news headline scale (pivot to newsZone path)
date: 2026-05-20
status: complete
---

# Quick Task 260520-ft0 — Fix tr3nding-news headline scale

## Problem

User-generated tr3nding-news slides (e.g. "TRUMP OVERTURNS BAN ON CHINESE CHIP SALES") rendered the headline at ~66px — visibly tiny in the bottom card. Root cause:

- Template declared `backgroundMode: 'image-with-bottom-card'` (Phase 45 path).
- `HOOK_FIT_REGISTRY.tr3nding-news` collapsed 42-char hooks via `scale 0.55 × 120 = 66px`.
- Sibling news-oracle / chrome-pulse use the classic newsZone path and stamp ~100-130px via `fitHeadlineToBox(842x620)`.

## Fix (mirrors chrome-pulse quick-260519-bgr verbatim)

**`src/lib/render/templates/tr3nding-news.ts`:**
- Removed `backgroundMode: 'image-with-bottom-card'`.
- Bumped `hookFontSize: '120px'` → `'130px'`.
- Added `captionCardDefaults: { heightPct: 42, blendPct: 15, opacity: 0.80 }` mirroring news-oracle / chrome-pulse so the dark caption-card carries the mint accent cleanly.
- Set `sample.layout: 'cover'` + emptied `sample.body_text` so the template-picker thumbnail renders the headline in cover-mode (matching the real generated cover slide; generated decks still get `layout:'cover'` stamped by `promoteNewsHeadline` at gen time).
- Updated header comment with quick-260520-ft0 rationale.

**`src/lib/render/hook-fit.ts`:**
- Removed the `'tr3nding-news': { baseSize: 120, steps: [...] }` block from `HOOK_FIT_REGISTRY`.
- Added breadcrumb comment under the existing chrome-pulse / sunset-tabloid / soft-sage section.

**`src/__tests__/render/premium-templates.test.tsx`:**
- Renamed the test from `renders image-with-bottom-card + ...` → `renders newsZone caption-card + ...`.
- Updated `captionCardNode` lookup geometry: `height 730/top 1190/backgroundColor "rgba(0,0,0,0.85)"` → `height 806/top 1114/backgroundImage gradient at 0.80 alpha` (the captionCardDefaults effect).
- Updated suite docstring to reflect the new geometry.

## Verification

| Suite | Result |
|-------|--------|
| `src/__tests__/render/premium-templates.test.tsx` | ✅ pass (snapshot refreshed for the new caption-card geometry + body-empty sample; obsolete snapshot pruned) |
| `src/__tests__/render/templates.test.ts` | ✅ pass |
| `src/lib/render/__tests__/parity.template-fingerprint.test.tsx` | ✅ PTF7 (tr3nding-news) pass after snapshot refresh. PTF14/PTF15 (sunset-tabloid/soft-sage) still fail — **pre-existing on `main`**, leftover from quick-260519-bgr; out of scope for this task. |
| `src/lib/render/templates/__tests__/keeper-curation.test.ts` | ✅ pass |
| `src/lib/render/__tests__/hook-fit.test.ts` | ✅ pass |
| `npx tsc --noEmit` | ✅ no new errors in changed files (pre-existing mock/type errors elsewhere unchanged) |

**Visual sanity check:** `npm run thumbs` regenerated `public/templates/tr3nding-news.png`. The headline now renders at ~130px filling the bottom caption-card; TR3NDING kicker, page-counter chip, and mint `$50M` / `12 MINUTES` pill highlights all preserved. User-delivered before/after PNGs (`/tmp/tr3nding-news-before.png` + `after.png`) confirm the oracle-scale pivot.

## Snapshots refreshed (exactly the expected fingerprint shift, no unrelated churn)

- `src/lib/render/__tests__/__snapshots__/parity.template-fingerprint.test.tsx.snap` — PTF7a + PTF7b for tr3nding-news only (font-size 84→130, bg-bleed img → background-image full-bleed).
- `src/__tests__/render/__snapshots__/premium-templates.test.tsx.snap` — tr3nding-news Satori snapshot rekeyed to `tr3nding-news-newsZone-caption-card-with-mid-pill` (obsolete `tr3nding-news-bottom-card-with-mid-pill` pruned).

## Deviations from plan

One: the planner did not anticipate the test-rename + caption-card geometry update in `premium-templates.test.tsx`. The test was asserting the old `image-with-bottom-card` geometry (height:730, top:1190, rgba(0,0,0,0.85)) and broke when those changed to the captionCardDefaults values (height:806, top:1114, gradient). Updated the assertion to match the new geometry — same intent, refreshed constants. Also added `sample.layout: 'cover'` + emptied body_text to make the template-picker thumbnail render correctly (the planner's task list didn't include sample updates, but they're necessary for the picker to show the headline at the same scale generated slides will hit).

## Files touched

- `src/lib/render/templates/tr3nding-news.ts` (template + sample + header comment)
- `src/lib/render/hook-fit.ts` (registry entry removed + breadcrumb)
- `src/__tests__/render/premium-templates.test.tsx` (test rename + geometry update + docstring)
- `src/__tests__/render/__snapshots__/premium-templates.test.tsx.snap` (snapshot refresh)
- `src/lib/render/__tests__/__snapshots__/parity.template-fingerprint.test.tsx.snap` (PTF7 refresh)
- `public/templates/tr3nding-news.png` (regenerated thumbnail)
