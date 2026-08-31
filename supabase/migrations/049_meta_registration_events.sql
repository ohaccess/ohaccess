-- 049_meta_registration_events.sql
-- At-most-once ledger for the Meta Conversions API CompleteRegistration leg.
-- /api/meta-event inserts the signing-up user's id with the browser-generated
-- event_id before relaying to Meta; the primary key makes a second insert for
-- the same user fail (23505), which the route treats as "already sent" and
-- skips. Fixes duplicate server conversions from repeat signup-form submits
-- (same Supabase user, fresh event_id each time — Meta can't dedup those).
--
-- Service-role access only: RLS is enabled with no policies, so the anon and
-- authenticated keys can't read or write ad-attribution state.

create table if not exists public.meta_registration_events (
  user_id uuid primary key,
  event_id text not null,
  created_at timestamptz not null default now()
);

alter table public.meta_registration_events enable row level security;
