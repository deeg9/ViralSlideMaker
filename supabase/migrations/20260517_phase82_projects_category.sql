-- Phase 82 (R1): persist the content category on the project row so
-- Regenerate and Remix reuse the same category. Nullable — pre-Phase-82
-- rows keep category NULL (back-compat; generation code treats a NULL
-- category as the default category, 'news').
ALTER TABLE projects ADD COLUMN IF NOT EXISTS category text;
