---
phase: 01-foundation-and-auth
plan: 01
subsystem: auth
tags: [nextjs, supabase, supabase-ssr, shadcn-ui, tailwind, vitest, react-testing-library, typescript]

# Dependency graph
requires: []
provides:
  - Next.js 15 App Router project scaffold with TypeScript and Tailwind CSS v4
  - Supabase browser client (createBrowserClient via @supabase/ssr)
  - Supabase server client (createServerClient with cookie access)
  - Middleware session refresh utility using getClaims/getUser
  - Next.js middleware for auth token refresh on every request
  - Login page with email/password form and error display
  - Signup page with email/password/confirm-password fields
  - Logout server action and LogoutButton client component
  - Auth callback route handler for email confirmation code exchange
  - Dashboard placeholder page
  - Vitest test infrastructure with Supabase mocks
  - 10 passing unit tests (signup 3, middleware 5, logout 2)
affects:
  - 01-02 (projects dashboard -- uses auth patterns and Supabase clients)
  - all subsequent phases (auth foundation)

# Tech tracking
tech-stack:
  added:
    - "@supabase/supabase-js (latest)"
    - "@supabase/ssr (latest)"
    - "shadcn/ui (latest) -- button, card, input, label"
    - "vitest 4.x"
    - "@testing-library/react"
    - "@testing-library/jest-dom"
    - "jsdom"
    - "@vitejs/plugin-react"
    - "lucide-react (via shadcn)"
    - "clsx + tailwind-merge (via shadcn)"
  patterns:
    - "Supabase browser client via createBrowserClient in client components"
    - "Supabase server client via createServerClient with cookie store in server components/actions"
    - "Middleware session refresh: getClaims() for token revalidation, fallback to getUser()"
    - "Server actions for auth form submissions (no API routes)"
    - "URL search params for passing error messages to auth pages"
    - "Route groups (auth) for pages without dashboard chrome"

key-files:
  created:
    - src/lib/supabase/client.ts
    - src/lib/supabase/server.ts
    - src/lib/supabase/middleware.ts
    - src/middleware.ts
    - src/app/(auth)/login/page.tsx
    - src/app/(auth)/login/actions.ts
    - src/app/(auth)/signup/page.tsx
    - src/app/(auth)/signup/actions.ts
    - src/app/auth/callback/route.ts
    - src/components/auth/logout-button.tsx
    - src/app/dashboard/page.tsx
    - vitest.config.ts
    - src/__tests__/setup.ts
    - src/__tests__/auth/signup.test.ts
    - src/__tests__/auth/middleware.test.ts
    - src/__tests__/auth/logout.test.ts
    - .env.local.example
  modified:
    - src/app/page.tsx (redirect to /login or /dashboard based on auth)
    - src/app/layout.tsx (Inter font, clean structure)
    - package.json (added dependencies)

key-decisions:
  - "Used getClaims() with getUser() fallback in middleware -- getClaims is newer API, may not be available in all Supabase SDK versions"
  - "Root / path excluded from auth redirect -- landing page stays public"
  - "Auth error messages passed via URL search params (?error=...) -- simple approach for server actions"
  - "LogoutButton uses form action pointing to logout server action -- avoids client-side API call"
  - "Created Next.js app in temp directory and rsync'd to project root -- npm naming restrictions block capital letters in project name"
  - "Dashboard placeholder created immediately to prevent build failure from page.tsx redirect"

patterns-established:
  - "Pattern: Server Supabase client -- import createClient from @/lib/supabase/server, await it"
  - "Pattern: Browser Supabase client -- import createClient from @/lib/supabase/client, call it"
  - "Pattern: Auth pages use (auth) route group for no-chrome layout"
  - "Pattern: Server actions handle form submissions, redirect on success/error"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

# Metrics
duration: 5min
completed: 2026-03-19
---

# Phase 01 Plan 01: Foundation and Auth Summary

**Next.js 15 app with Supabase email/password auth using @supabase/ssr cookie-based sessions, middleware token refresh with getClaims(), login/signup/logout pages via shadcn/ui, and 10 passing Vitest unit tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T17:42:03Z
- **Completed:** 2026-03-19T17:47:19Z
- **Tasks:** 2
- **Files modified:** 17 created, 3 modified

## Accomplishments
- Complete Supabase auth integration with browser/server/middleware clients following official @supabase/ssr patterns
- Login, signup, logout flows implemented as server actions with proper error handling and redirects
- Middleware refreshes auth tokens on every request using getClaims() (with getUser() fallback) to ensure session persistence
- Vitest test infrastructure with Supabase mocks, all 10 auth unit tests passing
- Clean shadcn/ui auth pages (login, signup) with error display via URL search params

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js project, install dependencies, configure Supabase clients and middleware** - `cd45651` (feat)
2. **Task 2: Implement auth pages (login, signup, logout) with server actions and auth callback** - `d0434dd` (feat)

## Files Created/Modified

- `src/lib/supabase/client.ts` - Browser Supabase client using createBrowserClient
- `src/lib/supabase/server.ts` - Server Supabase client with cookie store access
- `src/lib/supabase/middleware.ts` - Session refresh utility, getClaims/getUser, redirect logic
- `src/middleware.ts` - Next.js middleware entry point with path matcher
- `src/app/(auth)/login/page.tsx` - Login form with email/password, error display, signup link
- `src/app/(auth)/login/actions.ts` - Login, signup, and logout server actions
- `src/app/(auth)/signup/page.tsx` - Signup form with email/password/confirm, error display, login link
- `src/app/(auth)/signup/actions.ts` - Signup server action
- `src/app/auth/callback/route.ts` - Auth callback GET handler for email confirmation codes
- `src/components/auth/logout-button.tsx` - Client component LogoutButton calling logout server action
- `src/app/dashboard/page.tsx` - Dashboard placeholder with header and logout button
- `vitest.config.ts` - Vitest config with jsdom, React plugin, @/* path alias
- `src/__tests__/setup.ts` - Global test setup with Supabase mocks (createBrowserClient, createServerClient)
- `src/__tests__/auth/signup.test.ts` - 3 tests for signup action (calls signUp, redirects on success/error)
- `src/__tests__/auth/middleware.test.ts` - 5 tests for updateSession (getClaims, protected paths, public paths)
- `src/__tests__/auth/logout.test.ts` - 2 tests for logout action (calls signOut, redirects to /login)
- `src/app/page.tsx` - Root page redirects to /dashboard or /login based on auth state
- `src/app/layout.tsx` - Root layout with Inter font and clean HTML structure
- `.env.local.example` - Template for required environment variables

## Decisions Made

- Used getClaims() with getUser() as fallback in middleware since getClaims is a newer Supabase API that may not be available in older SDK versions
- Root `/` path excluded from auth redirect -- landing page remains public, middleware allows passthrough
- Error messages passed via URL search params (`?error=...`) -- simplest approach that works without client-side state for server actions
- LogoutButton wraps logout server action in a `<form>` -- avoids any client-side Supabase call, keeps logout server-authoritative
- Created Next.js app in a temp directory then rsync'd to repo root -- `create-next-app` refuses capital letters in project folder name, which the existing repo has

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scaffolded Next.js in temp directory then rsync'd to project root**
- **Found during:** Task 1 (scaffolding)
- **Issue:** `create-next-app` refuses project names with capital letters (`TikTokSlideshow`), failing with npm naming restriction error
- **Fix:** Scaffolded into `tiktok-slideshow-temp/`, rsync'd all files (excluding .git and node_modules) to the actual project root
- **Files modified:** All scaffolded project files
- **Verification:** `next build` succeeds
- **Committed in:** cd45651 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Created dashboard placeholder page**
- **Found during:** Task 1 (verifying build)
- **Issue:** `src/app/page.tsx` redirects authenticated users to `/dashboard` but no `/dashboard` route existed, which would cause a broken user experience
- **Fix:** Created `src/app/dashboard/page.tsx` as a placeholder with logout button in header
- **Files modified:** src/app/dashboard/page.tsx
- **Verification:** Build succeeds, /dashboard route appears in route manifest
- **Committed in:** d0434dd (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both were necessary for build success and correct app behavior. No scope creep.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

**External services require manual configuration before the app will function.**

Supabase project setup needed:
1. Create a Supabase project at https://supabase.com/dashboard
2. Copy `.env.local.example` to `.env.local` and fill in values:
   - `NEXT_PUBLIC_SUPABASE_URL` from Project Settings > API > Project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from Project Settings > API > anon/public key
3. (Optional for v1) Disable email confirmation: Authentication > Providers > Email > Confirm email toggle OFF

## Next Phase Readiness

- Auth foundation is complete: clients, middleware, login/signup/logout, tests all working
- Next plan (01-02) can implement the projects dashboard with Supabase CRUD and RLS policies
- Supabase client patterns are established -- follow `src/lib/supabase/server.ts` pattern for all server-side data access

---
*Phase: 01-foundation-and-auth*
*Completed: 2026-03-19*
