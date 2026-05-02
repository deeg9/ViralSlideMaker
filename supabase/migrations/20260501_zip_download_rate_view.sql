-- Phase 54 (D-19, METRIC-02): admin/analytics view for ZIP download rate.
-- Not user-facing. Surfaced in admin dashboard. Computes
--   rate = downloads_in_window / projects_created_in_window
-- Defaults to last 30 days when called without explicit window.

CREATE OR REPLACE FUNCTION public.zip_download_rate(
  window_start timestamptz DEFAULT (now() - interval '30 days'),
  window_end   timestamptz DEFAULT now()
)
RETURNS TABLE (
  window_start    timestamptz,
  window_end      timestamptz,
  downloads       bigint,
  projects_created bigint,
  rate            numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    zip_download_rate.window_start,
    zip_download_rate.window_end,
    COALESCE(d.cnt, 0) AS downloads,
    COALESCE(p.cnt, 0) AS projects_created,
    CASE WHEN COALESCE(p.cnt, 0) = 0
      THEN 0::numeric
      ELSE ROUND(COALESCE(d.cnt, 0)::numeric / p.cnt::numeric, 4)
    END AS rate
  FROM (
    SELECT count(*) AS cnt FROM public.carousel_events
    WHERE event_type = 'download_zip'
      AND occurred_at >= zip_download_rate.window_start
      AND occurred_at <  zip_download_rate.window_end
  ) d
  CROSS JOIN (
    SELECT count(*) AS cnt FROM public.projects
    WHERE created_at >= zip_download_rate.window_start
      AND created_at <  zip_download_rate.window_end
  ) p;
$$;

GRANT EXECUTE ON FUNCTION public.zip_download_rate(timestamptz, timestamptz) TO authenticated;

-- View wraps the function with default window for admin dashboard convenience:
CREATE OR REPLACE VIEW public.v_zip_download_rate AS
  SELECT * FROM public.zip_download_rate();

GRANT SELECT ON public.v_zip_download_rate TO authenticated;
