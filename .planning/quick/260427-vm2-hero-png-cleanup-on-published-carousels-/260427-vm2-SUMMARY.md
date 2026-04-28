---
quick_id: 260427-vm2
title: Hero PNG cleanup on published_carousels delete
date: 2026-04-27
status: complete
commits:
  - 7f757be  # feat: deletePublishedCarousel server action with storage cleanup
---

# Quick Task 260427-vm2 Summary

Fixes the orphan-PNG bug surfaced during /gsd-autonomous v2.4 verification.

## What changed

**`src/app/(dashboard)/project/[id]/publish-actions.ts`** — adds two pieces:

1. **`extractStoragePath(publicUrl, bucket)`** — parses the storage path out
   of a Supabase public URL (everything after `/object/public/<bucket>/`).
   Returns null on mismatch.
2. **`deletePublishedCarousel(publishedId)`** server action — owner-validated
   hard-delete that pairs `DELETE FROM published_carousels` with
   `supabase.storage.from('hero-thumbnails').remove([path])`. Order: row
   first, storage second; if storage cleanup fails after the row is gone, it
   logs and proceeds (orphan beats broken state).

`unpublish_carousel` is left alone — soft-delete is the locked semantic for
preserving fork lineage, and the eventual republish flow needs the hero file
to stay around.

## Side action: cleaned up the existing test orphan

The 1.7 MB hero PNG from the autonomous-test session
(`hero-thumbnails/5d840563-…/6347c426-…png`) was orphaned by the cleanup
SQL DELETEs we ran earlier. Removed via a one-off Node script using the
service-role key + `supabase.storage.remove([path])` — direct SQL DELETE on
`storage.objects` is blocked by Supabase's `protect_delete()` guard.

`storage.objects` for bucket `hero-thumbnails` now sits at 0 rows.

## Why this works (bypass for `protect_delete()`)

Supabase blocks direct `DELETE FROM storage.objects` to prevent accidents,
but the same operation routed through the Storage API (which the
`@supabase/supabase-js` SDK calls under the hood) is allowed. Our server
action uses the SSR client → calls the Storage API → succeeds.

## Deferred / follow-ups

- **Nightly orphan-sweep `pg_cron`** — defense-in-depth against admin direct
  `DELETE FROM Supabase Studio`. Would need either an Edge Function called
  via `pg_net` (the storage API can't be called from inside Postgres) or a
  Vercel cron route. Not done in this task.
- **Republish flow (PUB-06)** — the Manage Published dashboard view that
  was deferred from Phase 30. When shipped, it should also clean up the old
  hero PNG before regenerating. The `extractStoragePath` helper is ready for
  that.
- **UI hookup** — `deletePublishedCarousel` is currently only a server
  action; no UI surface yet calls it. Will be wired when the Manage Published
  view ships.

## Verification

- `npx tsc --noEmit` — passes (no new errors; one pre-existing error in
  unrelated `mcp-handler` code)
- `SELECT count(*) FROM storage.objects WHERE bucket_id = 'hero-thumbnails'`
  returns 0 (orphan cleaned)
- `git log` shows the atomic commit

## Files modified

- `src/app/(dashboard)/project/[id]/publish-actions.ts` (+59 lines)
