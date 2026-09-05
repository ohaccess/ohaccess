-- 050_drip_emails.sql
-- Automated lifecycle ("drip") emails for agents, sent by the daily
-- /api/cron/drip job: finish-setup nudge, first-open-house walkthrough,
-- referral link, sign-hardware offer, and up to three "holding an open
-- house?" check-ins. Design approved by Dave 2026-09-05.
--
-- Two pieces of infrastructure:
--   1. Per-agent unsubscribe. These emails are promotional, so every one
--      carries a working one-click unsubscribe (CAN-SPAM). The token is the
--      feedback_token pattern — random value, DB lookup, no crypto — and the
--      opt-out lives on the profile so the cron can exclude in one read.
--      Opting out does NOT touch transactional mail (reminders, reports,
--      billing).
--   2. A send ledger. One row = one drip email handed to Resend. The UNIQUE
--      constraint is the claim: the cron INSERTs before sending, so no agent
--      can ever receive the same drip email twice, no matter how often or
--      concurrently the job runs. agent_id references auth.users (same id
--      space as profiles) so the finish-setup nudge can be logged even for
--      signups whose profile row doesn't exist yet.

alter table profiles add column if not exists drip_unsubscribe_token uuid not null default gen_random_uuid();
alter table profiles add column if not exists drip_opt_out_at timestamptz;

-- The unsubscribe route resolves tokens to profiles.
create unique index if not exists profiles_drip_unsubscribe_token_idx
  on profiles (drip_unsubscribe_token);

create table agent_email_log (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users (id) on delete cascade,
  email_key text not null,
  sent_at timestamptz not null default now(),
  -- The at-most-once claim. Repeatable emails (check-ins) use numbered keys
  -- (checkin_1..checkin_3) so the constraint still holds.
  unique (agent_id, email_key)
);

-- Service-role only: written and read by the cron via the admin client.
-- No client-side access — RLS on with no policies (short_urls pattern).
alter table agent_email_log enable row level security;
