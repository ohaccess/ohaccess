-- ============================================================================
-- Migration 012: Per-visitor private notes
-- ============================================================================
-- Adds a free-text notes field on visitors so an agent can jot context
-- ("pre-approved, wants 3BR, serious") from the dashboard panel or the
-- mobile visitor page. Owner-only via the existing visitors RLS policy.
-- Safe to re-run.
-- ============================================================================

ALTER TABLE visitors ADD COLUMN IF NOT EXISTS notes TEXT;
