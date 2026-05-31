---
type: quick
slug: fix-mobile-nav-profile-editor
created: 2026-05-31
status: in-progress
area: mobile / layout
files:
  - src/components/layout/profile-menu.tsx
  - src/components/layout/dashboard-shell.tsx
  - src/components/layout/bottom-navbar.tsx
---

# Quick: Fix three iPhone bugs from v2.17 device UAT

Device-UAT feedback (Diego, physical iPhone, 2026-05-31). Three bugs:

## Bug 1 — Dashboard bottom nav floats mid-page ("isn't staying fixed; carousels show under it")
**Diagnosis:** NOT a CSS containing-block bug — verified the BottomNavbar ancestor chain is clean (no `transform`/`filter`/`contain`/`overflow` ancestor) and in Chromium @393px the nav pins correctly (`navBottom 854 ≈ vh 853`). So this is an **iOS-Safari-specific `position: fixed` runtime quirk** (fixed bottom bars can detach/float during scroll + address-bar transitions). Not reproducible off-device.
**Fix (best-effort, needs device confirm):** promote the fixed nav to its own compositing layer with `transform: translateZ(0)` — the standard iOS mitigation that keeps `position: fixed` bottom bars pinned to the visual viewport. Safe (nav has no fixed descendants).

## Bug 2 — Profile dropdown closes immediately on tap (can't reach Bookmarks/Resources/Log out)
**Diagnosis (root cause, reproduced in Chromium):** `ProfileMenu` mixes a hover-intent pattern (`onPointerEnter`/`onPointerLeave` → setOpen) with a click-toggle (`onClick` → setOpen(!prev)). On touch, a tap fires BOTH: `pointerenter` opens it, then `click` toggles it back closed → net closed. ("Sometimes it stays" = event-timing dependent.)
**Fix:** gate the hover-intent handlers to `pointerType === 'mouse'`. On touch only the click-toggle + outside-click governs; desktop hover unchanged.

## Bug 3 — Editor page broken when opening a carousel (can't scroll, can't edit, global nav overlaps)
**Diagnosis:** `DashboardShell` renders `<BottomNavbar />` unconditionally — including on the editor's full-bleed route (`isFullBleed = pathname.startsWith('/project/')`). The global HOME/CREATE/ME nav (fixed, z-50) overlaps the editor's own EDIT-06 bottom action bar and eats the bottom of the scroll area.
**Fix:** don't render `<BottomNavbar />` when `isFullBleed` — the editor has its own bottom action bar. (Editor scroll + overall layout still need Diego's device re-test — carried v2.17 editor UAT.)

## Verification
- Bug 2: reproduce + confirm fix in Chromium @393px (menu opens on click and STAYS).
- Bug 3: confirm global nav absent on `/project/[id]`; confirm present on `/dashboard`.
- Bug 1: code-applied; **requires physical-iPhone re-test** (not reproducible in Chromium).
- `tsc` no new errors; touched-component tests green.
