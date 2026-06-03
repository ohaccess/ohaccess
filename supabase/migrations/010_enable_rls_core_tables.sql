-- ============================================================================
-- Migration 010: Enable Row-Level Security on the core data tables
-- ============================================================================
-- WHY: Supabase flagged that some public tables had RLS disabled, meaning the
-- public (anon) API key could read/write every row — including secret open
-- house code words and visitor/agent PII. These tables were created before the
-- migrations existed, so they never had RLS turned on.
--
-- WHAT THIS DOES: enables RLS and adds owner-scoped policies so an authenticated
-- agent (using the public key + their login) can only touch their OWN rows.
-- The server (service-role key) BYPASSES RLS, so all API routes — visitor
-- registration, team management, the public /api/open-house display route,
-- Stripe webhooks — keep working unchanged.
--
-- Tables already secured by earlier migrations (brokerages, brokerage_invitations,
-- stripe_events, terms_acceptances) are left as-is.
--
-- Safe to re-run: ENABLE RLS is idempotent and every policy is dropped first.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PROFILES — an agent may read/insert/update only their own profile row.
-- (The public registration page no longer reads profiles with the anon key;
--  it goes through /api/open-house/[id], which uses the service role.)
-- ----------------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON profiles;
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_insert_own ON profiles;
CREATE POLICY profiles_insert_own ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());


-- ----------------------------------------------------------------------------
-- OPEN_HOUSES — an agent may do anything with their own open houses only.
-- The public registration page reads display fields via the service-role
-- /api/open-house route, so no anon read policy is needed here (and code_word
-- is therefore never exposed to the public key).
-- ----------------------------------------------------------------------------
ALTER TABLE open_houses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS open_houses_owner_all ON open_houses;
CREATE POLICY open_houses_owner_all ON open_houses
  FOR ALL
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());


-- ----------------------------------------------------------------------------
-- VISITORS — an agent may read/update/delete only the visitors tied to them.
-- Inserts happen server-side in /api/register (service role), which bypasses
-- RLS, so no anon insert policy is needed.
-- ----------------------------------------------------------------------------
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS visitors_owner_all ON visitors;
CREATE POLICY visitors_owner_all ON visitors
  FOR ALL
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());


-- ----------------------------------------------------------------------------
-- SHORT_URLS — only ever read/written by server routes (service role).
-- RLS on with no policies = no client/anon access at all.
-- ----------------------------------------------------------------------------
ALTER TABLE short_urls ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- RATE_LIMITS — server-only bookkeeping (service role). Lock out clients.
-- ----------------------------------------------------------------------------
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
