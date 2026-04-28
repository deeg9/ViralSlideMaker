---
quick_id: 260427-nxd
title: Add usernames and user profiles to support a future Explore page
date: 2026-04-27
status: incomplete
commits:
  - 9279c20  # feat: profiles table, claim_username RPC, avatars bucket migration
  - 1dad643  # feat: username validation lib + /onboarding/username gate + dashboard redirect
  - db69f60  # feat: settings/profile reads/writes public.profiles + avatar upload
---

# Quick Task 260427-nxd Summary

Shipped the data + UX needed to claim and manage a username and a public
profile, so a future Explore page can render `/[username]` pages where users
share/copy each other's templates.

**Status: code complete, manual verification pending.** The migration file is
written but has NOT yet been applied to the remote Supabase project — the
user needs to run `supabase db push` (or apply via Supabase Studio) before
the dashboard layout's username gate will work for new logins.

## What changed

### Migration — `supabase/migrations/20260427_create_profiles.sql` (commit 9279c20)
- `citext` extension enabled for case-insensitive unique usernames
- `public.profiles` table keyed on `auth.users(id) ON DELETE CASCADE`
  - columns: `username` (citext, unique, nullable), `display_name`, `bio`
    (≤280), `avatar_url`, `website_url`, `social_links` (jsonb), `template_count`,
    `created_at`, `updated_at`
  - CHECK constraints enforce `^[a-z0-9_.]{3,24}$`, no edge punctuation,
    no consecutive `[._]{2,}` — defends against homoglyph impersonation by
    restricting to ASCII
- RLS: public SELECT (so the future Explore page can render anonymously),
  owner-only INSERT/UPDATE
- `handle_new_user()` SECURITY DEFINER trigger auto-creates a profiles row
  on every `auth.users` insert (works for password / OAuth / magic-link
  uniformly), deriving `display_name` from `full_name` / `name` / first+last
- `claim_username(p_username citext)` SECURITY DEFINER RPC — race-safe
  atomic claim using `EXCEPTION WHEN unique_violation` rescue to return a
  typed `taken` response. Granted to `authenticated` only.
- `avatars` storage bucket (public read) with stricter per-user-folder RLS
  than `slide-backgrounds`: INSERT/UPDATE/DELETE require
  `(storage.foldername(name))[1] = auth.uid()::text`
- One-time backfill — every existing `auth.users` row that doesn't already
  have a profile gets one, with `display_name` derived from existing
  `user_metadata.first_name + last_name` and `username = NULL`. These users
  will hit the onboarding gate on next login.
- `profiles_updated_at` BEFORE-UPDATE trigger keeps `updated_at` fresh

### Validation library + onboarding flow (commit 1dad643)
- `src/lib/profile/reserved-usernames.ts` — `RESERVED_USERNAMES: ReadonlySet<string>`
  seeded with every existing top-level route (`api`, `auth`, `docs`, `privacy`,
  `terms`) plus dashboard subroutes plus common system / vanity words.
  Defense-in-depth — Next.js static segments already win over `[username]`
  dynamic catch-all routes, but the list also blocks impersonation of system
  names like `admin`, `support`.
- `src/lib/profile/username-validation.ts` — shared zod schema (3-24 chars,
  ASCII regex, no edge/consecutive punct, not reserved) + `normalizeUsername`,
  `validateUsernameFormat`, `isReservedUsername` helpers
- `src/lib/profile/username-suggestions.ts` — `suggestFromEmail` (strips
  `+tag` aliases and disallowed chars), `suffixedSuggestions` for collisions
- `src/app/(auth)/onboarding/username/` — deferred "Pick your username" gate:
  - `page.tsx` server component prefills with email-derived suggestion;
    redirects to `?next=` if the user already has a username
  - `claim-username-form.tsx` client form with 350ms debounced live
    availability check, status indicator (grey/green/red), URL preview, and
    race-safe submit via the `claim_username` RPC
  - `actions.ts` — `getOnboardingPrefill`, `checkUsernameAvailable`,
    `claimUsername` server actions; all run normalize → format → reserved → DB
- Dashboard layout (`src/app/(dashboard)/layout.tsx`) redirects to
  `/onboarding/username` whenever `profile.username IS NULL`. `userName`
  fallback chain now prefers `profile.display_name`.

### Settings profile page extension (commit db69f60)
- `src/app/(dashboard)/settings/profile/actions.ts` rewritten:
  - `getProfile()` reads from `public.profiles`, maps snake_case → camelCase,
    pulls `phone` from `user_metadata` (still lives there)
  - `saveProfile()` validates bio (≤280), website URL (http/https), 4 social
    links, then updates the profiles row; phone stays in `user_metadata`
  - NEW `uploadAvatar()` — JPEG/PNG/WebP only, 2MB cap, rejects SVG (XSS
    prevention), uploads to `avatars/<user-id>/<uuid>.<ext>`, persists
    public URL on `profiles.avatar_url`
- `src/app/(dashboard)/settings/profile/page.tsx` rewritten:
  - Replaces `firstName` / `lastName` with single `Display Name` field
  - Adds read-only Username row with `@handle` and "Change" link to onboarding
  - Adds Bio textarea (280-char counter), Website URL, 4 Social Links inputs
  - Wires Upload Photo to a hidden file input + `uploadAvatar` action with
    optimistic preview
  - Phone field unchanged

## Where validation lives (3 layers, all enforce identically)
1. **Client zod** in `usernameSchema` (instant feedback in the onboarding form)
2. **Server zod** in `checkUsernameAvailable` and `claimUsername` actions
3. **Postgres CHECK constraints** on the `profiles` table + regex inside the
   `claim_username` RPC

## Where the gate lives
`src/app/(dashboard)/layout.tsx` — every dashboard route runs through the
auth check, then queries `profile.username` in one round trip. If null, hard
redirect to `/onboarding/username`. The onboarding page lives under `(auth)`
specifically so it does NOT inherit the dashboard layout (no redirect loop).

## Manual verification still required

The user MUST:
1. Apply the migration to the remote Supabase project — run `supabase db push`
   (or apply `supabase/migrations/20260427_create_profiles.sql` via Supabase
   Studio's SQL editor).
2. Run `npm run dev` and walk through the 11-step verification in the plan
   (`260427-nxd-PLAN.md` "checkpoint:human-verify" task), including:
   - Logging in as an existing user → expect redirect to `/onboarding/username`
   - Trying `admin` → expect "That username is reserved"
   - Trying `ab` → expect "Must be at least 3 characters"
   - Claiming a valid name → expect redirect back to where they came from
   - Settings → Profile → upload a JPG → confirm avatar updates and
     `select avatar_url from profiles where id = auth.uid()` shows it

## What's deferred (out of scope for this quick task)
- The public `/[username]` profile page (next quick task or phase)
- The Explore feed itself
- Username-change rate limiting (the "Change username" link in settings
  goes back through the same onboarding flow without a 30-day cap)
- Username-history / soft-reservation table (anti-impersonation churn)
- Profanity / impersonation moderation (e.g. blocking `elon-musk`)
- Image transforms / cropping for avatars
- Follower / social graph
- `template_count` recompute trigger (will hook in when Explore launches —
  the column exists and defaults to 0)

## Side commit
The same session also shipped `2206fb8` — gating the "Buy Credits" feature
to Plus/Pro plans only (separate from this quick task; recorded here so the
git log makes sense).
