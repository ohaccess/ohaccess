-- ============================================================================
-- Migration 004: Referral source attribution on profiles
-- ============================================================================
-- What this does:
--   1. Adds `referral_source` (text, nullable) to profiles — captured from the
--      `?ref=` query param on first touch and persisted via a 30-day cookie.
--   2. Adds `referral_source_first_seen_at` (timestamptz, nullable) so we can
--      see when each agent first hit a tracked link.
--   3. Adds an index on referral_source for the /admin/sources report.
--
-- First-touch attribution: application code is responsible for never
-- overwriting an existing referral_source. The DB does not enforce this so
-- backfills/corrections from the admin remain possible.
--
-- Safe to re-run: every ALTER/CREATE uses IF NOT EXISTS.
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_source TEXT;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_source_first_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS profiles_referral_source_idx
  ON profiles(referral_source)
  WHERE referral_source IS NOT NULL;
