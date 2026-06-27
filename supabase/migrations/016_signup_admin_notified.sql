-- ============================================================================
-- Migration 016: One-time "new account" admin-notification flag
-- ============================================================================
-- We email the ohACCESS team the first time a new account becomes active.
-- This column lets the notification fire exactly once per account: the API
-- route claims it with a conditional UPDATE (... WHERE signup_admin_notified_at
-- IS NULL), so concurrent or repeated calls can never send a second email.
--
-- Existing rows are backfilled to now() so we don't blast the team with one
-- email per pre-existing account the first time they each load the dashboard.
--
-- Safe to re-run.
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS signup_admin_notified_at timestamptz;

-- Treat every account that exists today as "already announced".
UPDATE profiles
  SET signup_admin_notified_at = now()
  WHERE signup_admin_notified_at IS NULL;
