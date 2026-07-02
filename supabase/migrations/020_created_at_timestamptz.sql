-- ============================================================================
-- Migration 020: Convert remaining naive created_at columns to timestamptz
-- ============================================================================
-- Follow-up to migration 019. The pre-migration tables also had `created_at`
-- as `timestamp WITHOUT time zone`, so those dates (shown in the admin panel:
-- open-house created date, agent signup date) had the same UTC-vs-local bug as
-- registered_at — only visible when the UTC->local shift crosses midnight.
--
-- Same safe relabel: the stored values are UTC wall-clock, so `AT TIME ZONE
-- 'UTC'` reinterprets each as the UTC instant it already represented. No data
-- moved; no application code change needed.
--
-- Applied to production via Supabase Studio on 2026-07-02; this is the record.
-- ============================================================================

ALTER TABLE open_houses
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at AT TIME ZONE 'UTC';

ALTER TABLE profiles
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at AT TIME ZONE 'UTC';
