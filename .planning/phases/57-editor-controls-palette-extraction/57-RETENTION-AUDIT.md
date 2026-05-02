# Phase 57 Plan 03 — Treated-bucket retention audit (D-24)

**Audited:** 2026-04-30
**Auditor:** orchestrator-inline
**Verdict:** PASS — no changes needed

## Phase 54 pg_cron job state

Query: `SELECT * FROM cron.job WHERE jobname='cleanup_orphan_treated_backgrounds_daily'`

| jobname | schedule | command |
|---|---|---|
| cleanup_orphan_treated_backgrounds_daily | `0 3 * * *` (daily 03:00 UTC) | `SELECT public.cleanup_orphan_treated_backgrounds();` |

Job exists per Phase 54 verification (TREAT-06). Schedule unchanged.

## Recent runs

Query: `SELECT start_time, end_time, status FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5`

No `job_run_details` rows yet for this job — Phase 54 was completed
2026-04-30 ~01:43 UTC; the daily cron next-fire is 03:00 UTC. The job
itself is registered correctly; first execution is pending. No errors,
no missing job.

## Storage bucket state

Query: `SELECT COUNT(*) FROM storage.objects WHERE bucket_id='slide-backgrounds-treated'`

Result: 0 objects.

The bucket is empty in the staging database (no test treatments have
been triggered there end-to-end yet). The retention scope is unaffected
by Phase 56 grain PNG assets — those live in `public/textures/` as
static assets served from the Next.js `public/` directory, NOT in this
Supabase Storage bucket. Phase 56 verified the texture asset paths;
this audit confirms they did NOT inadvertently get uploaded to the
treated bucket.

## Verdict

PASS. No fix needed. The retention pg_cron job is healthy and correctly
scoped to the `slide-backgrounds-treated` bucket. Phase 57 introduces
no changes that broaden retention scope:

- `extractPalette` reads buffers FROM the bucket (and fetches treated
  URLs over HTTP) but does NOT upload new objects.
- `updateSlideTreatment` server action calls `treatPhoto`, which uses
  the existing Phase 54 upload-or-cache path — same bucket, same
  retention.
- New `sticky-note-accent.svg` lives in `public/overlays/` — static,
  not in the bucket.

## Follow-up watchlist

None required. Re-audit in Phase 58 ship-gate (PARITY-05 cascade-delete
audit) to verify deleting a project still cleans up its treated assets.
