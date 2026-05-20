---
slug: 260519-hnp-inline-hint-pill-component
type: quick
date: 2026-05-19
---

# Inline hint pill component + caption-card drag hint

## Goal

Add a reusable, dismissable hint pill that surfaces non-obvious interactions without dominating the UI. First use case: tell users they can drag the headline to move the caption card (the new behavior from `quick-260519-d7g`).

## Component

`src/components/ui/hint-pill.tsx`

- Client component (`'use client'`) because it touches localStorage.
- Props:
  - `hintKey: string` — unique identifier used as the localStorage key for the dismissal flag.
  - `children: React.ReactNode` — the hint text.
  - `icon?: string` — optional Material Symbols icon name (defaults to `lightbulb`).
  - `className?: string` — append to root for positioning by callers.
- localStorage key: `vsm:hint-dismissed:{hintKey}` set to `'1'` on dismiss.
- Defaults to hidden during SSR + hydration; on mount reads localStorage and shows iff not dismissed. (Avoids hydration-mismatch warnings on a hint flag the server can't know.)
- Visual: pill-shaped, brown/cream palette to match the editor (`bg-[#fff0e8]`, `border-[#3d0000]/15`, text `#7d4a3a`, dismiss `×` icon button on the right). Same aesthetic family as the existing slide-counter chip above the canvas.
- Accessibility: `role="status"` so screen readers announce it on appearance; dismiss button has `aria-label="Dismiss hint"`.

## First use site

`src/components/editor/slide-canvas.tsx`

- Show the pill ABOVE the canvas (right under the slide-counter chip) when the current slide has a caption-card headline (`captionCardHeadline` truthy).
- Predicate: replicate the same condition that drives `captionCardHeadline` in `slide-preview.tsx`:
  - `template.backgroundMode == null` (template path that allows news layouts)
  - `currentSlide.style_overrides?.layout != null` (slide has a layout override → news-layout)
  - `caption_bar_enabled === true` OR (unset AND news-layout-slide) (card actually rendered)
- Hint text: `Drag the headline to move the card`.
- `hintKey`: `caption-card-drag-headline-v1`.

## Out of scope

- No global hint-list UI / settings page to re-enable dismissed hints. Power users dismiss once and move on; if we ever need this, the localStorage prefix `vsm:hint-dismissed:` makes a "clear all hints" button trivial later.
- No animation / fade-in. The pill mounts after hydration once; instant appearance is fine and matches the slide-counter chip's behavior.
- No backend persistence. Per-device dismissal is enough — users don't need a hint twice on the same machine. Cross-device repetition is a non-issue for a one-line hint.

## Verification

- Open a news-layout cover slide with a caption card → pill shows above the canvas with the dragging hint.
- Click ×  → pill disappears.
- Reload the page → pill stays dismissed (localStorage check).
- Open a non-news-layout slide → pill does NOT show.
