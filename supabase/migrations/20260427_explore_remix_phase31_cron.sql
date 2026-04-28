-- v2.4 Phase 31: Trending feed support — popularity_score refresh cron.
-- Enables pg_cron, defines refresh_popularity_score() with HN-style gravity
-- formula, schedules it every 10 minutes.

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.refresh_popularity_score()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.published_carousels
     SET popularity_score = (
       (remix_count + bookmark_count * 0.5 + view_count * 0.05)
       / power(EXTRACT(EPOCH FROM (now() - published_at)) / 3600 + 2, 1.8)
     )
   WHERE unpublished_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_popularity_score() TO authenticated;

-- Initial seed
SELECT public.refresh_popularity_score();

-- Schedule every 10 minutes (uses pg_cron on the postgres database)
SELECT cron.schedule(
  'refresh_popularity_score_every_10_min',
  '*/10 * * * *',
  $cron$SELECT public.refresh_popularity_score();$cron$
);
