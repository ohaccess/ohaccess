-- ============================================================================
-- Migration 002: Stripe billing columns on profiles + webhook idempotency table
-- ============================================================================
-- What this does:
--   1. Adds Stripe subscription state columns to `profiles` for individual
--      (Pro tier) subscribers. Brokerage-level Stripe state already lives on
--      the `brokerages` table from migration 001.
--   2. Creates a `stripe_events` table used by the webhook handler to make
--      event processing idempotent (Stripe may deliver the same event twice).
--
-- Safe to re-run: every ADD COLUMN / CREATE uses IF NOT EXISTS.
-- Existing rows get NULL for the new columns; tier already defaults to 'free'.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. PROFILES: Stripe subscription state
-- ----------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id        TEXT;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_subscription_id    TEXT;

-- 'active' | 'trialing' | 'canceled' | 'past_due' | 'incomplete' | 'unpaid'
-- For 2-year prepay (one-time payment) we set 'active' manually until
-- current_period_end.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_status       TEXT;

-- 'month' | 'year' | 'two_year_prepay'
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS billing_interval          TEXT;

-- For subscriptions: end of current paid period (renews on this date).
-- For 2-year prepay: NOW() + 2 years from purchase, then access drops.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS current_period_end        TIMESTAMPTZ;

-- Set when user clicks Cancel; they retain access until current_period_end.
-- Webhook also sets this when Stripe reports cancellation.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_canceled_at  TIMESTAMPTZ;

-- One Stripe customer can only map to one profile; enforce uniqueness so
-- webhook lookups by customer ID are unambiguous. Partial index so multiple
-- NULLs are allowed (free-tier users have no Stripe customer yet).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_stripe_customer_id_uniq
  ON profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;


-- ----------------------------------------------------------------------------
-- 2. STRIPE_EVENTS: webhook idempotency
-- ----------------------------------------------------------------------------
-- Stripe guarantees at-least-once delivery, so the same event may arrive
-- multiple times. We record every event ID we've processed and ignore
-- duplicates. Service-role only — no RLS policies, no client access.
CREATE TABLE IF NOT EXISTS stripe_events (
  id            TEXT PRIMARY KEY,            -- Stripe event ID (evt_...)
  type          TEXT NOT NULL,               -- e.g. 'checkout.session.completed'
  payload       JSONB NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stripe_events_type_idx
  ON stripe_events (type);

ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role can read/write.
