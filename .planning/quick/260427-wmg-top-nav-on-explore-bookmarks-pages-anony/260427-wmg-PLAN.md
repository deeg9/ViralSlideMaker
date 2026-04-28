# Quick Task 260427-wmg: Top nav on /explore (anonymous-friendly)

## Context

`/explore` and `/explore/[slug]` were shipped under `src/app/explore/` (root)
specifically because the explore feed must be anonymous-accessible — the
`(dashboard)/layout.tsx` redirects unauthenticated users to /login, which
would block public browsing. Side effect: explore inherits only
`src/app/layout.tsx` (no nav). The site logo, dashboard/create/explore/
bookmarks icon row, and profile menu are all missing on those pages.

`/bookmarks` is fine — it's at `src/app/(dashboard)/bookmarks/` and
intentionally requires auth.

## Approach

Two surgical changes:

1. **Make TopNavbar's 'app' variant anonymous-friendly.** When `signedIn` is
   false, replace the ProfileMenu with `Log In` + `Get Started` links (same
   styling as the marketing variant). The icon row stays — anonymous users
   can click it; protected routes will route them to /login via the existing
   layout guards.

2. **Add `src/app/explore/layout.tsx`.** Fetches user without redirecting,
   reads display_name from profiles when signed in, wraps children in the
   same `bg-[#fff8f7]` shell with TopNavbar at the top.

No DashboardShell — that's coupled to client-side `usePathname` and
`isFullBleed` editor logic that doesn't apply here. Just the navbar +
content area.

## Tasks

### Task 1: TopNavbar accepts `signedIn` and renders auth-aware right side

**File**: `src/components/layout/top-navbar.tsx`

Add `signedIn?: boolean` to TopNavbarProps. In the 'app' branch:
- If `signedIn !== false` (default true to preserve existing dashboard
  behavior): render the existing ProfileMenu.
- If `signedIn === false`: render `Log In` + `Get Started` links matching
  the marketing variant's right-side links.

The icon row is unchanged — anonymous users see Dashboard/Create/Explore/
Bookmarks icons; clicking Dashboard or Bookmarks while logged out routes
through middleware/layout guards to /login. Explore works for them.

### Task 2: New explore layout

**File**: `src/app/explore/layout.tsx` (new server component)

Fetches user via Supabase server client (no redirect). When signed in, also
fetches display_name from profiles. Renders:
```tsx
<div className="min-h-screen bg-[#fff8f7]">
  <TopNavbar
    variant="app"
    signedIn={!!user}
    userName={displayName ?? user?.email?.split('@')[0]}
  />
  <main>{children}</main>
</div>
```

### Task 3: Remove redundant `bg-[#fff8f7]` wrapper from explore page bodies

**Files**: `src/app/explore/page.tsx`, `src/app/explore/[slug]/page.tsx`

Both pages currently render their own `<div className="min-h-screen bg-[#fff8f7]">`
wrapper. With the new layout owning the page chrome, the inner wrappers
become redundant — strip them down to just the inner `mx-auto max-w-...`
container.

## Verification

- `npx tsc --noEmit` — passes
- Visit `/explore` while signed in → see logo + icon row + profile menu
  (Big D Phil / 2 credits / avatar) at top
- Visit `/explore/[slug]` while signed in → same nav present
- Open an incognito window → visit `/explore` → see logo + icon row +
  Log In / Get Started buttons. Can browse the feed without signing in.
- Click Dashboard icon while signed out → routes to /login (existing
  layout guard fires)

## Files modified
- `src/components/layout/top-navbar.tsx`
- `src/app/explore/page.tsx`
- `src/app/explore/[slug]/page.tsx`

## Files added
- `src/app/explore/layout.tsx`
