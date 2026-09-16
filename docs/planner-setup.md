# Game-Day Planner: one-time setup

**ohaccess.com/planner** is a free public page: pick a state and a day,
see every game and event buyers might be watching (10 AM to 6 PM meter,
sweet spot, "Big one", full lineup with TV, sunrise and sunset), toggle
leagues on and off. Same rules as the Wednesday weekend-games email
(`lib/weekend-games/plan.ts`), plus the event sports the email doesn't
carry: PGA Tour, NASCAR, Formula 1, IndyCar, UFC, tennis majors, NWSL.
Agreed with Dave 2026-09-16 (visitor-arrival analytics deliberately left
out until there's a bigger sample per region).

- **Data**: ESPN's free public schedule feed, copied into the
  `sports_events` table once a week by `/api/cron/sports-refresh` (150 days
  ahead). The page reads the table through `/api/planner`, never ESPN
  directly, and the API response is CDN-cached for 30 minutes.
- **Playoffs and brackets**: ESPN lists NFL playoff, Super Bowl, College
  Football Playoff and MLB postseason slots as "TBD at TBD" months ahead;
  they show as placeholders ("Teams TBA"). Things ESPN doesn't list yet
  (NCAA Tournament, NBA and NHL playoffs, the Derby, the Indy 500) are kept
  by hand in `lib/planner/curated.ts` and shown as **Expected** until the
  real games arrive, which supersede them automatically.
- **Where a visitor lands**: `?state=` in the link, else their saved
  choice, else Vercel's geo header, else Texas.

## Setup steps (in order)

### 1. Run migration 055

`supabase/migrations/055_sports_events.sql` in the Supabase SQL editor
(creates `sports_events` and `sports_refresh_runs`; safe to re-run).

### 2. Deploy the code

Push to main as usual (Vercel).

### 3. Load the schedule once by hand

The weekly job runs Mondays; don't wait for it. In the Supabase SQL
editor (this borrows the drip job's secret, nothing to paste):

```sql
select net.http_post(
  url := 'https://www.ohaccess.com/api/cron/sports-refresh',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', substring(
      (select command from cron.job where jobname = 'weekend-games-email')
      from 'Bearer [^'']+'
    )
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 300000
);
```

A minute or two later:

```sql
select ran_at, from_day, to_day, games, failed_leagues, timed_out, ms from sports_refresh_runs order by id desc limit 3;
select league_key, count(*) from sports_events group by 1 order by 1;
```

### 4. Schedule the weekly pg_cron job

Replace `PASTE-CRON-SECRET-HERE` with the real `CRON_SECRET` (the same
value the drip job uses) and run:

```sql
select cron.schedule(
  'sports-refresh',
  '0 9 * * 1',  -- Mondays 09:00 UTC (4 AM Central)
  $$
  select net.http_post(
    url := 'https://www.ohaccess.com/api/cron/sports-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer PASTE-CRON-SECRET-HERE'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);
```

To verify it's registered: `select jobname, schedule from cron.job;`

Monday means the weekend's final scores and any rescheduled games are in,
and the week's TV picks (announced 6 to 12 days out for college football)
land before Wednesday's email. To refresh more often, change the schedule
(daily would be `'0 9 * * *'`); each run is about 550 ESPN requests.

## Operational notes

- **ZIP code box** (added 2026-09-16): a visitor can type their ZIP; the
  planner then picks their own market's teams (gold "Your market" tag, the
  same rule as the Wednesday email) and computes sunrise/sunset for that
  spot. `/api/planner/zip` geocodes the ZIP with Google
  (`GOOGLE_MAPS_SERVER_KEY`, already set for the map), 60 lookups per IP
  per hour, cached at the CDN for 30 days. The ZIP is remembered in the
  browser and carried in the link as `?zip=`, so
  `ohaccess.com/planner?zip=77005` opens straight to a Houston view.

- **A league ESPN can't serve** keeps last week's rows and is named in
  `sports_refresh_runs.failed_leagues`. A required league failing (NFL,
  college football, MLB, NBA, NHL) or the run hitting its time budget
  emails support@ohaccess.com. Event sports and college basketball are
  optional: they're skipped silently apart from the log row.
- **Run just some leagues** (after a failure, or to widen the window):
  add `?leagues=football/nfl,golf/pga` and/or `?days=200` to the URL in
  the by-hand call above.
- **Month cap**: ESPN caps a month request at 500 games; a capped month
  is re-read a day at a time automatically. College basketball and tennis
  are always read by day.
- **Pause the job**: `select cron.unschedule('sports-refresh');`
- **Team moved or a new league team?** Once a year before football
  season, run `node scripts/build-team-states.mjs` and commit the updated
  `lib/weekend-games/team-states.json` (NWSL is included).
- **Next season's placeholders**: when the NCAA, NBA and NHL publish their
  2028 dates, add them to `CURATED` in `lib/planner/curated.ts`.
- **What's deliberately not here**: visitor-arrival analytics ("buyers in
  your area tend to arrive at…"). Revisit once there's a larger sample of
  sign-ins per region.
