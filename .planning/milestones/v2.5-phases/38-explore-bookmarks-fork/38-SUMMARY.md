---
phase: 38-explore-bookmarks-fork
status: complete
shipped: 2026-04-28
requirements_closed: [API-12, API-13, API-14, API-15, API-16, API-17]
---

# Phase 38 — SUMMARY

## What shipped

6 endpoints covering programmatic Explore browsing, single-carousel detail, forking, and bookmark management.

| Endpoint | Method | Notes |
|---|---|---|
| List Explore feed | `GET /explore` | sort=trending\|new\|featured, tag, q, cursor |
| Get carousel detail | `GET /explore/{slug}` | includes slide_data + creator snippet |
| Fork carousel | `POST /explore/{slug}/fork` | returns new projectId |
| List my bookmarks | `GET /me/bookmarks` | cursor-paginated |
| Bookmark a carousel | `POST /me/bookmarks` | idempotent on (user_id, published_carousel_id) |
| Remove a bookmark | `DELETE /me/bookmarks/{publishedId}` | idempotent |

## New schema

`PublishedCarousel` schema added to `components/schemas` — used by both `/explore` (omits slide_data for payload size) and `/explore/{slug}` (full snapshot with creator snippet).

## Files

- **New** `src/app/api/v1/explore/route.ts` — feed listing
- **New** `src/app/api/v1/explore/[slug]/route.ts` — single carousel detail
- **New** `src/app/api/v1/explore/[slug]/fork/route.ts` — fork
- **New** `src/app/api/v1/me/bookmarks/route.ts` — GET + POST
- **New** `src/app/api/v1/me/bookmarks/[publishedId]/route.ts` — DELETE

## Decisions (defaults applied)

- **Page size:** 24 for both `/explore` and `/me/bookmarks`. Cursors are opaque base64-encoded `{published_at}|{id}` (explore) / `{created_at}` (bookmarks). Stable across pagination because the order keys never change.
- **Search behavior:** when `?q=` is set, `published_at` ordering takes precedence over `popularity_score` (mirrors the dashboard's behavior — search results are most-recent-first, not most-popular).
- **Fork behavior:** mirrors `fork_published_carousel` RPC — deep-copies slide_data, sets `template_id = 'bold-minimal'` (forker's own brand kit re-resolves at render), sets `topic = null` and `generation_status = 'complete'`. Title becomes `"Remix of <original>"`. Increments `remix_count` on the source row in a separate UPDATE (best-effort; not in the same transaction as the insert because admin client can't open multi-statement transactions cleanly without an RPC).
- **Bookmark idempotency:** POST returns 201 even if the row already exists (catches Postgres 23505 unique violation). DELETE returns 200 whether or not the row existed. Saves callers from having to track local state.

## Verification

- `npx tsc --noEmit | grep -E "explore|bookmarks"` → empty
- All 5 routes return 401 to unauthenticated curls (expected)
- All routes use the existing `withApiAuth` wrapper, so rate limiting + CORS + credit-balance fetch + structured errors all apply

## Out of scope

- Anonymous browsing of `/api/v1/explore` (the page version is anonymous-friendly; the API requires a key for now). Adding anonymous access via a separate path or auth-optional middleware is a v2.6 follow-up if customer demand exists.
- View-counter increments from API GETs (the `/explore/[slug]` page uses a `<ViewTracker>` client component that POSTs to a separate event-log endpoint; the API GET intentionally doesn't write).
