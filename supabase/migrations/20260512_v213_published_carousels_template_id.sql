-- quick-260511-uk1: published_carousels.template_id nullable text column +
-- one-shot backfill from public.projects.template_id.
--
-- CLOSES (does NOT supersede) the Phase 78 REMIX-01 snapshot gap. The original
-- 20260510_v213_published_carousels_style_spec.sql added style_spec +
-- reference_assets but OMITTED template_id. Consequence chain:
--   1. Forks fell back to the hardcoded 'bold-minimal' in
--      fork_published_carousel (see companion migration
--      20260512_v213_fork_inherits_template_id.sql).
--   2. The explore/[slug] detail page consumer had no template_id to read,
--      so it hardcoded `getTemplate('highlight-bar')` — every published
--      carousel rendered as highlight-bar regardless of its original
--      template. Same project + slide_data → three different palettes
--      across Dashboard / Explore index / Explore detail.
--   3. The v2.13 TPLREND-05 parity invariant (same input → same output
--      across every render path) was structurally violated for every
--      published row.
--
-- Phase 78 REMIX-01..03 remain in force for style_spec + reference_assets —
-- those snapshot semantics are unchanged. This migration is purely additive
-- and orthogonal.
--
-- Mirrors 20260510_v213_published_carousels_style_spec.sql verbatim in
-- safety posture: nullable, additive, ADD COLUMN IF NOT EXISTS (re-runnable),
-- COMMENT ON COLUMN with quick-260511-uk1 citation, idempotent UPDATE
-- backfill guarded by `template_id IS NULL`.
--
-- template_id : snapshot of source projects.template_id at publish time.
--               Text column (matches projects.template_id's type, which is
--               also text in the v2.4 schema). Application layer enforces the
--               closed-enum of registered template ids (src/lib/render/templates/
--               index.ts TEMPLATE_IDS); at the DB layer the column accepts any
--               string and the render-time getTemplate() falls back to
--               templates[0] (highlight-bar) for unknown ids — no render
--               crash on tampered values.
--
-- Threat model anchor (T-quick-260511-uk1-01, T-02, T-05):
--   - Tampering: text column accepts arbitrary strings; render-time fallback
--     to highlight-bar via getTemplate's existing default-fallback contract
--     prevents render-time crash on bad values.
--   - Info disclosure: template_id is non-sensitive (e.g. 'news-cyan',
--     'highlight-bar'), parallel to slide_data + tags which are already
--     publicly readable.
--   - Backfill repudiation: idempotent (IS NULL guard); re-running is a
--     no-op; logged via Supabase migration audit trail.
--
-- Verification (post-deploy):
--   -- Column exists and matches the expected type
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema = 'public'
--      AND table_name   = 'published_carousels'
--      AND column_name  = 'template_id';
--   -- Expected: data_type='text', is_nullable='YES'
--
--   -- Backfill ran: rows whose source project still exists have template_id set
--   SELECT count(*) AS unbackfilled_rows
--     FROM public.published_carousels pc
--    WHERE pc.template_id IS NULL
--      AND pc.source_project_id IS NOT NULL
--      AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = pc.source_project_id);
--   -- Expected: 0
--
--   -- Legacy row with deleted source project stays NULL (back-compat invariant)
--   SELECT pc.id, pc.template_id, pc.source_project_id
--     FROM public.published_carousels pc
--    WHERE pc.source_project_id IS NULL OR NOT EXISTS (
--          SELECT 1 FROM public.projects p WHERE p.id = pc.source_project_id);
--   -- Expected: template_id IS NULL for these rows; explore consumer falls back
--   --           to 'highlight-bar' at render time.

ALTER TABLE public.published_carousels
  ADD COLUMN IF NOT EXISTS template_id text;

COMMENT ON COLUMN public.published_carousels.template_id IS
  'quick-260511-uk1: snapshot of source projects.template_id at publish time. Closes the Phase 78 REMIX-01 gap (the original migration shipped style_spec + reference_assets but omitted template_id, causing forks to default to bold-minimal and the explore/[slug] consumer to hardcode highlight-bar). NULL for legacy pre-quick-260511-uk1 rows; backfilled at migration time from public.projects.template_id where source_project_id resolves.';

-- One-shot backfill. Re-running is a no-op because of the IS NULL guard.
-- Rows whose source project no longer exists stay NULL and the consumer
-- (src/app/explore/[slug]/page.tsx) falls back to 'highlight-bar' at
-- render time. Mirrors the safety posture of the Phase 78
-- 20260510_v213_published_carousels_style_spec.sql migration (additive,
-- no rollback complications).
UPDATE public.published_carousels pc
   SET template_id = p.template_id
  FROM public.projects p
 WHERE pc.source_project_id = p.id
   AND pc.template_id IS NULL
   AND pc.source_project_id IS NOT NULL;
