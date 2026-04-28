-- v2.4 Phase 32: Full-text search vector for /explore search box.
-- Uses a trigger-maintained column rather than a generated column because
-- to_tsvector with the 'simple' regconfig is not detected as IMMUTABLE in
-- a generation expression (Postgres conservative check). Trigger gives us
-- the same behavior with no functional difference.

ALTER TABLE public.published_carousels
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS published_carousels_search_idx
  ON public.published_carousels USING gin(search_vector);

CREATE OR REPLACE FUNCTION public.published_carousels_update_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  new.search_vector :=
    setweight(to_tsvector('simple'::regconfig, coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(array_to_string(new.tags, ' '), '')), 'C');
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS published_carousels_search_vector_trigger ON public.published_carousels;
CREATE TRIGGER published_carousels_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, description, tags ON public.published_carousels
  FOR EACH ROW EXECUTE PROCEDURE public.published_carousels_update_search_vector();

-- Backfill any existing rows
UPDATE public.published_carousels SET title = title;
