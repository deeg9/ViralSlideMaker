---
quick_id: 260427-iun
type: quick
mode: quick
created: 2026-04-27
title: "Top nav restructure - Dashboard/Create/Discover icon row + profile dropdown"
files_modified:
  - src/components/layout/top-navbar.tsx
  - src/components/layout/profile-menu.tsx
  - src/components/layout/bottom-navbar.tsx
  - src/components/projects/create-project-dialog.tsx
  - src/app/(dashboard)/discover/page.tsx
  - src/app/(dashboard)/bookmarks/page.tsx
  - src/app/(dashboard)/resources/page.tsx
autonomous: true
---

<objective>
Restructure the app top-navbar to a social-app pattern: three primary nav icons
(Dashboard / Create / Discover) plus a hover/click profile dropdown containing
Profile, Bookmarks, Settings, Resources, and Log out. Remove the standalone
LogoutButton from the navbar (it moves into the dropdown). Add three placeholder
routes so new nav links resolve, wire Create to the existing create-project
dialog via a `?new=1` deep-link, and re-label the mobile bottom nav to match.

Purpose: Align the chrome with the user's reference screenshot, free top-bar
real estate, and give every screen a consistent identity zone.

Output: Refactored navbar(s), new ProfileMenu component, three placeholder
pages, deep-link support in CreateProjectDialog.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@/Users/deeg/.claude/plans/okay-just-research-me-rosy-pinwheel.md
@src/components/layout/top-navbar.tsx
@src/components/layout/bottom-navbar.tsx
@src/components/layout/dashboard-shell.tsx
@src/components/auth/logout-button.tsx
@src/components/ui/icon.tsx
@src/components/projects/create-project-dialog.tsx
@src/components/projects/project-list.tsx
@src/app/(dashboard)/dashboard/page.tsx

<interfaces>
<!-- Already present in the codebase, reuse as-is. -->

From src/components/ui/icon.tsx:
```typescript
export function Icon(props: {
  name: string                         // Material Symbols name
  filled?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}): JSX.Element
```

From src/app/(auth)/login/actions.ts:
```typescript
export async function logout(): Promise<void>   // server action, redirects to /login
```
Use via `<form action={logout}><button type="submit">…</button></form>` —
identical to the existing LogoutButton pattern.

From src/components/projects/create-project-dialog.tsx (current):
```typescript
export function CreateProjectDialog(props: { asPlaceholderCard?: boolean }): JSX.Element
// Internally: const [open, setOpen] = useState(false)
// Wraps Base-UI <Dialog.Root open={open} onOpenChange={setOpen}>
```
For the `?new=1` deep-link Task 2 will auto-open this dialog by reading the
URL search param via `useSearchParams()` inside the component and seeding
`open` accordingly.

Active-pill convention (reuse everywhere):
- Active:   `bg-[#fadbdb] text-[#3d0000]`
- Inactive: `text-[#7d6161] hover:bg-[#fff0f0] hover:text-[#3d0000]`

Brand surface tokens used elsewhere in chrome:
- Surface: `bg-[#fff8f7]`, soft surface `bg-[#fff0f0]`
- Text primary `text-[#3d0000]`, secondary `text-[#7d6161]`
- Divider: `border-[#dbc1bc]/20`
- Card shadow: `shadow-[0px_20px_40px_rgba(61,0,0,0.06)]`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build ProfileMenu and restructure TopNavbar (Dashboard / Create / Discover + dropdown)</name>
  <files>
    src/components/layout/profile-menu.tsx (NEW),
    src/components/layout/top-navbar.tsx (MODIFY)
  </files>
  <action>
**Step A — Create `src/components/layout/profile-menu.tsx` (NEW client component).**

Props:
```typescript
interface ProfileMenuProps {
  userName: string
  creditDisplay?: React.ReactNode
}
```

Behavior:
- Renders the right-side identity zone exactly as the current top-navbar does:
  the small `userName` + `creditDisplay` block (hidden on mobile via
  `hidden sm:block`) and an avatar circle (`w-8 h-8 rounded-full bg-[#fadbdb]`
  containing `<Icon name="person" size="sm" className="text-[#3d0000]" />`).
- Wraps trigger + floating panel in a single relatively-positioned `<div>`
  with `onPointerEnter` opening and `onPointerLeave` closing after an 80ms
  debounce (use a `useRef<number | null>` timeout id; clear on re-enter).
- Avatar is `<button type="button">` so it is also tap/click-toggleable for
  touch devices. Clicking toggles `open`.
- A `useEffect` outside-click listener (`mousedown` on `document`) closes the
  menu when the click target is outside the wrapper ref. Clean up listener
  on unmount.
- The floating panel is positioned `absolute right-0 top-full mt-2 w-56`,
  styled `bg-white rounded-xl shadow-[0px_20px_40px_rgba(61,0,0,0.12)]
  border border-[#dbc1bc]/20 py-2 z-50`. Render nothing (or `hidden`) when
  `open === false`.
- Each row is a `<Link>` (or `<form action={logout}><button>` for logout)
  styled: `flex items-center gap-3 px-4 py-2.5 text-sm text-[#3d0000]
  hover:bg-[#fff0f0] transition-colors w-full text-left`. Icon on the left
  via `<Icon name="…" size="sm" />`.
- Active row styling (when `pathname` matches the row's href, including
  `pathname.startsWith` for `/settings` and `/settings/profile`): apply
  `bg-[#fadbdb]` to the row.
- Rows in order:
  1. Profile      — icon `account_circle`, href `/settings/profile`
  2. Bookmarks    — icon `bookmark`,        href `/bookmarks`
  3. Settings     — icon `settings`,        href `/settings`
     (active when `pathname === '/settings'` only, NOT `/settings/profile`)
  4. Resources    — icon `science`,         href `/resources`
  5. Divider: `<div className="my-2 border-t border-[#dbc1bc]/20" />`
  6. Log out — `<form action={logout}>` with a button styled like the other
     rows; icon `logout`. Import `logout` from `@/app/(auth)/login/actions`.
- File is `'use client'`. Import `Link` from `next/link`, `usePathname` from
  `next/navigation`, `Icon` from `@/components/ui/icon`, `logout` from
  `@/app/(auth)/login/actions`.
- Export `function ProfileMenu(props: ProfileMenuProps)`.

**Step B — Modify `src/components/layout/top-navbar.tsx` (`variant="app"` branch only; leave the `'marketing'` branch untouched).**

- Import `useSearchParams` from `next/navigation` alongside `usePathname`.
- Import the new `ProfileMenu` from `./profile-menu`.
- Remove the `LogoutButton` import.
- Replace the `navItems` constant with:
  ```typescript
  const navItems = [
    { key: 'dashboard', icon: 'dashboard',  label: 'Dashboard', href: '/dashboard' },
    { key: 'create',    icon: 'add_circle', label: 'Create',    href: '/dashboard?new=1' },
    { key: 'discover',  icon: 'explore',    label: 'Discover',  href: '/discover' },
  ] as const
  ```
- Inside the component, derive active state per item:
  - `isCreate = searchParams.get('new') === '1'`
  - `isDashboard = pathname === '/dashboard' && !isCreate`
  - `isDiscover  = pathname.startsWith('/discover')`
  Switch in the map by `item.key`.
- Render the existing icon-row block (`hidden md:flex items-center gap-1`)
  using the same active-pill classes already in the file. Each anchor keeps
  `title={item.label}` for tooltips and `<Icon name={item.icon} size="sm" />`
  as the body.
- Replace the entire current "Profile" `<div>` (the block that contains
  `userName`, `creditDisplay`, the avatar `div`, and `<LogoutButton />`)
  with a single `<ProfileMenu userName={userName ?? 'User'} creditDisplay={creditDisplay} />`.
  Keep the surrounding container so spacing matches; ProfileMenu owns the
  identity-zone layout (left border divider, padding-left, gap-4) — move that
  styling into the ProfileMenu wrapper so the navbar stays clean.
- Do not change the header element, padding, logo, or the `marketing` branch.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && npx tsc --noEmit 2>&1 | grep -E "(top-navbar|profile-menu)" || echo "OK: no type errors in top-navbar/profile-menu"</automated>
  </verify>
  <done>
- `src/components/layout/profile-menu.tsx` exists, exports `ProfileMenu`, and
  contains all five rows (Profile, Bookmarks, Settings, Resources, Log out)
  with the divider above Log out.
- `top-navbar.tsx` no longer imports `LogoutButton` and renders three nav
  icons (Dashboard, Create, Discover) plus `<ProfileMenu />`.
- Active pill highlights Dashboard when `pathname === '/dashboard'` AND no
  `?new=1`, Create when `?new=1` is present, Discover when on `/discover*`.
- `npx tsc --noEmit` reports no new errors in the modified files.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add 3 placeholder routes, wire Create deep-link, update bottom navbar</name>
  <files>
    src/app/(dashboard)/discover/page.tsx (NEW),
    src/app/(dashboard)/bookmarks/page.tsx (NEW),
    src/app/(dashboard)/resources/page.tsx (NEW),
    src/components/projects/create-project-dialog.tsx (MODIFY),
    src/components/layout/bottom-navbar.tsx (MODIFY)
  </files>
  <action>
**Step A — Three placeholder pages under `src/app/(dashboard)/`.**

Each page is a server component, ~20 lines, sharing this shape (substitute
title/description/icon per route). Use the dashboard route group so the
existing `(dashboard)/layout.tsx` automatically wraps them in the
DashboardShell — verify by reading `src/app/(dashboard)/layout.tsx` first;
if it does not wrap children in `DashboardShell`, import and use
`DashboardShell` directly inside each page (and pass `userName` resolved the
same way `dashboard/page.tsx` does — via `createClient()` then
`auth.getUser()`). Default to NOT importing DashboardShell if the layout
already wraps children.

Template (Discover example):
```tsx
import { Icon } from '@/components/ui/icon'

export default function DiscoverPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-[#fadbdb] flex items-center justify-center mb-6">
        <Icon name="explore" size="lg" className="text-[#3d0000]" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-[#3d0000] mb-2">Discover</h1>
      <p className="text-sm text-[#7d6161] max-w-sm">
        Trending carousels and inspiration from the community. Coming soon.
      </p>
    </div>
  )
}
```

Variants:
- `discover/page.tsx`  — icon `explore`,  title "Discover",  body "Trending carousels and inspiration from the community. Coming soon."
- `bookmarks/page.tsx` — icon `bookmark`, title "Bookmarks", body "Save carousels you love and revisit them anytime. Coming soon."
- `resources/page.tsx` — icon `science`,  title "Resources", body "Templates, guides, and creator tools. Coming soon."

**Step B — Wire `?new=1` deep-link in `src/components/projects/create-project-dialog.tsx`.**

- Import `useSearchParams` and `useRouter` (`useRouter` already imported).
- Inside `CreateProjectDialog`, after the existing `useState`/`useRef`/`useRouter`
  hooks add:
  ```typescript
  const searchParams = useSearchParams()
  const wantsNew = searchParams.get('new') === '1'

  useEffect(() => {
    if (wantsNew && !asPlaceholderCard) setOpen(true)
  }, [wantsNew, asPlaceholderCard])
  ```
  Add `useEffect` to the `useState`/`useRef` import line from `'react'`.
- In `handleSubmit`, after `setOpen(false)`, if `wantsNew` is true clear the
  query param before navigation:
  ```typescript
  if (wantsNew) router.replace('/dashboard')
  ```
  (The existing `router.push(`/project/${projectId}`)` happens after this and
  takes precedence when a project was created; the replace only matters when
  the dialog is dismissed without submission, so also call it from a new
  `onOpenChange` handler — replace the bare `setOpen` handler in
  `<Dialog.Root>` with:
  ```tsx
  onOpenChange={(next) => {
    setOpen(next)
    if (!next && wantsNew) router.replace('/dashboard')
  }}
  ```
- Guard with `asPlaceholderCard` so only the visible "Create New Slide"
  instance auto-opens; the in-grid placeholder card instance must NOT
  auto-open (avoids two dialogs racing).

**Step C — Update `src/components/layout/bottom-navbar.tsx`.**

Replace the `tabs` array with:
```typescript
const tabs = [
  { href: '/dashboard',         icon: 'home',        label: 'Home' },
  { href: '/dashboard?new=1',   icon: 'add_circle',  label: 'Create' },
  { href: '/discover',          icon: 'explore',     label: 'Discover' },
  { href: '/settings/profile',  icon: 'person',      label: 'Me' },
] as const
```

Update `isActive` to handle all four tabs (current logic only handles Home
and Me, and the boolean expression is broken — it returns a string for the
'Home' branch). Replace with:
```typescript
const searchParams = useSearchParams()  // add import from 'next/navigation'
const isCreate = searchParams.get('new') === '1'
const isActive =
  tab.label === 'Create'   ? isCreate :
  tab.label === 'Home'     ? pathname === '/dashboard' && !isCreate :
  tab.label === 'Discover' ? pathname.startsWith('/discover') :
  tab.label === 'Me'       ? pathname.startsWith('/settings') :
  false
```

Do not change the rendered markup, classes, or the `md:hidden` wrapper.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && npx tsc --noEmit 2>&1 | grep -E "(discover|bookmarks|resources|create-project-dialog|bottom-navbar)" || echo "OK: no type errors in new/modified files"</automated>
  </verify>
  <done>
- Visiting `/discover`, `/bookmarks`, `/resources` renders a placeholder page
  inside the DashboardShell (top + bottom nav visible).
- Visiting `/dashboard?new=1` auto-opens the CreateProjectDialog exactly
  once; closing it (without creating) returns the URL to `/dashboard`.
- Bottom nav shows Home / Create / Discover / Me with correct active state on
  each route, including the `?new=1` Create state.
- `npx tsc --noEmit` reports no new errors.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Visual + functional verification</name>
  <what-built>New top nav with three icon buttons + profile dropdown, three placeholder routes, Create deep-link, updated bottom nav.</what-built>
  <how-to-verify>
1. Hard-refresh `http://localhost:3000/dashboard`. Confirm the top nav shows
   three icons in this order: Dashboard (active), Create, Discover. The
   standalone logout button is gone.
2. Hover the avatar in the top-right. Dropdown opens with Profile, Bookmarks,
   Settings, Resources, divider, Log out. Move the cursor down into the
   panel without it closing. Move the cursor away — closes after ~80ms.
3. Tap/click each row (touch path also works):
   - Profile   → navigates to `/settings/profile`
   - Bookmarks → navigates to `/bookmarks` (placeholder renders)
   - Settings  → navigates to `/settings`
   - Resources → navigates to `/resources` (placeholder renders)
   - Log out   → signs out, redirects to `/login`
4. From `/dashboard`, click the Create icon in the top nav. URL becomes
   `/dashboard?new=1` AND the create-project dialog opens automatically.
   Dismiss the dialog → URL returns to `/dashboard`.
5. Click Discover in the top nav → `/discover` placeholder renders, Discover
   icon is active.
6. Resize the window to mobile width. Bottom nav shows Home / Create /
   Discover / Me with the correct active highlight on each route.
7. From the project root run `npx tsc --noEmit` — no new errors in any
   modified file.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues found.</resume-signal>
</task>

</tasks>

<success_criteria>
- Top nav shows Dashboard / Create / Discover icons + ProfileMenu (no
  standalone logout button).
- ProfileMenu opens on hover (desktop) and tap (touch), closes on
  outside-click or 80ms debounced mouseleave.
- All five dropdown rows route correctly; Log out uses the existing `logout`
  server action.
- `/discover`, `/bookmarks`, `/resources` render placeholder pages inside
  the DashboardShell.
- `/dashboard?new=1` auto-opens the CreateProjectDialog and clears the
  param on close.
- Bottom nav re-labeled to Home / Create / Discover / Me with correct
  active-state logic.
- `npx tsc --noEmit` passes without new errors.
</success_criteria>

<output>
After completion, create
`.planning/quick/260427-iun-top-nav-restructure-dashboard-create-dis/260427-iun-SUMMARY.md`
listing the files changed, the dropdown trigger behavior chosen, and any
follow-ups (e.g. swap to Radix dropdown for full a11y, build real Discover
/ Bookmarks / Resources, mobile Me action sheet).
</output>
