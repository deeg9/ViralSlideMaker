---
name: 260428-vis summary
description: Quick task — consolidate publish UX into per-card Edit visibility modal
type: project
status: complete
---

# Quick Task 260428-vis — SUMMARY

## What shipped

Replaces the dashboard's separate "Published to Explore" section with
a per-card **Edit visibility** action on the existing Recent Carousels
3-dot menu. One modal handles title, public/private toggle, and search
hashtags (tags) for any project.

## Files

- **Modified** `src/app/(dashboard)/dashboard/page.tsx` — removes the
  PublishedList import + render; reshapes the published_carousels
  query into `Record<projectId, ProjectPublishedState>` for the cards.
- **Modified** `src/components/projects/project-list.tsx` — forwards
  `publishedByProjectId` to each `ProjectCard`.
- **Modified** `src/components/projects/project-card.tsx` — adds
  "Edit visibility" menu item (sibling to Delete) + "PUBLIC" badge
  on the thumbnail when there's a visible published row.
- **New** `src/components/projects/edit-visibility-modal.tsx` —
  client modal with title, Private|Public segmented toggle, and
  comma-separated tags input (tags disabled when Private).
- **New** `src/app/(dashboard)/dashboard/visibility-actions.ts` —
  unified `saveVisibility` server action.

## Behavior

`saveVisibility(projectId, formData)` resolves all four transitions:

| From → To | Action |
|---|---|
| private → public | `publishProjectToExplore` (renders hero PNG, calls publish_carousel RPC, mints slug) |
| public → public + edits | UPDATE `published_carousels` row's `title` + `tags` directly (RLS owner UPDATE) |
| public → private | `unpublishCarousel` (sets `unpublished_at`) |
| private → private | sync `projects.title` only |

In every branch `projects.title` is also synced. Pages
`/dashboard`, `/explore`, and `/explore/[slug]` are revalidated
where relevant.

## Verification

- `npm run lint` — 0 errors, 41 warnings (unchanged).
- Dashboard hot-reloaded clean (`GET /dashboard 200`).
- Old PublishedList component file is left in the tree (unused).

## Out of scope (deliberate)

- No DB migration — reuses existing `publish_carousel` /
  `unpublish_carousel` RPCs and `source_project_id` FK.
- Description field not surfaced in the modal (existing
  publish flow keeps it through).
- Slug is reminted on un-publish + re-publish (matches prior
  behavior); preserving slug across cycles would need a new RPC.
- `src/components/dashboard/published-list.tsx` left in place,
  no longer referenced.

## Commit

`60cd9a4` — `feat(quick-260428-vis): edit visibility from project card 3-dot menu`
