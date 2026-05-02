-- Phase 54 (D-06, TREAT-02): slide-backgrounds-treated public bucket for
-- server-side photo-treatment outputs. Per-user-folder RLS mirrors the
-- brand-kit-logos pattern (20260428_brand_kit_logos_bucket.sql).

INSERT INTO storage.buckets (id, name, public)
VALUES ('slide-backgrounds-treated', 'slide-backgrounds-treated', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Treated backgrounds are publicly accessible" ON storage.objects;
CREATE POLICY "Treated backgrounds are publicly accessible"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'slide-backgrounds-treated');

DROP POLICY IF EXISTS "Users can upload own treated backgrounds" ON storage.objects;
CREATE POLICY "Users can upload own treated backgrounds"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'slide-backgrounds-treated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own treated backgrounds" ON storage.objects;
CREATE POLICY "Users can update own treated backgrounds"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'slide-backgrounds-treated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own treated backgrounds" ON storage.objects;
CREATE POLICY "Users can delete own treated backgrounds"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'slide-backgrounds-treated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
