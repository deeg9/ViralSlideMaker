-- quick-260515-io9: bump style_spec_cache.model column DEFAULT from
-- 'gemini-2.5-flash' (sunsets 2026-10-16) to 'gemini-3.1-flash-lite'.
--
-- New extraction cache writes that omit the model arg now record the new
-- default. EXISTING rows are deliberately NOT backfilled — each row
-- correctly reflects the model it was extracted with (the column is
-- provenance metadata, not a cache-key partition; lookupStyleSpec does
-- not filter by model). Fully reversible: re-run with the old default.
--
-- Does NOT edit the already-applied 20260510_style_spec_cache.sql.

ALTER TABLE public.style_spec_cache
  ALTER COLUMN model SET DEFAULT 'gemini-3.1-flash-lite';
