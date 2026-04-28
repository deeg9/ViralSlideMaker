# Quick Task 260428-css: Explore detail carousel slideshow

## Why

The Explore detail page (`/explore/[slug]`) showed only the published
carousel's hero image — viewers couldn't see slides 2..N without forking
the carousel into their own dashboard first. The dashboard project page
already has a left/right arrow viewer for navigating slides; the same
affordance was missing on the public surface.

User wants viewers to flip through every slide of a carousel they
discover on Explore.

## What ships

1. **New** `src/app/explore/[slug]/carousel-slideshow.tsx` — client
   component that takes `slides`, `template`, optional `ownerTier`,
   maintains a `selectedIndex` state, and renders one
   `<SlidePreview>` at a time bracketed by chevron-left/right buttons
   and a "Slide X / N" pill. Mirrors the styling of `slide-canvas.tsx`
   on the editor side.
2. **Modified** `src/app/explore/[slug]/page.tsx` — replaces the
   single hero `<Image>` with the new client component when
   `slide_data.length > 0`. Hero image stays as a fallback for the
   degenerate empty-slides case. Loads `bold-minimal` template
   (matches what `fork_published_carousel` defaults to since
   `published_carousels` doesn't store a `template_id`) and the
   owner's tier so the free-tier watermark stays consistent across
   all slides.

## Files

- **New** `src/app/explore/[slug]/carousel-slideshow.tsx` (~55 lines).
- **Modified** `src/app/explore/[slug]/page.tsx`:
  - imports `CarouselSlideshow`, `getTemplate`, `getUserTier`
  - looks up `template = getTemplate('bold-minimal')` and
    `ownerTier = await getUserTier(c.owner_id)` server-side
  - renders the slideshow when `c.slide_data.length > 0`, else the
    old hero `<Image>` fallback

## Trade-off / known gap

Published carousels don't store the original `template_id` (publish
RPC only snapshots `slide_data`). Falling back to `bold-minimal` is the
same convention the fork RPC already uses, but this means a carousel
originally rendered with a non-default template may render slightly
differently in the slideshow viewer than in the pre-rendered hero PNG
(slide 1 specifically). For most carousels this difference is small
because per-slide `style_overrides` carry over and cover most look
decisions; long-term fix is to store `template_id` on
`published_carousels`. Not a v2.5 blocker.

## Verification

- Visit `/explore/<slug>` — left/right arrows present, click cycles
  through slides, "Slide X / N" counter updates.
- First-slide arrow disabled; last-slide arrow disabled.
- Each slide renders backgrounds + text overlays + watermark identical
  to the dashboard editor view.
- `npx tsc --noEmit | grep "explore/\\[slug\\]"` clean.
