---
quick_id: 260515-explore-slide-arrows
created: 2026-05-15
status: in-progress
---

# Add slide-flip arrows to Explore cards

## Goal
On `/explore`, let users click left/right arrows on each carousel card to flip through all slides — same chevron + "N / M" counter pattern as `ProjectCard` on the dashboard.

## Files
- NEW `src/app/explore/explore-card.tsx` — client component; useState for slide index; arrows + counter on hover; useRouter().push() on card click so arrows can stopPropagation
- EDIT `src/app/explore/page.tsx` — add `slide_data, template_id` to the select; render via `<ExploreCard>`

## Approach
1. Fetch `slide_data` (Slide[]) and `template_id` per row.
2. Card renders cover via `hero_image_url` for slide 0 (preserves current LCP/visual). For slides 1+, mounts `<SlidePreview>` with the snapshotted template — same component the detail page already uses.
3. Arrows + counter pill copied from `project-card.tsx:185-211` (group-hover reveal, disabled at first/last).
4. Card click uses `useRouter().push()` so arrow `e.stopPropagation()` cleanly cancels navigation (avoids button-in-anchor pattern).

## Out of scope
- Touch swipe / keyboard nav
- Auto-advance / play
- Pre-rendering thumbnails for slides 1+ (raw `SlidePreview` on demand is enough)
