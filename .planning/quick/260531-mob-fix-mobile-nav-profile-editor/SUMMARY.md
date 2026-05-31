---
type: quick
slug: fix-mobile-nav-profile-editor
created: 2026-05-31
completed: 2026-05-31
status: complete
area: mobile / layout
commits:
  - "fix(mobile): profile menu stays open on tap — gate hover-intent to mouse only (bug 2)"
  - "fix(mobile): hide global bottom nav on full-bleed editor route (bug 3)"
  - "fix(mobile): promote bottom nav to its own layer (translateZ(0)) for iOS fixed-positioning (bug 1)"
---

# Quick Summary: Three iPhone bugs from v2.17 device UAT

Diego's physical-iPhone testing of v2.17 surfaced three bugs. Diagnosed each from code + reproduced what was reproducible in Chromium at a true 393px (via a throwaway signup, since the gated surfaces need auth — account deleted after).

## Bug 2 — Profile dropdown closed on tap ✅ FIXED + VERIFIED
**Root cause:** `ProfileMenu` mixed a hover-intent pattern (`onPointerEnter`/`onPointerLeave` → setOpen) with a click-toggle. On touch, one tap fires `pointerenter` (opens) then `click` (toggles closed) → net closed.
**Fix:** gated the hover handlers to `pointerType === 'mouse'`. `src/components/layout/profile-menu.tsx`.
**Verified (Chromium @393px):** before the fix, clicking the avatar left the menu closed; after, the menu opens and STAYS, showing Bookmarks / Resources / Log out. Desktop hover unchanged.

## Bug 3 — Editor broken when opening a carousel ✅ root cause FIXED (editor scroll = device retest)
**Root cause:** `DashboardShell` rendered `<BottomNavbar />` unconditionally, including on the editor's full-bleed route (`/project/*`). The global HOME/CREATE/ME nav (fixed, z-50) stacked on top of the editor's own EDIT-06 action bar and ate the bottom of the scroll area.
**Fix:** `{!isFullBleed && <BottomNavbar />}` in `src/components/layout/dashboard-shell.tsx`.
**Verified:** dashboard still renders the nav (no regression); the conditional removes it on every `/project/*` route. The editor's remaining "can't scroll / looks terrible" is iOS-specific and part of the **carried v2.17 editor device UAT** — needs Diego's iPhone to confirm whether removing the collision resolved scroll, or more work remains.

## Bug 1 — Dashboard bottom nav floated mid-page 🟡 best-effort (device retest required)
**Diagnosis:** NOT a CSS containing-block bug — the BottomNavbar ancestor chain is clean (no `transform`/`filter`/`contain`/`overflow` ancestor), and in Chromium @393px the nav pins correctly (`navBottom 854 ≈ vh 853`). So it's an **iOS-Safari-specific `position: fixed` runtime quirk** (fixed bottom bars detach during scroll / address-bar transitions). Not reproducible off-device.
**Fix (best-effort):** added `[transform:translateZ(0)]` to the nav — the standard iOS mitigation that promotes a fixed bar to its own compositing layer so it stays pinned. `src/components/layout/bottom-navbar.tsx`. **Unverifiable in Chromium — needs Diego's iPhone.** If still floating, a device-debugging session is required.

## Checks
- `tsc --noEmit`: 20 errors = baseline, 0 new.
- No layout component tests exist; changes are presentational/event-handler only.
- Throwaway QA account (`mobile-qa-260531@example.com`) created to inspect gated surfaces, then deleted (auth.users + cascaded profile gone).

## For Diego (device re-test)
1. Profile dropdown — should now stay open on tap. ✅ expect fixed.
2. Editor — global HOME/CREATE/ME nav should be gone; the editor's own Export/Public bar should have room. Confirm scroll works now or report what's still broken.
3. Dashboard bottom nav — confirm it now stays pinned to the bottom. If it still floats, we need a live device-debug session (it's an iOS quirk I can't reproduce in Chromium).
