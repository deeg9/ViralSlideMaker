-- Phase 74 (REF-01, Plan 02): slide-references PRIVATE bucket + per-user folder RLS.
-- Mirrors brand-kit-logos pattern (20260428_brand_kit_logos_bucket.sql) BUT with
-- public=false (signed URLs only — references are uploaded by users for their own
-- vision-extraction; we have no use case for public reads).
--
-- Bucket name: 'slide-references' — matches existing 'slide-*' prefix family per
-- CONTEXT.md decision + ROADMAP locked decision #3. (Architecture research suggested
-- 'reference-images'; CONTEXT.md re-decided 'slide-references' for prefix consistency.)
--
-- Per-user folder structure: {user_id}/{ref_id}.{ext} — per CONTEXT.md decision.
-- Phase 75's vision-extraction call reads via signed URLs (createSignedUrl with TTL),
-- NOT via direct public URLs, so the bucket can stay private indefinitely.

INSERT INTO storage.buckets (id, name, public)
VALUES ('slide-references', 'slide-references', false)
ON CONFLICT (id) DO NOTHING;

-- Per-user folder RLS — authenticated user CAN read/write/delete only objects
-- whose first folder segment === auth.uid()::text.

DROP POLICY IF EXISTS "Users can read own slide references" ON storage.objects;
CREATE POLICY "Users can read own slide references"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'slide-references'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can upload own slide references" ON storage.objects;
CREATE POLICY "Users can upload own slide references"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'slide-references'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own slide references" ON storage.objects;
CREATE POLICY "Users can update own slide references"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'slide-references'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own slide references" ON storage.objects;
CREATE POLICY "Users can delete own slide references"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'slide-references'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- NO public-read policy — bucket is private. Phase 75 reads via service-role admin
-- client OR via signed URLs minted from the upload route. NO retention cron in v2.13
-- per CONTEXT.md deferred ideas (storage cost negligible pre-PMF).
