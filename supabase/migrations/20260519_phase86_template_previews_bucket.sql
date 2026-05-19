-- Phase 86 (ADMIN-02): template-previews public storage bucket for
-- admin-authored template cover-snapshot PNGs. Additive + reversible —
-- creates one new public bucket, touches nothing else. No existing bucket and
-- no existing table change; no carousel and no code template changes how it
-- renders.
--
-- Writes go through the service-role admin client only (deny-by-default — no
-- authenticated INSERT/UPDATE/DELETE policy), mirroring the public.templates
-- Phase 83 write posture: the service role bypasses RLS, and the Phase 86
-- save endpoint performs the app-level admin role check (requireAdmin).
--
-- Reversal:
--   DROP POLICY IF EXISTS "Template previews are publicly accessible" ON storage.objects;
--   DELETE FROM storage.buckets WHERE id = 'template-previews';

INSERT INTO storage.buckets (id, name, public)
VALUES ('template-previews', 'template-previews', true)
ON CONFLICT (id) DO NOTHING;

-- Public read — the picker renders these PNGs for every user.
DROP POLICY IF EXISTS "Template previews are publicly accessible" ON storage.objects;
CREATE POLICY "Template previews are publicly accessible"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'template-previews');

-- NO INSERT/UPDATE/DELETE policy by design — deny-by-default writes. Template
-- previews are uploaded ONLY by the service-role admin client in the
-- Save-as-Template save endpoint (src/app/api/admin/templates/route.ts), which
-- bypasses RLS after the app-level admin gate.
