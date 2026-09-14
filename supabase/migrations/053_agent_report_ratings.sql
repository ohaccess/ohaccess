-- 053_agent_report_ratings.sql
-- One-tap agent ratings from the post-event report email.
--
-- Each report email carries five star links (1 to 5) for that open house. A
-- tap opens /rate/<open house id>/<signature>, which saves the score here and
-- lets the agent change it or add a comment. One row per open house: a later
-- tap overwrites the score. The admin Overview shows the average and the
-- latest ratings.
--
-- No foreign keys on purpose (like qr_scans): a rating is feedback about
-- ohACCESS, not visitor data, so it survives the agent deleting the open house.
--
-- Service-role access only: RLS is enabled with no policies, so the anon and
-- authenticated keys can't read or write ratings.
--
-- Safe to re-run.

create table if not exists public.agent_report_ratings (
  open_house_id uuid primary key,
  agent_id uuid not null,
  score smallint not null check (score between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_report_ratings_updated_at_idx
  on public.agent_report_ratings (updated_at desc);

alter table public.agent_report_ratings enable row level security;
