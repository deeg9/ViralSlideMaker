---
name: news-hook-autofit
slug: 260428-nws-news-hook-autofit
date: 2026-04-28
status: complete
commit: f015b49
---

# Summary — News Hook Auto-fit

## What changed

- New `src/lib/render/news-hook-fit.ts` exports `isNewsTemplate()` +
  `getNewsHookFontSize(text, base)` — a char-count scaler returning
  `base * { ≤22:1.0, ≤44:0.80, ≤66:0.64, else:0.52 }`.
- Wired into the 3 render paths so editor, picker thumbnails, HTML render,
  and Satori PNG export all auto-shrink news hooks consistently:
  `slide-preview.tsx`, `render-slide.ts`, `render-slide-satori.tsx`.
- Manual `overrides.hook_font_size` still wins — auto-fit only applies when
  unset and the template is `news-drop` or `news-cyan`.

## Effect on the reported case

- "OPENAI WINS LANDMARK COPYRIGHT CASE" (35 chars) → 88px hook (was 110px).
- "AMAZON FACES PRICE-FIXING ALLEGATIONS" (37 chars) → 88px hook.
- Both now fit cleanly in the 60-80% Y window without bleeding into the
  body line at y=80%.

## Verification

- `npx tsc --noEmit` clean for changed files.
- No regressions to non-news templates (helper is gated on `isNewsTemplate`).
