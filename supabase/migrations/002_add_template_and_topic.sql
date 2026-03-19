ALTER TABLE projects ADD COLUMN IF NOT EXISTS template_id text DEFAULT 'bold-minimal';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS generation_status text DEFAULT 'draft';
