-- ============================================================================
-- Migration 003: Terms acceptance audit trail
-- ============================================================================
-- What this does:
--   Creates a `terms_acceptances` table that records every signup-form
--   agreement to the Subscriber Terms + Privacy Policy. Captures the email,
--   the versions agreed to, the timestamp, the IP, and the user-agent header.
--   This is the evidence trail that proves a particular subscriber agreed
--   to a particular version of the docs, which is what wins a disputed
--   click-through challenge.
--
--   The table is keyed by email rather than profile_id because the signup
--   form is submitted before the profile (and the underlying auth.users
--   row, until email confirmation) exists.
--
-- Safe to re-run: every CREATE uses IF NOT EXISTS.
-- ============================================================================

CREATE TABLE IF NOT EXISTS terms_acceptances (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                       TEXT NOT NULL,
  subscriber_terms_version    TEXT NOT NULL,
  privacy_policy_version      TEXT NOT NULL,
  accepted_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address                  TEXT,
  user_agent                  TEXT
);

CREATE INDEX IF NOT EXISTS terms_acceptances_email_idx
  ON terms_acceptances (lower(email));

CREATE INDEX IF NOT EXISTS terms_acceptances_accepted_at_idx
  ON terms_acceptances (accepted_at);

-- Service-role only: no policies, RLS enabled.
ALTER TABLE terms_acceptances ENABLE ROW LEVEL SECURITY;
