-- ============================================================================
-- Migration 031: Per-sponsor seat limit
-- ============================================================================
-- Groundwork for sponsors outgrowing the flat Team-equivalent plan: each
-- sponsor gets their own seat limit (default 10 = the Team plan) instead of
-- a hardcoded cap. Raising a sponsor to Brokerage-style per-seat pricing is
-- then a one-line update with no code deploy:
--
--   UPDATE sponsors SET seat_limit = 15 WHERE display_email = '...';
--
-- Mirrors brokerages.seat_limit (migration 001).
-- Safe to re-run: ADD COLUMN IF NOT EXISTS.
-- ============================================================================

ALTER TABLE sponsors
  ADD COLUMN IF NOT EXISTS seat_limit INTEGER NOT NULL DEFAULT 10;
