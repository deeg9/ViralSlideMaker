---
quick_id: 260515-explore-slide-arrows
created: 2026-05-15
completed: 2026-05-15
status: complete
---

# Summary — Add slide-flip arrows to Explore cards

## What shipped
Explore (`/explore`) carousel cards now expose left/right chevron arrows and a "N / M" counter pill on hover, mirroring the dashboard `ProjectCard` pattern. Users can flip through every slide of a published carousel without leaving the grid.

## Files
- **NEW** `src/app/explore/explore-card.tsx` — client component; `useState` for slide index; chevrons + counter on group-hover; `useRouter().push()` for card navigation so arrow buttons can `stopPropagation` without fighting `<Link>` semantics.
- **EDIT** `src/app/explore/page.tsx` — added `slide_data, template_id` to the `published_carousels` select; swapped inline card JSX for `<ExploreCard>`.

## Behavior
- Cover slide (index 0) keeps rendering the prebuilt `hero_image_url` via `<Image>` — initial LCP unchanged.
- Slides 1+ mount `<SlidePreview>` with the snapshotted `template_id` (falls back to `highlight-bar`), matching the detail-page rendering.
- Arrows + counter fade in on hover, fade out at first/last (`disabled:opacity-0`).
- Card body click still navigates to `/explore/{slug}`.

## Verification
- `npx tsc --noEmit` — no new errors on the changed files
- `npx eslint src/app/explore/explore-card.tsx src/app/explore/page.tsx` — clean

## Out of scope
- Touch swipe, keyboard arrow nav, auto-advance
- Pre-rendered thumbnails for slides 1+ (on-demand `SlidePreview` is enough)
