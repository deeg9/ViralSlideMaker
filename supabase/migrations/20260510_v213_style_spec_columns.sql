-- Phase 74 (STYLESPEC-02, REF-07, Plan 02): projects.style_spec + reference_assets
-- columns. Both nullable + additive — legacy v2.12 projects (where both are NULL)
-- continue to render byte-identical (Plan 04 PTF baseline test verifies this).
--
-- style_spec     : validated StyleSpec object (src/lib/types/style-spec.ts) populated by
--                  Phase 75 extraction; consumed by Phase 77 emit; never read by either
--                  renderer (TPLREND-05 byte-identity preserved by construction).
--                  Shape per src/lib/types/style-spec.ts (Plan 01) — schema_version=1
--                  + palette / typography / layout / imagery / decorations / rhythm /
--                  voice_note. Column type is jsonb so the application layer enforces
--                  shape via Zod (src/lib/validators/style-spec.ts).
--
-- reference_assets : provenance rows persisted on upload completion (Plan 03).
--                  Per-row shape (jsonb-enforced by app layer, not by schema):
--                    [
--                      {
--                        "url": "<supabase storage signed URL or path>",
--                        "sha256": "<hex sha-256 of preprocessed bytes>",
--                        "uploaded_at": "<ISO8601 timestamp>",
--                        "mime_type": "image/png" | "image/jpeg" | "image/webp" | "image/heic",
--                        "size_bytes": <integer, ≤ 20_000_000>,
--                        "original_filename": "<sanitized utf-8>"
--                      },
--                      ...
--                    ]
--                  Per CONTEXT.md Claude's-discretion: include mime_type / size_bytes /
--                  original_filename for richer provenance (cheap forensics insurance).
--                  Per REF-06: rows are written on UPLOAD completion, not on extraction
--                  trigger — so provenance is preserved even if the user abandons before
--                  generating.
--
-- Both columns: NO backfill (additive nullable; same pattern as v2.12 decorations
-- column at Phase 67 Plan 01).

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS style_spec       jsonb,
  ADD COLUMN IF NOT EXISTS reference_assets jsonb;

COMMENT ON COLUMN public.projects.style_spec IS
  'Phase 74 STYLESPEC-02: validated StyleSpec (src/lib/types/style-spec.ts, schema_version=1) populated by Phase 75 extraction; consumed by Phase 77 emit. NULL on legacy projects — TPLREND-05 byte-identity preserved by Plan 04 PTF baseline.';

COMMENT ON COLUMN public.projects.reference_assets IS
  'Phase 74 REF-07: provenance array — [{url, sha256, uploaded_at, mime_type, size_bytes, original_filename}, ...]. Written on upload completion (Plan 03), not on extraction trigger (REF-06). Shape enforced by application layer (Plan 03 server action).';

-- Optional: index that enables fast filter "show me my style-from-reference projects"
-- (e.g. for EDITOR-02 "From references" badge in Phase 77). Partial index only — keeps
-- the index small (only rows where style_spec is set). Same pattern as research
-- ARCHITECTURE.md §Q2 storage shape.
CREATE INDEX IF NOT EXISTS projects_has_style_spec_idx
  ON public.projects ((style_spec IS NOT NULL))
  WHERE style_spec IS NOT NULL;
