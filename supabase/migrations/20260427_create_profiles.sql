-- 260427-nxd: Add public.profiles table + claim_username RPC + avatars bucket.
-- Moves the profile model out of auth.users.user_metadata into a publicly-readable
-- public.profiles table keyed on auth.users(id). Powers a future Explore page where
-- users share/copy templates under a stable, URL-safe identity.
--
-- This migration ships:
--   1. citext extension (case-insensitive uniqueness on usernames)
--   2. public.profiles table with CHECK constraints on username format
--   3. RLS: public SELECT, owner-only INSERT/UPDATE
--   4. handle_new_user trigger — auto-creates a profile row on auth.users insert
--   5. claim_username(p_username citext) RPC — race-safe atomic username claim
--   6. avatars storage bucket + per-user-folder RLS (stricter than slide-backgrounds)
--   7. one-time backfill: populate profiles for any pre-existing auth.users rows

CREATE EXTENSION IF NOT EXISTS citext;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. profiles table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username        citext UNIQUE,
  display_name    text,
  bio             text,
  avatar_url      text,
  website_url     text,
  social_links    jsonb NOT NULL DEFAULT '{}'::jsonb,
  template_count  integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_bio_length
    CHECK (bio IS NULL OR char_length(bio) <= 280),
  CONSTRAINT profiles_username_length
    CHECK (username IS NULL OR char_length(username::text) BETWEEN 3 AND 24),
  CONSTRAINT profiles_username_format
    CHECK (username IS NULL OR username::text ~ '^[a-z0-9_.]+$'),
  CONSTRAINT profiles_username_no_consecutive_punct
    CHECK (username IS NULL OR username::text !~ '[._]{2,}'),
  CONSTRAINT profiles_username_no_edge_punct
    CHECK (username IS NULL OR username::text ~ '^[a-z0-9].*[a-z0-9]$')
);

CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles(username);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. handle_new_user trigger — auto-create profile on signup
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  derived_display_name text;
BEGIN
  derived_display_name := COALESCE(
    NULLIF(new.raw_user_meta_data->>'full_name', ''),
    NULLIF(new.raw_user_meta_data->>'name', ''),
    NULLIF(
      btrim(concat_ws(' ',
        new.raw_user_meta_data->>'first_name',
        new.raw_user_meta_data->>'last_name'
      )),
      ''
    )
  );

  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    new.id,
    derived_display_name,
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. claim_username RPC — race-safe atomic claim
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.claim_username(p_username citext)
RETURNS TABLE (ok boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN QUERY SELECT false, 'unauthenticated';
    RETURN;
  END IF;

  IF p_username IS NULL
     OR p_username::text !~ '^[a-z0-9_.]{3,24}$'
     OR p_username::text ~ '[._]{2,}'
     OR p_username::text !~ '^[a-z0-9].*[a-z0-9]$' THEN
    RETURN QUERY SELECT false, 'invalid_format';
    RETURN;
  END IF;

  BEGIN
    UPDATE public.profiles
       SET username   = p_username,
           updated_at = now()
     WHERE id = uid;

    IF NOT FOUND THEN
      INSERT INTO public.profiles (id, username)
      VALUES (uid, p_username);
    END IF;

    RETURN QUERY SELECT true, NULL::text;
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT false, 'taken';
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_username(citext) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. avatars storage bucket + per-user-folder RLS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. One-time backfill — create profiles for existing auth.users
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.profiles (id, display_name, avatar_url)
SELECT
  u.id,
  NULLIF(
    btrim(concat_ws(' ',
      u.raw_user_meta_data->>'first_name',
      u.raw_user_meta_data->>'last_name'
    )),
    ''
  ),
  u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- updated_at auto-update trigger
CREATE OR REPLACE FUNCTION public.profiles_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.profiles_set_updated_at();
