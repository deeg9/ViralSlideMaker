-- Phase 79 (LEGAL-02, Plan 01): style-from-reference ToS-acceptance audit log.
--
-- Single source of truth for "did user X accept ToS version V for sha S?".
-- One row per (user_id, sha256) per acceptance event — insert-only, no
-- updates, RLS-locked so users only see their own acceptance rows and only
-- the service role can write.
--
-- INDEX RATIONALE:
--   * (user_id, sha256) — fast lookup when the upload handler asks
--     "has this user already acknowledged this exact image bytes hash?"
--     (used by the deduplication path in Plan 79-02 client UI).
--   * (user_id, tos_version) — fast lookup for hasUserAcceptedCurrentTos()
--     (audit-log.ts), which is on the hot path of every reference upload
--     after the first to decide whether to skip the clickwrap modal.
--
-- RLS POSTURE: SELECT for `authenticated` scoped to own rows; INSERT only
-- for `service_role` (writes route through the audit-log helper using the
-- admin client — defense in depth: even if a client somehow obtained an
-- anon JWT it cannot forge an acceptance row). DELETE is implicitly blocked
-- for everyone except the cron job below, which runs as `postgres`.
--
-- RETENTION: 12-month rolling window via pg_cron — mirrors the existing
-- v2.4 (20260427_explore_remix_phase31_cron.sql) and v2.9
-- (20260501_treated_backgrounds_retention_cron.sql) cron-retention pattern.
-- Daily 09:00 UTC sweep deletes acceptance rows older than 12 months.
-- Operator applies via `supabase db push`.

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS style_reference_uploads (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sha256       text        NOT NULL,
  tos_version  text        NOT NULL,
  accepted_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_style_reference_uploads_user_sha
  ON style_reference_uploads(user_id, sha256);

CREATE INDEX IF NOT EXISTS idx_style_reference_uploads_user_tos
  ON style_reference_uploads(user_id, tos_version);

ALTER TABLE style_reference_uploads ENABLE ROW LEVEL SECURITY;

-- SELECT: a user sees only their own acceptance rows. The audit-log helper
-- runs server-side with the service-role client, which bypasses RLS, so this
-- policy is the user-facing surface (e.g., a future "view my acceptances"
-- account page).
DROP POLICY IF EXISTS "users see own uploads" ON style_reference_uploads;
CREATE POLICY "users see own uploads"
  ON style_reference_uploads
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: only the service role can write acceptance rows. Client code
-- never inserts directly — it calls the server action which routes through
-- recordStyleFromReferenceTosAcceptance() with the admin client.
DROP POLICY IF EXISTS "service role inserts" ON style_reference_uploads;
CREATE POLICY "service role inserts"
  ON style_reference_uploads
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 12-month retention sweep (daily at 09:00 UTC). Mirrors the v2.4/v2.9
-- cron-retention pattern. Idempotent re-schedule: `cron.schedule()` returns
-- the existing job id if the name already exists, but to be safe on re-runs
-- we unschedule any prior job with this name first.
DO $$
BEGIN
  PERFORM cron.unschedule('style-reference-uploads-retention');
EXCEPTION WHEN OTHERS THEN
  -- No prior job — first apply, nothing to unschedule.
  NULL;
END $$;

SELECT cron.schedule(
  'style-reference-uploads-retention',
  '0 9 * * *',
  $cron$DELETE FROM style_reference_uploads WHERE accepted_at < now() - interval '12 months'$cron$
);
