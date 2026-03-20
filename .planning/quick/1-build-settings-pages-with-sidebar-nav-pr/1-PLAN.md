---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(dashboard)/settings/layout.tsx
  - src/app/(dashboard)/settings/page.tsx
  - src/app/(dashboard)/settings/profile/page.tsx
  - src/app/(dashboard)/settings/profile/actions.ts
  - src/app/(dashboard)/settings/notifications/page.tsx
  - src/app/(dashboard)/settings/notifications/actions.ts
  - src/app/(dashboard)/settings/subscription/page.tsx
  - src/components/layout/top-navbar.tsx
  - src/components/layout/bottom-navbar.tsx
autonomous: true
requirements: [SETTINGS-NAV, SETTINGS-PROFILE, SETTINGS-NOTIFICATIONS, SETTINGS-SUBSCRIPTION]

must_haves:
  truths:
    - "Settings pages have a left sidebar nav with 4 items: Profile, Notifications, Manage Subscription, Brand Kit"
    - "Profile page shows editable first name, last name, email (read-only), phone number fields with save"
    - "Notifications page shows toggle switches for marketing, branding, slides ready, customer service"
    - "Subscription page shows pricing tiers and a Manage Subscription button"
    - "Active settings nav item is visually highlighted based on current route"
    - "Navbar settings icon links to /settings (redirects to /settings/profile)"
  artifacts:
    - path: "src/app/(dashboard)/settings/layout.tsx"
      provides: "Settings layout with left sidebar navigation"
    - path: "src/app/(dashboard)/settings/profile/page.tsx"
      provides: "Profile settings form"
    - path: "src/app/(dashboard)/settings/notifications/page.tsx"
      provides: "Notification preferences UI"
    - path: "src/app/(dashboard)/settings/subscription/page.tsx"
      provides: "Subscription tiers and manage button"
  key_links:
    - from: "src/components/layout/top-navbar.tsx"
      to: "/settings"
      via: "navItems href change"
    - from: "src/app/(dashboard)/settings/layout.tsx"
      to: "all settings sub-pages"
      via: "sidebar nav links with pathname-based active state"
---

<objective>
Build a complete settings section with left sidebar navigation containing 4 pages: Profile, Notifications, Manage Subscription, and the existing Brand Kit.

Purpose: Give users account management capabilities beyond brand kit -- profile editing, notification preferences, and subscription management.
Output: 4 settings pages accessible via sidebar nav at /settings/*
</objective>

<execution_context>
@/Users/deeg/.claude/get-shit-done/workflows/execute-plan.md
@/Users/deeg/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/app/(dashboard)/settings/brand-kit/page.tsx (existing settings page pattern)
@src/app/(dashboard)/settings/brand-kit/actions.ts (server action pattern)
@src/app/(dashboard)/layout.tsx (dashboard auth pattern)
@src/components/layout/top-navbar.tsx (navbar with settings link)
@src/components/layout/bottom-navbar.tsx (mobile nav with settings link)
@src/components/layout/dashboard-shell.tsx (shell wrapper)
@src/components/ui/icon.tsx (Material Symbols icon component)

<interfaces>
<!-- Key patterns the executor needs -->

From src/components/ui/icon.tsx:
```typescript
export function Icon({ name, filled, size, className }: IconProps)
// Usage: <Icon name="settings" size="sm" className="text-[#3d0000]" />
// Available sizes: 'sm' | 'md' | 'lg' | 'xl'
```

From src/app/(dashboard)/settings/brand-kit/actions.ts:
```typescript
// Server action pattern: 'use server', createClient(), getUser(), supabase query
// Returns typed result objects like { success: true } | { success: false; error: string }
```

Theme colors used throughout the app:
```
Primary: #3d0000 (headings, active states)
Background: #fff8f7 (page bg)
Muted bg: #fff0f0 (hover states)
Accent: #fadbdb (active nav items, badges)
Muted foreground: #7d6161 (secondary text)
Border: #dbc1bc with /10 or /30 opacity
Card bg: white with rounded-xl, border border-[#dbc1bc]/10
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Settings layout with sidebar nav, profile page, and notifications page</name>
  <files>
    src/app/(dashboard)/settings/layout.tsx
    src/app/(dashboard)/settings/page.tsx
    src/app/(dashboard)/settings/profile/page.tsx
    src/app/(dashboard)/settings/profile/actions.ts
    src/app/(dashboard)/settings/notifications/page.tsx
    src/app/(dashboard)/settings/notifications/actions.ts
    src/components/layout/top-navbar.tsx
    src/components/layout/bottom-navbar.tsx
  </files>
  <action>
1. Create `src/app/(dashboard)/settings/layout.tsx` -- a client component ('use client') settings layout with left sidebar navigation:
   - Use `usePathname()` to determine active nav item
   - Sidebar nav items (each with Icon + label):
     - Profile (icon: "person") -> /settings/profile
     - Notifications (icon: "notifications") -> /settings/notifications
     - Manage Subscription (icon: "credit_card") -> /settings/subscription
     - Brand Kit (icon: "palette") -> /settings/brand-kit
   - Active item: `bg-[#fadbdb] text-[#3d0000] font-bold` with rounded-xl
   - Inactive: `text-[#7d6161] hover:bg-[#fff0f0] hover:text-[#3d0000]`
   - Sidebar width: `w-64` on desktop, hidden on mobile
   - On mobile (md:hidden), show a horizontal scrollable tab bar at top instead of sidebar
   - Layout structure: `<div className="flex gap-8">` with sidebar + `<div className="flex-1 min-w-0">{children}</div>`
   - Page heading "Settings" with Icon name="settings" at top of sidebar

2. Create `src/app/(dashboard)/settings/page.tsx` -- server component that does `redirect('/settings/profile')` (just like how the app redirects unauthenticated users). Import from 'next/navigation'.

3. Create `src/app/(dashboard)/settings/profile/page.tsx` -- a client component ('use client') with:
   - Header: Icon "person" + "Profile" heading + subtitle "Manage your personal information"
   - White card (`bg-white rounded-xl p-8 border border-[#dbc1bc]/10`) containing form fields:
     - First Name (text input)
     - Last Name (text input)
     - Email (text input, disabled/read-only, populated from current session -- fetch via getProfile action)
     - Phone Number (text input, type="tel")
   - Profile picture section: circular avatar placeholder with Icon "person", "Upload Photo" button (UI only for v1, no actual upload wired)
   - Save button: `bg-[#3d0000] text-white px-6 py-2.5 rounded-xl font-medium` that calls saveProfile server action
   - Use React useState for form state, useTransition for pending state on save
   - Input styling: `w-full px-4 py-3 rounded-xl border border-[#dbc1bc]/30 bg-[#fff8f7] text-[#3d0000] focus:outline-none focus:ring-2 focus:ring-[#fadbdb]`

4. Create `src/app/(dashboard)/settings/profile/actions.ts` -- server actions:
   - `getProfile()`: Returns `{ firstName, lastName, email, phone }` -- For v1, get email from `supabase.auth.getUser()`, and store first_name/last_name/phone in user_metadata via `supabase.auth.updateUser()` / `supabase.auth.getUser()`. Read from `user.user_metadata.first_name` etc. No new DB table needed.
   - `saveProfile(formData: FormData)`: Updates user_metadata via `supabase.auth.updateUser({ data: { first_name, last_name, phone } })`. Returns `{ success: true } | { success: false; error: string }`. Revalidates `/settings/profile`.

5. Create `src/app/(dashboard)/settings/notifications/page.tsx` -- a client component ('use client') with:
   - Header: Icon "notifications" + "Notifications" heading + subtitle "Choose what notifications you receive"
   - White card with 4 toggle rows, each containing:
     - Label + description text on left
     - Toggle switch on right (styled checkbox or button)
   - Toggles:
     - Marketing Updates: "Receive emails about new features and promotions"
     - Brand Tips: "Get tips on improving your brand presence"
     - Slides Ready: "Be notified when your carousel slides are generated"
     - Customer Service: "Receive responses from our support team"
   - Toggle styling: custom CSS toggle -- 48px wide, 24px tall pill shape, bg-[#dbc1bc]/30 when off, bg-[#3d0000] when on, white circle knob
   - Save button same style as profile page
   - Use localStorage for v1 persistence (no DB table). Load on mount, save on button click.

6. Create `src/app/(dashboard)/settings/notifications/actions.ts` -- empty placeholder with just 'use server' export (for future DB-backed notifications). Export an empty object or a no-op function so the file exists for future use.

7. Update `src/components/layout/top-navbar.tsx`:
   - Change navItems settings href from '/settings/brand-kit' to '/settings'
   - Update isActive logic for Settings: `pathname.startsWith('/settings')` instead of exact match

8. Update `src/components/layout/bottom-navbar.tsx`:
   - Change the "Me" tab href from '/settings/brand-kit' to '/settings/profile'
   - Update isActive: `pathname.startsWith('/settings')` for the Me tab
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && npx next build 2>&1 | tail -20</automated>
  </verify>
  <done>Settings layout with sidebar nav renders. Profile page shows form fields and saves to user_metadata. Notifications page shows 4 toggles with localStorage persistence. Nav links updated to /settings. Build succeeds with no errors.</done>
</task>

<task type="auto">
  <name>Task 2: Subscription page with pricing tiers</name>
  <files>
    src/app/(dashboard)/settings/subscription/page.tsx
  </files>
  <action>
Create `src/app/(dashboard)/settings/subscription/page.tsx` -- a client component ('use client') with:

1. Header: Icon "credit_card" + "Manage Subscription" heading + subtitle "View your plan and manage billing"

2. Current plan badge: Show "Current Plan: Pro" in a small badge with `bg-[#fadbdb] text-[#3d0000] px-3 py-1 rounded-full text-sm font-bold`

3. Pricing tiers displayed in a 3-column grid (`grid grid-cols-1 md:grid-cols-3 gap-6`):

   **Free Tier:**
   - Price: $0/mo
   - Features: 5 carousels/month, Basic templates, Standard quality exports
   - CTA: "Current Plan" (disabled button, muted style)

   **Pro Tier (highlighted):**
   - Price: $12/mo
   - Features: Unlimited carousels, All templates + Brand Kit, HD exports, Priority generation
   - Ring highlight: `ring-2 ring-[#3d0000]` + "Most Popular" badge at top
   - CTA: "Current Plan" (if Pro) or "Upgrade" button

   **Business Tier:**
   - Price: $29/mo
   - Features: Everything in Pro, Team collaboration (coming soon), Custom templates, API access (coming soon)
   - CTA: "Contact Sales" button

4. Card styling for each tier: `bg-white rounded-xl p-6 border border-[#dbc1bc]/10` with price in large text `text-3xl font-bold text-[#3d0000]`, features as a list with Icon "check_circle" in `text-[#3d0000]` before each item.

5. Below tiers: "Manage Subscription" button that is `bg-[#3d0000] text-white px-6 py-3 rounded-xl font-medium w-full md:w-auto`. For v1, this is a placeholder -- onClick shows `window.alert('Stripe billing portal coming soon!')` or links to "#". Add a small note below: "Billing is managed through Stripe. You'll be redirected to a secure portal."

6. Hardcode "Pro" as the current plan for now (no DB lookup). The component is purely presentational for v1.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && npx next build 2>&1 | tail -20</automated>
  </verify>
  <done>Subscription page renders 3 pricing tier cards in a responsive grid. Pro tier is visually highlighted. Manage Subscription button present as placeholder. Build succeeds.</done>
</task>

</tasks>

<verification>
- `npm run build` completes without errors
- Navigate to /settings -> redirects to /settings/profile
- Profile page shows form with first name, last name, email (read-only), phone fields
- Notifications page shows 4 toggles that persist via localStorage
- Subscription page shows 3 pricing tiers with Pro highlighted
- Brand Kit page still accessible at /settings/brand-kit
- Settings sidebar highlights active section based on URL
- Top navbar settings icon links to /settings with active state on all /settings/* routes
- Bottom mobile nav "Me" tab links to /settings/profile
</verification>

<success_criteria>
- All 4 settings sub-pages render correctly under the shared settings layout with sidebar nav
- Profile save persists to Supabase user_metadata
- Notification toggles persist to localStorage
- Subscription page is presentational with placeholder Stripe button
- Existing brand-kit page unchanged and accessible
- Navigation updated in both top and bottom navbars
- Build passes with zero errors
</success_criteria>

<output>
After completion, create `.planning/quick/1-build-settings-pages-with-sidebar-nav-pr/1-SUMMARY.md`
</output>
