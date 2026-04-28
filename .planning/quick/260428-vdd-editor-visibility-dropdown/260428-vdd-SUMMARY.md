---
name: 260428-vdd summary
description: Editor sidebar — Publish button replaced with Public/Private dropdown
type: project
status: complete
---

# Quick Task 260428-vdd — SUMMARY

## What shipped

Replaces the editor sidebar's old Publish-modal flow with a compact
**VisibilityDropdown** that flips a project's published state in one
click. Public is the listed-first / "DEFAULT" option per the user's
spec.

## Files

- **New** `src/components/editor/visibility-dropdown.tsx` — popover
  trigger reading "Public" (globe) or "Private" (lock); two-option
  menu with descriptions, recommended-default badge on Public,
  check-mark on the active state. Outside-click closes; uses the
  existing `saveVisibility` server action.
- **Modified** `src/components/editor/slide-editor.tsx` — drops
  `<PublishModal>` import + `publishOpen` state + the modal mount;
  swaps the Publish button for `<VisibilityDropdown>`. New optional
  `initialPublishedState` prop (id, slug, tags) carries the current
  published row down.
- **Modified** `src/app/(dashboard)/project/[id]/page.tsx` —
  fetches the visible `published_carousels` row for this project
  (mirrors the dashboard query) and forwards it.

## Behavior

| User action | Behind the scenes |
|---|---|
| Open editor on a private project | Dropdown reads "Private" with lock icon |
| Open editor on a public project | Dropdown reads "Public" with globe icon |
| Click Public on private | `saveVisibility(public)` → `publishProjectToExplore` (hero render + publish_carousel RPC) |
| Click Private on public | `saveVisibility(private)` → `unpublish_carousel` |
| Click the already-active option | No-op |

Errors surface inline as a small red toast under the dropdown.

## Verification

- `npm run lint` — 0 errors, 41 warnings (unchanged).
- Dev server hot-reloaded clean (`GET /project/<id> 200`).
- `publish-modal.tsx` is now unreferenced but left on disk.

## Commit

`1d412de` — `feat(quick-260428-vdd): editor visibility dropdown replaces Publish modal`
