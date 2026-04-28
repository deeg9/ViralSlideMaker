-- Quick task 260428-fix: provision the brand-kit-logos storage bucket.
-- The v2.5 phase-39 work introduced POST /api/v1/me/brand-kit/logo-upload-url
-- which calls createSignedUploadUrl on the 'brand-kit-logos' bucket, but the
-- bucket was never provisioned. Smoke test surfaced HTTP 500 with
-- "The related resource does not exist".
--
-- Mirrors the per-user-folder RLS pattern used by hero-thumbnails
-- (supabase/migrations/20260427_explore_remix_phase29.sql).

INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-kit-logos', 'brand-kit-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Brand kit logos are publicly accessible" ON storage.objects;
CREATE POLICY "Brand kit logos are publicly accessible"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'brand-kit-logos');

DROP POLICY IF EXISTS "Users can upload own brand kit logos" ON storage.objects;
CREATE POLICY "Users can upload own brand kit logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'brand-kit-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own brand kit logos" ON storage.objects;
CREATE POLICY "Users can update own brand kit logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'brand-kit-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own brand kit logos" ON storage.objects;
CREATE POLICY "Users can delete own brand kit logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'brand-kit-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
