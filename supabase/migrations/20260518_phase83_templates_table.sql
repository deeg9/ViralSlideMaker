-- Phase 83 (TSTORE-01): DB-backed template storage.
-- Additive + reversible: creates ONE new table (public.templates) and touches
-- nothing else. No existing carousel and none of the 13 CODE templates change
-- how they render — DB storage is purely additive (a hybrid code+DB registry,
-- not a migration of the code templates). The 13 code templates STAY in code.
--
-- This migration ships:
--   1. public.templates table — id (text PK, shared ID space with
--      projects.template_id and code-template ids), name, category (CHECK'd
--      closed set), flat_style jsonb (mirrors the ~30-field SlideTemplate),
--      layout_recipe jsonb (NULLABLE — reserved for Phase 84's LayoutRecipe
--      model so Phase 84 needs no second migration), preview text (NULLABLE —
--      reserved for Phase 86's picker preview), created_by, timestamps.
--   2. RLS: public SELECT USING (true); NO write policy → deny-by-default.
--      Writes go through the service-role admin client (Phase 86).
--   3. updated_at auto-update trigger.
--
-- Reversal: DROP TABLE IF EXISTS public.templates CASCADE; (the trigger
-- function templates_set_updated_at is dropped with CASCADE-owned objects;
-- drop it explicitly if reverting).

CREATE TABLE IF NOT EXISTS public.templates (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  category      text,
  flat_style    jsonb NOT NULL DEFAULT '{}'::jsonb,
  layout_recipe jsonb,
  preview       text,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT templates_category_allowed
    CHECK (category IS NULL OR category IN ('news', 'facts'))
);

COMMENT ON TABLE public.templates IS
  'Phase 83 (TSTORE-01): DB-backed template rows merged with the 13 code templates by the async registry. Additive — code templates stay in code.';
COMMENT ON COLUMN public.templates.id IS
  'Text slug PK — one shared ID space with projects.template_id and code-template ids. A code template wins over a DB row with the same id.';
COMMENT ON COLUMN public.templates.flat_style IS
  'jsonb blob mirroring the SlideTemplate flat-style fields (~30 mostly-optional). JSON keeps the schema additive — no migration per new style field.';
COMMENT ON COLUMN public.templates.layout_recipe IS
  'NULLABLE jsonb — reserved for the Phase 84 LayoutRecipe model. Added now so Phase 84 needs no second migration. Phase 83 never reads/writes it.';
COMMENT ON COLUMN public.templates.preview IS
  'NULLABLE preview reference — reserved for the Phase 86 picker preview. Phase 83 leaves it null.';
COMMENT ON COLUMN public.templates.created_by IS
  'NULLABLE uuid FK to auth.users, ON DELETE SET NULL (mirrors projects.user_id). Set by the Phase 86 admin authoring flow.';

CREATE INDEX IF NOT EXISTS templates_category_idx ON public.templates(category);
CREATE INDEX IF NOT EXISTS templates_created_at_idx ON public.templates(created_at DESC);

-- ── RLS: public read, deny-by-default writes ────────────────────────────────
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Templates are viewable by everyone" ON public.templates;
CREATE POLICY "Templates are viewable by everyone"
  ON public.templates FOR SELECT
  USING (true);

-- NO INSERT/UPDATE/DELETE policy by design — deny-by-default. Writes go through
-- the service-role admin client (createAdminClient), which bypasses RLS. The
-- Phase 86 endpoint performs the app-level admin role check (mirrors
-- src/app/api/admin/seed-explore/route.ts). Reads use the anon/publishable
-- client (src/lib/supabase/server.ts), respecting the public SELECT policy.

-- ── updated_at auto-update trigger ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.templates_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS templates_updated_at ON public.templates;
CREATE TRIGGER templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE PROCEDURE public.templates_set_updated_at();
