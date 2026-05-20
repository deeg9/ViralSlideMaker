---
slug: 260519-d7g-hook-drag-forwards-to-caption-card
type: quick
date: 2026-05-19
status: complete
---

# Hook drag forwards to caption-card drag — SUMMARY

## Changes

Single file: `src/components/slides/slide-preview.tsx`.

1. **`disableDragging` gate relaxed** (line 1955). Dropped `!!captionCardHeadline` from the lockout. Card-bound headlines are now draggable; the existing `hookLocked || hookEditing` rules still apply.

2. **`onDragStart` (line 1957)** — when `captionCardHeadline` is truthy, snapshot the start position into `hookDragStartRef.current` and short-circuit before the snap-index / alt-state bookkeeping. None of that machinery applies to a card-managed headline.

3. **`onDrag` (line 1980)** — when `captionCardHeadline` is truthy, short-circuit immediately. react-rnd handles the visual translate via its own controlled-drag state; no snap pass needed (a card-managed headline is constrained to the card, not a free-floating element with snap targets).

4. **`onDragStop` (line 2044)** — when `captionCardHeadline` is truthy, compute the gesture delta from the start-ref, convert to `% of canvas`, add to `captionBarForFit.x / .y`, clamp `[0, 100]`, and dispatch ONE `onCaptionBarUpdate({ caption_bar_x, caption_bar_y })`. Skip every snap / group-drag / alt-duplicate / per-element fan-out branch below — none of them have meaning for a card-managed headline.

## Verification

Playwright drag on `localhost:3000/project/75d870d0-1987-4b98-a349-c89a7a5cde85` (news-oracle cover slide with caption_bar_enabled + overrides.layout = 'cover'):

- Drag headline DOWN 80px → `caption_bar_y` went from `62.25` → `68.53` (delta +6.28%, matches the 80px / scale conversion). Card visibly moved down with the headline.
- Drag headline UP 80px → `caption_bar_y` went from `68.53` → `58.49` (delta −10.04%, matches the 80px / scale conversion). Card visibly moved up.
- Headline cursor changed from `auto` to `move` — affordance now matches behavior.
- `caption_bar_x` left at 0 (unchanged) when the gesture had no horizontal component — math is symmetric on x/y.

## Out of scope (intentionally)

- **Live preview** of the card during the gesture. Current behavior: react-rnd translates the headline visually while the card stays at its prop position; on drag stop the card commits to the new position and the headline derived-position recomputes to the card centre. Verified empirically — there is no visible "snap" on release because the headline derivation lands at exactly where react-rnd had it.
- **Non-card-bound headlines.** When `captionCardHeadline` is null (e.g. legacy slides without `overrides.layout` set), the headline keeps its existing free-floating drag with snap / group / alt-duplicate semantics — that path is untouched and preserved via the same `if (captionCardHeadline)` early-return guard.
- **Hook resize** when card-bound — already locked via `enableResizing` (line 1954). Stays locked.
