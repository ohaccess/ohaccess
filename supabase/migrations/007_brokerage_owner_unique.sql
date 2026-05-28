-- ============================================================================
-- Migration 007: One brokerage per owner
-- ============================================================================
-- The Stripe webhook can attempt to provision a Team brokerage from two
-- different events (checkout.session.completed and customer.subscription.created).
-- Our app-layer check is idempotent, but a unique index closes the small
-- concurrent-insert race so an owner can never end up with two brokerages.
--
-- Safe to re-run.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS brokerages_owner_id_uniq
  ON brokerages (owner_id);
