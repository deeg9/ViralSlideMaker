---
slug: 260519-bkn-breaking-news-badge
type: quick
date: 2026-05-19
status: complete
---

# BREAKING NEWS badge on news-oracle cover — SUMMARY

## Changes

### New shared module
**`src/lib/render/breaking-news-badge.ts`** — single source of truth for badge geometry + gate. All three render paths import from here, keeping TPLREND-05 / PARITY-01 invariants.

- `BREAKING_NEWS_BADGE` frozen spec: text, font/letter spacing, line length+thickness, gap, vertical offset, total height.
- `shouldShowBreakingNewsBadge(templateId, slideRole)` — true iff `news-oracle` cover slide.
- `breakingNewsBadgeTopPct(captionCardTopPct)` — derives badge top % from the resolved caption-card top %.

### Three render surfaces wired

1. **`src/components/slides/slide-preview.tsx`** — new `BreakingNewsBadgeLayer` component:
   - Mounted in NON-editable branch (sibling of `<CaptionCardLayer />`).
   - Mounted in EDITABLE branch (sibling of the caption-card Rnd, before `<OverlayLayers />`).
   - Skips render when `cc.enabled === false`.
   - z-index 3 — above the photo overlay (z-1) + caption card (z-2), below the headline (z-10).
   - Reads `template.textColor`, `template.headingFontFamily ?? template.fontFamily`, `template.hookFontWeight ?? 400` so a future template can override fonts without touching badge code.

2. **`src/lib/render/render-slide-satori.tsx`** — JSX block emitted right after the caption-card render. Uses absolute pixel positions on the 1080×1920 canvas. Same spec values, byte-identical layout to the editor preview.

3. **`src/lib/render/render-slide.ts`** — `breakingNewsHtml` string built next to `captionCardHtml`; interpolated into the HTML output right after the card div. Same `%`-based positioning as the editor preview branch.

## Verification

`npx vitest run src/lib/render/__tests__/breaking-news-badge.test.ts` — 6/6 pass:
- Gate true ONLY for `news-oracle` + `cover` — verified against every other role and against 4 other templates' covers.
- Geometry: `breakingNewsBadgeTopPct(62)` = `(1190.4 - 28 - 36) / 1920 * 100`; scales linearly with card top.
- Frozen spec values match PLAN.md.

`npx vitest run src/lib/render/__tests__/caption-bar-overrides.test.ts src/__tests__/render/legacy-templates-byte-identical.test.ts src/__tests__/render/templates.test.ts` — 29/29 pass (no regressions in the resolver or legacy-template byte-identity).

## Out of scope (intentionally)

- User toggle to hide the badge — per `AskUserQuestion`, always on. The badge is part of the template's cover chrome.
- Visual verification in the browser — would require switching an existing project's template to news-oracle, which isn't exposed in the editor route. Unit tests + the shared-module pattern (already used for the caption card itself) cover the parity invariants. The user will see it when generating a new news-oracle carousel.
- Pre-existing test failures (`templates registry holds the v2.12/v2.13 trailing-edge count` × 3) — failing on `main` before this work; unrelated. The fix is a one-line update to those tests when someone next touches them.
- Pre-existing missing snapshot entries for news-oracle in 2 fingerprint-test files — would get auto-written on next snapshot regen, but they're not my changes to commit.
