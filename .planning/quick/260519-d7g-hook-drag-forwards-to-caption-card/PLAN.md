---
slug: 260519-d7g-hook-drag-forwards-to-caption-card
type: quick
date: 2026-05-19
---

# Hook drag forwards to caption-card drag

## Goal

When a slide has a caption-card headline (`captionCardHeadline` is truthy), dragging the headline text should drag the underlying card. The headline auto-positions itself to the card centre, so this is the intuitive UX — the user sees the text move and the card "carries" the text with it.

## Current behavior

`src/components/slides/slide-preview.tsx:1955`:

```jsx
disableDragging={hookLocked || hookEditing || !!captionCardHeadline}
```

The headline Rnd is drag-locked whenever there's a caption card. The card behind it is draggable but only ~70px wide on either side of the text (the headline covers ~87% of slide width), so the click target for moving the card is impractically small.

## Plan

Single file: `src/components/slides/slide-preview.tsx`.

1. **Re-enable dragging on the headline Rnd when card-bound.** Drop `!!captionCardHeadline` from `disableDragging`. (`hookLocked || hookEditing` stays.)

2. **Branch the hook drag handlers at the top.** When `captionCardHeadline` is truthy:
   - `onDragStart`: record `hookDragStartRef.current = { x: data.x, y: data.y }` and short-circuit before the snap/group-drag bookkeeping (that bookkeeping doesn't apply when the headline is card-managed).
   - `onDrag`: short-circuit. Let react-rnd handle the visual translate via its internal drag state. No snap pass needed because the headline is constrained to the card.
   - `onDragStop`: compute the gesture delta in % of canvas (`dx = (data.x - startRef.x) / REF_WIDTH * 100`, same for y), add it to the current `captionBarForFit.x/y`, clamp to `[0, 100]`, and commit ONE `onCaptionBarUpdate` call. Skip all the alt-duplicate, group-drag, and per-element fan-out branches — card-bound headline has none of those semantics.

3. **Visual during gesture:** react-rnd will translate the headline with the cursor (its normal controlled-drag visual). The card itself only updates on release; on release the slide state's `caption_bar_x/y` change, the card re-renders at the new spot, and the headline's derived `hookRndPixels` re-positions back to the card centre. So the visible jump on release should be zero — the headline lands at exactly where the user dragged it (since card moved by the same delta).

4. **No new props needed.** `onCaptionBarUpdate` already exists end-to-end (slide-preview → slide-canvas → slide-editor, lines 1641-1648 wire it to one `UPDATE_SLIDE` with full history). Reusing it means the gesture records exactly one undo entry, matching the card-drag pattern.

## Out of scope

- Hook resizing when card-bound — already locked via `enableResizing` at line 1954. Stays locked. Card-managed = card-managed; you resize the card.
- Body text drag behavior — untouched (no `captionCardBody` analogue exists; bodies aren't card-bound).
- Snap/group-drag/alt-duplicate semantics for hook — preserved for the non-card-bound case via the same early-return guard.
- Live-preview of the card during the headline drag — could be a follow-up if the release-snap feels off in practice. Starting with commit-on-stop because:
  (a) it's the same UX shape the caption-card Rnd's own drag uses today, and
  (b) it avoids react-rnd's "position prop changing mid-drag" foot-guns.

## Verification

- Manual: open a news/cover slide with caption-card headline → drag the headline text → on release, the card has moved to the new position and the headline is centred inside it.
- Playwright: drag the headline by ~120px right, assert `style_overrides.caption_bar_x` updated to ~original + 120/REF_WIDTH*100, and assert the headline's `getBoundingClientRect()` is near the new card centre.
- Regression: drag the caption card itself (clicking outside the text) — must still work exactly as before.
- Regression: drag a non-card hook (any older slide without caption card) — must still hit all the snap/group/alt-duplicate paths.
