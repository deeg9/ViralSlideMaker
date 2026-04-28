# Quick Task 260428-fix: fix the 3 v2.5 bugs surfaced by the live smoke test

## Why

Live curl walk-through against v2.5 (10 commits) found 3 real bugs and 1
env issue. This task closes the 3 code-side bugs.

## What ships

### Fix 1: Provision the `brand-kit-logos` storage bucket + RLS

**Bug:** `POST /me/brand-kit/logo-upload-url` returns HTTP 500
("The related resource does not exist"). The route in
`src/app/api/v1/me/brand-kit/logo-upload-url/route.ts:7` writes to a
bucket named `brand-kit-logos` that was never provisioned. The 3
existing buckets are `avatars`, `hero-thumbnails`, `slide-backgrounds`.

**Fix:** New migration `supabase/migrations/20260428_brand_kit_logos_bucket.sql`:

- `INSERT INTO storage.buckets (id, name, public) VALUES ('brand-kit-logos', 'brand-kit-logos', true)`
- 4 policies on `storage.objects`, all gated on `bucket_id = 'brand-kit-logos'`:
  - public SELECT (logo URLs are public for rendering on Explore)
  - owner-only INSERT/UPDATE/DELETE keyed on `auth.uid() = (storage.foldername(name))[1]::uuid` (per-user folder pattern, mirrors `hero-thumbnails`)

Apply via `mcp__supabase__apply_migration`.

### Fix 2: `findActivePublishedRow` picks the most-recent active row

**Bug:** `DELETE /projects/{id}/publish` returns 404 when ≥2 active
`published_carousels` rows exist for the same project (POST /publish is
spec'd to allow multiple snapshots; the existing helper's
`.maybeSingle()` errors silently when more than one row matches).

**Fix:** `src/lib/services/publish.ts:findActivePublishedRow` — add
`.order('published_at', { ascending: false }).limit(1)` before
`.maybeSingle()`. Picks the freshest active row, leaving older ones
untouched (caller can DELETE again to peel them off one at a time).

### Fix 3: `POST /carousel` refunds the credit on failure

**Bug:** `src/app/api/v1/carousel/route.ts:105` deducts 1 credit then
runs `generateCarousel(...)` inside a try/catch. On failure the catch
returns 500 without refunding — Diego lost 2 credits to two failed
attempts during the smoke test. The `imagen-actions` flow already does
this correctly (refund row inserted before the error response).

**Fix:** in the catch block, insert a `credit_transactions` row
(`type='refund'`, `amount=1`, `description='Carousel generation failed'`,
`reference_id` = the project id we created) using the admin client
before returning 500.

## Files

- **New** `supabase/migrations/20260428_brand_kit_logos_bucket.sql`
- **Modified** `src/lib/services/publish.ts` (~3 lines)
- **Modified** `src/app/api/v1/carousel/route.ts` (~6 lines added in catch)

## Out of scope

- Rotating the `GEMINI_API_KEY` in `.env.local` — env-side, user does this.
- The Satori "display: flex" failure that appeared in the smoke test
  when seeded slide_data had `background_url: null` — not a v2.5 bug,
  same path on the dashboard. File for later.

## Verification (re-runs the smoke-test failures)

Mint a fresh API key, then:

1. **Fix 1:** `curl -X POST /api/v1/me/brand-kit/logo-upload-url -d '{}'` → 200 with `uploadUrl` + `publicUrl`.
2. **Fix 2:** publish the existing fixture project twice (creates 2 active rows), `DELETE /publish` → 200 (peels off the most recent), `DELETE /publish` again → 200 (peels off the older one), third `DELETE` → 404.
3. **Fix 3:** `POST /carousel` (will fail because Gemini key is invalid) → balance unchanged after the call; check `SELECT SUM(amount) FROM credit_transactions WHERE user_id='...'` before vs after.

Cleanup: revoke test API key, delete any phantom test artifacts.
