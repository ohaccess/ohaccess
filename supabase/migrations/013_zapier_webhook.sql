-- ============================================================================
-- Migration 013: Per-agent Zapier (CRM) webhook URL
-- ============================================================================
-- Stores the agent's "Catch Hook" URL from Zapier. When a visitor registers,
-- the server POSTs the visitor data to this URL so Zapier can route it into
-- the agent's CRM. Only https://hooks.zapier.com/ URLs are ever called
-- (validated in code) to avoid SSRF. Owner-only via the existing profiles RLS.
-- Safe to re-run.
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zapier_webhook_url TEXT;
