-- v2.4 Phase 33: Nightly aggregation of view events into view_count.
-- carousel_events captures high-frequency 'view' inserts (one per detail-page
-- mount); this cron job sums them and bumps published_carousels.view_count
-- once per night, then deletes the processed events. Avoids row-lock
-- contention on hot carousels at view time.

CREATE OR REPLACE FUNCTION public.aggregate_view_events()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  cutoff timestamptz := now();
BEGIN
  WITH counts AS (
    SELECT published_carousel_id, count(*)::integer AS n
    FROM public.carousel_events
    WHERE event_type = 'view' AND occurred_at <= cutoff
    GROUP BY published_carousel_id
  )
  UPDATE public.published_carousels p
     SET view_count = view_count + counts.n
    FROM counts
   WHERE p.id = counts.published_carousel_id;

  DELETE FROM public.carousel_events
   WHERE event_type = 'view' AND occurred_at <= cutoff;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aggregate_view_events() TO authenticated;

-- 04:00 UTC daily — quiet hour, low traffic
SELECT cron.schedule(
  'aggregate_view_events_nightly',
  '0 4 * * *',
  $cron$SELECT public.aggregate_view_events();$cron$
);
