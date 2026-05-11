-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 78 (REMIX-03, Plan 01 Task 2): fork_published_carousel inherits
-- style_spec + reference_assets from the source published_carousels row.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Extends v2.12 20260504_fork_strip_decoration_locked.sql (which extended
-- v2.11 20260502_fork_strip_locked.sql, which extended the v2.4 original
-- 20260427_explore_remix_phase29.sql) with two added columns in the INSERT
-- INTO public.projects: style_spec and reference_assets, copied verbatim
-- from the matching columns on the source published row (Phase 78 Plan 01
-- Task 1 added those columns to public.published_carousels).
--
-- The forker takes ownership of the inherited spec + references — Phase
-- 77-03's <ReferenceThumbnailsStrip> (which renders when
-- project.reference_assets !== null) and Plan 78-02's "Regenerate from
-- references" action both work automatically once the new project row
-- carries the inherited fields. No UI changes needed for the inherit path.
--
-- Spec is INERT structural metadata — no per-row strip needed (decoration
-- `locked: true` is the only fork-strip concern, and v2.12 already handles
-- it via _strip_locked_from_slide_data on slide_data, which is unchanged
-- here). reference_assets carries provenance only — no `locked` flag exists
-- on those rows.
--
-- RPC return type + signature unchanged: still returns the new project_id
-- as uuid. CREATE OR REPLACE preserves the existing GRANT EXECUTE from the
-- v2.4 migration. The _strip_locked_from_slide_data helper from v2.12 is
-- unchanged (this migration only touches fork_published_carousel itself).
--
-- Threat model anchor: snapshot-on-fork pattern preserves point-in-time
-- integrity — the original creator can edit/delete their published row's
-- spec/assets later, and existing forks still hold their inherited copy.
-- Mirrors v2.4 slide_data deep-copy pattern.
--
-- Verification (post-deploy):
--   -- Fork a published carousel that has style_spec + reference_assets set
--   SELECT public.fork_published_carousel('<published-id>'::uuid);
--   SELECT style_spec, reference_assets FROM public.projects
--    WHERE id = '<new-project-id>';
--   -- Expected: both columns populated from the source published row.
--
--   -- Fork a legacy v2.4 published carousel (style_spec NULL, refs NULL)
--   SELECT public.fork_published_carousel('<legacy-published-id>'::uuid);
--   SELECT style_spec, reference_assets FROM public.projects
--    WHERE id = '<new-project-id>';
--   -- Expected: both columns NULL (back-compat invariant).

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
  -- published row. Spec is inert metadata (no locked-strip needed); refs are
  -- provenance only. Both columns nullable — legacy v2.4 published rows
  -- (where pub.style_spec IS NULL and pub.reference_assets IS NULL) produce
  -- new project rows with both columns NULL (back-compat invariant).
  INSERT INTO public.projects (
    user_id, title, description, slide_data, template_id, topic,
    generation_status, style_spec, reference_assets, created_at, updated_at
  ) VALUES (
    uid,
    'Remix of ' || pub.title,
    pub.description,
    new_slide_data,
    'bold-minimal',  -- default template; brand-kit template will re-resolve to forker's at render
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
