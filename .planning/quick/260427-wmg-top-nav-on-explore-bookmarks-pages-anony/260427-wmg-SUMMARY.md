---
quick_id: 260427-wmg
title: Top nav on /explore (anonymous-friendly) + move Bookmarks into profile dropdown
date: 2026-04-27
status: complete
commits:
  - f594f0e  # feat: top nav on /explore + /explore/[slug] (anonymous-friendly)
  - 19ee645  # feat: move Bookmarks from top nav into profile dropdown
---

# Quick Task 260427-wmg Summary

Two related navigation polish fixes shipped in this task.

## What changed

### 1. Top nav on /explore + /explore/[slug] (commit f594f0e)

**Problem.** The explore routes were shipped at `src/app/explore/` (root)
specifically because the explore feed must be anonymous-accessible — the
`(dashboard)/layout.tsx` redirects unauthenticated users to /login, which
would block public browsing. Side effect: explore inherited only
`src/app/layout.tsx` (no nav).

**Fix.**
- `src/components/layout/top-navbar.tsx` — added optional
  `signedIn?: boolean` prop (defaults `true`). In the 'app' variant,
  conditionally renders `ProfileMenu` when signed in, or `Log In` /
  `Get Started` links when anonymous.
- `src/app/explore/layout.tsx` (new) — server component that fetches the
  user without redirecting, reads `display_name` from `public.profiles`
  when signed in, wraps children in the `bg-[#fff8f7]` shell with
  `<TopNavbar variant="app" signedIn={!!user} userName={...}>`.
- `src/app/explore/page.tsx`, `src/app/explore/[slug]/page.tsx` — stripped
  the redundant inner `min-h-screen bg-[#fff8f7]` wrapper now that the
  layout owns the page chrome.

### 2. Bookmarks moved from top nav into profile dropdown (commit 19ee645)

User feedback: the global nav was getting crowded. Moved Bookmarks out of
the icon row and into the profile dropdown above Settings.

- `src/components/layout/top-navbar.tsx` — removed the `bookmarks` entry
  from `navItems`. Top nav now shows 3 icons: Dashboard / Create / Explore.
- `src/components/layout/profile-menu.tsx` — added `Bookmarks` row at
  position [0], above Settings. Profile dropdown order now:
  Bookmarks → Settings → Resources → divider → Log out.

## Verified live

- Signed in as Big D Phil, /explore and /explore/[slug] now render the
  full nav (logo + 3-icon row + profile menu)
- Profile dropdown opens with Bookmarks first, then Settings, then
  Resources, then Log out
- No console errors during navigation
- Anonymous code path is structurally identical — anonymous users will see
  Log In / Get Started instead of the profile menu, and all 3 nav icons
  remain clickable (protected routes still bounce through layout guards)
- `npx tsc --noEmit` passes (only pre-existing mcp-handler error)

## Files modified

- `src/components/layout/top-navbar.tsx` — signedIn prop + remove bookmarks
- `src/components/layout/profile-menu.tsx` — Bookmarks row added above Settings
- `src/app/explore/layout.tsx` — new
- `src/app/explore/page.tsx` — strip wrapper
- `src/app/explore/[slug]/page.tsx` — strip wrapper
