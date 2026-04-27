-- 260427-hut: Brand logo watermark settings on brand_kits.
ALTER TABLE brand_kits
  ADD COLUMN IF NOT EXISTS logo_position text,
  ADD COLUMN IF NOT EXISTS logo_size_pct integer,
  ADD COLUMN IF NOT EXISTS logo_opacity_pct integer;

ALTER TABLE brand_kits
  ADD CONSTRAINT brand_kits_logo_position_check
  CHECK (logo_position IS NULL OR logo_position IN (
    'top-left','top-center','top-right',
    'middle-left','middle-center','middle-right',
    'bottom-left','bottom-center','bottom-right'
  ));

ALTER TABLE brand_kits
  ADD CONSTRAINT brand_kits_logo_size_pct_check
  CHECK (logo_size_pct IS NULL OR (logo_size_pct BETWEEN 4 AND 20));

ALTER TABLE brand_kits
  ADD CONSTRAINT brand_kits_logo_opacity_pct_check
  CHECK (logo_opacity_pct IS NULL OR (logo_opacity_pct BETWEEN 10 AND 100));
