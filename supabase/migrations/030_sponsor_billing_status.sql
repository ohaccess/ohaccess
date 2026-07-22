-- ============================================================================
-- Migration 030: Sponsor billing status
-- ============================================================================
-- Sponsors pay the published Team-plan prices ($120/mo flat, up to 10
-- sponsored agents). While billing is collected manually (Stripe invoice
-- created by hand), this flag is what turns the paid benefits on:
-- agents sponsored by an ACTIVE sponsor get Pro-level access (no trial cap),
-- exactly like members of a paying team.
--
--   'unpaid' (default) — sponsorship co-branding works, but sponsored agents
--                        keep whatever plan/trial they already had.
--   'active'           — sponsor is paying; their accepted agents are covered.
--
-- Flipped manually (admin/SQL) for now; a Stripe webhook can own it once
-- sponsor self-serve billing is built.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS.
-- ============================================================================

ALTER TABLE sponsors
  ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'unpaid';
