# Quick Task 260427-nxd: Add Usernames and User Profiles - Research

**Researched:** 2026-04-27
**Domain:** Supabase auth + public profiles + username UX
**Confidence:** HIGH

## Summary

The job is to evolve the current "profile = `auth.users.user_metadata`" model into a proper
`public.profiles` table that (a) holds a unique, URL-safe `username`, (b) is publicly readable
so an Explore page can render `/[username]` pages, and (c) is auto-created on signup via a
trigger. There is no existing `profiles` table in `supabase/migrations/` — this is greenfield.

The ecosystem is well-trodden. Supabase publishes a canonical pattern in its Next.js tutorial:
`public.profiles` keyed on `auth.users(id)`, RLS allowing public SELECT but owner-only
UPDATE, and a `handle_new_user()` SECURITY DEFINER trigger that backfills a row on every new
auth user. We adopt that pattern unchanged.

The only nontrivial decisions are: (1) lowercase-stored `citext` vs. `text` + functional
unique index for case-insensitive uniqueness, (2) where to enforce the regex/reserved-word
list (DB CHECK + server action both, never client-only), (3) when to collect the username
(deferred "claim your handle" prompt is the right answer because Supabase OAuth doesn't give
you one), and (4) the URL shape for public profiles (`/[username]` with a reserved-word
guard, not `/u/[username]`).

**Primary recommendation:** Add a `public.profiles` table with `username citext UNIQUE`,
auto-create rows via `handle_new_user` trigger, validate via shared regex + reserved-word
list in both a DB CHECK and a server action, claim the username via a SECURITY DEFINER RPC
that does check + insert/update inside one transaction (no race), and ship a deferred
"choose your handle" modal that triggers when `profile.username IS NULL`.

## User Constraints

No CONTEXT.md exists for this quick task. The user-supplied focus document is the source of
truth, and it is fully captured in this research.

**Locked-in scope from the focus brief:**
- Stack already chosen: Next.js 15 + Supabase + Supabase Auth (no migration of auth provider).
- Output is the data + UX needed to power a future Explore page where users share/copy
  templates and slides — the model must accommodate `template_count` style aggregates later.
- "Search the web to see how people add user names successfully so we can replicate them."
  → recommendations are concrete and copied from how the major creator platforms do it.

**Out of scope for this quick task:**
- The Explore page itself (research informs the data model so it's ready when built).
- Followers / social graph (we leave room in the schema but do not build now).
- Profanity filtering (mentioned briefly; deferred — see Open Questions).
- Custom domains / vanity URLs (Linktree-style `links.yoursite.com`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Username uniqueness | Database | API/Server Action | Only the DB can guarantee atomicity; server action returns friendly errors. |
| Username regex/length validation | Database (CHECK) | API/Server Action | Defense-in-depth — DB is the contract, server gives nicer errors. |
| Reserved-word check | API/Server Action | — | Source list lives in code (easy to update); DB does not need to know. |
| Real-time availability check | API (server action / route) | — | Anonymous read of `profiles.username` (RLS allows public SELECT). |
| Profile auto-create on signup | Database (trigger) | — | Atomic with `auth.users` insert. |
| Avatar upload | Supabase Storage | Frontend | Public bucket + per-user-folder RLS, identical to existing `slide-backgrounds` pattern. |
| Public profile page render | Next.js (server) | Database | SSR fetches profile by username (anon RLS allows it). |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | already installed | Server-side auth + cookies | Already in `src/lib/supabase/server.ts` |
| Supabase Postgres `citext` extension | bundled | Case-insensitive unique usernames | Native to Postgres; recommended in [Supabase discussion #3188](https://github.com/orgs/supabase/discussions/3188) |
| Supabase Storage `avatars` bucket | bundled | Public avatar hosting | Standard pattern from [official tutorial](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs) |
| `zod` | install if not present | Shared regex/length validation between client and server actions | Already used elsewhere; keep schema in one place |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useDebounce` (custom hook or `use-debounce`) | — | 300-500 ms debounce for live availability check | UX expectation per [debounce article](https://artofcoding.blog/javascript-debounce-function-explained-with-real-ux-fixes/) |
| `nanoid` or `crypto.randomUUID` | already in Node 18+ | Suffix random digits in auto-suggested usernames | When `from_email` collides |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `citext UNIQUE` | `text` + `CREATE UNIQUE INDEX … ON profiles(lower(username))` | Functionally identical; `citext` is one less moving part. The functional index works without enabling an extension. We choose `citext` because the project owner is a solo dev and "store as lowercase, query as-is" is mentally simpler. |
| Trigger-based profile auto-create | Server-action backfill on first authenticated request | Trigger is atomic with auth row creation and works across signup methods (password, OAuth, magic link). Server-action backfill leaves a window where the user is logged in without a profile. **Choose trigger.** |
| Storing username only in `auth.users.user_metadata` | What the codebase does today for first/last name | `user_metadata` is **not** queryable by other users (no public read), no unique constraint, no RLS for cross-user reads → cannot power an Explore page. **Must move to `public.profiles`.** |

**Installation (Postgres-side):**
```sql
create extension if not exists citext;
```

## Architecture Patterns

### Recommended Project Structure

```
supabase/migrations/
└── 20260427_create_profiles.sql      # new — table, trigger, RLS, citext, avatars bucket

src/lib/profile/
├── username-validation.ts            # shared zod schema + reserved-word list (canonical source)
├── username-suggestions.ts           # email -> "diegofill" / "diegofill-92" auto-suggest
└── reserved-usernames.ts             # const RESERVED: ReadonlySet<string>

src/app/(dashboard)/settings/profile/
├── page.tsx                          # extended: username row, bio, avatar
└── actions.ts                        # extended: getProfile/saveProfile + setUsername server action

src/app/(auth)/onboarding/username/
├── page.tsx                          # NEW deferred "claim your handle" gate
└── actions.ts                        # claim_username RPC wrapper

src/app/[username]/                   # NEW public profile page (post-MVP for Explore)
└── page.tsx
```

### Pattern 1: The canonical `public.profiles` table

The Supabase official Next.js tutorial publishes the exact shape we want. We extend
minimally for our use case. Final shape (recommended):

```sql
-- Adapted from Supabase official tutorial; matches existing migration style in this repo.
create extension if not exists citext;

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      citext unique,                          -- nullable until user claims it
  display_name  text,                                   -- separate from username, free-form
  bio           text check (char_length(bio) <= 280),   -- twitter-style cap
  avatar_url    text,
  website_url   text,
  social_links  jsonb default '{}'::jsonb,              -- { tiktok, instagram, x, ... }
  template_count int not null default 0,                -- denormalized for Explore (kept in sync by trigger or scheduled job — defer)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint username_length check (
    username is null or (char_length(username::text) between 3 and 24)
  ),
  constraint username_format check (
    username is null or username::text ~ '^[a-z0-9_.]+$'
  ),
  constraint username_no_consecutive_punct check (
    username is null or username::text !~ '[._]{2,}'
  ),
  constraint username_no_edge_punct check (
    username is null or username::text ~ '^[a-z0-9].*[a-z0-9]$'
  )
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);
create policy "Users insert own profile"
  on public.profiles for insert with check (auth.uid() = id);
create policy "Users update own profile"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create index profiles_username_idx on public.profiles(username);
```

`citext` makes the `unique` constraint and equality lookups (`where username = 'diego'`)
case-insensitive automatically — `Diego`, `DIEGO`, `diego` collapse to one row. Always
**store** the lowercased value at the application layer too, so the rendered profile path
is consistent.

### Pattern 2: The `handle_new_user` trigger

Canonical Supabase pattern — atomic profile-row creation when an `auth.users` row is inserted
(works for password signup, OAuth, and magic links uniformly):

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

Note: we do **not** insert a username here. Username is null on creation, the user claims
it later. This is deliberate — see UX Pattern below.

### Pattern 3: Atomic username claim (no race)

The naive flow is: `select 1 from profiles where username = $1` → `update profiles set
username = $1`. Two concurrent requests can both see "available" and both try to write. The
`UNIQUE` constraint on `citext` already serializes the writes; we just want a friendly
return value:

```sql
create or replace function public.claim_username(p_username citext)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return query select false, 'unauthenticated'; return;
  end if;

  if p_username !~ '^[a-z0-9_.]{3,24}$'
     or p_username ~ '[._]{2,}'
     or p_username !~ '^[a-z0-9].*[a-z0-9]$' then
    return query select false, 'invalid_format'; return;
  end if;

  begin
    update public.profiles
       set username = p_username,
           updated_at = now()
     where id = uid;
    return query select true, null::text;
  exception when unique_violation then
    return query select false, 'taken';
  end;
end;
$$;

grant execute on function public.claim_username(citext) to authenticated;
```

The `unique_violation` rescue makes this race-safe: even if two requests interleave between
the check and the update, only one update commits, the other returns `('taken', false)`.

### Pattern 4: Live availability check

Anonymous read of `profiles.username` is allowed by the RLS policy above. The server-action
just runs:

```ts
// src/app/(auth)/onboarding/username/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { validateUsernameFormat, isReservedUsername } from '@/lib/profile/username-validation'

export async function checkUsernameAvailable(raw: string) {
  const username = raw.trim().toLowerCase()
  const formatErr = validateUsernameFormat(username)
  if (formatErr) return { available: false, reason: formatErr }
  if (isReservedUsername(username)) return { available: false, reason: 'reserved' }

  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()
  return { available: !data, reason: data ? 'taken' : null }
}
```

Client debounces 350 ms and shows green/red/grey state. Pattern is standard. **The
availability check is hint UI only — the source of truth is the `claim_username` RPC's
race-safe response.**

### Pattern 5: Avatar storage

Identical pattern to existing `slide-backgrounds` bucket in
`supabase/migrations/006_storage_buckets.sql` — public bucket, per-user-folder RLS:

```sql
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

create policy "Avatar images are publicly accessible"
  on storage.objects for select to public
  using (bucket_id = 'avatars');

create policy "Users can upload own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

Upload path is `${userId}/${nanoid()}.${ext}`. Image transforms can be added later via
Supabase Image Transformations — out of scope for v1.

### Anti-Patterns to Avoid
- **Storing username only in `user_metadata`:** Cannot enforce uniqueness, cannot be
  queried by other users — fails the Explore-page goal.
- **Doing the availability check on the client only:** Client state can be stale;
  `claim_username` RPC is the only authority.
- **Allowing username changes with no rate limit:** Creates impersonation churn.
- **Mixing case in storage:** Always lowercase before insert — even with `citext`, the
  rendered profile URL should have a single canonical form (`/diego` not `/Diego`).
- **Putting the public profile page at `/u/[username]`:** Linktree, GitHub, X, Instagram,
  TikTok all use root-level `/[username]`. Solve route collisions with a reserved-words
  list, not by giving up the root path.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Case-insensitive uniqueness | Lowercase-on-write + ad-hoc checks | `citext` extension + `UNIQUE` | Native Postgres, atomic, one line of SQL |
| Race-free username claim | App-level lock + check-then-set | Postgres `UNIQUE` + `unique_violation` rescue inside SECURITY DEFINER function | DB-level atomicity, no double-claim possible |
| Profile row creation on signup | Manual server-action backfill | `handle_new_user()` trigger | Atomic with auth row, works for OAuth/magic link/password uniformly |
| Reserved-word list | Empty array you populate over time | Vendor [shouldbee/reserved-usernames](https://github.com/shouldbee/reserved-usernames/blob/master/reserved-usernames.txt) and trim to your routes | Years of accumulated edge cases |
| Avatar serving | Hand-roll image proxy | Supabase Storage public bucket | Already proven for `slide-backgrounds` |
| Username regex | Permissive then patchy | Match TikTok/Instagram exactly: `^[a-z0-9_.]{3,24}$` no edge-or-consecutive punctuation | Users already know these rules |

## Common Pitfalls

### Pitfall 1: OAuth users have no username at signup time
**What goes wrong:** Google sign-in completes, `handle_new_user` fires, but
`raw_user_meta_data` does not contain a username.
**How to avoid:** `username` is **nullable**. Add a layout-level guard that checks
`profile.username IS NULL` and redirects to `/onboarding/username`. Pattern used by GitHub,
Notion, Linktree.

### Pitfall 2: Race conditions on uniqueness
**How to avoid:** `UNIQUE` constraint provides atomicity for free; wrap the update in a
`SECURITY DEFINER` function with an `EXCEPTION WHEN unique_violation` clause to return a
typed `taken` response.

### Pitfall 3: Homoglyph impersonation
**What goes wrong:** User registers `аdmin` (Cyrillic а), impersonates support staff.
**How to avoid:** Restrict username charset to ASCII `[a-z0-9_.]`. **For v1, do not allow
Unicode.** When you eventually want to, apply NFKC normalization plus the Unicode
Confusables map (UTS #39).

### Pitfall 4: Route collisions on the public profile page
**How to avoid:** (a) Maintain a `RESERVED_USERNAMES` set, enforced in
`username-validation.ts`. Seed it with every top-level path you currently have or might
want: `dashboard, settings, login, signup, onboarding, api, docs, pricing, blog, admin,
terms, privacy, contact, help, support, about, explore, search, u, user, users, profile,
profiles, account, billing, brand-kit, credits, notifications, subscription, api-keys, mcp,
openapi, robots.txt, sitemap.xml, favicon.ico`. (b) Static routes in `app/` always win over
dynamic `[username]` — this is mostly belt-and-suspenders.

### Pitfall 5: Free username changes invite impersonation churn
**How to avoid:** Allow username changes but rate-limit to **once per 30 days** (TikTok
convention). For v1, simplest: add a `username_changed_at` column, disallow change if
`now() - username_changed_at < interval '30 days'`. Soft-reserve old names in v2.

### Pitfall 6: Forgetting to lowercase on submit
**How to avoid:** `username = raw.trim().toLowerCase()` before every write.

## Code Examples

### Shared validation module (single source of truth)
```ts
// src/lib/profile/username-validation.ts
import { z } from 'zod'
import { RESERVED_USERNAMES } from './reserved-usernames'

export const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9_.]{1,22}[a-z0-9])?$/

export const usernameSchema = z
  .string()
  .min(3, 'Must be at least 3 characters')
  .max(24, 'Must be at most 24 characters')
  .regex(USERNAME_REGEX, 'Use letters, numbers, _ or .')
  .refine((s) => !/[._]{2,}/.test(s), 'No consecutive dots or underscores')
  .refine((s) => !RESERVED_USERNAMES.has(s), 'That username is reserved')

export function validateUsernameFormat(s: string): string | null {
  const r = usernameSchema.safeParse(s)
  return r.success ? null : r.error.issues[0]?.message ?? 'invalid'
}

export function isReservedUsername(s: string): boolean {
  return RESERVED_USERNAMES.has(s)
}
```

### Auto-suggest from email
```ts
// src/lib/profile/username-suggestions.ts
export function suggestFromEmail(email: string): string {
  const local = email.split('@')[0] ?? ''
  const cleaned = local
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .replace(/^[._]+|[._]+$/g, '')
    .replace(/[._]{2,}/g, '_')
    .slice(0, 24)
  return cleaned.length >= 3 ? cleaned : `${cleaned}user`.slice(0, 24)
}

export function suffixedSuggestions(base: string, count = 3): string[] {
  const trimmed = base.slice(0, 21)
  return Array.from({ length: count }, () => {
    const n = Math.floor(Math.random() * 900 + 100)
    return `${trimmed}${n}`
  })
}
```

## Username Collection UX (Recommendation)

**Decision: deferred "Claim your handle" gate, not on signup.**

Why:
- OAuth signup (Google) cannot collect a username inline.
- Password signup *could* collect it, but two divergent flows is unnecessary cost.
- Pre-claiming reduces signup friction.

The gate:
1. After auth, every page in `(dashboard)` runs through a layout that fetches
   `profile.username`. If null, redirect to `/onboarding/username`.
2. Onboarding page shows: auto-suggested username (from email), "this is your profile URL"
   preview, live availability indicator, "Claim" button.
3. On claim, RPC returns success, redirect to wherever they were heading (`?next=`).
4. Edge case: user closes the tab. Re-prompted on next visit. Username remains nullable.

**Display name vs username:** Always keep them separate (every major platform does).
Username is the URL/handle/identity. `display_name` is "how it should be rendered" —
defaults to whatever Google OAuth or signup form gave us. User can edit display name
freely; username is rate-limited.

## Public Profile URL Shape

**Decision: `/[username]` at root, with reserved-words guard.**

Justification:
- Linktree: `linktr.ee/[username]`
- GitHub: `github.com/[username]`
- X/Twitter: `x.com/[username]`
- Instagram: `instagram.com/[username]`
- TikTok: `tiktok.com/@[username]`

Adding `/u/` would gain nothing (no SEO benefit; collision risk solved by the reserved
list) and lose the share-link aesthetic creators expect.

In Next.js App Router, static segments take precedence over dynamic segments, so `/dashboard`
will always resolve to the dashboard, not to a user named "dashboard".

## Profile Data Model for the Future Explore Page

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid PK | FK to `auth.users(id)` |
| `username` | citext UNIQUE | nullable until claimed |
| `display_name` | text | free-form, defaults from OAuth |
| `bio` | text (≤ 280 chars) | twitter-style cap |
| `avatar_url` | text | URL into `avatars` bucket |
| `website_url` | text | optional, validate as URL on the way in |
| `social_links` | jsonb | `{ tiktok, instagram, x, youtube }` — flexible without schema migrations |
| `template_count` | int default 0 | denormalized; defer the recompute trigger to when Explore launches |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Deliberately **not** included now:
- `follower_count`, `following_count` — defer until follower system exists.
- `verified` — defer.
- `username_changed_at` — add when shipping the rate limit (probably v1.1).

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Supabase Auth (existing) |
| V3 Session Management | yes | Supabase SSR cookies (existing) |
| V4 Access Control | yes | Postgres RLS on `public.profiles` |
| V5 Input Validation | yes | zod on server actions, CHECK constraints in SQL |
| V6 Cryptography | n/a | No new secret material |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Username impersonation via homoglyph | Spoofing | Restrict charset to ASCII `[a-z0-9_.]` |
| Reserved-name claim (`admin`, `support`) | Spoofing | Reserved-word list enforced in server action |
| Concurrent claim race | Tampering | `UNIQUE` constraint + RPC `unique_violation` rescue |
| Mass username scraping | Information Disclosure | RLS allows public SELECT (intentional). Rate-limit `checkUsernameAvailable` if abused (out of scope v1). |
| Avatar XSS via uploaded SVG | Tampering | Reject `image/svg+xml` MIME type at upload |

## Open Questions

1. **Profanity / impersonation list scope.** Beyond reserved system words, should we block
   slurs and obvious impersonation attempts (`elon-musk`, `t-swift`)? **Recommendation:**
   defer. Add a moderation queue when first abuse report comes in.

2. **Should `template_count` be on `profiles` or in a `profile_stats` view?**
   **Recommendation:** keep on `profiles` for v1. Move to a materialized view if and when
   query performance suffers.

3. **First-name / last-name carrying over.** Current settings page stores `first_name` /
   `last_name` / `phone` in `user_metadata`. Should `display_name` default to
   `${first_name} ${last_name}` for existing users? **Recommendation:** yes, as a one-time
   backfill in the same migration.

4. **Are templates "owned" by users yet?** The Explore goal implies users will share
   templates they've created. **Recommendation:** out of scope for this task; raise as a
   follow-up.

## Sources

### Primary (HIGH confidence)
- [Supabase official Next.js user-management tutorial](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs)
- [Supabase official user-management example repo](https://github.com/supabase/supabase/tree/master/examples/user-management/nextjs-user-management)
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [HandleGrab — Instagram & TikTok Username Rules 2026](https://www.handlegrab.com/blog/social-media-username-rules-limits)

### Secondary (MEDIUM confidence)
- [Supabase Discussion #3491 — Best practices for adding username to profiles at signup](https://github.com/orgs/supabase/discussions/3491)
- [Supabase Discussion #3188 — Case-insensitive search](https://github.com/orgs/supabase/discussions/3188)
- [shouldbee/reserved-usernames](https://github.com/shouldbee/reserved-usernames/blob/master/reserved-usernames.txt)
- [Mottie/github-reserved-names](https://github.com/Mottie/github-reserved-names)
- [Linktree — How to change your username URL](https://help.linktr.ee/en/articles/5434119-how-to-change-your-linktree-username-url)
- [JavaScript debounce article](https://artofcoding.blog/javascript-debounce-function-explained-with-real-ux-fixes/)
- [Unicode normalization attacks](https://medium.com/@instatunnel/unicode-normalization-attacks-when-admin-admin-32477c36db7f)
- [confusables.txt vs NFKC conflict](https://paultendo.github.io/posts/unicode-confusables-nfkc-conflict/)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Supabase tutorial is the literal canonical pattern
- Architecture: HIGH — citext + RLS + trigger is industry standard
- Pitfalls: HIGH for race / homoglyph / OAuth / route collisions; MEDIUM for change rate-limit
- Sources: well-cross-verified across Supabase docs, GitHub discussions, platform-specific username rules

**Research date:** 2026-04-27
**Valid until:** ~2026-05-27
