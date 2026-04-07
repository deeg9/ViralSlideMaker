# Phase 1: Foundation and Auth - Research

**Researched:** 2026-03-19
**Domain:** Next.js App Router + Supabase Auth + Project CRUD + UI Foundation
**Confidence:** HIGH

## Summary

Phase 1 establishes the complete application shell: Next.js project scaffolding, Supabase authentication (email/password signup, login, session persistence, logout), a projects dashboard with CRUD operations, and the foundational clean/minimal UI design system.

The stack is well-established: Next.js 15 (App Router) with TypeScript, Supabase for auth and database, shadcn/ui + Tailwind CSS for the UI layer. The official Supabase starter template (`with-supabase`) provides a proven foundation for the auth integration pattern using `@supabase/ssr` with cookie-based sessions. The projects table uses Supabase Row Level Security (RLS) to scope data per user with zero custom middleware.

**Primary recommendation:** Bootstrap with `create-next-app`, add Supabase via `@supabase/ssr`, use shadcn/ui for all UI components, and implement RLS policies on the `projects` table from day one.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can create account with email/password | Supabase Auth `signUp` with email/password -- built-in, no custom backend needed |
| AUTH-02 | User session persists across browser refresh | `@supabase/ssr` cookie-based sessions + middleware token refresh pattern |
| AUTH-03 | User can log out from any page | `supabase.auth.signOut()` + redirect in server action or client handler |
| PROJ-01 | User can create a new slideshow project | Supabase `projects` table INSERT with RLS policy restricting to `auth.uid()` |
| PROJ-02 | User can save a project and return later | Supabase row persistence -- project data stored in `projects` table, loaded on return |
| PROJ-03 | User can view dashboard of saved projects | Server component SELECT query on `projects` table, filtered by RLS automatically |
| PROJ-04 | User can delete projects | Supabase DELETE with RLS policy -- only owner can delete their own projects |
| UIUX-01 | Clean, minimal design aesthetic | shadcn/ui components + Tailwind CSS + custom theme inspired by 21st.dev |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x (latest 15.5) | Full-stack React framework | App Router, server components, server actions, stable and well-documented |
| React | 19.x | UI library | Ships with Next.js 15, required for server components |
| TypeScript | 5.x | Type safety | Default in Next.js scaffolding, catches errors early |
| @supabase/supabase-js | latest | Supabase client SDK | Official SDK for auth, database, storage |
| @supabase/ssr | latest | Server-side auth helpers | Cookie-based session management for Next.js App Router |
| Tailwind CSS | 4.x | Utility-first CSS | Default in Next.js scaffolding, pairs with shadcn/ui |
| shadcn/ui | latest | Component library | Copy-paste components built on Radix UI, fully customizable, clean aesthetic |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | latest | Icons | Default icon set for shadcn/ui |
| clsx + tailwind-merge | latest | Class utilities | Conditional className merging (installed with shadcn/ui) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Next.js 15 | Next.js 16 | 16 has proxy.ts replacing middleware, Cache Components, Turbopack default -- but less ecosystem documentation and more breaking changes. 15 is safer for a new project. |
| shadcn/ui | Radix Themes or Mantine | shadcn/ui gives full control over component code, matches "clean minimal" aesthetic goal, and is the de facto standard with Next.js |
| Tailwind v4 | Tailwind v3 | v4 ships with latest Next.js scaffolding and shadcn/ui supports it; no reason to use v3 |

**Installation:**
```bash
npx create-next-app@latest tiktok-slideshow --ts --tailwind --eslint --app --src-dir
cd tiktok-slideshow
npm install @supabase/supabase-js @supabase/ssr
npx shadcn@latest init
npx shadcn@latest add button card input label dialog dropdown-menu avatar separator
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/
    (auth)/                  # Route group for auth pages (no layout chrome)
      login/page.tsx
      signup/page.tsx
    (dashboard)/             # Route group for authenticated pages
      layout.tsx             # App shell with nav, requires auth
      dashboard/page.tsx     # Project list / home
      project/[id]/page.tsx  # Individual project (placeholder for Phase 2+)
    auth/
      callback/route.ts     # Auth callback handler for email confirmation
    layout.tsx               # Root layout (html, body, fonts, providers)
    page.tsx                 # Landing/redirect to dashboard or login
  components/
    ui/                      # shadcn/ui components (auto-generated)
    layout/                  # Header, Sidebar, AppShell
    auth/                    # LoginForm, SignupForm, LogoutButton
    projects/                # ProjectCard, CreateProjectDialog, ProjectList
  lib/
    supabase/
      client.ts             # Browser client (createBrowserClient)
      server.ts             # Server client (createServerClient)
      middleware.ts          # Session refresh utility
  middleware.ts              # Next.js middleware (calls lib/supabase/middleware.ts)
```

### Pattern 1: Supabase Browser Client (Client Components)
**What:** Singleton browser client for client-side Supabase calls
**When to use:** Client components that need auth state or real-time data
**Example:**
```typescript
// src/lib/supabase/client.ts
// Source: https://supabase.com/ui/docs/nextjs/client
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

### Pattern 2: Supabase Server Client (Server Components / Actions)
**What:** Per-request server client with cookie access
**When to use:** Server components, server actions, route handlers
**Example:**
```typescript
// src/lib/supabase/server.ts
// Source: https://supabase.com/ui/docs/nextjs/client
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component -- cannot set cookies
          }
        },
      },
    }
  )
}
```

### Pattern 3: Middleware for Session Refresh
**What:** Middleware intercepts every request to refresh expired auth tokens
**When to use:** Always -- required for session persistence (AUTH-02)
**Example:**
```typescript
// src/lib/supabase/middleware.ts
// Source: https://supabase.com/ui/docs/nextjs/client
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Use getClaims() not getSession() -- getClaims revalidates the token
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  // Redirect unauthenticated users to login
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/signup') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

```typescript
// src/middleware.ts
import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Pattern 4: Server Actions for Auth
**What:** Server actions handle login, signup, logout -- no API routes needed
**When to use:** All auth form submissions
**Example:**
```typescript
// src/app/(auth)/login/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/login?error=Invalid credentials')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    redirect('/signup?error=Could not create account')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

### Pattern 5: Auth Callback Route Handler
**What:** Handles the callback after email confirmation
**When to use:** Required when email confirmation is enabled in Supabase
**Example:**
```typescript
// src/app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Auth callback failed`)
}
```

### Pattern 6: Database Schema with RLS
**What:** Projects table with Row Level Security
**When to use:** All user-owned data tables
**Example:**
```sql
-- Supabase SQL Editor: projects table
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  title text not null default 'Untitled Project',
  description text,
  slide_data jsonb default '[]'::jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Enable RLS
alter table public.projects enable row level security;

-- Users can only see their own projects
create policy "Users can view own projects"
  on public.projects for select
  using (auth.uid() = user_id);

-- Users can only insert their own projects
create policy "Users can insert own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

-- Users can only update their own projects
create policy "Users can update own projects"
  on public.projects for update
  using (auth.uid() = user_id);

-- Users can only delete their own projects
create policy "Users can delete own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- Index for faster queries
create index projects_user_id_idx on public.projects(user_id);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on public.projects
  for each row execute function update_updated_at();
```

### Anti-Patterns to Avoid
- **Using `getSession()` on the server:** Always use `getClaims()` -- `getSession()` does not revalidate the auth token and is not secure for server-side checks.
- **Creating Supabase client in middleware without cookie forwarding:** The middleware client MUST use the request/response cookie pattern shown above, or sessions will not persist.
- **Storing auth state in React state:** Let Supabase handle session management via cookies. Do not duplicate session state in `useState` or context.
- **Skipping RLS:** Never rely solely on client-side route protection. RLS ensures data security even if someone calls the Supabase API directly.
- **Using API routes for simple CRUD:** Server actions are simpler and more secure for form submissions and mutations. Reserve API routes for webhook endpoints or external integrations.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Authentication | Custom JWT/session system | Supabase Auth | Email verification, password reset, session management, token refresh -- massive surface area for security bugs |
| Session persistence | Custom cookie management | `@supabase/ssr` middleware pattern | Token refresh, cookie syncing between server/client is tricky to get right |
| Authorization | Custom middleware auth checks | Supabase RLS policies | Database-level security that works regardless of how data is accessed |
| UI components | Custom buttons, forms, dialogs | shadcn/ui | Accessibility, keyboard navigation, focus management are hard to implement correctly |
| Form validation | Custom regex/validation | HTML5 validation + server-side checks | Sufficient for v1; add Zod later if needed |
| CSS utility classes | Custom CSS-in-JS | Tailwind CSS | Consistent, performant, well-documented utility system |

**Key insight:** Supabase provides auth, database, and RLS out of the box. The entire auth + CRUD backend for this phase requires zero custom server code -- only SQL schema, RLS policies, and Supabase SDK calls.

## Common Pitfalls

### Pitfall 1: Using getSession() Instead of getClaims() on Server
**What goes wrong:** Auth token is not revalidated, potentially allowing stale/tampered tokens to pass checks.
**Why it happens:** Older tutorials and documentation reference `getSession()`. Supabase now recommends `getClaims()`.
**How to avoid:** Always use `supabase.auth.getClaims()` in server-side code (middleware, server components, server actions).
**Warning signs:** Auth working in development but users getting randomly logged out or security audit flags.

### Pitfall 2: Middleware Not Refreshing Tokens
**What goes wrong:** Users get logged out after token expiry (typically 1 hour) despite having a valid refresh token.
**Why it happens:** Middleware not calling `supabase.auth.getClaims()` to trigger token refresh on every request.
**How to avoid:** Follow the exact middleware pattern from Supabase docs. The `getClaims()` call is what triggers the refresh.
**Warning signs:** Users report being logged out after ~1 hour of inactivity.

### Pitfall 3: Missing Cookie Forwarding in Middleware
**What goes wrong:** Auth state lost between requests. User appears logged out on server-rendered pages.
**Why it happens:** The middleware creates a new response without forwarding the updated cookies from the Supabase client.
**How to avoid:** Use the exact `setAll` pattern that updates BOTH `request.cookies` and `supabaseResponse.cookies`.
**Warning signs:** Client-side auth works but server components show user as unauthenticated.

### Pitfall 4: Forgetting RLS on New Tables
**What goes wrong:** All users can see/modify all data. One user's projects visible to another.
**Why it happens:** Creating tables without enabling RLS. Supabase defaults to no RLS on new tables.
**How to avoid:** Always run `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` immediately after `CREATE TABLE`. Add at minimum a SELECT policy.
**Warning signs:** Data leaks in development when testing with multiple user accounts.

### Pitfall 5: Not Handling Auth Errors in UI
**What goes wrong:** Users see blank pages or generic errors when login/signup fails.
**Why it happens:** Server actions using `redirect()` for errors without passing error info, or not catching Supabase errors.
**How to avoid:** Pass error messages via URL search params or use `useFormState` for server action error handling.
**Warning signs:** Users unable to understand why login failed (wrong password, unverified email, etc.).

### Pitfall 6: Blocking the Landing Page with Auth Middleware
**What goes wrong:** The root `/` page redirects to login even though it should be publicly accessible.
**Why it happens:** Middleware matcher catches all routes including public ones.
**How to avoid:** Configure middleware matcher to exclude public routes, or check path before redirecting.
**Warning signs:** Cannot access landing page without being logged in.

## Code Examples

### Project CRUD Server Actions
```typescript
// src/app/(dashboard)/dashboard/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createProject(formData: FormData) {
  const supabase = await createClient()
  const title = formData.get('title') as string

  const { error } = await supabase
    .from('projects')
    .insert({ title: title || 'Untitled Project' })

  if (error) throw new Error('Failed to create project')
  revalidatePath('/dashboard')
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)

  if (error) throw new Error('Failed to delete project')
  revalidatePath('/dashboard')
}
```

### Dashboard Server Component
```typescript
// src/app/(dashboard)/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'
import { ProjectList } from '@/components/projects/project-list'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false })

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Your Projects</h1>
      <ProjectList projects={projects ?? []} />
    </div>
  )
}
```

### Environment Variables
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...your-anon-key
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | auth-helpers is deprecated; ssr is the only supported package |
| `getSession()` for server auth checks | `getClaims()` | 2025 | getClaims revalidates token server-side; getSession does not |
| Pages Router pattern | App Router with Server Components | Next.js 13+ (2023) | Server components for data fetching, server actions for mutations |
| `middleware.ts` | `proxy.ts` (Next.js 16) | Oct 2025 | Next.js 16 renames middleware to proxy; we use 15 where middleware.ts is standard |
| Tailwind v3 config file | Tailwind v4 CSS-first config | 2025 | No `tailwind.config.ts` needed; config via `@theme` in CSS |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Replaced by `@supabase/ssr`. Do not install.
- `supabase.auth.getSession()` in server code: Use `supabase.auth.getClaims()` instead.
- Next.js Pages Router: Use App Router for all new projects.

## Open Questions

1. **Email Confirmation Flow**
   - What we know: Supabase can be configured to require email confirmation before login. The auth callback route handler exchanges the code for a session.
   - What's unclear: Whether to enable email confirmation for v1 or allow immediate login after signup (simpler UX).
   - Recommendation: Disable email confirmation for v1 (simpler). Can enable later. Set in Supabase Dashboard > Auth > Settings.

2. **Project Data Schema for Future Phases**
   - What we know: Phase 1 needs basic project metadata (title, description, timestamps). Phase 2+ will add slide data, template info, etc.
   - What's unclear: Exact schema for slide data.
   - Recommendation: Use a `slide_data jsonb` column as a flexible container. Phase 2 will define the structure. This avoids schema migrations between phases.

3. **Supabase getClaims() vs getUser()**
   - What we know: Supabase docs now reference `getClaims()` as the recommended server-side auth check.
   - What's unclear: Whether `getClaims()` is available in all versions of `@supabase/supabase-js` or only the very latest.
   - Recommendation: Use latest `@supabase/supabase-js`. If `getClaims()` is not available, fall back to `getUser()` which also validates the token server-side (just slower). Do NOT use `getSession()`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + React Testing Library |
| Config file | none -- Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Signup with email/password calls supabase.auth.signUp | unit | `npx vitest run src/__tests__/auth/signup.test.ts -t "signup"` | Wave 0 |
| AUTH-02 | Middleware refreshes session on request | unit | `npx vitest run src/__tests__/auth/middleware.test.ts -t "session"` | Wave 0 |
| AUTH-03 | Logout calls signOut and redirects | unit | `npx vitest run src/__tests__/auth/logout.test.ts -t "logout"` | Wave 0 |
| PROJ-01 | Create project inserts into database | unit | `npx vitest run src/__tests__/projects/crud.test.ts -t "create"` | Wave 0 |
| PROJ-02 | Project data persists and loads | unit | `npx vitest run src/__tests__/projects/crud.test.ts -t "load"` | Wave 0 |
| PROJ-03 | Dashboard lists user projects | unit | `npx vitest run src/__tests__/projects/dashboard.test.ts -t "list"` | Wave 0 |
| PROJ-04 | Delete project removes from database | unit | `npx vitest run src/__tests__/projects/crud.test.ts -t "delete"` | Wave 0 |
| UIUX-01 | Clean design -- visual consistency | manual-only | N/A -- visual review | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` -- Vitest configuration with path aliases
- [ ] `src/__tests__/auth/signup.test.ts` -- covers AUTH-01
- [ ] `src/__tests__/auth/middleware.test.ts` -- covers AUTH-02
- [ ] `src/__tests__/auth/logout.test.ts` -- covers AUTH-03
- [ ] `src/__tests__/projects/crud.test.ts` -- covers PROJ-01, PROJ-02, PROJ-04
- [ ] `src/__tests__/projects/dashboard.test.ts` -- covers PROJ-03
- [ ] `src/__tests__/setup.ts` -- Supabase mock setup
- [ ] Framework install: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`

## Sources

### Primary (HIGH confidence)
- [Supabase Client Libraries - Next.js](https://supabase.com/ui/docs/nextjs/client) -- browser client, server client, middleware code
- [Supabase Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) -- auth setup patterns
- [Supabase SSR Client Creation](https://supabase.com/docs/guides/auth/server-side/creating-a-client) -- createBrowserClient, createServerClient
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) -- RLS policy patterns
- [shadcn/ui Next.js Installation](https://ui.shadcn.com/docs/installation/next) -- CLI setup
- [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4) -- v4 compatibility
- [Next.js 16 Blog Post](https://nextjs.org/blog/next-16) -- version comparison for stack decision

### Secondary (MEDIUM confidence)
- [Vercel Supabase Starter Template](https://vercel.com/templates/next.js/supabase) -- reference implementation
- [Next.js Project Structure](https://nextjs.org/docs/app/getting-started/project-structure) -- official structure guide

### Tertiary (LOW confidence)
- getClaims() API -- referenced in latest Supabase docs but may be very new; fall back to getUser() if unavailable

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Next.js 15 + Supabase + shadcn/ui is the most common greenfield stack, extensively documented
- Architecture: HIGH -- Follows official Supabase starter template patterns and Next.js App Router conventions
- Pitfalls: HIGH -- Well-documented gotchas from Supabase migration guides and community discussions
- getClaims() API: MEDIUM -- New API, may need fallback to getUser()

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (30 days -- stable technologies)
