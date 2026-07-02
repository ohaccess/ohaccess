-- ============================================================================
-- Migration 019: Fix visitor sign-in time (registered_at) showing in UTC
-- ============================================================================
-- BUG: The visitor log showed sign-in times ~5 hours ahead of local (i.e. in
-- UTC). Root cause: `visitors.registered_at` is `timestamp WITHOUT time zone`.
-- The app writes the correct UTC instant (new Date().toISOString()), but a
-- naive column hands the value back with NO timezone marker
-- ("2026-07-02T22:45:33" instead of "...Z"). The browser then parses a
-- marker-less timestamp as LOCAL time, so a 22:45 UTC sign-in renders as
-- "22:45 local" — 5 hours ahead in US Central.
--
-- FIX: Convert the column to `timestamptz`. The stored values ARE UTC
-- wall-clock, so `AT TIME ZONE 'UTC'` reinterprets each existing value as the
-- UTC instant it always represented — no data is shifted, only correctly
-- labeled. After this, PostgREST returns values with an offset and every
-- `new Date(...).toLocaleString()` in the app renders local time correctly
-- (dashboard visitor log, admin, CSV export, and the post-event report email).
-- No application code change is required.
--
-- SAFE: standard column-type change; the USING clause is a lossless relabel.
-- Idempotent-friendly: re-running is a no-op once the type is already timestamptz.
-- ============================================================================

ALTER TABLE visitors
  ALTER COLUMN registered_at TYPE timestamptz
  USING registered_at AT TIME ZONE 'UTC';
