---
quick_id: 260427-iun
type: quick
mode: quick
title: "Top nav restructure - Dashboard/Create/Discover icon row + profile dropdown"
created: 2026-04-27
completed: 2026-04-27
base_commit: d4fdf87a02afbe5a137a254a5fbd2694225d65d0
commits:
  - 17158da: "feat(quick-260427-iun): ProfileMenu dropdown + restructured top navbar"
  - 9589805: "feat(quick-260427-iun): placeholder routes, Create deep-link, bottom nav update"
files_changed:
  created:
    - src/components/layout/profile-menu.tsx
    - src/app/(dashboard)/discover/page.tsx
    - src/app/(dashboard)/bookmarks/page.tsx
    - src/app/(dashboard)/resources/page.tsx
  modified:
    - src/components/layout/top-navbar.tsx
    - src/components/projects/create-project-dialog.tsx
    - src/components/layout/bottom-navbar.tsx
---

# Quick Task 260427-iun: Top Nav Restructure Summary

Restructured the app top-navbar to a social-app pattern: three primary icon
buttons (Dashboard / Create / Discover) plus a hover/click profile dropdown
(Profile, Bookmarks, Settings, Resources, Log out). Added three placeholder
routes, wired Create to the existing create-project dialog via a `?new=1`
deep-link, and re-labeled the mobile bottom nav to match.

## Files Changed

### Created
- **`src/components/layout/profile-menu.tsx`** — new client component containing
  the identity zone (user name, credit display, avatar) plus the floating
  dropdown panel with Profile / Bookmarks / Settings / Resources / divider /
  Log out. Owns its own ref, open state, debounce timer, and outside-click
  listener. Reuses the existing `logout` server action.
- **`src/app/(dashboard)/discover/page.tsx`** — placeholder server component,
  centered "Coming soon" card with `explore` icon.
- **`src/app/(dashboard)/bookmarks/page.tsx`** — placeholder, `bookmark` icon.
- **`src/app/(dashboard)/resources/page.tsx`** — placeholder, `science` icon.

All three placeholder pages live under the `(dashboard)` route group, which
already wraps children in `DashboardShell` via
`src/app/(dashboard)/layout.tsx`, so they automatically inherit the new top
and bottom nav chrome.

### Modified
- **`src/components/layout/top-navbar.tsx`**
  - Removed `LogoutButton` import.
  - Added `useSearchParams` import alongside `usePathname`.
  - Replaced the `navItems` array with the three-item Dashboard / Create /
    Discover icon row.
  - Derived `isCreate`, `isDashboard`, `isDiscover` and switched per
    `item.key` in the map.
  - Replaced the inline avatar + LogoutButton block with
    `<ProfileMenu userName={...} creditDisplay={...} />`. ProfileMenu owns
    the left-border divider, padding, and gap so the navbar stays clean.
  - `marketing` branch is untouched.
- **`src/components/projects/create-project-dialog.tsx`**
  - Added `useEffect` to the `react` import and `useSearchParams` to the
    `next/navigation` import.
  - Read `searchParams.get('new') === '1'` into `wantsNew`.
  - `useEffect` auto-opens the dialog when `wantsNew && !asPlaceholderCard`
    (the placeholder card instance is guarded out so only the visible
    "Create New Slide" button auto-opens; otherwise two dialogs would race
    when projects already exist).
  - `Dialog.Root onOpenChange` replaced with a handler that calls
    `setOpen(next)` and `router.replace('/dashboard')` when the dialog
    closes while `wantsNew` is true. This also fires when the user clicks
    the backdrop, presses Escape, or hits the Cancel button.
  - `handleSubmit` also calls `router.replace('/dashboard')` before the
    project-route push, so the URL is clean even if navigation is
    interrupted.
- **`src/components/layout/bottom-navbar.tsx`**
  - Replaced the four tabs with Home / Create / Discover / Me, routes
    `/dashboard`, `/dashboard?new=1`, `/discover`, `/settings/profile`.
  - Imported `useSearchParams` and computed `isCreate`.
  - Replaced the broken `isActive` boolean (was returning a string for
    Home) with an explicit ladder covering all four tabs, including
    `?new=1` for Create.

## Dropdown Trigger Behavior (chosen)

- **Open on hover** (`onPointerEnter` on the wrapper div). Pointer entering
  the trigger or the panel keeps it open because they share a common
  relatively-positioned wrapper.
- **Close on `pointerleave` after 80ms debounce** so the user can move the
  cursor down from the avatar through the gap into the panel without losing
  the menu.
- **Click/tap toggles** (`onClick` on the avatar `<button>`) so touch
  devices and keyboard users can open it without hover.
- **Outside-click closes** via a `mousedown` listener on `document` that
  checks the wrapper ref. Listener is cleaned up on unmount.
- The pending close-timer is cleared on every re-enter and on unmount so we
  don't leak timers or accidentally close after re-hovering.
- `aria-haspopup="menu"`, `aria-expanded`, and `role="menu"` / `role="menuitem"`
  are set; full ARIA menu keyboard nav (arrow keys, type-ahead) is left to
  a follow-up that swaps in `@radix-ui/react-dropdown-menu`.

## Verification

### Automated (passed)
```
$ npx tsc --noEmit 2>&1 | grep -E "top-navbar|profile-menu|bottom-navbar|discover|bookmarks|resources|dashboard/page" | head -20
(no output)
```
No new TypeScript errors in any touched file.

### Manual walkthrough (Task 3 — to be done by user)

The dev server is already running at `http://localhost:3000`.

1. Hard-refresh `http://localhost:3000/dashboard`. Confirm the top nav shows
   three icons in this order: **Dashboard** (active pill), **Create**,
   **Discover**. The standalone logout button is gone.
2. Hover the avatar in the top-right. Dropdown opens with Profile,
   Bookmarks, Settings, Resources, divider, Log out. Move the cursor down
   into the panel without it closing. Move the cursor away — closes after
   ~80ms.
3. Tap/click each row (touch path also works because clicking the avatar
   toggles `open`):
   - Profile   → navigates to `/settings/profile`
   - Bookmarks → navigates to `/bookmarks` (placeholder renders)
   - Settings  → navigates to `/settings`
   - Resources → navigates to `/resources` (placeholder renders)
   - Log out   → signs out, redirects to `/login`
4. From `/dashboard`, click the **Create** icon in the top nav. URL becomes
   `/dashboard?new=1` AND the create-project dialog opens automatically.
   Dismiss the dialog (Cancel / Escape / backdrop) → URL returns to
   `/dashboard`.
5. Click **Discover** in the top nav → `/discover` placeholder renders,
   Discover icon is active.
6. Resize the window to mobile width. Bottom nav shows Home / Create /
   Discover / Me with the correct active highlight on each route, including
   the `?new=1` Create state.
7. From the project root run `npx tsc --noEmit` — no new errors in any
   modified file. (Already automated above.)

## Deviations from Plan

None — plan executed exactly as written. All five rows present, divider
above Log out, three-icon row in the documented order, deep-link guarded
by `asPlaceholderCard` to prevent races, bottom nav re-labeled with the
explicit `isActive` ladder, and the marketing navbar branch left
untouched.

## Follow-ups

- **Swap to Radix `react-dropdown-menu`** for full keyboard nav (arrow
  keys, type-ahead), focus trap, and richer ARIA semantics. The current
  ProfileMenu is intentionally framework-light; Radix would also handle
  the open/close debounce more cleanly.
- **Real avatar image** — wire the user's Supabase avatar URL into the
  trigger (currently a generic `person` icon).
- **Build real Discover, Bookmarks, Resources** — these are placeholder
  pages today.
- **Mobile "Me" action sheet** — on touch the bottom-navbar Me tab links
  directly to `/settings/profile`. A future revision could replace it with
  a bottom-sheet that mirrors the desktop ProfileMenu.

## Self-Check

Files exist:
- FOUND: src/components/layout/profile-menu.tsx
- FOUND: src/components/layout/top-navbar.tsx
- FOUND: src/components/layout/bottom-navbar.tsx
- FOUND: src/components/projects/create-project-dialog.tsx
- FOUND: src/app/(dashboard)/discover/page.tsx
- FOUND: src/app/(dashboard)/bookmarks/page.tsx
- FOUND: src/app/(dashboard)/resources/page.tsx

Commits exist:
- FOUND: 17158da
- FOUND: 9589805

## Self-Check: PASSED
