-- Phase 80 (R5): purge style_spec_cache rows holding the v1 schema_version.
--
-- Phase 80 bumps STYLE_SPEC_VERSION from 1 to 2 (Plan 80-01). The cached
-- StyleSpec shape changed (added slideArchetype + per-archetype slot params);
-- the Phase B validator (Plan 80-02) rejects v1 payloads with ok:false, so
-- any cached v1 row, if returned by lookupStyleSpec, would fail validation
-- downstream (Phase 75 orchestrator) and the user would see a confusing
-- extraction error.
--
-- Per CONTEXT.md (Verification, Fixtures, and Migration Mechanics):
--   - Cache is small + pre-PMF; purge-and-repopulate beats reclassification.
--   - Runs via `supabase db push` (standard repo pattern; no app coordination).
--   - Brief cache-miss window post-deploy is acceptable; next extraction
--     repopulates the row at v2.
--
-- Mirrors v2.6 match_photo_cache (20260502_match_photo_cache.sql) cache
-- discipline: PK = content sha256, RLS disabled (server-only), purges are
-- safe because the data is reproducible.
--
-- Idempotent: running the migration twice yields the same final state.
-- The DELETE matches:
--   1. rows where style_spec is missing schema_version (NULL coerces via the
--      IS NULL branch and is also dropped)
--   2. rows where style_spec.schema_version is anything other than 2
-- Both classes are unusable at v2 and must go.

DELETE FROM public.style_spec_cache
WHERE (style_spec->>'schema_version')::int IS DISTINCT FROM 2
   OR style_spec->>'schema_version' IS NULL;

-- Sanity COMMENT for ops: confirm post-deploy that the table holds only v2 rows:
--   SELECT COUNT(*) FROM public.style_spec_cache
--     WHERE (style_spec->>'schema_version')::int IS DISTINCT FROM 2;
-- Expected: 0.

COMMENT ON TABLE public.style_spec_cache IS
  'Phase 73 (COST-03): vision-extraction StyleSpec cache. Key is SHA-256 of preprocessed image bytes (Phase 73 Plan 01 prepareForVision output). Server-only via service role. last_hit_at updated on lookup hit so future LRU eviction has the data without backfill. Phase 80 (R5): purge migration ran 2026-05-14 — only schema_version=2 rows now permitted; lookupStyleSpec adds defensive filter.';
