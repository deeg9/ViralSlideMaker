-- Storage bucket for slide background images (AI-generated and user uploads)
INSERT INTO storage.buckets (id, name, public)
VALUES ('slide-backgrounds', 'slide-backgrounds', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload slide backgrounds"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'slide-backgrounds');

-- Allow public read access (images need to be viewable in slides)
CREATE POLICY "Public read access for slide backgrounds"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'slide-backgrounds');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Users can delete own slide backgrounds"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'slide-backgrounds' AND (storage.foldername(name))[1] = auth.uid()::text);
