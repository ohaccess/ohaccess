-- 035_visitor_invites.sql
-- "Re-invite past visitors": an agent can email the people who signed in at
-- their earlier open houses about an upcoming one. Two tables:
--
--   1. email_opt_outs — global email suppression list (the email twin of
--      sms_opt_outs). A visitor who clicks Unsubscribe in any invite is never
--      invited again by ANY agent. Also closes the Terms §"Unsubscribe link in
--      every email" promise for this email type.
--   2. visitor_invites — one row per invite email sent. Backs the send rules:
--      never invite the same address twice for the same open house (unique
--      index), cap invites per agent+address per rolling month (agent/sent_at
--      index), and carries the per-email unsubscribe token.
--
-- Safe to re-run: everything is IF NOT EXISTS.

create table if not exists public.email_opt_outs (
  email text primary key,            -- normalized: trimmed + lowercased
  opted_out_at timestamptz not null default now(),
  source text                        -- e.g. 'invite_unsubscribe'
);

-- Service-role only (matches sms_opt_outs / rate_limits): RLS on, no policies.
alter table public.email_opt_outs enable row level security;

create table if not exists public.visitor_invites (
  id uuid primary key default gen_random_uuid(),
  open_house_id uuid not null references public.open_houses(id) on delete cascade,
  agent_id uuid not null,
  email text not null,               -- normalized: trimmed + lowercased
  unsubscribe_token text not null,   -- opaque lookup token (randomUUID), emailed as the Unsubscribe link
  email_message_id text,             -- Resend message id (delivery diagnostics)
  sent_at timestamptz not null default now()
);

-- One invite per address per open house — the insert acts as the send
-- reservation, so a double-click / concurrent POST can't double-send.
create unique index if not exists visitor_invites_oh_email_idx
  on public.visitor_invites (open_house_id, email);

create unique index if not exists visitor_invites_token_idx
  on public.visitor_invites (unsubscribe_token);

-- Frequency cap: "invites sent by this agent in the last 30 days".
create index if not exists visitor_invites_agent_sent_idx
  on public.visitor_invites (agent_id, sent_at);

-- Service-role only: all reads/writes go through the invites API route.
alter table public.visitor_invites enable row level security;
