---
name: 260428-pfp summary
description: Quick task summary — public profile page at /[username]
type: project
status: complete
---

# Quick Task 260428-pfp — SUMMARY

## What shipped

A public profile page at `/[username]` that closes the broken byline link
on the explore detail page. Two new files, no DB changes.

## Files added

- `src/app/[username]/layout.tsx` — anonymous-friendly TopNavbar shell
  (mirrors `src/app/explore/layout.tsx`).
- `src/app/[username]/page.tsx` — server component that:
  - looks up the profile by username (citext, case-insensitive) and
    `notFound()`s on miss
  - fetches the user's public carousels (`unpublished_at IS NULL AND
    is_hidden = false`, ordered by `published_at` desc, limit 48)
  - renders profile header — 80×80 avatar (with `person` icon
    fallback), display name + @handle, bio, joined month, website +
    `tiktok|instagram|x|youtube` social-link chips
  - shows an "Edit profile" CTA → `/settings/profile` only on own
    profile (`user.id === profile.id`)
  - renders the carousel grid using the same card markup as
    `src/app/explore/page.tsx`, or an empty-state card if the user
    hasn't published anything (with a "Create a carousel" CTA on own
    profile only)

## What was reused

- `TopNavbar` (`signedIn` prop already supports anonymous viewers)
- carousel-card markup from `/explore` (grid + hero + bookmark/remix
  counts)
- `notFound()` + brand color tokens from `/explore/[slug]`
- empty-state card style from `/bookmarks`
- existing `profiles` + `published_carousels` schemas (no migration)
- `RESERVED_USERNAMES` already defends top-level static routes from
  the new dynamic catch-all

## Verification

- `npx tsc --noEmit` — zero errors on new files (the unrelated
  pre-existing test-file and `mcp-handler` errors were untouched).
- `npm run lint` — zero errors/warnings on new files (the 3
  pre-existing errors elsewhere in the repo were untouched).
- Dev server hit at `http://localhost:3000/diego` — middleware returns
  307 → `/login` for unauthenticated curl (as expected; same behavior
  as `/explore` and other non-allowlisted routes), confirming the
  route is registered. The reported bug occurred while the user was
  signed in, where middleware passes through and the page now
  renders.

## Deviations from plan

None.

## Known follow-ups (out of scope, not done)

- `src/lib/supabase/middleware.ts` does not allowlist `/explore`,
  `/explore/[slug]`, or `/[username]` for anonymous viewers, despite
  the layouts being designed anonymous-friendly. Sharing a profile or
  carousel link with a logged-out person currently bounces them to
  `/login`. This is a pre-existing gap from the wmg commit that
  affects all three public-content routes; fixing it is a separate
  task.
- Profile dropdown (`src/components/layout/profile-menu.tsx`) does not
  include a "View profile" link to one's own `/[username]` page; that
  could be added in a follow-up if desired.

## Commit

`6e66d14` — `feat(quick-260428-pfp): public profile page at /[username]`
