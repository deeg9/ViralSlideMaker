---
name: 260428-css summary
description: Explore detail page now lets viewers flip through every slide of a published carousel
type: project
status: complete
---

# Quick Task 260428-css — SUMMARY

## What shipped

`/explore/[slug]` previously showed only the pre-rendered hero PNG of
slide 1. Anyone discovering a carousel on Explore had to fork it into
their dashboard before they could see slides 2..N. Added the same
left/right arrow viewer the editor uses, so viewers can flip through
the entire carousel right on the public page.

## Files

- **New** `src/app/explore/[slug]/carousel-slideshow.tsx` — client
  component (~55 lines). Takes `slides: Slide[]`, `template: SlideTemplate`,
  optional `ownerTier`. Maintains `selectedIndex` state, renders one
  `<SlidePreview editable={false} />` at a time inside chevron buttons
  styled identically to `src/components/editor/slide-canvas.tsx`. First
  arrow disabled at index 0, last arrow disabled at index N-1.
- **Modified** `src/app/explore/[slug]/page.tsx`:
  - imports `CarouselSlideshow`, `getTemplate`, `getUserTier`
  - server-side: `template = getTemplate('bold-minimal')` (matches what
    `fork_published_carousel` defaults to since `published_carousels`
    doesn't store `template_id`); `ownerTier = await getUserTier(c.owner_id)`
    keeps the free-tier watermark consistent across all slides
  - renders `<CarouselSlideshow>` when `slide_data.length > 0`, else
    the legacy hero `<Image>` fallback for the degenerate empty-slides
    case

## Trade-off

`published_carousels.slide_data` doesn't preserve the original
`template_id`. Slides 2..N render with `bold-minimal` even if the
project was originally created with a different template. Per-slide
`style_overrides` carry over and cover most look decisions, but a
carousel originally rendered with (e.g.) `quote-card` will look
slightly different in the slideshow viewer than in the pre-rendered
hero PNG.

Long-term fix: store `template_id` on `published_carousels`. Not a
v2.5 blocker — file under deferred polish.

## Verification

- `npx tsc --noEmit | grep "explore/\\[slug\\]"` → clean
- Visiting any `/explore/<slug>` shows arrows + "Slide X / N"; clicking
  cycles through slides; first/last arrows disabled at the edges
- The `<SlidePreview editable={false}>` path was already used for
  thumbnails, so no new render bugs introduced

## Notes

The previous hero `<Image>` is left as a fallback rather than deleted
because the component renders fine even if `slide_data` is somehow
empty (legacy rows, edge cases). Cheap defense-in-depth.
