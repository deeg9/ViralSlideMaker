-- Phase 73 (COST-03, Plan 02): style_spec_cache — vision-extraction cache for
-- Phase 75's StyleSpec extraction. Keyed by SHA-256 hex of the preprocessed
-- image bytes (Phase 73 Plan 01's prepareForVision output), so hits only
-- occur on bit-identical preprocessed input. Cache hit returns the persisted
-- StyleSpec at $0 cost (no Gemini Vision call, no credit charge).
--
-- Mirrors v2.6 match_photo_cache (20260502_match_photo_cache.sql):
--   - SHA-256 PK + jsonb result column
--   - RLS DISABLED (server-only access via service role; cache key is
--     content-derived, not user-derived, so no user-facing RLS needed)
--
-- last_hit_at is updated on each lookup hit (fire-and-forget) so a future
-- LRU eviction strategy can be added without backfill — per CONTEXT.md
-- "load-bearing for future LRU eviction without backfill" decision.
--
-- TTL / eviction is explicitly NOT shipped in v2.13 (CONTEXT.md: "recommend
-- forever with manual purge endpoint; revisit after launch telemetry").

CREATE TABLE IF NOT EXISTS public.style_spec_cache (
  sha256 text NOT NULL PRIMARY KEY,
  style_spec jsonb NOT NULL,
  model text NOT NULL DEFAULT 'gemini-2.5-flash',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_hit_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.style_spec_cache DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.style_spec_cache IS
  'Phase 73 (COST-03): vision-extraction StyleSpec cache. Key is SHA-256 of preprocessed image bytes (Phase 73 Plan 01 prepareForVision output). Server-only via service role. last_hit_at updated on lookup hit so future LRU eviction has the data without backfill. Mirrors v2.6 match_photo_cache (20260502).';
