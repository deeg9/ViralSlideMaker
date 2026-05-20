---
slug: 260519-hnp-inline-hint-pill-component
type: quick
date: 2026-05-19
status: complete
---

# Inline hint pill component + caption-card drag hint — SUMMARY

## Changes

### New file: `src/components/ui/hint-pill.tsx`

Reusable dismissable hint pill. Client component (touches localStorage).
- Props: `hintKey: string`, `children: ReactNode`, `icon?: string` (defaults to `lightbulb`), `className?: string`.
- localStorage key: `vsm:hint-dismissed:{hintKey}` (the `vsm:` namespace is reserved for future hint utilities — e.g. a "reset all hints" button trivially clears the whole prefix).
- SSR-safe: defaults to hidden, mounts, then reads localStorage. Avoids hydration mismatches because the server cannot know per-device dismissal state.
- A11y: `role="status"` so SRs announce on appearance; dismiss button has `aria-label="Dismiss hint"`.
- Visual: pill-shaped, `bg-[#fff0e8]` cream / `border-[#3d0000]/15` brown / text `#7d4a3a`. Same aesthetic family as the slide-counter chip above the editor canvas.

### Wired in: `src/components/editor/slide-canvas.tsx`

- Imports `HintPill`.
- Computes `showCaptionCardDragHint` from the same predicate that drives `captionCardHeadline` in slide-preview: `template.backgroundMode == null && overrides.layout != null && (overrides.caption_bar_enabled === true || (overrides.caption_bar_enabled == null && isNewsLayoutSlide))`. This guarantees the hint only appears on slides where the d7g drag-forwarding actually applies.
- Renders the pill ABOVE the canvas, below the slide-counter chip, with `mb-3` margin so the canvas isn't pushed too far down. `hintKey="caption-card-drag-headline-v1"`. Text: `Drag the headline to move the card`.

## Verification

`localhost:3000/project/75d870d0-1987-4b98-a349-c89a7a5cde85` (news-oracle cover slide with caption card):

- Cleared localStorage `vsm:hint-dismissed:*` keys, reloaded → pill visible above the canvas with the lightbulb icon and dismiss ×.
- Clicked dismiss → pill disappears, `localStorage['vsm:hint-dismissed:caption-card-drag-headline-v1'] = '1'`.
- Reloaded the page → pill stays dismissed (localStorage check), `pillVisible: false`.
- Screenshots: `hnp-01-hint-visible.png`, `hnp-02-pill-closeup.png`.

## Out of scope

- No "reset hints" UI yet. The `vsm:hint-dismissed:` localStorage prefix makes adding one a future one-liner.
- No backend dismissal sync. Per-device is enough for a one-line hint.
- No animation. Instant mount matches the slide-counter chip's behaviour and keeps the pill from feeling chatty.

## Follow-ups (deliberately deferred)

- Audit other non-obvious interactions to add hints to: floating alignment toolbar, marquee select, double-click-to-edit. Each one is now a one-liner.
