-- 055_sports_events.sql
-- The public /planner page's copy of the sports schedule, so it never calls
-- ESPN itself. Filled and pruned by /api/cron/sports-refresh (weekly via
-- pg_cron, see docs/planner-setup.md); read by /api/planner.
--
--   sports_events: one row per game, playoff placeholder ("TBD at TBD") or
--     event day (a golf round, a race, a fight card). id = "<league_key>:<espn id>".
--     day_et is the Eastern date ESPN files the game under; unannounced
--     starts carry a midnight-Eastern placeholder time and time_known=false.
--   sports_refresh_runs: one row per refresh, so the page can say when the
--     schedule was last updated and how far ahead it reaches.
--
-- No RLS policies on purpose: only the service role (cron + API) touches
-- these tables; the browser gets the data through /api/planner.
--
-- Safe to re-run: everything is IF NOT EXISTS.

create table if not exists public.sports_events (
  id text primary key,
  league_key text not null,
  kind text not null default 'game',
  name text,
  importance integer not null default 0,
  start_at timestamptz not null,
  day_et date not null,
  time_known boolean not null default true,
  time_approx boolean not null default false,
  home jsonb not null default '{}'::jsonb,
  away jsonb not null default '{}'::jsonb,
  home_state text,
  away_state text,
  neutral boolean not null default false,
  city text,
  venue_state text,
  broadcasts jsonb not null default '{"national":[],"home":[],"away":[]}'::jsonb,
  postseason boolean not null default false,
  national boolean not null default false,
  source text not null default 'espn',
  updated_at timestamptz not null default now()
);

create index if not exists sports_events_day_idx on public.sports_events (day_et);
create index if not exists sports_events_league_day_idx on public.sports_events (league_key, day_et);

alter table public.sports_events enable row level security;

create table if not exists public.sports_refresh_runs (
  id bigserial primary key,
  ran_at timestamptz not null default now(),
  from_day date not null,
  to_day date not null,
  games integer not null default 0,
  failed_leagues text[] not null default '{}',
  timed_out boolean not null default false,
  ms integer
);

alter table public.sports_refresh_runs enable row level security;
