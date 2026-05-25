-- ============================================================================
-- Migration 001: Brokerages, invitations, and profile/role linkage
-- ============================================================================
-- What this does:
--   1. Creates a `brokerages` table (one row per team/brokerage account)
--   2. Adds `brokerage_id` + `role` to `profiles` so agents can belong to a brokerage
--   3. Creates a `brokerage_invitations` table for pending CSV/email invites
--   4. Enables Row Level Security on the new tables
--
-- Safe to re-run: every CREATE/ALTER uses IF NOT EXISTS.
-- Existing single-agent profiles get brokerage_id = NULL, role = 'agent'.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. BROKERAGES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brokerages (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT NOT NULL,
  owner_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- Branding (overrides individual agent branding for members)
  logo_url               TEXT,
  primary_color          TEXT,
  accent_color           TEXT,

  -- Plan tier: 'team' (up to seat_limit agents) or 'brokerage' (custom)
  tier                   TEXT NOT NULL DEFAULT 'team'
                              CHECK (tier IN ('team', 'brokerage')),
  seat_limit             INTEGER NOT NULL DEFAULT 10,

  -- Stripe (filled in once Stripe is wired up; nullable for now)
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  subscription_status    TEXT,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep updated_at fresh on every UPDATE
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS brokerages_updated_at ON brokerages;
CREATE TRIGGER brokerages_updated_at
  BEFORE UPDATE ON brokerages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ----------------------------------------------------------------------------
-- 2. PROFILES: link to brokerage + role
-- ----------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS brokerage_id UUID
    REFERENCES brokerages(id) ON DELETE SET NULL;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'agent'
    CHECK (role IN ('agent', 'brokerage_admin'));

CREATE INDEX IF NOT EXISTS profiles_brokerage_id_idx ON profiles(brokerage_id);


-- ----------------------------------------------------------------------------
-- 3. BROKERAGE INVITATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brokerage_invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id  UUID NOT NULL REFERENCES brokerages(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'agent'
                     CHECK (role IN ('agent', 'brokerage_admin')),
  token         TEXT NOT NULL UNIQUE,
  invited_by    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ NOT NULL,
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS brokerage_invitations_brokerage_idx
  ON brokerage_invitations (brokerage_id);
CREATE INDEX IF NOT EXISTS brokerage_invitations_email_idx
  ON brokerage_invitations (lower(email));


-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
ALTER TABLE brokerages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokerage_invitations   ENABLE ROW LEVEL SECURITY;

-- Members can read their brokerage
DROP POLICY IF EXISTS brokerages_select_for_members ON brokerages;
CREATE POLICY brokerages_select_for_members ON brokerages
  FOR SELECT
  USING (
    id IN (SELECT brokerage_id FROM profiles WHERE id = auth.uid())
  );

-- Only brokerage admins can update brokerage settings
DROP POLICY IF EXISTS brokerages_update_for_admins ON brokerages;
CREATE POLICY brokerages_update_for_admins ON brokerages
  FOR UPDATE
  USING (
    id IN (
      SELECT brokerage_id FROM profiles
      WHERE id = auth.uid() AND role = 'brokerage_admin'
    )
  );

-- Invitations: no client access. Service-role API routes only.
-- (RLS enabled with no policies = only service_role can read/write.)
