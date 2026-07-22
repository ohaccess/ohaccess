-- ============================================================================
-- Migration 029: Sponsor landing page URL
-- ============================================================================
-- Mirrors profiles.landing_page_url for sponsors: a bio/website link the
-- sponsor sets in Settings, rendered as a tracked "Sponsor information"
-- short link in the visitor email's Sponsored-by card (same pattern as the
-- agent's "Agent information" link).
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS.
-- ============================================================================

ALTER TABLE sponsors
  ADD COLUMN IF NOT EXISTS landing_page_url TEXT;
