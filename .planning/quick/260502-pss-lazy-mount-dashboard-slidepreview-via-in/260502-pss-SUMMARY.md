---
phase: quick-260502-pss
status: complete
date: 2026-05-03
---

# Quick Task 260502-pss: Summary

Lazy-mounted the dashboard `<SlidePreview>` via `IntersectionObserver` to keep first-paint snappy as project lists grow.

## Files changed

| File | Change |
|------|--------|
| `src/components/projects/project-card.tsx` | Added `hasBeenVisible` state (sticky once true) and an `IntersectionObserver` keyed off a new `thumbRef` on the thumbnail container. Below-the-fold cards render a lightweight `<img loading="lazy" decoding="async" src={slide.background_url}>` (or a colored backdrop for color-only templates with no photo) until they enter a 400px-rootMargin pre-mount zone, at which point `<SlidePreview>` swaps in. The arrow buttons + page counter still work after mount because `currentSlideIndex` state is preserved across the swap. |

## Approach

- **Sticky-true state.** Once visible, the preview stays mounted forever — scrolling away doesn't unmount, so flipping slides and re-entering the viewport doesn't re-render the heavy tree. Trade-off accepted: peak memory grows linearly with viewed cards, but the dashboard isn't long-lived enough for that to matter.
- **400px rootMargin.** Pre-mounts cards roughly one card-height before they enter the viewport so users with fast scroll don't see the placeholder→preview swap mid-card.
- **Placeholder fidelity.** For photo templates the placeholder is the same `slide.background_url` photo the dashboard used before this milestone — no visual regression vs. the pre-rendered version. For paper-essay / brutalist-grid (color-only, no photo) the placeholder is a solid block matching `template.backgroundColor`, which blends into the final preview's background.
- **SSR safe.** Guarded `typeof IntersectionObserver === 'undefined'` falls back to immediate-mount; the component is `'use client'` so the guard only runs after hydration anyway, but the explicit check protects very old browsers.
- **One-shot observer.** `observer.disconnect()` after the first intersection — no ongoing observation cost per card.

## QA (smoke-tested via Playwright MCP)

| Check | Result |
|-------|--------|
| Cards above the fold mount `<SlidePreview>` immediately on first paint (IO fires on observe when element already visible) | ✓ |
| `npx tsc --noEmit` — no new errors in changed file | ✓ |
| Slide-flip arrows still work after lazy mount | (state preserved across swap; arrows inherent to ProjectCard, untouched) |

## Commits

- `c255409` — perf(quick-260502-pss): lazy-mount dashboard SlidePreview via IntersectionObserver

## Notes for future

- If profiling later shows the placeholder→SlidePreview swap is itself janky on slow devices, options are: (a) progressively mount in chunks via `requestIdleCallback`, (b) increase rootMargin to 800px, (c) move SlidePreview into a `React.lazy()` chunk so the JS isn't even parsed until first card hits the viewport.
- A SlidePreview-thumbnail-only variant (stripping the editor-only wiring like Rnd, alignment guides, etc.) would shrink the work-per-mount further. Out of scope today.
