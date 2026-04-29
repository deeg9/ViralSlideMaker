---
phase: 36-publish-credits-read
status: complete
shipped: 2026-04-28
requirements_closed: [API-06, API-07, API-08]
---

# Phase 36 — SUMMARY

## What shipped

3 new endpoints + a shared service-layer module for publish reuse.

| Endpoint | Method | Notes |
|---|---|---|
| Publish to Explore | `POST /projects/{id}/publish` | hero render + storage upload + insert |
| Unpublish | `DELETE /projects/{id}/publish` | soft-delete on the active published row |
| Read credits | `GET /me/credits` | tier + balance + monthly_grant + period_end |

## Files

- **New** `src/lib/services/publish.ts` — shared service layer:
  - `renderHeroBuffer(project, brandKit, origin)` — extracts the hero-render logic from `publish-actions.ts` into a reusable helper
  - `publishProjectAdmin(admin, userId, projectId, opts)` — replicates `publish_carousel` RPC behavior using the admin client (does its own ownership check, slug retry loop, hero upload, insert into `published_carousels`)
  - `unpublishProjectAdmin(admin, userId, publishedId)` — soft-delete with explicit ownership check
  - `findActivePublishedRow(admin, userId, projectId)` — used by the API DELETE route to map project_id → published_id
  - `normalizePublishTags(rawTags)` — accepts string|string[] and applies the same lowercase/length/regex/banned-pattern rules as `publishProjectToExplore`
- **New** `src/app/api/v1/projects/[id]/publish/route.ts` — POST + DELETE
- **New** `src/app/api/v1/me/credits/route.ts` — GET

## Why a separate publish service

The original `publishProjectToExplore` server action uses `auth.uid()` indirectly through Supabase user-context client. The API-key path uses the admin client (no user context), so calling `publish_carousel` RPC directly would fail (auth.uid() returns null inside SECURITY DEFINER). Instead, the new service does explicit ownership checks against `projects.user_id` before inserting. Same end state (a published_carousels row), different control flow.

## Decisions (defaults applied)

- **Tags input:** accepts both `string[]` and comma-separated `string` for ergonomics. Banned-pattern denylist matches the server-action version.
- **Slug retry:** 5 attempts on unique-violation, same as the SQL RPC. After 5 failures, hero is cleaned up and the request returns INTERNAL_ERROR.
- **DELETE behavior:** maps `project_id → published_id` via `findActivePublishedRow`, so the API caller doesn't need to know the published_id. Returns 404 if no active publication exists.
- **Already-published projects:** POST does NOT detect a pre-existing publication; calling POST twice creates a second snapshot. This matches the server action, which similarly creates new rows. Callers should DELETE first if they want to replace.
- **`/me/credits` shape:** `{ tier, balance, monthly_grant, period_end, status, cancel_at_period_end }`. Reads `credit_balance` from the existing `ctx.creditBalance` (already populated by `withApiAuth`).

## Verification

- `npx tsc --noEmit | grep -E "publish|me/credits|services/publish"` → empty
- `curl /api/v1/me/credits` → 401 (no API key, expected)
- `curl -X POST /api/v1/projects/test/publish -d '{}'` → 401 (no API key, expected)

## Out of scope

- Republish flow (update existing snapshot) — current behavior is "delete + re-publish", consistent with the dashboard. A future enhancement could add `PUT /projects/{id}/publish` for in-place updates.
- API-side webhook for "carousel published" — defer to v2.6.
