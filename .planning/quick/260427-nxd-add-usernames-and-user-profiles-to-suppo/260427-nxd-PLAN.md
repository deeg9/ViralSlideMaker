---
phase: quick-260427-nxd
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260427_create_profiles.sql
  - src/lib/profile/reserved-usernames.ts
  - src/lib/profile/username-validation.ts
  - src/lib/profile/username-suggestions.ts
  - src/app/(auth)/onboarding/username/page.tsx
  - src/app/(auth)/onboarding/username/actions.ts
  - src/app/(dashboard)/layout.tsx
  - src/app/(dashboard)/settings/profile/page.tsx
  - src/app/(dashboard)/settings/profile/actions.ts
autonomous: false
requirements:
  - 260427-nxd
must_haves:
  truths:
    - "A new authenticated user has a `public.profiles` row created automatically (trigger), with `username = NULL` until claimed."
    - "Any logged-in user without a username is redirected to `/onboarding/username` from any `(dashboard)` route, with `?next=` preserved so they return to their original destination on claim."
    - "On the onboarding page, the user sees an auto-suggested username derived from their email and a live (350 ms debounced) green/red availability indicator."
    - "Submitting the form invokes the `claim_username(p_username citext)` RPC; a successful claim atomically writes the username and a duplicate attempt returns a typed 'taken' error rendered inline."
    - "The username regex/length/reserved-word rules are enforced in three places: zod on the client, zod on the server action, and CHECK + RPC validation in Postgres."
    - "Existing users (created before this migration) get a profiles row backfilled with `display_name` from `user_metadata.first_name + last_name`, `username = NULL`, so they are routed through the onboarding gate on next login."
    - "The Settings → Profile page reads from and writes to `public.profiles` (display_name, bio, website_url, social_links, avatar_url) and shows the current username read-only with a 'Change username' link to onboarding."
    - "An `avatars` storage bucket exists with public read + per-user-folder write/update/delete RLS, and the Settings page can upload a new avatar to `${userId}/${nanoid()}.${ext}` and persist `avatar_url` on the profile row."
    - "Public SELECT on `public.profiles` is permitted by RLS so a future Explore/`/[username]` page can render anonymously without policy changes."
  artifacts:
    - path: "supabase/migrations/20260427_create_profiles.sql"
      provides: "profiles table, citext extension, RLS, handle_new_user trigger, claim_username RPC, avatars bucket + RLS, one-time backfill"
      contains: "create table public.profiles"
    - path: "src/lib/profile/reserved-usernames.ts"
      provides: "RESERVED_USERNAMES set covering every existing top-level route + common system words"
      exports: ["RESERVED_USERNAMES"]
    - path: "src/lib/profile/username-validation.ts"
      provides: "shared zod schema + format/reserved helpers"
      exports: ["usernameSchema", "USERNAME_REGEX", "validateUsernameFormat", "isReservedUsername"]
    - path: "src/lib/profile/username-suggestions.ts"
      provides: "email -> handle suggestion + suffixed alternatives"
      exports: ["suggestFromEmail", "suffixedSuggestions"]
    - path: "src/app/(auth)/onboarding/username/page.tsx"
      provides: "deferred 'claim your handle' UI with live availability + auto-suggest"
      min_lines: 60
    - path: "src/app/(auth)/onboarding/username/actions.ts"
      provides: "checkUsernameAvailable + claimUsername server actions wrapping the RPC"
      exports: ["checkUsernameAvailable", "claimUsername"]
    - path: "src/app/(dashboard)/layout.tsx"
      provides: "username gate that redirects to /onboarding/username when profile.username IS NULL"
      contains: "/onboarding/username"
    - path: "src/app/(dashboard)/settings/profile/page.tsx"
      provides: "extended settings UI: display_name, bio, website, social_links, avatar upload, read-only username"
    - path: "src/app/(dashboard)/settings/profile/actions.ts"
      provides: "getProfile/saveProfile reading and writing public.profiles (not user_metadata)"
      exports: ["getProfile", "saveProfile", "uploadAvatar"]
  key_links:
    - from: "auth.users insert"
      to: "public.profiles row"
      via: "on_auth_user_created trigger -> handle_new_user()"
      pattern: "create trigger on_auth_user_created"
    - from: "src/app/(dashboard)/layout.tsx"
      to: "/onboarding/username"
      via: "select username from public.profiles where id = auth.uid(); redirect if null"
      pattern: "redirect.*onboarding/username"
    - from: "src/app/(auth)/onboarding/username/actions.ts"
      to: "public.claim_username(citext) RPC"
      via: "supabase.rpc('claim_username', { p_username })"
      pattern: "rpc\\(['\"]claim_username"
    - from: "src/app/(dashboard)/settings/profile/page.tsx"
      to: "public.profiles"
      via: "getProfile / saveProfile server actions"
      pattern: "from\\(['\"]profiles"
    - from: "Settings avatar upload"
      to: "storage.objects bucket=avatars"
      via: "supabase.storage.from('avatars').upload(`${userId}/${nanoid()}.${ext}`)"
      pattern: "storage\\.from\\(['\"]avatars"
---

<objective>
Move the profile model out of `auth.users.user_metadata` into a proper, publicly-readable
`public.profiles` table keyed on `auth.users(id)`, so that (a) usernames are unique and
URL-safe, (b) profiles can be queried anonymously to power a future `/[username]` Explore
page, and (c) every user is gated through a deferred "claim your handle" flow before
entering the dashboard.

Purpose: Unblock the Explore page roadmap by establishing the data + UX needed for users
to share/copy templates under a stable, URL-safe identity. Stop short of building the
public profile page or Explore feed — those are downstream work.

Output: One Supabase migration, a shared validation/suggestions library, a deferred
onboarding gate at `/onboarding/username`, a layout-level redirect when
`profile.username IS NULL`, and an extended Settings → Profile page that reads/writes the
new table (including avatar upload via a new `avatars` bucket).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260427-nxd-add-usernames-and-user-profiles-to-suppo/260427-nxd-RESEARCH.md
@src/app/(dashboard)/layout.tsx
@src/app/(dashboard)/settings/profile/page.tsx
@src/app/(dashboard)/settings/profile/actions.ts
@src/lib/supabase/server.ts
@supabase/migrations/006_storage_buckets.sql
@supabase/migrations/20260427_brand_kit_template.sql

<interfaces>
<!-- Existing patterns the executor should match. Extracted from the codebase. -->

Supabase server client (existing — already in use everywhere):
```ts
// src/lib/supabase/server.ts
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient() // async, reads cookies
```

Existing settings actions (TO BE REPLACED — currently uses user_metadata):
```ts
// src/app/(dashboard)/settings/profile/actions.ts (current, soon to be rewritten)
export async function getProfile(): Promise<Profile | null>
export async function saveProfile(formData: FormData):
  Promise<{ success: true } | { success: false; error: string }>
```

Existing dashboard layout (where the username gate goes):
```tsx
// src/app/(dashboard)/layout.tsx (current)
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')
const userName = (user.user_metadata?.first_name as string) || ...
```

Migration filename convention (from supabase/migrations/):
- Date-prefixed: `20260427_<feature>.sql` (matches existing `20260427_brand_kit_*.sql`)
- Use `CREATE EXTENSION IF NOT EXISTS`, `ON CONFLICT (id) DO NOTHING` for idempotency
- RLS is `ENABLE ROW LEVEL SECURITY` then `CREATE POLICY` (see 006_storage_buckets.sql)
- Triggers/functions use `language plpgsql security definer set search_path = ''`

Storage RLS pattern (copy from 006_storage_buckets.sql, but tighten upload to per-user folder):
```sql
-- Existing slide-backgrounds bucket allows ANY authenticated user to upload.
-- The `avatars` bucket MUST scope WITH CHECK to (storage.foldername(name))[1] = auth.uid()::text
-- to prevent users overwriting other users' avatars.
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create profiles migration (table + trigger + RPC + avatars bucket + backfill)</name>
  <files>supabase/migrations/20260427_create_profiles.sql</files>
  <action>
Create a single migration that does everything DB-side in dependency order. Match the
existing migration style (uppercase keywords, idempotent guards, comments at top).

1. `create extension if not exists citext;`

2. Create `public.profiles`:
   - `id uuid primary key references auth.users(id) on delete cascade`
   - `username citext unique` (nullable until claimed)
   - `display_name text`
   - `bio text` with `check (bio is null or char_length(bio) <= 280)`
   - `avatar_url text`
   - `website_url text`
   - `social_links jsonb not null default '{}'::jsonb`
   - `template_count int not null default 0`
   - `created_at timestamptz not null default now()`
   - `updated_at timestamptz not null default now()`
   - CHECK constraints (per RESEARCH.md — username is null OR all of):
     - `char_length(username::text) between 3 and 24`
     - `username::text ~ '^[a-z0-9_.]+$'`
     - `username::text !~ '[._]{2,}'`
     - `username::text ~ '^[a-z0-9].*[a-z0-9]$'`
   - Index: `create index profiles_username_idx on public.profiles(username);`

3. Enable RLS and create three policies (per RESEARCH.md Pattern 1):
   - `Profiles are viewable by everyone` — `for select using (true)`
   - `Users insert own profile` — `for insert with check (auth.uid() = id)`
   - `Users update own profile` — `for update using (auth.uid() = id) with check (auth.uid() = id)`

4. Create `public.handle_new_user()` trigger function (`security definer`, `set search_path = ''`)
   that inserts a profiles row on `auth.users` insert, copying `display_name` from
   `coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', trim(both ' ' from concat_ws(' ', raw_user_meta_data->>'first_name', raw_user_meta_data->>'last_name')))`
   and `avatar_url` from `raw_user_meta_data->>'avatar_url'`. Username left NULL.
   Drop existing trigger first; `create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();`

5. Create `public.claim_username(p_username citext) returns table(ok boolean, reason text)`
   exactly per RESEARCH.md Pattern 3: lowercase + format check, then `update public.profiles
   set username = p_username, updated_at = now() where id = auth.uid()`, with
   `exception when unique_violation then return query select false, 'taken'`. Grant
   execute to `authenticated`.

6. Create `avatars` storage bucket (public=true, idempotent insert) and four RLS policies
   per RESEARCH.md Pattern 5 (public SELECT, authenticated INSERT/UPDATE/DELETE scoped to
   `(storage.foldername(name))[1] = auth.uid()::text`). Note: this is STRICTER than the
   existing `slide-backgrounds` policies — that's intentional, avatars must be
   per-user-folder enforced.

7. One-time backfill — for every existing `auth.users` row that has no profiles row yet,
   insert one with `display_name = trim(both ' ' from concat_ws(' ',
   raw_user_meta_data->>'first_name', raw_user_meta_data->>'last_name'))` (NULL if empty
   string), `username = NULL`. Use `insert into public.profiles (id, display_name) select
   u.id, ... from auth.users u left join public.profiles p on p.id = u.id where p.id is
   null;`. This ensures existing users get routed through the onboarding gate without
   manual intervention.

8. Add a top-of-file comment block explaining what the migration does (match the
   `20260427_brand_kit_template.sql` style).
  </action>
  <verify>
    <automated>cd supabase &amp;&amp; npx supabase db reset --local --debug 2>&amp;1 | tail -50 &amp;&amp; npx supabase db diff --schema public --local | head -100 &amp;&amp; psql "$LOCAL_DB_URL" -c "select column_name, data_type from information_schema.columns where table_schema='public' and table_name='profiles' order by ordinal_position;" -c "select tgname from pg_trigger where tgname='on_auth_user_created';" -c "select proname from pg_proc where proname in ('handle_new_user','claim_username');" -c "select id from storage.buckets where id='avatars';"</automated>
  </verify>
  <done>
Migration applies cleanly on a fresh local Supabase. `public.profiles` exists with all
columns, CHECK constraints, RLS enabled with 3 policies, `on_auth_user_created` trigger
present, `claim_username` and `handle_new_user` functions present, `avatars` bucket
exists with 4 storage policies. Backfill inserted one profile row for every existing
`auth.users` row.
  </done>
</task>

<task type="auto">
  <name>Task 2: Validation lib + onboarding gate (claim username flow)</name>
  <files>src/lib/profile/reserved-usernames.ts, src/lib/profile/username-validation.ts, src/lib/profile/username-suggestions.ts, src/app/(auth)/onboarding/username/page.tsx, src/app/(auth)/onboarding/username/actions.ts, src/app/(dashboard)/layout.tsx</files>
  <action>
Build the shared validation library, the deferred onboarding page, and wire the
dashboard-layout gate. Username is the URL-safe identity — validation must be enforced
identically in three layers.

A) `src/lib/profile/reserved-usernames.ts` — export `RESERVED_USERNAMES: ReadonlySet<string>`
   seeded with every existing top-level route and obvious system words:
   `dashboard, settings, login, signup, onboarding, api, docs, pricing, blog, admin,
   terms, privacy, contact, help, support, about, explore, search, u, user, users,
   profile, profiles, account, billing, brand-kit, credits, notifications, subscription,
   api-keys, mcp, openapi, robots.txt, sitemap.xml, favicon.ico, www, mail, ftp, root,
   null, undefined, true, false, me, you, new, edit, delete, create, home, index`.
   All lowercase. Confirm against the actual `src/app/` directory structure before
   committing — add any other static segment that exists.

B) `src/lib/profile/username-validation.ts` — implement exactly per RESEARCH.md "Code
   Examples" section. Export:
   - `USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9_.]{1,22}[a-z0-9])?$/`
   - `usernameSchema` (zod): min 3, max 24, regex, refine no `[._]{2,}`, refine not
     reserved
   - `validateUsernameFormat(s: string): string | null` (returns first error message or
     null)
   - `isReservedUsername(s: string): boolean`
   Important: this module is imported by both client (`'use client'` page) and server
   (action). Keep it free of server-only imports.

C) `src/lib/profile/username-suggestions.ts` — implement `suggestFromEmail(email)` and
   `suffixedSuggestions(base, count = 3)` exactly per RESEARCH.md examples. Use
   `crypto.randomUUID()` is unnecessary — `Math.floor(Math.random()*900+100)` for the
   3-digit suffix is fine.

D) `src/app/(auth)/onboarding/username/actions.ts` — `'use server'`. Export:
   - `checkUsernameAvailable(raw: string): Promise<{ available: boolean; reason: string | null }>`
     — lowercase, validate format via `validateUsernameFormat`, check
     `isReservedUsername`, then `supabase.from('profiles').select('id').eq('username',
     username).maybeSingle()`. Return `{ available: !data, reason: data ? 'taken' : null }`.
   - `claimUsername(raw: string): Promise<{ success: boolean; error?: string }>` —
     lowercase, validate, then call `supabase.rpc('claim_username', { p_username:
     username })`. The RPC returns a single row `{ ok, reason }`. Translate `reason` to a
     friendly message (`taken`, `invalid_format`, `unauthenticated` → human strings).
     On success, `revalidatePath('/onboarding/username')`. Do not redirect from the
     server action; let the client read the result and `router.push(next ?? '/dashboard')`.

E) `src/app/(auth)/onboarding/username/page.tsx` — `'use client'`. Layout: the
   page reads `?next=` from `useSearchParams`. On mount, fetch the user's email server-side
   via a tiny server action (or via a `getOnboardingPrefill()` action that returns
   `{ email, suggestion }`) and seed the input with `suggestFromEmail(email)`. As the user
   types: `useTransition`-debounced (350 ms via `setTimeout`/`clearTimeout`, no library
   needed) call to `checkUsernameAvailable`; show grey while pending, green check + "URL
   preview: viralslidemaker.com/{username}" when available, red message otherwise. Submit
   button calls `claimUsername`; on success, `router.push(searchParams.get('next') ??
   '/dashboard')`. Match the styling of the existing settings page (rounded `rounded-xl`,
   color tokens `#3d0000`, `#fff8f7`, `#dbc1bc`).

   IMPORTANT: this route lives under `(auth)` so it does NOT inherit the `(dashboard)`
   layout. That's deliberate — the dashboard layout is what redirects HERE, so we cannot
   re-enter it.

F) `src/app/(dashboard)/layout.tsx` — extend the existing layout: after the
   `auth.getUser()` redirect, run a single query
   `supabase.from('profiles').select('username, display_name').eq('id', user.id).maybeSingle()`.
   If `profile?.username` is null/empty, build `next = headers().get('x-pathname') ?? '/dashboard'`
   (Next.js doesn't expose pathname in server components — use `next/headers` `headers()`
   if available, otherwise fall back to `/dashboard`) and `redirect('/onboarding/username?next=' + encodeURIComponent(next))`.
   Update the `userName` derivation to prefer `profile?.display_name` over
   `user.user_metadata?.first_name`. Don't break the existing fallback chain.

   Edge case: a brand-new user might race the trigger. If `profile` is null entirely (not
   just `username`-null), still redirect to `/onboarding/username` — the page will
   re-fetch and the trigger should have fired by then.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&amp;1 | tail -20 &amp;&amp; npx next lint --dir src/lib/profile --dir 'src/app/(auth)/onboarding' --dir 'src/app/(dashboard)/layout.tsx' 2>&amp;1 | tail -20 &amp;&amp; node -e "const {usernameSchema, validateUsernameFormat} = require('./src/lib/profile/username-validation.ts'); console.log(validateUsernameFormat('ab')); console.log(validateUsernameFormat('admin')); console.log(validateUsernameFormat('valid_one'));" 2>&amp;1 || echo 'note: ts-node may be needed for inline test; rely on tsc + manual smoke test'</automated>
  </verify>
  <done>
- `npx tsc --noEmit` passes with zero errors in changed files.
- Logging in as a user whose `profiles.username IS NULL` and visiting `/dashboard`
  redirects to `/onboarding/username?next=%2Fdashboard`.
- The onboarding page renders with a pre-filled suggestion derived from the user's
  email, shows live availability after 350 ms of inactivity, blocks reserved words
  client-side and server-side, and on successful claim redirects back to `?next`.
- Concurrently submitting the same username from two sessions: exactly one succeeds, the
  other gets a "taken" inline error (verified by the RPC's `unique_violation` rescue —
  no double-claim possible).
- Logging in as a user with `profiles.username` already set does NOT redirect.
- The page lives at `/onboarding/username` (under `(auth)`) and does not inherit the
  dashboard layout.
  </done>
</task>

<task type="auto">
  <name>Task 3: Settings → Profile page extension (read/write public.profiles + avatar upload)</name>
  <files>src/app/(dashboard)/settings/profile/page.tsx, src/app/(dashboard)/settings/profile/actions.ts</files>
  <action>
Replace the user_metadata-backed settings flow with one that reads from and writes to
`public.profiles`. Keep the existing visual style (rounded-xl, color tokens) and the
existing email-disabled pattern.

A) `src/app/(dashboard)/settings/profile/actions.ts` — rewrite (preserve the named exports
   so callers don't break, but extend the `Profile` interface):

   ```ts
   interface Profile {
     username: string | null
     displayName: string
     bio: string
     email: string
     phone: string                  // keep — still in user_metadata
     websiteUrl: string
     avatarUrl: string
     socialLinks: { tiktok?: string; instagram?: string; x?: string; youtube?: string }
   }
   ```

   - `getProfile()` — fetch user via `auth.getUser()`, then
     `supabase.from('profiles').select('username, display_name, bio, avatar_url, website_url, social_links').eq('id', user.id).single()`.
     Map snake_case → camelCase. Pull `email` from `user.email`, `phone` from
     `user.user_metadata.phone` (still lives there — phone is unrelated to the public
     profile model).

   - `saveProfile(formData)` — read `display_name`, `bio`, `phone`, `website_url` and
     `social_links` (JSON-encoded string in the form). Validate: `bio` ≤ 280, `website_url`
     parseable as URL or empty, `social_links` is an object of string values. Then run
     TWO writes:
     1. `supabase.from('profiles').update({ display_name, bio, website_url, social_links, updated_at: new Date().toISOString() }).eq('id', user.id)`
     2. `supabase.auth.updateUser({ data: { phone } })` (phone stays in user_metadata)
     `revalidatePath('/settings/profile')` and `revalidatePath('/(dashboard)', 'layout')`
     so the dashboard layout's username display updates.

   - NEW: `uploadAvatar(file: File): Promise<{ success: true; url: string } | { success: false; error: string }>`
     — validate MIME type is `image/jpeg` or `image/png` (reject `image/svg+xml` per
     RESEARCH.md security domain), size ≤ 2 MB. Generate path
     `${user.id}/${crypto.randomUUID()}.${ext}`. Upload via
     `supabase.storage.from('avatars').upload(path, file, { upsert: false })`. Get the
     public URL via `getPublicUrl(path)`. Persist to
     `profiles.avatar_url`. Return the URL.

B) `src/app/(dashboard)/settings/profile/page.tsx` — extend the form:
   - Replace `firstName` / `lastName` two-column with a single `displayName` input
     (label: "Display Name", helper: "How your name appears on your profile and
     templates"). Pre-seed with the existing display_name (which the migration backfilled
     from first/last).
   - Add a read-only **Username** field showing `profile.username`, with a "Change
     username" link to `/onboarding/username?next=/settings/profile`. Helper text:
     "Username changes are limited (coming soon)" — this is the deferred 30-day rate
     limit hook from RESEARCH.md.
   - Add **Bio** textarea (maxLength 280, character counter).
   - Add **Website** input (`type="url"`, optional).
   - Add **Social Links** — four small inputs in a 2-col grid: TikTok, Instagram, X,
     YouTube. Each takes the username/handle (not full URL) — store under the
     corresponding key in `social_links`. Empty string → omit from JSON.
   - Wire the **Upload Photo** button (currently dead) to a hidden `<input type="file"
     accept="image/jpeg,image/png">` that calls `uploadAvatar`. Show optimistic preview
     (object URL), replace with the returned `avatar_url` on success. The avatar circle
     renders the image when `avatarUrl` is set, falls back to the existing person icon
     otherwise.
   - Keep the existing message banner (success/error) and disabled email pattern.
   - Phone field stays exactly as it is.

   Keep the existing color tokens and class names — do NOT introduce new design system
   patterns; this is a content-only extension.

C) Out of scope (per the constraints in this plan):
   - Editing username inline on this page (deferred — handled via the "Change username"
     link to onboarding; the 30-day rate limit is itself deferred).
   - Image cropping / Supabase Image Transformations — raw upload only for v1.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&amp;1 | tail -20 &amp;&amp; npx next build 2>&amp;1 | tail -30</automated>
  </verify>
  <done>
- `npx tsc --noEmit` and `npx next build` both succeed.
- Settings → Profile loads existing data (display_name backfilled from first/last, bio
  empty, etc.), saves changes that persist across reload, and refreshes the
  dashboard-shell userName.
- Avatar upload accepts JPG/PNG ≤ 2 MB, rejects SVG and oversize files with an inline
  error, writes to `avatars/${userId}/<uuid>.<ext>`, and persists the public URL to
  `profiles.avatar_url`.
- Re-uploading replaces the displayed avatar (old file remains in storage — cleanup is
  not in scope).
- Username displays read-only; clicking "Change username" lands on
  `/onboarding/username?next=/settings/profile` and a successful claim returns to
  settings.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
The full username + profiles flow:
1. Migration applied (profiles table, trigger, RPC, avatars bucket, backfill).
2. Username gate at `/onboarding/username` (auto-suggest, live availability, claim).
3. Dashboard layout redirect when `username IS NULL`.
4. Settings → Profile reads/writes `public.profiles`, supports avatar upload.
  </what-built>
  <how-to-verify>
1. Run `npx supabase db reset --local` and `npm run dev`.
2. Sign up as a brand-new user (or sign in as an existing one whose backfilled
   profile has `username = NULL`).
3. Visit `/dashboard` — you should be redirected to
   `/onboarding/username?next=%2Fdashboard`. Verify the suggested username is
   derived from your email and the URL preview shows
   `viralslidemaker.com/<suggested>`.
4. Type `admin` — expect "That username is reserved" inline.
5. Type `ab` — expect "Must be at least 3 characters".
6. Type a valid name (e.g., `diego_test`) and wait ~400 ms — expect green check.
7. Open a second browser, claim the same name — expect "taken".
8. In the first browser, claim `diego_test` — expect redirect to `/dashboard`.
9. Reload `/dashboard` — should NOT bounce back to onboarding.
10. Visit Settings → Profile. Verify:
    - Display name is pre-filled (from backfilled first/last name).
    - Username displays read-only with "Change username" link.
    - Bio textarea works (try 281 chars — expect rejection).
    - Website + 4 social link inputs persist after save.
    - Upload Photo: try a 3 MB PNG — expect rejection. Try a small JPG —
      expect avatar circle updates and the URL is in `profiles.avatar_url`
      after a `select * from profiles where id = auth.uid()`.
    - Try an SVG — expect rejection.
11. As a sanity check on RLS, log out and run (in psql):
    `select id, username, display_name, avatar_url from public.profiles;` —
    should return all rows (anonymous SELECT is allowed by design).
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → server action | Untrusted username/bio/website/social_links input crosses here |
| Server action → Postgres | Validated input written via authenticated Supabase client |
| Anonymous SELECT on profiles | Public read is intentional (powers Explore page) |
| Browser → storage avatars bucket | Untrusted file upload (MIME, size, path) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-nxd-01 | Spoofing | Username impersonation via homoglyph | mitigate | Charset restricted to ASCII `[a-z0-9_.]` enforced in zod + DB CHECK + RPC regex (Task 1, Task 2) |
| T-nxd-02 | Spoofing | Reserved-name claim (admin, support, api) | mitigate | `RESERVED_USERNAMES` set checked in zod (`username-validation.ts`) and re-checked server-side in `checkUsernameAvailable` and `claimUsername`. DB does not need it (server is the contract). |
| T-nxd-03 | Tampering | Concurrent claim race | mitigate | `citext UNIQUE` constraint + RPC `EXCEPTION WHEN unique_violation` rescue. Tested in Task 2's done criteria with two-browser test. |
| T-nxd-04 | Tampering | Cross-user avatar overwrite | mitigate | Storage RLS policy uses `(storage.foldername(name))[1] = auth.uid()::text` for INSERT/UPDATE/DELETE — strictly per-user folder. (Task 1) |
| T-nxd-05 | Tampering | XSS via uploaded SVG avatar | mitigate | `uploadAvatar` rejects `image/svg+xml`; only `image/jpeg` and `image/png` permitted. (Task 3) |
| T-nxd-06 | Information Disclosure | Mass username scraping | accept | RLS allows public SELECT — intentional for Explore page. Rate-limit `checkUsernameAvailable` if abused (out of scope v1). |
| T-nxd-07 | Elevation of Privilege | claim_username called by unauthenticated user | mitigate | RPC checks `auth.uid() is null` first, returns `(false, 'unauthenticated')`. Grant restricted to `authenticated` role. |
| T-nxd-08 | Tampering | Direct INSERT/UPDATE on profiles bypassing claim_username | mitigate | RLS update policy permits owner UPDATEs, so a user could in theory set their own username via raw update — but the same CHECK constraints (regex, length, no consecutive punct) and the UNIQUE constraint apply, so the security envelope is identical. The RPC is a UX wrapper, not a security boundary. |
| T-nxd-09 | Information Disclosure | Phone leaks via public profiles SELECT | accept | Phone stays in `auth.users.user_metadata` (Task 3 keeps it there); `profiles` table does not contain phone. |
</threat_model>

<verification>
1. `supabase db reset --local` succeeds and the schema is exactly as described in
   Task 1's `done`.
2. `npx tsc --noEmit` passes.
3. `npx next build` succeeds.
4. Manual checkpoint flow above passes end-to-end.
5. `psql -c "select reltuples::int from pg_class where relname='profiles';"` returns
   the same count as `auth.users` (proves the backfill + trigger work).
</verification>

<success_criteria>
- Every authenticated user has a `public.profiles` row.
- No one can reach the dashboard with a NULL username.
- A user can complete the claim flow in one screen, with live feedback, and not
  experience double-claim race conditions.
- Settings → Profile reads and writes the new table; avatar upload works end-to-end.
- The data model supports a future `/[username]` Explore page with no schema changes.
</success_criteria>

<output>
After completion, create `.planning/quick/260427-nxd-add-usernames-and-user-profiles-to-suppo/260427-nxd-SUMMARY.md`
documenting:
- The migration shape (table + trigger + RPC + bucket).
- Where username validation lives (3 layers: zod client, zod server, Postgres CHECK).
- Where the gate lives (`(dashboard)/layout.tsx`).
- What's deferred to a follow-up: 30-day username change rate limit, the
  `/[username]` public page, the Explore feed, profanity moderation, image
  transforms, follower graph, `template_count` recompute trigger.
</output>
