---
name: 260428-fix summary
description: Closed 3 v2.5 bugs surfaced by live smoke test (bucket missing, multi-row unpublish, missing carousel refund)
type: project
status: complete
---

# Quick Task 260428-fix — SUMMARY

## What shipped

3 fixes for v2.5 bugs found by the live smoke test run earlier this
session. Each was reproducible against the local dev server with a
fresh API key.

| # | Bug | Fix |
|---|---|---|
| 1 | `POST /me/brand-kit/logo-upload-url` → 500 (bucket missing) | New migration provisions `brand-kit-logos` bucket + per-user-folder RLS |
| 2 | `DELETE /projects/{id}/publish` → 404 with multiple active rows | `findActivePublishedRow` now orders by `published_at` desc + limit 1 |
| 3 | `POST /carousel` doesn't refund credits on failure | Catch block inserts a `refund` credit_transactions row before returning 500 |

## Files

- **New** `supabase/migrations/20260428_brand_kit_logos_bucket.sql` —
  4 policies (public SELECT + owner INSERT/UPDATE/DELETE), idempotent
  bucket insert. Applied via `mcp__supabase__apply_migration`.
- **Modified** `src/lib/services/publish.ts` — `findActivePublishedRow`
  query now `.order('published_at', { ascending: false }).limit(1)`
  before `.maybeSingle()`. Comment notes the multi-snapshot scenario.
- **Modified** `src/app/api/v1/carousel/route.ts` — catch block adds a
  `credit_transactions` insert (type='refund', amount=1) before
  returning 500. Mirrors `src/lib/imagen/generate-image.ts` refund pattern.

## Verification (live, with a fresh API key)

| Fix | Test | Result |
|---|---|---|
| 1 | `POST /me/brand-kit/logo-upload-url` body `{filename:"my-logo.png",contentType:"image/png"}` | 200 with `uploadUrl` containing `/brand-kit-logos/<userId>/<uuid>-my-logo.png` |
| 2 | `POST /publish` x2 on fixture (creates 2 fresh active rows on top of 1 pre-existing seed = 3 total), then 3 sequential `DELETE /publish` calls | 200 / 200 / 200, peeled off most-recent each time. Caller can fully unpublish via repeated calls. (3rd DELETE in this test happened to peel the original seed; restored to active in cleanup.) |
| 3 | `POST /carousel` (fails because `GEMINI_API_KEY` invalid in env), credits before/after | 204 → 204. Refund row inserted; balance restored. |

`npx tsc --noEmit` clean for all 3 modified files.

## Cleanup

- Test API key revoked
- Test publish snapshots (`fix2-first-*`, `fix2-second-*`) hard-deleted
  from `published_carousels`
- Original seed publish row restored to active (`unpublished_at = NULL`)

## Notes

- The `GEMINI_API_KEY` in `.env.local` is still invalid per Google
  (`API_KEY_INVALID`). Until rotated, `POST /carousel`,
  `POST /slides/{index}/regenerate-text`, and
  `POST /slides/{index}/generate-image` will all 500 with that root
  cause. Fix 3 ensures the carousel refund happens regardless; the
  text-regen path is free so no refund needed; the imagen path
  already refunds via `generateImagenBackgroundAdmin`'s own catch.
- Apply the migration to production Supabase via `supabase db push`
  before the next deploy. Without it the brand-kit upload flow stays
  broken in prod.
