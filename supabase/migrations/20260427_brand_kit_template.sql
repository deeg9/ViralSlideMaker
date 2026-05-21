-- =====================================================================
-- SHELVED 2026-05-20 (Phase 89, BKSHELVE) — the brand-kit feature was
-- fully removed from the application code. This migration is intentionally
-- NOT rolled back: the brand_kits schema (and the columns added below) is
-- left DORMANT so a future revival can rewire against it without a new
-- migration. Do NOT add a down-migration; do NOT drop these columns.
-- No application code reads brand_kits as of Phase 89.
-- =====================================================================
--
-- 260427-bkt: Brand kit as a first-class template.
-- Adds 7 fields so the brand kit can fully describe a slide template:
--   heading_font_family, body_font_family — Canva-style font pairing
--   accent_color                          — two-color emphasis (NewsHeadline accents)
--   text_align, text_position             — layout lock-in
--   hook_style                            — uppercase / normal / italic
--   overlay_opacity_pct                   — image-readability overlay
--
-- Existing `font_family` is preserved for backward compat. New code reads
-- body_font_family / heading_font_family and falls back to font_family.

ALTER TABLE brand_kits
  ADD COLUMN heading_font_family text,
  ADD COLUMN body_font_family text,
  ADD COLUMN accent_color text,
  ADD COLUMN text_align text,
  ADD COLUMN text_position text,
  ADD COLUMN hook_style text,
  ADD COLUMN overlay_opacity_pct integer;

ALTER TABLE brand_kits
  ADD CONSTRAINT brand_kits_text_align_check
    CHECK (text_align IS NULL OR text_align IN ('left', 'center', 'right'));

ALTER TABLE brand_kits
  ADD CONSTRAINT brand_kits_text_position_check
    CHECK (text_position IS NULL OR text_position IN ('top', 'center', 'bottom'));

ALTER TABLE brand_kits
  ADD CONSTRAINT brand_kits_hook_style_check
    CHECK (hook_style IS NULL OR hook_style IN ('uppercase', 'normal', 'italic'));

ALTER TABLE brand_kits
  ADD CONSTRAINT brand_kits_overlay_opacity_pct_check
    CHECK (overlay_opacity_pct IS NULL OR overlay_opacity_pct BETWEEN 0 AND 100);

-- Backfill: existing font_family becomes body_font_family; heading copies from it.
UPDATE brand_kits
   SET body_font_family    = COALESCE(body_font_family, font_family),
       heading_font_family = COALESCE(heading_font_family, font_family)
 WHERE font_family IS NOT NULL;
