-- ─────────────────────────────────────────────────────────────────────────────
-- quick-260511-uk1: fork_published_carousel inherits pub.template_id
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Extends 20260510_v213_fork_inherits_style_spec.sql (Phase 78 REMIX-03)
-- by also inheriting the template_id snapshot column. Same function body
-- as that migration; the ONLY behavioral change is the INSERT INTO
-- public.projects template_id slot:
--
--   FROM: 'bold-minimal',
--   TO:   COALESCE(pub.template_id, 'bold-minimal'),
--
-- Why: until quick-260511-uk1, published_carousels did NOT snapshot
-- template_id (Phase 78 REMIX-01 gap — see the companion migration
-- 20260512_v213_published_carousels_template_id.sql for the column add
-- + backfill). Forks therefore defaulted to 'bold-minimal' regardless of
-- the original creator's template, breaking the v2.13 TPLREND-05 parity
-- invariant (a forked carousel opened in an unrelated palette).
--
-- After this migration:
--   - Forks of new (post-uk1) published rows inherit the original template
--     (via the snapshotted pub.template_id).
--   - Forks of legacy rows (where pub.template_id is NULL — either the row
--     pre-dates this fix and its source project was deleted, or backfill
--     skipped it) safely fall back to 'bold-minimal' via the COALESCE.
--
-- The RPC return type + signature are unchanged: still returns the new
-- project_id as uuid. CREATE OR REPLACE preserves the v2.4 GRANT EXECUTE,
-- and the trailing GRANT below is idempotent insurance.
--
-- The _strip_locked_from_slide_data helper from v2.12 is unchanged (this
-- migration only touches fork_published_carousel itself).
--
-- Threat model anchor (T-quick-260511-uk1-03):
--   SECURITY DEFINER + RLS gates (unpublished_at IS NULL, is_hidden = false)
--   prevent forking hidden or unpublished rows. The COALESCE fallback is
--   a string literal known to the template registry; no untrusted-input
--   path widens here.
--
-- Verification (post-deploy):
--   -- Fork a published row that has template_id set
--   SELECT public.fork_published_carousel('<published-with-template-id>'::uuid);
--   SELECT template_id FROM public.projects WHERE id = '<new-project-id>';
--   -- Expected: template_id matches the published row's template_id.
--
--   -- Fork a legacy published row where template_id is NULL
--   SELECT public.fork_published_carousel('<legacy-published-id>'::uuid);
--   SELECT template_id FROM public.projects WHERE id = '<new-project-id>';
--   -- Expected: template_id = 'bold-minimal' (COALESCE fallback).
--
--   -- Confirm the RPC body carries the COALESCE expression
--   SELECT pg_get_functiondef('public.fork_published_carousel(uuid)'::regprocedure)
--          ~ 'COALESCE\(pub\.template_id, ''bold-minimal''\)' AS coalesce_present;
--   -- Expected: t

CREATE OR REPLACE FUNCTION public.fork_published_carousel(p_published_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid             uuid := auth.uid();
  pub             public.published_carousels%ROWTYPE;
  new_project_id  uuid;
  new_slide_data  jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '28000';
  END IF;

  -- Fetch the published row (must be visible per RLS — NULL unpublished_at, not hidden)
  SELECT * INTO pub
  FROM public.published_carousels
  WHERE id = p_published_id
    AND unpublished_at IS NULL
    AND is_hidden = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'published_carousel_not_available' USING errcode = '42P01';
  END IF;

  -- Phase 64 LOCK-08 + Phase 71 MIGR-01: strip `locked` on every element
  -- (text_boxes / custom_images / custom_texts / decorations + watermark).
  -- Helper is IMMUTABLE + pure-data; no DB access. Body unchanged from v2.12.
  new_slide_data := public._strip_locked_from_slide_data(pub.slide_data);

  -- Phase 78 REMIX-03: inherit style_spec + reference_assets from the source
  -- published row (unchanged from 20260510_v213_fork_inherits_style_spec.sql).
  --
  -- quick-260511-uk1: inherit template_id from the source published row
  -- via COALESCE(pub.template_id, 'bold-minimal'). Closes the Phase 78
  -- REMIX-01 snapshot-column gap. Legacy rows where pub.template_id IS NULL
  -- (either pre-uk1 publishes whose source project was deleted at backfill
  -- time, or rows that pre-date the companion migration) safely fall back
  -- to 'bold-minimal' — same behavior as before this migration.
  INSERT INTO public.projects (
    user_id, title, description, slide_data, template_id, topic,
    generation_status, style_spec, reference_assets, created_at, updated_at
  ) VALUES (
    uid,
    'Remix of ' || pub.title,
    pub.description,
    new_slide_data,
    COALESCE(pub.template_id, 'bold-minimal'),  -- quick-260511-uk1: inherit published template_id; fallback to bold-minimal for legacy rows where the column is NULL
    NULL,
    'complete',
    pub.style_spec,        -- Phase 78 REMIX-03: inherit (nullable copy)
    pub.reference_assets,  -- Phase 78 REMIX-03: inherit (nullable copy)
    now(),
    now()
  ) RETURNING id INTO new_project_id;

  -- Increment remix_count on the source atomically
  UPDATE public.published_carousels
     SET remix_count = remix_count + 1
   WHERE id = p_published_id;

  RETURN new_project_id;
END;
$$;

-- Re-grant just to be explicit; CREATE OR REPLACE preserves the v2.4 grant
-- but a redundant GRANT is idempotent and protects against any future RPC
-- recreation that might lose it.
GRANT EXECUTE ON FUNCTION public.fork_published_carousel(uuid) TO authenticated;
