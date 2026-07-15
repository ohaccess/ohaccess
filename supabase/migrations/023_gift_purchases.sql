-- ============================================================================
-- Migration 023: Gift purchases (1-year Pro gifts)
-- ============================================================================
-- WHY: anyone — no account needed — can buy a real estate agent 1 year of
-- ohACCESS Pro ("Know a real estate agent?" on the pricing page). The Stripe
-- webhook mints one row per completed gift checkout; the recipient redeems
-- the code at /gift/claim, which stamps claimed_by/claimed_at.
--
-- One product only: 12 months of Pro as a ONE-TIME payment (never a
-- subscription). Claiming reuses the comp shape from migration 021's notes
-- (billing_interval='comped') for agents without a Stripe subscription, or
-- pushes the next invoice out a year for agents who already subscribe.
--
-- Safe to re-run: uses IF NOT EXISTS.
-- ============================================================================

CREATE TABLE IF NOT EXISTS gift_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Canonical claim code, GIFT-XXXX-XXXX (lookalike-free alphabet).
  code TEXT NOT NULL UNIQUE,
  -- The Stripe Checkout session that paid for this gift. UNIQUE so a webhook
  -- replay can never mint a second code for the same payment.
  stripe_session_id TEXT NOT NULL UNIQUE,
  amount_cents INTEGER,
  currency TEXT,
  giver_name TEXT,
  giver_email TEXT,
  recipient_name TEXT,
  recipient_email TEXT,
  gift_note TEXT,
  months INTEGER NOT NULL DEFAULT 12,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ
);

ALTER TABLE gift_purchases ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role can read/write.
