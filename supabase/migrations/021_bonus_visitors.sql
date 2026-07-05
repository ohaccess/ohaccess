-- ============================================================================
-- Migration 021: Bonus trial visitors (admin gifts / referral thank-yous)
-- ============================================================================
-- Adds `bonus_visitors` to profiles: extra registrations the admin has gifted
-- on top of the standard 25-visitor free trial. The agent's effective cap is
-- 25 + bonus_visitors (enforced in /api/register and mirrored in the
-- dashboard). Only meaningful while the agent is on the free tier.
--
-- The companion "comp Pro until a date" gift needs NO schema change — it
-- reuses tier/subscription_status/current_period_end with
-- billing_interval='comped' (no Stripe ids), mirroring the legacy 2-year
-- prepay shape.
--
-- Safe to re-run: uses IF NOT EXISTS.
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bonus_visitors INTEGER NOT NULL DEFAULT 0;
