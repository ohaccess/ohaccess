-- 054_unsubscribe_details.sql
-- Where an unsubscribe came from, for the /admin/unsubscribes list:
--   1. email_opt_outs.open_house_id + agent_id: set when a visitor clicks
--      Unsubscribe in an agent's open-house invite, copied from the
--      visitor_invites row behind the token (the open house the invite was
--      for and the agent who sent it). No foreign keys, like qr_scans: the
--      opt-out must outlive a deleted open house or account.
--   2. profiles.drip_opt_out_source: which agent email the opt-out link was
--      in ('tips' = lifecycle/welcome emails, 'weekend_games' = the Wednesday
--      weekend-games email). Both share one opt-out; this only records where
--      the click happened.
-- Rows from before this migration stay null (shown as not recorded).
--
-- Safe to re-run: everything is IF NOT EXISTS.

alter table public.email_opt_outs
  add column if not exists open_house_id uuid,
  add column if not exists agent_id uuid;

alter table public.profiles
  add column if not exists drip_opt_out_source text;
