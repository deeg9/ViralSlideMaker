-- Brand kits table: one per user (v1)
CREATE TABLE brand_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'My Brand',
  primary_color text,
  secondary_color text,
  text_color text,
  background_color text,
  font_family text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE brand_kits ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own brand kit
CREATE POLICY "Users can view own brand kit"
  ON brand_kits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own brand kit"
  ON brand_kits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own brand kit"
  ON brand_kits FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own brand kit"
  ON brand_kits FOR DELETE
  USING (auth.uid() = user_id);
