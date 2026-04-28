# Quick Task 260428-vdd: editor sidebar visibility dropdown

## Why

The editor sidebar still uses the old "Publish" button + modal. Since
the dashboard already has the consolidated Edit-visibility modal
(quick-260428-vis), the editor surface only needs a quick toggle:
public ↔ private. User asked for a small dropdown next to the
existing buttons, defaulting to Public.

## What ships

1. **New** `src/components/editor/visibility-dropdown.tsx` — compact
   dropdown trigger that reads "Public" (globe icon) or "Private"
   (lock icon), opens a popover with two options. Public listed
   first with a recommended-default check. Selecting an option calls
   `saveVisibility` immediately (no extra modal). Shows pending +
   error states.

2. **Modify** `src/components/editor/slide-editor.tsx`:
   - drop the PublishModal import and `publishOpen` state
   - replace the `<button>Publish</button>` (and adjacent modal
     mount) with `<VisibilityDropdown>`
   - accept new optional `initialPublishedState` prop (id, slug, tags)

3. **Modify** `src/app/(dashboard)/project/[id]/page.tsx` — fetch
   the current visible `published_carousels` row for this project
   and forward as `initialPublishedState`.

## Behavior

- Dropdown reflects the project's actual current state (Public when
  there's a visible published row, Private otherwise).
- "Public" appears at the top of the menu and is shown as the
  recommended/default option (subtle "Default" hint).
- Selecting Public on a private project triggers the existing
  publish flow (renders hero PNG, mints slug — takes ~1-3s).
- Selecting Private on a public project unpublishes immediately.
- Selecting the already-active option is a no-op.
- After a successful change, `router.refresh()` re-renders the
  editor with the new state (badge label flips, dropdown text
  updates).
- On error, shows the message inline below the dropdown.

## Files

- **Create** `src/components/editor/visibility-dropdown.tsx`
- **Modify** `src/components/editor/slide-editor.tsx`
- **Modify** `src/app/(dashboard)/project/[id]/page.tsx`

## Reuse

- `saveVisibility` server action from
  `src/app/(dashboard)/dashboard/visibility-actions.ts`
- The existing `publishProjectToExplore` flow it delegates to
- Brand colors + icon names (`public`, `lock`) from the existing
  editor sidebar styling

## Out of scope

- Title/tag edits in the editor (still done from the dashboard's
  Edit visibility modal — keeps the editor surface tight).
- Removing `publish-modal.tsx` from disk (left in place for now;
  will be unreferenced after this commit).

## Verification

- `npm run lint` — 0 errors
- Open `/project/<id>` for a private project → dropdown reads
  "Private" with lock icon. Click → "Public" → after ~2s, dropdown
  reads "Public" and the carousel appears at /explore.
- Open `/project/<id>` for a public project → dropdown reads
  "Public" with globe icon. Click → "Private" → dropdown flips and
  /explore drops it.
- Old Publish button + modal are gone from the editor sidebar.

## Commit

```
feat(quick-260428-vdd): editor visibility dropdown replaces Publish modal
```
