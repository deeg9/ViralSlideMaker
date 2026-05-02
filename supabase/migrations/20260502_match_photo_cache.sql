-- Phase 58 (MATCH-03, D-07): content-hash cache for premium photo↔slide matching.
-- Lighter-weight than Storage-as-cache: ~64 chars/key + JSON value, indexed on PK.
-- Server-only access via service role; no RLS needed.

CREATE TABLE IF NOT EXISTS public.match_photo_cache (
  photo_set_sha256 text NOT NULL,
  slide_manifest_sha256 text NOT NULL,
  result_jsonb jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (photo_set_sha256, slide_manifest_sha256)
);

ALTER TABLE public.match_photo_cache DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.match_photo_cache IS
  'Phase 58 (MATCH-03): premium-tier photo<->slide matching cache. SHA-256 keys; result_jsonb stores the (string|null)[] assignment array. Server-only via service role. 30-day TTL deferred to v3.0 maintenance task — cache is small and idempotent.';
