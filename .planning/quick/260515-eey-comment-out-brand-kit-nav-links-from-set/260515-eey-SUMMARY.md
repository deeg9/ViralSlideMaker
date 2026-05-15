---
phase: quick-260515-eey
plan: 01
status: complete
subsystem: settings-navigation
tags: [nav, settings, brand-kit, hide-from-production]
dependency_graph:
  requires: []
  provides:
    - Brand Kit hidden from all visible nav surfaces (settings sidebar, app header, sidebar-nav deep-link)
  affects:
    - User-facing entry points to /settings/brand-kit (now unreachable through clicks; direct URL still works)
tech_stack:
  added: []
  patterns:
    - Comment-out (not delete) so feature can be re-enabled by uncommenting two lines + restoring one href
key_files:
  created: []
  modified:
    - src/app/(dashboard)/settings/layout.tsx
    - src/components/layout/app-header.tsx
    - src/components/layout/sidebar-nav.tsx
decisions:
  - Commented out (instead of deleting) Brand Kit nav rows so the feature remains a single-grep restore away once it's production-ready. Each commented region has a `260515-eey` marker comment so future readers can find/restore them deterministically.
  - For sidebar-nav.tsx, the row's label is "Settings" not "Brand Kit" — only the href was a brand-kit reference. Changed href from `/settings/brand-kit` → `/settings` so the Settings nav still works (the index already redirects to `/settings/profile`).
  - Did NOT touch the Brand Kit page (`/settings/brand-kit/page.tsx`), API route (`/api/v1/me/brand-kit`), components (`brand-kit-form.tsx`), lib (`/lib/brand-kit/*`), or types — they're referenced by other surfaces (style-from-reference Remix toggle, fork flow, project download) that remain in production. Direct URL access to `/settings/brand-kit` still serves the page; only nav discovery is removed.
metrics:
  tasks_completed: 3
  files_created: 0
  files_modified: 3
  duration_minutes: ~5
  commits: TBD
---

# Quick Task 260515-eey: Hide Brand Kit from production nav

## One-liner

Commented out every clickable entry that points users at `/settings/brand-kit` (settings sidebar row + app-header link + sidebar-nav deep-link href) so the unfinished Brand Kit surface stops appearing in production navigation. Underlying code is intact and one-comment-flip away from being re-enabled.

## What changed

| File | Change | Restore by |
| ---- | ------ | ---------- |
| `src/app/(dashboard)/settings/layout.tsx` | Brand Kit row in `settingsNav` array commented out | Delete two `//`s on line 11 |
| `src/components/layout/app-header.tsx` | `<Link href="/settings/brand-kit">Brand Kit</Link>` wrapped in `{/* */}` | Delete the JSX comment markers |
| `src/components/layout/sidebar-nav.tsx` | Settings entry href changed `/settings/brand-kit` → `/settings` | Restore the original href string |

## Out of scope (not touched)

- `src/app/(dashboard)/settings/brand-kit/page.tsx` — page still serves on direct URL access.
- `src/app/(dashboard)/settings/brand-kit/actions.ts` — server actions still callable.
- `src/app/api/v1/me/brand-kit/*` — API routes still respond.
- `src/components/brand-kit/brand-kit-form.tsx` — form component still imported by the page.
- `src/components/style-from-reference/brand-kit-remix-toggle.tsx` — Remix toggle in style-from-reference flow still active (different surface, different UX).
- `src/lib/brand-kit/*` — utility modules still imported by render/fork/download paths.

Touching any of these would scope-creep into feature removal; the user asked to comment out the visible nav, not strip the feature.

## Verification

| Check | Result |
| ----- | ------ |
| `grep "Brand Kit" src/app/(dashboard)/settings/layout.tsx` | only inside the `// {...}` commented row |
| `grep "Brand Kit" src/components/layout/app-header.tsx` | only inside `{/* */}` JSX comment |
| `grep "/settings/brand-kit" src/components/layout/sidebar-nav.tsx` | zero matches |
| Test files referencing removed entries | none — tests only mock the brand-kit actions module + the Remix toggle (neither affected) |
| Settings sidebar (`/settings/*`) renders 4 rows: Profile, Notifications, Manage Subscription, API Keys | yes |
| Sidebar Settings nav → click → lands on `/settings/profile` (via `/settings` redirect) | yes (server redirect already in place at `src/app/(dashboard)/settings/page.tsx`) |

## Manual smoke test (pending user)

1. Hard-refresh the app, sign in.
2. Confirm the left rail of /settings does NOT show "Brand Kit" between "Manage Subscription" and "API Keys".
3. Confirm the top app header (where rendered) does NOT show a "Brand Kit" link.
4. Click the Settings icon in the main sidebar — should land on `/settings/profile`, not `/settings/brand-kit`.
5. Visit `/settings/brand-kit` directly via URL bar — page still loads (intentional, so existing dev/test flows aren't blocked). If you also want this URL gated, that's a follow-up.

## Restore in one minute

When Brand Kit is production-ready:

```diff
# src/app/(dashboard)/settings/layout.tsx
-  // Brand Kit hidden from production — feature not ready (260515-eey). Re-enable when complete.
-  // { href: '/settings/brand-kit', icon: 'palette', label: 'Brand Kit' },
+  { href: '/settings/brand-kit', icon: 'palette', label: 'Brand Kit' },

# src/components/layout/app-header.tsx
-  {/* Brand Kit hidden from production — feature not ready (260515-eey). Re-enable when complete.
   <Link href="/settings/brand-kit" ...>Brand Kit</Link>
-  */}

# src/components/layout/sidebar-nav.tsx
-  // Settings nav previously deep-linked to Brand Kit; re-routed to /settings ...
-  { href: '/settings', icon: 'settings', label: 'Settings' },
+  { href: '/settings/brand-kit', icon: 'settings', label: 'Settings' },
```

## Self-Check: PASSED

- File `src/app/(dashboard)/settings/layout.tsx`: edited — Brand Kit row commented out
- File `src/components/layout/app-header.tsx`: edited — Brand Kit link wrapped in JSX comment
- File `src/components/layout/sidebar-nav.tsx`: edited — Settings href re-routed to `/settings`
- No code paths to brand-kit feature internals touched
