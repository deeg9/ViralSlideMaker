---
name: news-hook-autofit
slug: 260428-nws-news-hook-autofit
created: 2026-04-28
status: in-progress
---

# News Templates: Auto-fit Hook Font Size

## Problem

`news-drop` and `news-cyan` set `hookFontSize: 110px` and use the cover layout
which puts the body line at `y=80%`. At 110px Anton, any hook over ~25 chars
wraps to 4 lines and the last line bleeds into the body zone — the user
reported it visually as "OPENAI WINS LANDMARK COPYRIGHT CASE" overlapping
"Federal court rules training on public data is fair use".

## Fix

Char-count-driven auto-fit. New helper `src/lib/render/news-hook-fit.ts`
exports:

- `isNewsTemplate(id)` — `id ∈ {news-drop, news-cyan}`
- `getNewsHookFontSize(text, base)` — returns `base × { ≤22:1.0, ≤44:0.80, ≤66:0.64, else:0.52 }`

Wired into all 3 render paths:

- `src/components/slides/slide-preview.tsx` (editor + picker thumbnails)
- `src/lib/render/render-slide.ts` (HTML render)
- `src/lib/render/render-slide-satori.tsx` (Satori PNG export)

Manual `overrides.hook_font_size` always wins — auto-fit only kicks in when
unset.

## Verification

- `npx tsc --noEmit` clean for changed files.
- "OPENAI WINS LANDMARK COPYRIGHT CASE" (35 chars) → 88px (was 110px).
- "AMAZON FACES PRICE-FIXING ALLEGATIONS" (37 chars) → 88px.
- Both should now fit in the 60-80% Y zone without overlapping the body line
  at y=80%.

## Out of scope

- Pixel-measured auto-fit (requires DOM measurement; char-count heuristic is
  good enough for the reported case).
- Applying auto-fit to non-news templates.
