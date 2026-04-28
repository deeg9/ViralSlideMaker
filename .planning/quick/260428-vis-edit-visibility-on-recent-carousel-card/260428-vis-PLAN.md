# Quick Task 260428-vis: consolidate publish UX into per-card "Edit visibility"

## Why

The dashboard currently has TWO surfaces for the same carousels — a
"Published to Explore" section above Recent Carousels (with View /
Unpublish / Delete buttons) and the editor's separate Publish modal.
The user wants a single, simpler model: keep just the Recent Carousels
grid, and let users toggle a project's visibility from the existing
3-dot menu on each card.

## What ships

1. **Remove `<PublishedList>` from the dashboard.** Drop the import and
   the render block in `src/app/(dashboard)/dashboard/page.tsx`. Keep
   the published-row query, but reshape it into a `Map<projectId,
   PublishedState>` passed down to the project list so each card knows
   if it's currently public.

2. **Add "Edit visibility" to the project-card 3-dot menu.** Sibling
   to the existing "Delete" item. Opens a new modal.

3. **`EditVisibilityModal`** (new client component) — fields:
   - **Title** (text input, max 120, required)
   - **Visibility** — Private | Public segmented toggle
   - **Tags** — comma-separated input (max 5, lowercase a-z 0-9 _ -),
     same normalization as the existing publish flow
   - Save / Cancel

4. **`saveVisibility(projectId, formData)`** server action handling
   all 4 transitions:
   - private → public: delegate to existing
     `publishProjectToExplore` (renders hero PNG, calls
     `publish_carousel` RPC). Title + tags from the form pass through.
   - public → private: call `unpublish_carousel` RPC (existing).
   - public → public + edits: UPDATE the live `published_carousels`
     row's `title`, `description` (kept from existing row), and
     `tags`. Owner UPDATE is RLS-allowed.
   - private → private + title edit only: UPDATE `projects.title`.
   - In every branch, `projects.title` is also synced.

5. **Card UI shows a "Public" badge** when the project has a visible
   published row, so users can tell at a glance.

## Files

- **Modify** `src/app/(dashboard)/dashboard/page.tsx` — remove
  PublishedList; build `publishedByProjectId` Map; pass to ProjectList.
- **Modify** `src/components/projects/project-list.tsx` — accept and
  forward `publishedByProjectId` to ProjectCard.
- **Modify** `src/components/projects/project-card.tsx` — accept
  `publishedState` prop; add "Edit visibility" menu item; render
  modal; show "Public" badge when applicable.
- **Create** `src/components/projects/edit-visibility-modal.tsx` —
  the modal client component (pattern matches
  `src/components/editor/publish-modal.tsx`).
- **Create** `src/app/(dashboard)/dashboard/visibility-actions.ts` —
  the unified `saveVisibility` server action.
- **Reuse** `publishProjectToExplore` and `unpublishCarousel` from
  `src/app/(dashboard)/project/[id]/publish-actions.ts`.

## Out of scope

- Removing/dropping `published-list.tsx` itself — leave the file in
  case it's wanted later. Just stop rendering it.
- Deleting published rows from the modal (that lives elsewhere; the
  user explicitly asked to keep it simple — Public/Private toggle).
- Preserving slug across un-publish + re-publish (currently a new
  slug is minted on each publish; matches existing behavior).
- Description field — keep existing description on UPDATE, but don't
  expose it in the modal (user didn't ask).
- Category dropdown (the user's example screenshot shows a single
  category; we use the existing comma-separated tags model, since
  search/filtering on /explore already keys off `tags`).

## Verification

- `npm run lint` — 0 errors (warnings unchanged).
- Dashboard no longer shows "Published to Explore" section.
- 3-dot menu on a Recent Carousel card now shows "Edit visibility"
  + "Delete".
- Edit visibility modal opens with current title pre-filled.
- Toggling Public on a private project + Save → after revalidate,
  card shows "Public" badge; row appears at /explore.
- Toggling Private on a public project + Save → card loses badge;
  row no longer at /explore.
- Editing title + tags on a public project + Save → /explore detail
  reflects the new title; new tag filters work on /explore.
- /explore/[slug] page (anon-friendly via prior fix) still loads.

## Commit

Single atomic commit:

```
feat(quick-260428-vis): edit visibility from project card 3-dot menu

Removes the separate Published-to-Explore dashboard section and
folds publish/unpublish + title/tag edits into a per-card "Edit
visibility" modal opened from the existing more-actions menu on
Recent Carousels. Server action saveVisibility handles all four
private↔public transitions; reuses the existing publish_carousel
and unpublish_carousel RPCs.
```
