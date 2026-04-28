# Quick Task 260428-pfp: public profile page at /[username]

See `/Users/deeg/.claude/plans/users-deeg-desktop-screenshot-2026-04-2-groovy-crystal.md`
for the full approved plan. Summary:

Clicking the author byline ("Diego Fill" / "@diego") on `/explore/[slug]`
navigates to `/diego` and 404s. The link target was already wired up at
`src/app/explore/[slug]/page.tsx:127` and the settings page advertises
the URL pattern (`viralslidemaker.com/{username}`), but the route itself
was missing.

1. Add `src/app/[username]/layout.tsx` — anonymous-friendly TopNavbar
   shell, mirroring `src/app/explore/layout.tsx`.
2. Add `src/app/[username]/page.tsx` — server component:
   - look up profile by username (citext, case-insensitive); `notFound()`
     on miss
   - render header: avatar, display name, @handle, bio, joined month,
     website + social-link chips, "Edit profile" CTA when own profile
   - render grid of public published carousels (reusing the explore
     card markup), or empty-state card if none

No DB / migration changes. Reserved-usernames list already covers all
top-level static routes, so the new dynamic catch-all doesn't shadow
existing pages.
