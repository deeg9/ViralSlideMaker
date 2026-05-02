-- Phase 54 (D-17, D-18, METRIC-01): extend carousel_events to track ZIP
-- downloads at the project level (pre-publish). Avoids a parallel events
-- table per "extend, do not parallel-create" decision.
--
-- Changes:
--  * CHECK constraint: include 'download_zip'
--  * Add event_data jsonb (payload bag — slide_count, template_id, user_tier)
--  * Make published_carousel_id nullable (downloads happen pre-publish)
--  * Add project_id uuid (FK projects(id), nullable for view events)
--  * One of (project_id, published_carousel_id) MUST be non-null

-- 1. Drop old CHECK, add new one
ALTER TABLE public.carousel_events
  DROP CONSTRAINT IF EXISTS carousel_events_event_type_check;
ALTER TABLE public.carousel_events
  ADD CONSTRAINT carousel_events_event_type_check
  CHECK (event_type IN ('view', 'download_zip'));

-- 2. Allow published_carousel_id NULL (was NOT NULL)
ALTER TABLE public.carousel_events
  ALTER COLUMN published_carousel_id DROP NOT NULL;

-- 3. Add project_id (nullable FK to projects)
ALTER TABLE public.carousel_events
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;

-- 4. Add event_data jsonb payload column
ALTER TABLE public.carousel_events
  ADD COLUMN IF NOT EXISTS event_data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 5. Enforce: at least one of project_id / published_carousel_id is set
ALTER TABLE public.carousel_events
  DROP CONSTRAINT IF EXISTS carousel_events_target_check;
ALTER TABLE public.carousel_events
  ADD CONSTRAINT carousel_events_target_check
  CHECK (project_id IS NOT NULL OR published_carousel_id IS NOT NULL);

-- 6. Index on project_id for download-rate queries
CREATE INDEX IF NOT EXISTS carousel_events_project_idx
  ON public.carousel_events(project_id) WHERE project_id IS NOT NULL;

-- 7. RLS: extend insert policy to permit 'download_zip' from authenticated users
DROP POLICY IF EXISTS "Authenticated users can log view events" ON public.carousel_events;
DROP POLICY IF EXISTS "Authenticated users can log carousel events" ON public.carousel_events;
CREATE POLICY "Authenticated users can log carousel events"
  ON public.carousel_events FOR INSERT
  TO authenticated
  WITH CHECK (event_type IN ('view', 'download_zip'));
