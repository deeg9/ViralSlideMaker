-- Phase 78 (REMIX-01, Plan 01 Task 1): published_carousels.style_spec +
-- published_carousels.reference_assets nullable JSONB columns.
--
-- Mirrors v2.12 Phase 74-02 pattern (20260510_v213_style_spec_columns.sql)
-- which added the same two columns on `projects`. v2.13 ships a snapshot of
-- those fields onto every published row so forks inherit the spec + refs at
-- publish time (not by foreign-key — point-in-time copy preserves forker
-- regenerate-from-original-references behavior).
--
-- Both columns nullable + additive — no backfill, no rollback complications.
-- Legacy v2.4 published_carousels rows (every pre-v2.13 publish) keep both
-- columns NULL and continue to render byte-identical. The forker side reads
-- NULL and skips the new ReferenceThumbnailsStrip + Regenerate-from-references
-- UI (Phase 77-03 + Plan 78-02 are both null-conditional).
--
-- style_spec       : snapshot of source projects.style_spec at publish time.
--                    Validated StyleSpec object (src/lib/types/style-spec.ts,
--                    schema_version=1) — same shape as projects.style_spec.
--                    Application-layer enforced via Zod.
-- reference_assets : snapshot of source projects.reference_assets at publish
--                    time. Per-row shape (jsonb-enforced by app layer):
--                      [{url, sha256, uploaded_at, mime_type, size_bytes,
--                        original_filename}, ...]
--                    URLs reference the original creator's slide-references
--                    bucket paths; private-bucket access requires platform
--                    auth (the forker has it).
--
-- Threat model anchor: snapshot pattern preserves point-in-time integrity —
-- the original creator can later edit/delete their projects.style_spec
-- without retro-mutating any published or forked carousel (ownership
-- transfer mirrors v2.4 slide_data deep-copy pattern).
--
-- Verification (post-deploy):
--   -- Newly-published row carries the snapshot
--   SELECT style_spec, reference_assets FROM public.published_carousels
--    WHERE id = '<new-publish-id>';
--   -- Legacy published row (pre-v2.13) returns NULL for both
--   SELECT style_spec, reference_assets FROM public.published_carousels
--    WHERE published_at < '2026-05-10';

ALTER TABLE public.published_carousels
  ADD COLUMN IF NOT EXISTS style_spec       jsonb,
  ADD COLUMN IF NOT EXISTS reference_assets jsonb;

COMMENT ON COLUMN public.published_carousels.style_spec IS
  'Phase 78 REMIX-01: snapshot of source projects.style_spec at publish time. Point-in-time copy (not foreign-key) — preserves forker regenerate-from-references after original creator edits. NULL for legacy/non-style-from-reference rows.';

COMMENT ON COLUMN public.published_carousels.reference_assets IS
  'Phase 78 REMIX-01: snapshot of source projects.reference_assets at publish time. Same per-row shape as projects.reference_assets ({url, sha256, uploaded_at, mime_type, size_bytes, original_filename}). NULL when no references on source project.';
