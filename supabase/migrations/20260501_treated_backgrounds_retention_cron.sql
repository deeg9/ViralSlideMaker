-- Phase 54 (D-07, TREAT-06): 7-day retention on orphan treated assets.
-- Runs daily at 03:00 UTC. Treats an object as orphan if no project's
-- slide_data references its public URL via the background_url field.
-- Reuses the pg_cron pattern from 20260427_explore_remix_phase31_cron.sql.
--
-- The LIKE-suffix join is intentionally loose because
-- projects.slide_data[*].background_url is a full public URL
-- (https://.../storage/v1/object/public/slide-backgrounds-treated/<userId>/treated/<sha>.png)
-- but storage.objects.name is the object key
-- (<userId>/treated/<sha>.png). Match-by-suffix avoids URL parsing.

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.cleanup_orphan_treated_backgrounds()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  deleted_count int := 0;
BEGIN
  WITH orphans AS (
    SELECT obj.name AS object_name
      FROM storage.objects obj
     WHERE obj.bucket_id = 'slide-backgrounds-treated'
       AND obj.created_at < now() - interval '7 days'
       AND NOT EXISTS (
         SELECT 1
           FROM public.projects p,
                LATERAL jsonb_array_elements(COALESCE(p.slide_data, '[]'::jsonb)) AS slide
          WHERE slide->>'background_url' LIKE '%' || obj.name
       )
  )
  DELETE FROM storage.objects
    WHERE bucket_id = 'slide-backgrounds-treated'
      AND name IN (SELECT object_name FROM orphans);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'cleanup_orphan_treated_backgrounds: deleted % objects', deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_orphan_treated_backgrounds() TO postgres;

SELECT cron.schedule(
  'cleanup_orphan_treated_backgrounds_daily',
  '0 3 * * *',
  $cron$SELECT public.cleanup_orphan_treated_backgrounds();$cron$
);
