-- Phase 90: per-carousel output format (TikTok 9:16 / Instagram 4:5 / Square 1:1).
-- Nullable + additive — no backfill (same discipline as
-- 20260517_phase82_projects_category.sql).
--
-- BACK-COMPAT CONTRACT: a NULL output_format means "legacy project" and the
-- application layer (resolveFormat in src/lib/render/carousel-formats.ts)
-- treats NULL as 'tiktok' (1080x1920) — so every carousel created before this
-- migration keeps its exact size. New projects are written with 'instagram'
-- explicitly at INSERT time by createProjectService, so NULL only ever means
-- "pre-Phase-90".
--
-- Plain text column (no enum type, no CHECK constraint) — matches how
-- projects.category and projects.template_id are modeled; validity is enforced
-- in the app layer, and a future fourth format ships with no schema migration.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS output_format text;

COMMENT ON COLUMN projects.output_format IS
  'Carousel output format — one of tiktok|instagram|square. NULL = legacy pre-Phase-90 project, resolved as tiktok (1080x1920) by the app layer. New projects insert ''instagram''.';
