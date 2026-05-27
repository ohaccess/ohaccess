-- ============================================================================
-- Migration 005: Teach the auth->profiles trigger about referral_source
-- ============================================================================
-- The existing handle_new_user() trigger creates a profiles row at the same
-- instant an auth.users row is inserted, which means our app-level code in
-- dashboard/page.tsx never gets a chance to apply referral_source.
--
-- This migration:
--   1. Replaces handle_new_user() with a version that also copies
--      referral_source from auth.users.raw_user_meta_data onto the new row.
--   2. Backfills any existing profiles whose auth user already has a
--      referral_source captured in metadata (e.g. test signups made during
--      the build-out of this feature).
--
-- Safe to re-run: CREATE OR REPLACE + idempotent UPDATE.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    referral_source,
    referral_source_first_seen_at
  )
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'referral_source',
    CASE
      WHEN new.raw_user_meta_data->>'referral_source' IS NOT NULL
      THEN now()
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;


-- Backfill existing rows whose auth user has referral_source in metadata
-- but whose profile row was created before this fix.
UPDATE profiles p
SET
  referral_source = u.raw_user_meta_data->>'referral_source',
  referral_source_first_seen_at = COALESCE(p.referral_source_first_seen_at, u.created_at)
FROM auth.users u
WHERE p.id = u.id
  AND p.referral_source IS NULL
  AND u.raw_user_meta_data->>'referral_source' IS NOT NULL;
