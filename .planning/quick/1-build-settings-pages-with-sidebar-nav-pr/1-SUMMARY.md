---
phase: quick
plan: 1
subsystem: settings
tags: [settings, profile, notifications, subscription, sidebar-nav]
dependency_graph:
  requires: [supabase-auth, dashboard-layout, icon-component]
  provides: [settings-layout, profile-page, notifications-page, subscription-page]
  affects: [top-navbar, bottom-navbar]
tech_stack:
  added: []
  patterns: [user_metadata-storage, localStorage-persistence, sidebar-nav-layout]
key_files:
  created:
    - src/app/(dashboard)/settings/layout.tsx
    - src/app/(dashboard)/settings/page.tsx
    - src/app/(dashboard)/settings/profile/page.tsx
    - src/app/(dashboard)/settings/profile/actions.ts
    - src/app/(dashboard)/settings/notifications/page.tsx
    - src/app/(dashboard)/settings/notifications/actions.ts
    - src/app/(dashboard)/settings/subscription/page.tsx
  modified:
    - src/components/layout/top-navbar.tsx
    - src/components/layout/bottom-navbar.tsx
decisions:
  - Profile data stored in Supabase user_metadata (no new DB table)
  - Notification preferences stored in localStorage for v1
  - Subscription page is fully presentational with hardcoded Pro plan
metrics:
  duration: 2 min
  completed: 2026-03-20
---

# Quick Plan 1: Build Settings Pages with Sidebar Nav - Summary

Settings section with 4-page sidebar navigation: Profile (user_metadata CRUD), Notifications (localStorage toggles), Subscription (presentational pricing tiers), and existing Brand Kit.

## What Was Built

### Task 1: Settings layout with sidebar nav, profile page, and notifications page
**Commit:** `386c3da`

- **Settings layout** (`layout.tsx`): Client component with `usePathname()`-based active nav highlighting. Desktop shows a 264px sidebar with 4 nav items; mobile shows a horizontal scrollable tab bar.
- **Settings redirect** (`page.tsx`): Server component that redirects `/settings` to `/settings/profile`.
- **Profile page** (`profile/page.tsx` + `actions.ts`): Editable first name, last name, phone fields with read-only email. Saves to Supabase `user_metadata` via `auth.updateUser()`. Avatar upload UI placeholder included.
- **Notifications page** (`notifications/page.tsx` + `actions.ts`): 4 toggle switches (Marketing, Brand Tips, Slides Ready, Customer Service) with custom pill-style toggle components. Persisted via `localStorage`. Placeholder server action file for future DB migration.
- **Navbar updates**: Top navbar settings link changed to `/settings` with `pathname.startsWith('/settings')` active detection. Bottom navbar "Me" tab changed to `/settings/profile` with same active logic.

### Task 2: Subscription page with pricing tiers
**Commit:** `675cbf7`

- **Subscription page** (`subscription/page.tsx`): 3-column responsive grid with Free ($0), Pro ($12, highlighted with ring + "Most Popular" badge), and Business ($29) tiers. Each tier shows features with check_circle icons. Current plan badge shows "Pro" (hardcoded for v1). "Manage Subscription" button triggers alert placeholder for future Stripe integration.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npm run build` completes successfully with all routes listed
- All 4 settings sub-pages render under shared layout
- Build output confirms routes: `/settings`, `/settings/brand-kit`, `/settings/notifications`, `/settings/profile`, `/settings/subscription`
