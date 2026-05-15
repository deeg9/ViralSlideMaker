-- Phase 81 (R1): add profiles.onboarding_completed_at + backfill existing rows
-- in a single transaction so the first-run tour never auto-fires for any
-- pre-existing user (the ~50 users on v2.13 as of 2026-05-15).
--
-- Per 81-CONTEXT.md D-13 the order matters:
--   1. ALTER TABLE ... ADD COLUMN (nullable, no DEFAULT)
--   2. UPDATE profiles SET onboarding_completed_at = now() WHERE ... IS NULL
--
-- Postgres runs every .sql migration inside an implicit transaction, so the
-- ALTER + UPDATE are atomic — no two-deploy window where existing users could
-- be briefly eligible to see the tour.
--
-- Why NO DEFAULT clause: a default of now() on the column would write a
-- non-null timestamp into every NEW signup's profiles row at insert time,
-- which would mark them as already-onboarded and silently break SPEC R2
-- ("welcome modal auto-opens iff onboarding_completed_at IS NULL"). Genuine
-- first-time users must see NULL until the tour is finished or skipped.
--
-- Why NO RLS change: per 81-CONTEXT.md D-14, the existing profile-self-select
-- and profile-self-update policies cover all columns on the row. The new
-- column inherits the same access rules with zero additional policy work.
--
-- Acceptance (SPEC R1):
--   SELECT count(*) FROM profiles WHERE onboarding_completed_at IS NULL
-- returns 0 immediately after this migration applies.

ALTER TABLE profiles
  ADD COLUMN onboarding_completed_at timestamptz;

UPDATE profiles
  SET onboarding_completed_at = now()
  WHERE onboarding_completed_at IS NULL;
