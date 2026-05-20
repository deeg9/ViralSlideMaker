---
slug: 260519-bkn-breaking-news-badge
type: quick
date: 2026-05-19
---

# BREAKING NEWS badge on news-oracle cover

## Goal

Render a `—— BREAKING NEWS ——` badge above the caption card on the cover slide of news-oracle carousels. Always on (no toggle). Matches across editor preview + Satori PNG export + HTML export.

## Visual spec (in 1080×1920 canvas units)

- Centered horizontally
- Two short white horizontal rules, each `96px` long, `2px` thick
- Gap `16px` between each rule and the text
- Text "BREAKING NEWS" — Anton font, white (`template.textColor`), `28px`, uppercase, letter-spacing `4px`, weight 400 (Anton ships single-weight)
- Vertical position: bottom edge of the badge sits `28px` above the caption-card top edge (`cc.y%`)
- z-index above the photo + overlay but BELOW the headline (so the card's edge-blend doesn't obscure it)

## Architecture — shared module, three consumers

New file: `src/lib/render/breaking-news-badge.ts`

```ts
export const BREAKING_NEWS_BADGE = {
  text: 'BREAKING NEWS',
  fontSizePx: 28,
  letterSpacingPx: 4,
  lineLengthPx: 96,
  lineThicknessPx: 2,
  lineGapPx: 16,
  bottomOffsetPx: 28,  // distance from badge baseline to card top edge
} as const

export function shouldShowBreakingNewsBadge(
  templateId: string,
  slideRole: string | undefined,
): boolean {
  return templateId === 'news-oracle' && slideRole === 'cover'
}
```

Three render surfaces consume it:

1. **`src/components/slides/slide-preview.tsx`** — new `BreakingNewsBadgeLayer` component near `CaptionCardLayer`. Renders in BOTH the non-editable branch (line ~1355, sibling of `<CaptionCardLayer />`) and the editable branch (after the caption-card Rnd at line ~1909). Uses `%`-based positioning so the canvas scale is honored.

2. **`src/lib/render/render-slide-satori.tsx`** — JSX block after the caption-card render (around line ~493). Uses absolute pixel positions (Satori is pixel-precise at 1080×1920).

3. **`src/lib/render/render-slide.ts`** — HTML string after `captionCardHtml`. Uses `%`-based positioning consistent with the rest of the HTML export.

## Constants → coordinates

Given `cc.y` (caption-card top edge, in %):

- Badge bottom (px): `(cc.y / 100) * 1920 - BOTTOM_OFFSET_PX`
- Badge height: ~font height + line thickness, roughly `40px` total
- Badge top (px): `bottomPx - 40`

For browser/Satori parity, use flex centering. The line+text+line row is a `flex` with `gap: 16px` and `align-items: center`.

## Out of scope

- User toggle to hide the badge — per `AskUserQuestion` answer, always on.
- Other templates getting a similar badge — news-oracle only.
- Animation — static element, no flashing.
- Different copy per slide — fixed string "BREAKING NEWS".

## Verification

- Manual: open a news-oracle carousel → cover slide shows the badge above the caption card. Non-cover slides (role !== 'cover') do NOT show it.
- Visual: matches the user's screenshot (short flanking lines, not full-width).
- Export: run a quick Satori render of a news-oracle cover via the export flow; badge appears in the PNG. (Skipped if no easy local Satori test path — caption-card byte-identical tests will catch regressions.)
- Regression: non-news-oracle covers and non-cover news-oracle slides remain unchanged (existing caption-bar tests pass).
