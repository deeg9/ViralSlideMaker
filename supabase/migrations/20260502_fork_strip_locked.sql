-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 64 LOCK-08: fork_published_carousel strips `locked` on copy
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Forker takes ownership of the forked carousel — all elements (text_boxes,
-- custom_images, custom_texts, watermark) lose any `locked` flag the
-- original creator set. Mirrors the v2.4 brand_kit_id strip pattern (the
-- original RPC at 20260427_explore_remix_phase29.sql replaces template_id
-- with 'bold-minimal' on copy; this extension also clears `locked`).
--
-- Why one-liner-style: the original RPC already deep-copies `pub.slide_data`
-- into `new_slide_data`. We add a single jsonb-walk helper that removes the
-- `locked` key from every element across every slide.
--
-- Verification (post-deploy):
--   -- Fork a published carousel that has slide_data with locked: true
--   SELECT public.fork_published_carousel('<published-id>'::uuid);
--   SELECT slide_data->0->'text_boxes'->0->'locked' FROM public.projects WHERE id = '<new-project-id>';
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
    -- custom_texts (legacy mirror — also carries locked post-Plan 49).
    FOREACH arr_field IN ARRAY ARRAY['text_boxes', 'custom_images', 'custom_texts']
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
    -- not array — Phase 60 schema lift).
    IF slide_out ? 'watermark' AND jsonb_typeof(slide_out -> 'watermark') = 'object' THEN
      slide_out := jsonb_set(slide_out, '{watermark}', (slide_out -> 'watermark') #- '{locked}');
    END IF;
    result := result || jsonb_build_array(slide_out);
  END LOOP;
  RETURN result;
END;
$$;

-- Re-declare fork_published_carousel with the strip step inserted.
-- Body matches 20260427_explore_remix_phase29.sql lines 255-308 with one
-- added line between `new_slide_data := pub.slide_data;` and the INSERT.

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

  -- Phase 64 LOCK-08: strip `locked` on every element across every slide.
  -- The forker takes ownership; inherited locks would block the forker from
  -- editing the copy. Helper is IMMUTABLE + pure-data; no DB access.
  new_slide_data := public._strip_locked_from_slide_data(pub.slide_data);

  -- Create new private project owned by the forker
  INSERT INTO public.projects (
    user_id, title, description, slide_data, template_id, topic, generation_status, created_at, updated_at
  ) VALUES (
    uid,
    'Remix of ' || pub.title,
    pub.description,
    new_slide_data,
    'bold-minimal',  -- default template; brand-kit template will re-resolve to forker's at render
    NULL,
    'complete',
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

GRANT EXECUTE ON FUNCTION public.fork_published_carousel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._strip_locked_from_slide_data(jsonb) TO authenticated;
