-- ============================================================================
-- Migration 018: Team/brokerage-level CRM forwarding
-- ============================================================================
-- Per-agent CRM intake already exists (migration 017, profiles.crm_lead_email):
-- a sign-in is emailed to the open-house-owning agent's CRM. This adds an
-- OPTIONAL brokerage-level intake so a team lead / brokerage can also receive
-- every sign-in from any of their members' open houses in the team CRM.
--
--   crm_lead_email            — the team/brokerage CRM intake address
--                               (validated as an email in code)
--   crm_forward_member_leads  — master on/off switch; when true, each member
--                               open-house sign-in is ALSO sent to the address
--                               above (in addition to the agent's own CRM).
--                               Defaults to false — opt-in per brokerage.
--
-- Admin-only via the existing team-settings API (PATCH is gated to the team
-- lead). Safe to re-run.
-- ============================================================================

ALTER TABLE brokerages ADD COLUMN IF NOT EXISTS crm_lead_email TEXT;
ALTER TABLE brokerages ADD COLUMN IF NOT EXISTS crm_forward_member_leads BOOLEAN NOT NULL DEFAULT false;
