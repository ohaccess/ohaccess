-- ============================================================================
-- Migration 028: Sponsors (3rd-party providers co-branding agent accounts)
-- ============================================================================
-- What this does:
--   1. Creates a `sponsors` table — one row per sponsor account (e.g. a
--      mortgage lender). Owned by an auth user, mirrors the agent profile's
--      branding fields (headshot/logo are pasted URLs, same as profiles).
--   2. Creates `sponsor_invitations` — a sponsor invites agents by email;
--      the agent explicitly accepts (nothing shows on their open houses
--      until they do).
--   3. Adds `profiles.sponsor_id` — the active sponsorship link. One sponsor
--      per agent; NULL = not sponsored.
--   4. Adds `visitors.sponsor_id` + `visitors.sponsor_name` — the consent
--      audit trail: which sponsor was disclosed on the sign-in form this
--      visitor submitted. sponsor_name is a point-in-time snapshot so the
--      record survives later edits/deletes of the sponsor row.
--   5. Row Level Security to match the rest of the schema.
--
-- Safe to re-run: every CREATE/ALTER uses IF NOT EXISTS / OR REPLACE.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. SPONSORS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sponsors (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One sponsor account per auth user. CASCADE: deleting the auth user
  -- removes the sponsor row (links below are SET NULL, snapshots survive).
  owner_id       UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Public-facing card fields (all shown in the visitor email)
  full_name      TEXT,
  company        TEXT,
  display_email  TEXT,
  phone          TEXT,
  license_number TEXT,          -- e.g. "NMLS #123456"
  headshot_url   TEXT,          -- pasted direct image URL (profiles pattern)
  logo_url       TEXT,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reuses set_updated_at() from migration 001.
DROP TRIGGER IF EXISTS sponsors_updated_at ON sponsors;
CREATE TRIGGER sponsors_updated_at
  BEFORE UPDATE ON sponsors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ----------------------------------------------------------------------------
-- 2. SPONSOR INVITATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sponsor_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id  UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  token       TEXT NOT NULL UNIQUE,
  invited_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sponsor_invitations_sponsor_idx
  ON sponsor_invitations (sponsor_id);
CREATE INDEX IF NOT EXISTS sponsor_invitations_email_idx
  ON sponsor_invitations (lower(email));


-- ----------------------------------------------------------------------------
-- 3. PROFILES: active sponsorship link
-- ----------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sponsor_id UUID
    REFERENCES sponsors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_sponsor_id_idx ON profiles(sponsor_id);


-- ----------------------------------------------------------------------------
-- 4. VISITORS: which sponsor was disclosed at sign-in (consent audit)
-- ----------------------------------------------------------------------------
ALTER TABLE visitors
  ADD COLUMN IF NOT EXISTS sponsor_id UUID
    REFERENCES sponsors(id) ON DELETE SET NULL;

ALTER TABLE visitors
  ADD COLUMN IF NOT EXISTS sponsor_name TEXT;


-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
ALTER TABLE sponsors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_invitations ENABLE ROW LEVEL SECURITY;

-- A sponsor manages their own row from the browser (profiles pattern).
DROP POLICY IF EXISTS sponsors_select_own ON sponsors;
CREATE POLICY sponsors_select_own ON sponsors
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS sponsors_insert_own ON sponsors;
CREATE POLICY sponsors_insert_own ON sponsors
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS sponsors_update_own ON sponsors;
CREATE POLICY sponsors_update_own ON sponsors
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- A sponsored agent can read (only) their own sponsor's card — the Settings
-- tab shows "Sponsored by …". Visitors never read this table directly; the
-- registration page gets sponsor display fields via the service-role
-- /api/open-house route.
DROP POLICY IF EXISTS sponsors_select_for_sponsored_agents ON sponsors;
CREATE POLICY sponsors_select_for_sponsored_agents ON sponsors
  FOR SELECT
  USING (
    id IN (SELECT sponsor_id FROM profiles WHERE id = auth.uid())
  );

-- Invitations: no client access. Service-role API routes only.
-- (RLS enabled with no policies = only service_role can read/write.)
