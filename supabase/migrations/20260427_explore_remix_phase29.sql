-- v2.4 Phase 29: Schema, RPCs & Hero Storage for Explore + Remix.
-- Builds the foundation for community publishing + v0.dev-style fork-and-save.
--
-- Ships:
--   1. published_carousels   — public snapshot rows (separate from private projects)
--   2. bookmarks             — owner-only saved-for-later entries
--   3. carousel_events       — append-only event log for high-frequency view counter
--   4. RLS policies          — public SELECT on published, owner-only on bookmarks/events
--   5. publish_carousel      — SECURITY DEFINER RPC, validates ownership + generates slug
--   6. fork_published_carousel — atomic deep-copy into a new private projects row
--   7. unpublish_carousel    — soft-delete (sets unpublished_at)
--   8. bookmark_count trigger — direct update on bookmark insert/delete
--   9. hero-thumbnails bucket + per-user-folder RLS

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. published_carousels
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.published_carousels (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_project_id   uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  slug                text NOT NULL UNIQUE,
  title               text NOT NULL,
  description         text,
  hero_image_url      text,
  slide_data          jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags                text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_featured         boolean NOT NULL DEFAULT false,
  is_hidden           boolean NOT NULL DEFAULT false,
  view_count          integer NOT NULL DEFAULT 0,
  bookmark_count      integer NOT NULL DEFAULT 0,
  remix_count         integer NOT NULL DEFAULT 0,
  popularity_score    numeric NOT NULL DEFAULT 0,
  published_at        timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  unpublished_at      timestamptz,
  CONSTRAINT published_carousels_title_length CHECK (char_length(title) BETWEEN 1 AND 120),
  CONSTRAINT published_carousels_description_length CHECK (description IS NULL OR char_length(description) <= 500),
  CONSTRAINT published_carousels_slug_format CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,80}[a-z0-9])?$'),
  CONSTRAINT published_carousels_tags_count CHECK (cardinality(tags) <= 5)
);

CREATE INDEX IF NOT EXISTS published_carousels_owner_idx ON public.published_carousels(owner_id);
CREATE INDEX IF NOT EXISTS published_carousels_published_at_idx ON public.published_carousels(published_at DESC);
CREATE INDEX IF NOT EXISTS published_carousels_popularity_idx ON public.published_carousels(popularity_score DESC, published_at DESC);
CREATE INDEX IF NOT EXISTS published_carousels_tags_idx ON public.published_carousels USING gin(tags);

ALTER TABLE public.published_carousels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published carousels visible to everyone" ON public.published_carousels;
CREATE POLICY "Published carousels visible to everyone"
  ON public.published_carousels FOR SELECT
  USING (unpublished_at IS NULL AND is_hidden = false);

DROP POLICY IF EXISTS "Owners can see their own published rows" ON public.published_carousels;
CREATE POLICY "Owners can see their own published rows"
  ON public.published_carousels FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update own published carousel" ON public.published_carousels;
CREATE POLICY "Owners can update own published carousel"
  ON public.published_carousels FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete own published carousel" ON public.published_carousels;
CREATE POLICY "Owners can delete own published carousel"
  ON public.published_carousels FOR DELETE
  USING (auth.uid() = owner_id);

-- updated_at auto-bump
CREATE OR REPLACE FUNCTION public.published_carousels_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS published_carousels_updated_at ON public.published_carousels;
CREATE TRIGGER published_carousels_updated_at
  BEFORE UPDATE ON public.published_carousels
  FOR EACH ROW EXECUTE PROCEDURE public.published_carousels_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. bookmarks
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bookmarks (
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  published_carousel_id uuid NOT NULL REFERENCES public.published_carousels(id) ON DELETE CASCADE,
  created_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, published_carousel_id)
);

CREATE INDEX IF NOT EXISTS bookmarks_user_idx ON public.bookmarks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookmarks_carousel_idx ON public.bookmarks(published_carousel_id);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own bookmarks" ON public.bookmarks;
CREATE POLICY "Users see own bookmarks"
  ON public.bookmarks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own bookmarks" ON public.bookmarks;
CREATE POLICY "Users insert own bookmarks"
  ON public.bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own bookmarks" ON public.bookmarks;
CREATE POLICY "Users delete own bookmarks"
  ON public.bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- bookmark_count trigger (direct update — low-frequency operation, no contention concern)
CREATE OR REPLACE FUNCTION public.bookmarks_update_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE public.published_carousels
       SET bookmark_count = bookmark_count + 1
     WHERE id = new.published_carousel_id;
    RETURN new;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.published_carousels
       SET bookmark_count = GREATEST(0, bookmark_count - 1)
     WHERE id = old.published_carousel_id;
    RETURN old;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS bookmarks_count_trigger ON public.bookmarks;
CREATE TRIGGER bookmarks_count_trigger
  AFTER INSERT OR DELETE ON public.bookmarks
  FOR EACH ROW EXECUTE PROCEDURE public.bookmarks_update_count();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. carousel_events (async view counter)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.carousel_events (
  id                    bigserial PRIMARY KEY,
  published_carousel_id uuid NOT NULL REFERENCES public.published_carousels(id) ON DELETE CASCADE,
  event_type            text NOT NULL CHECK (event_type IN ('view')),
  occurred_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS carousel_events_carousel_idx ON public.carousel_events(published_carousel_id);
CREATE INDEX IF NOT EXISTS carousel_events_occurred_idx ON public.carousel_events(occurred_at);

ALTER TABLE public.carousel_events ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can write a 'view' event (anonymous views happen via a server action that runs as service-role)
DROP POLICY IF EXISTS "Authenticated users can log view events" ON public.carousel_events;
CREATE POLICY "Authenticated users can log view events"
  ON public.carousel_events FOR INSERT
  TO authenticated
  WITH CHECK (event_type = 'view');

-- No SELECT policy — events are write-only from the client; aggregation happens via service role.

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. publish_carousel RPC
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.publish_carousel(
  p_project_id     uuid,
  p_title          text,
  p_description    text DEFAULT NULL,
  p_tags           text[] DEFAULT ARRAY[]::text[],
  p_hero_image_url text DEFAULT NULL
)
RETURNS public.published_carousels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid              uuid := auth.uid();
  proj             public.projects%ROWTYPE;
  base_slug        text;
  candidate_slug   text;
  slug_suffix      text;
  attempts         integer := 0;
  norm_tags        text[];
  result           public.published_carousels%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '28000';
  END IF;

  -- Validate ownership
  SELECT * INTO proj FROM public.projects WHERE id = p_project_id AND user_id = uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'project_not_found_or_not_owned' USING errcode = '42501';
  END IF;

  -- Validate title
  IF p_title IS NULL OR char_length(btrim(p_title)) < 1 OR char_length(p_title) > 120 THEN
    RAISE EXCEPTION 'invalid_title' USING errcode = '22023';
  END IF;

  -- Normalize tags: lowercase, trim, dedupe, max 5, max 24 chars each
  SELECT array_agg(DISTINCT tag) INTO norm_tags
  FROM (
    SELECT lower(btrim(unnest(p_tags))) AS tag
  ) t
  WHERE tag <> '' AND char_length(tag) <= 24
    AND tag ~ '^[a-z0-9][a-z0-9_-]*[a-z0-9]?$';
  norm_tags := COALESCE(norm_tags, ARRAY[]::text[]);
  IF cardinality(norm_tags) > 5 THEN
    norm_tags := norm_tags[1:5];
  END IF;

  -- Generate slug from title (lowercase, hyphens, alphanumeric only)
  base_slug := regexp_replace(lower(btrim(p_title)), '[^a-z0-9]+', '-', 'g');
  base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');
  IF base_slug = '' THEN base_slug := 'carousel'; END IF;
  IF char_length(base_slug) > 60 THEN base_slug := substr(base_slug, 1, 60); END IF;

  -- Append a 6-char nanoid-style suffix; retry up to 5 times on collision
  LOOP
    slug_suffix := substr(md5(random()::text || clock_timestamp()::text), 1, 6);
    candidate_slug := base_slug || '-' || slug_suffix;

    BEGIN
      INSERT INTO public.published_carousels (
        owner_id, source_project_id, slug, title, description,
        hero_image_url, slide_data, tags, published_at, updated_at
      ) VALUES (
        uid, p_project_id, candidate_slug, btrim(p_title), p_description,
        p_hero_image_url, proj.slide_data, norm_tags, now(), now()
      ) RETURNING * INTO result;
      RETURN result;
    EXCEPTION WHEN unique_violation THEN
      attempts := attempts + 1;
      IF attempts >= 5 THEN
        RAISE EXCEPTION 'slug_collision_retry_exhausted' USING errcode = '40001';
      END IF;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_carousel(uuid, text, text, text[], text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. fork_published_carousel RPC
-- ─────────────────────────────────────────────────────────────────────────────

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

  -- Deep-copy slide_data; the application layer is responsible for re-resolving
  -- 'brand-kit' template references against the forker's own brand kit at render time.
  new_slide_data := pub.slide_data;

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

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. unpublish_carousel RPC
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.unpublish_carousel(p_published_id uuid)
RETURNS public.published_carousels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid    uuid := auth.uid();
  result public.published_carousels%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = '28000';
  END IF;

  UPDATE public.published_carousels
     SET unpublished_at = now()
   WHERE id = p_published_id
     AND owner_id = uid
     AND unpublished_at IS NULL
   RETURNING * INTO result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found_or_not_owned' USING errcode = '42501';
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unpublish_carousel(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. hero-thumbnails storage bucket + per-user-folder RLS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('hero-thumbnails', 'hero-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Hero thumbnails are publicly accessible" ON storage.objects;
CREATE POLICY "Hero thumbnails are publicly accessible"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'hero-thumbnails');

DROP POLICY IF EXISTS "Users can upload own hero thumbnails" ON storage.objects;
CREATE POLICY "Users can upload own hero thumbnails"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'hero-thumbnails'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own hero thumbnails" ON storage.objects;
CREATE POLICY "Users can update own hero thumbnails"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'hero-thumbnails'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own hero thumbnails" ON storage.objects;
CREATE POLICY "Users can delete own hero thumbnails"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'hero-thumbnails'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
