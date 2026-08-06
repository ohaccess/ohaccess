-- 044_hardware_claims.sql
-- Free sign-hardware offer: the first 100 individual Pro 2-year subscribers
-- in each state get two pedestal sign stands or one A-frame, shipped free.
--
-- One row = one claim, written by the Stripe webhook when a qualifying
-- checkout completes. The shipping address and hardware choice are collected
-- by Stripe Checkout itself (shipping_address_collection + a dropdown custom
-- field), so this table is the fulfillment queue and the source of truth for
-- the live per-state counters shown on the pricing page.
--
-- Fulfillment is manual (ordered from Amazon, shipped to the agent):
-- fulfilled_at stays NULL until the order is placed, so unshipped claims are
-- WHERE fulfilled_at IS NULL.
--
-- Idempotency: stripe_session_id is UNIQUE so a webhook replay can't record
-- the same purchase twice, and profile_id is UNIQUE so an account can never
-- claim more than once (terms §4.9: one per Subscriber Account).
--
-- The state column is the 2-letter code from the SHIPPING address — the
-- binding basis for the per-state limit per the offer terms (display on the
-- marketing page may use IP geolocation, which is non-binding).

create table hardware_claims (
  id uuid primary key default gen_random_uuid(),
  -- Nullable so a deleted profile keeps the claim on the books (the per-state
  -- count must never go backwards); UNIQUE still holds for live profiles
  -- because Postgres allows multiple NULLs in a unique column.
  profile_id uuid unique references profiles(id) on delete set null,
  stripe_session_id text not null unique,
  choice text not null check (choice in ('pedestal_pair', 'a_frame')),
  state text not null check (char_length(state) = 2),
  -- Denormalized for the fulfillment email trail even if the profile goes away.
  agent_name text,
  agent_email text,
  -- Full shipping block exactly as Stripe collected it: {name, line1, line2,
  -- city, state, postal_code, country}.
  shipping jsonb not null,
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz
);

-- The pricing page counts claims per state on every load.
create index hardware_claims_state_idx on hardware_claims (state);

-- Service-role only: written by the Stripe webhook, read by API routes via the
-- admin client. No client-side access — RLS on with no policies.
alter table hardware_claims enable row level security;
