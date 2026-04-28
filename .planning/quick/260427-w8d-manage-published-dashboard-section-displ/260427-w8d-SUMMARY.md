---
quick_id: 260427-w8d
title: Manage Published dashboard section + display_name in welcome heading
date: 2026-04-27
status: complete
commits:
  - da54996  # feat: Manage Published section + display_name welcome
---

# Quick Task 260427-w8d Summary

Closed the two polish gaps surfaced after v2.4 shipped:

1. No UI to unpublish/delete published carousels — users had no recourse via
   the app if they regretted publishing.
2. The dashboard "Welcome back, X!" heading read from
   `user_metadata.first_name`, ignoring `profile.display_name` shipped in
   260427-nxd.

## What changed

**`src/app/(dashboard)/dashboard/page.tsx`** — extended the userName fallback
chain to prefer `profile.display_name` over `user_metadata.first_name`. Added
a server query against `published_carousels` filtered by `owner_id` and wired
the new PublishedList component into the dashboard between the upgrade
prompts and the Recent Carousels list.

**`src/components/dashboard/published-list.tsx`** (new) — client component:
- Renders nothing when the user hasn't published anything (no empty-state
  noise on fresh accounts).
- Each card shows hero thumbnail (dimmed + "HIDDEN" pill when
  `unpublished_at` is set), title, bookmark/remix counters.
- Three actions per row: View / Unpublish (visible rows only) / Delete (with
  `window.confirm`).
- After mutation: `router.refresh()` so the list re-fetches instantly.

Both buttons hit existing server actions from the previous quick task
(`unpublishCarousel`, `deletePublishedCarousel`) — zero new RPCs or
migrations needed.

## Verified live end-to-end

- Published a test carousel via the editor → appeared in the new "Published
  to Explore" dashboard section
- Clicked Unpublish → row got HIDDEN badge, hero dimmed, Unpublish button
  removed (only View + Delete remain)
- Clicked Delete (with confirm dialog stubbed via `window.confirm = () => true`)
  → both `published_carousels` row AND the hero PNG in
  `hero-thumbnails` storage bucket removed (verified via SQL: 0 rows, 0
  storage objects)
- Welcome heading now reads "Welcome back, Big D Phil!" (display_name) instead
  of "Welcome back, bigdfill!" (user_metadata.first_name)
- `npx tsc --noEmit` passes

## Files modified

- `src/app/(dashboard)/dashboard/page.tsx` — userName fallback + published query + PublishedList wire-up
- `src/components/dashboard/published-list.tsx` — new (140 lines)
