---
phase: quick-260515-eey
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(dashboard)/settings/layout.tsx
  - src/components/layout/app-header.tsx
  - src/components/layout/sidebar-nav.tsx
autonomous: true
---

<objective>
Hide Brand Kit from production by commenting out every user-facing nav reference. The feature is incomplete and we don't want users discovering / using a half-broken surface. Code paths (page, server actions, form, types, /api/v1/me/brand-kit route) stay intact so the feature can be re-enabled by uncommenting later.

Commenting out (not deleting) is intentional — preserves the work for the next iteration with a single-grep restoration path.
</objective>

<context>
Current visible references discovered:
1. `src/app/(dashboard)/settings/layout.tsx:11` — Brand Kit entry in `settingsNav` array (visible in screenshot — left rail of /settings/* with "palette" icon)
2. `src/components/layout/app-header.tsx:12-17` — `<Link href="/settings/brand-kit">Brand Kit</Link>` in the top-of-page nav
3. `src/components/layout/sidebar-nav.tsx:12` — Settings nav entry deep-links to `/settings/brand-kit` (label is "Settings", but the href routes users into the broken Brand Kit page on click)

For (3), the label is "Settings" not "Brand Kit", so commenting the whole row would lose the Settings nav. Instead, change href to `/settings` (the index already redirects to `/settings/profile`), keeping the Settings entry working while removing the brand-kit deep-link.

Out of scope (intentionally):
- The brand-kit page itself (`src/app/(dashboard)/settings/brand-kit/page.tsx`) — direct URL access still works, but no nav points there.
- `src/components/brand-kit/brand-kit-form.tsx`, `src/lib/brand-kit/*`, `/api/v1/me/brand-kit` — referenced by other surfaces (style-from-reference Remix toggle, fork flow, project download, etc.). Touching them would scope-creep into feature removal.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Comment out Brand Kit row in settings sidebar</name>
  <files>src/app/(dashboard)/settings/layout.tsx</files>
  <action>
Comment out the `{ href: '/settings/brand-kit', icon: 'palette', label: 'Brand Kit' }` line in the `settingsNav` array. Add a single-line comment above explaining why (`// Brand Kit hidden from production — feature not ready (260515-eey). Re-enable when complete.`) so future readers know it's deliberate, not abandoned.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow &amp;&amp; grep -q "// { href: '/settings/brand-kit'" "src/app/(dashboard)/settings/layout.tsx" &amp;&amp; ! grep -E "^\s*\{ href: '/settings/brand-kit'" "src/app/(dashboard)/settings/layout.tsx"</automated>
  </verify>
  <done>
The Brand Kit row is commented out (still recoverable by deleting two `//`s); other nav rows (Profile, Notifications, Manage Subscription, API Keys) untouched.
  </done>
</task>

<task type="auto">
  <name>Task 2: Comment out Brand Kit link in app header</name>
  <files>src/components/layout/app-header.tsx</files>
  <action>
Wrap the `<Link href="/settings/brand-kit">Brand Kit</Link>` block in a JSX `{/* ... */}` comment with a leading rationale line. Keep the `<nav>` wrapper so the header structure stays valid even though the nav becomes empty.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow &amp;&amp; grep -q "Brand Kit hidden from production" src/components/layout/app-header.tsx &amp;&amp; ! grep -E '^\s*<Link\s*$|href="/settings/brand-kit"' src/components/layout/app-header.tsx | grep -v "{/\*\|\*/}"</automated>
  </verify>
  <done>
Header no longer renders a clickable "Brand Kit" link. `<nav>` wrapper preserved (will render empty until next nav item is added).
  </done>
</task>

<task type="auto">
  <name>Task 3: Re-route Settings sidebar entry to /settings (index)</name>
  <files>src/components/layout/sidebar-nav.tsx</files>
  <action>
Change `{ href: '/settings/brand-kit', icon: 'settings', label: 'Settings' }` → `{ href: '/settings', ... }`. The `/settings` page is a server redirect to `/settings/profile`, so users land on Profile (the first surviving nav item).

Add a one-line comment above explaining the rationale.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow &amp;&amp; grep -q "href: '/settings'," src/components/layout/sidebar-nav.tsx &amp;&amp; ! grep "href: '/settings/brand-kit'" src/components/layout/sidebar-nav.tsx</automated>
  </verify>
  <done>
Settings nav still works — clicking it sends users to /settings → redirects to /settings/profile. No remaining /settings/brand-kit link in sidebar-nav.tsx.
  </done>
</task>

</tasks>

<success_criteria>

- [x] No clickable "Brand Kit" entry in the settings sidebar (left rail of /settings/*)
- [x] No "Brand Kit" link in the top app header
- [x] Sidebar Settings nav entry no longer deep-links to /settings/brand-kit (lands on /settings/profile via /settings redirect)
- [x] Brand Kit code paths preserved (page, actions, form, types, API route untouched) — restorable by uncommenting two lines + restoring one href
- [x] No test files reference the removed nav entries (verified — tests only mock `@/app/(dashboard)/settings/brand-kit/actions` and Brand Kit Remix toggle, neither affected)

</success_criteria>
