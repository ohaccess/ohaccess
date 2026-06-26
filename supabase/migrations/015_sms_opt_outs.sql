-- Global SMS opt-out suppression list. When a number replies STOP, sends to it
-- fail with Twilio error 21610; we record the number here so future
-- registrations (across ALL agents/accounts) are suppressed and flagged. This
-- backs the TCPA obligation (and Subscriber Terms §8.4) not to re-contact an
-- opted-out number through a different agent.
create table if not exists public.sms_opt_outs (
  phone text primary key,            -- normalized to E.164 (e.g. +15005550001)
  opted_out_at timestamptz not null default now(),
  source text                        -- e.g. 'twilio_error_21610'
);

-- Service-role only (matches rate_limits / short_urls). No policies = the
-- anon/agent clients can't read the global list; per-visitor flagging below is
-- how agents see opt-out state for their own visitors.
alter table public.sms_opt_outs enable row level security;

-- Per-visitor flag so the agent dashboard can badge an opted-out visitor
-- without exposing the global list. Set when a send is suppressed at
-- registration or when a send fails with error 21610.
alter table public.visitors
  add column if not exists sms_opted_out boolean not null default false;
