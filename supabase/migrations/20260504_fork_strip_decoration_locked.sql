-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 71 MIGR-01: fork_published_carousel strips `locked` on decorations
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Extends v2.11 20260502_fork_strip_locked.sql (LOCK-08) with one new
-- array_field added to the FOREACH loop in _strip_locked_from_slide_data.
-- Forker takes ownership of the forked carousel — decorations lose any
-- `locked` flag the original creator set, mirroring the same ownership
-- transfer applied to text_boxes/custom_images/custom_texts/watermark.
--
-- The fork_published_carousel function body is unchanged; it calls
-- _strip_locked_from_slide_data which now walks four arrays + watermark.
-- CREATE OR REPLACE preserves existing GRANTs from the v2.11 migration.
--
-- Threat model anchor: T-71-09 (Elevation of Privilege — original creator
-- sets locked: true on decorations to block forker editing post-fork).
-- Mitigation: this migration. SQL #- '{locked}' removes the key entirely,
-- not sets to null — forked decorations have `locked === undefined`.
--
-- Verification (post-deploy):
--   -- Fork a published carousel that has slide_data with locked: true on a decoration
--   SELECT public.fork_published_carousel('<published-id>'::uuid);
--   SELECT slide_data->0->'decorations'->0->'locked' FROM public.projects WHERE id = '<new-project-id>';
--   -- Expected: NULL (key absent — `jsonb #-` removes the key, not sets it null)

CREATE OR REPLACE FUNCTION public._strip_locked_from_slide_data(p_slide_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  result    jsonb := '[]'::jsonb;
  slide     jsonb;
  slide_out jsonb;
  arr       jsonb;
  arr_out   jsonb;
  el        jsonb;
  el_out    jsonb;
  arr_field text;
BEGIN
  IF p_slide_data IS NULL OR jsonb_typeof(p_slide_data) <> 'array' THEN
    RETURN p_slide_data;
  END IF;
  FOR slide IN SELECT * FROM jsonb_array_elements(p_slide_data)
  LOOP
    slide_out := slide;
    -- Strip `locked` from each element of text_boxes / custom_images /
    -- custom_texts / decorations. Phase 71 MIGR-01 added 'decorations' as
    -- the 4th entry — forker takes ownership and inherited locks would
    -- block editing the copy (mirrors v2.11 LOCK-08 rationale on text_boxes).
    FOREACH arr_field IN ARRAY ARRAY['text_boxes', 'custom_images', 'custom_texts', 'decorations']
    LOOP
      arr := slide_out -> arr_field;
      IF arr IS NOT NULL AND jsonb_typeof(arr) = 'array' THEN
        arr_out := '[]'::jsonb;
        FOR el IN SELECT * FROM jsonb_array_elements(arr)
        LOOP
          el_out := el #- '{locked}';
          arr_out := arr_out || jsonb_build_array(el_out);
        END LOOP;
        slide_out := jsonb_set(slide_out, ARRAY[arr_field], arr_out);
      END IF;
    END LOOP;
    -- Strip `locked` from watermark slot if present (single-object slot,
    -- not array — Phase 60 schema lift). Unchanged from v2.11.
    IF slide_out ? 'watermark' AND jsonb_typeof(slide_out -> 'watermark') = 'object' THEN
      slide_out := jsonb_set(slide_out, '{watermark}', (slide_out -> 'watermark') #- '{locked}');
    END IF;
    result := result || jsonb_build_array(slide_out);
  END LOOP;
  RETURN result;
END;
$$;

-- fork_published_carousel function body is unchanged — it already calls
-- _strip_locked_from_slide_data, so this CREATE OR REPLACE on the helper
-- propagates automatically. No need to redeclare the RPC. GRANT EXECUTE
-- from v2.11 migration is preserved across CREATE OR REPLACE.
GRANT EXECUTE ON FUNCTION public._strip_locked_from_slide_data(jsonb) TO authenticated;
