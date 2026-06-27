-- ============================================================================
-- Migration 017: Per-agent CRM lead-email (universal email-parse integration)
-- ============================================================================
-- Every major real estate CRM (Follow Up Boss, BoldTrail/kvCORE, Lofty, Sierra,
-- Real Geeks, etc.) issues each user a unique "send leads here" intake address
-- and auto-files any lead-formatted email sent to it. When a visitor registers,
-- the server emails a labeled lead notification (plus Lead Metadata Spec meta
-- tags, leadmetadata.org) to this address so the signup lands in the agent's CRM
-- automatically — no per-CRM API build required.
--
--   crm_lead_email — the agent's CRM intake address (validated as an email in code)
--   crm_type       — which CRM it is (for tailored setup help + native-build demand
--                    signal); free-text, e.g. 'follow_up_boss', 'boldtrail', 'other'
--
-- Owner-only via the existing profiles RLS. Safe to re-run.
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS crm_lead_email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS crm_type TEXT;
