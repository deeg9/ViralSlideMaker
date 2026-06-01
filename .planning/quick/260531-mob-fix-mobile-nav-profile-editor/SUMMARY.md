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

## Bug 1 — Dashboard "bottom nav doesn't stick; scroll past it into blank white space" 🟢 ROOT CAUSE FOUND + FIXED (device confirm)
**Corrected diagnosis (after Diego's follow-up detail "I can scroll past it into blank white space below"):** the nav IS correctly `fixed`; the real problem is the **document is inflated by thousands of phantom px**, so you scroll past the real content into emptiness and the fixed nav looks unmoored. Root cause: each dashboard card lazy-mounts a `<SlidePreview>` that renders an **absolutely-positioned 1080×1920 element** scaled down via `transform`. iOS Safari (unlike Chromium) **fails to clip that child's scroll-height through `overflow:hidden`** — the exact leak the editor shell already works around with `position: fixed` (see `dashboard-shell.tsx:9` comment). With many cards (Diego has 42) the body inflates by ~1656px × N.
**Why I missed it first:** my throwaway test account had 0 carousels → no `SlidePreview` ever mounted → nothing leaked. Reproduced the *structure* by cloning 33 cards onto a fresh account; confirmed Chromium contains it perfectly (so it's iOS-only) and that the absolute child is `position:absolute` w1080×h1920 inside the `overflow:hidden` thumb.
**Fix:** `[contain:layout_paint]` on the card thumb (`src/components/projects/project-card.tsx`) — makes each thumb a true layout/paint containment boundary that iOS honors, capping each card at its own box. Reverted the earlier (wrong-diagnosis) nav `translateZ(0)`.
**Verified (Chromium @393px, 33 cards):** cards render correctly (no clip/distortion), containment active (`contain: layout paint`), zero document inflation/regression. **The iOS clipping behavior itself still needs Diego's iPhone to confirm the blank space is gone** (iOS-only behavior, not reproducible in Chromium).

## Checks
- `tsc --noEmit`: 20 errors = baseline, 0 new.
- No layout component tests exist; changes are presentational/event-handler only.
- Throwaway QA account (`mobile-qa-260531@example.com`) created to inspect gated surfaces, then deleted (auth.users + cascaded profile gone).

## For Diego (device re-test)
1. Profile dropdown — should now stay open on tap. ✅ expect fixed.
2. Editor — global HOME/CREATE/ME nav should be gone; the editor's own Export/Public bar should have room. Confirm scroll works now or report what's still broken.
3. Dashboard bottom nav — confirm it now stays pinned to the bottom. If it still floats, we need a live device-debug session (it's an iOS quirk I can't reproduce in Chromium).
