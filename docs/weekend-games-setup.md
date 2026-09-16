# Weekend games email: one-time setup

Every Wednesday at 8 AM in the agent's own time zone, US agents whose
Settings are filled in (name, brokerage, phone, license number, state) get
**"Planning on an Open House this weekend?"**: their state's college and pro
games for Saturday and Sunday, a 10 AM to 6 PM game meter, the sweet spot,
the day's "Big one", and a Create my open house button. Approved by Dave
2026-09-13.

- **Games**: NFL, college football (top division), MLB, NBA, NHL, WNBA, MLS,
  plus college basketball only when it matters (a Top 25 team or the NCAA
  Tournament). Games played in the state, plus the state's teams playing
  away (marked 📺).
- **Data**: ESPN's free public schedule feed. If it can't be read, nobody
  gets the email that hour and support@ohaccess.com gets an alert; the next
  hourly run tries again.
- **Sunrise and sunset** under each day's meter (added 2026-09-16), computed
  locally with the NOAA formulas, no service involved. Location: the
  agent's most recent open house that has map coordinates, otherwise
  their state's largest metro (`lib/weekend-games/sun.ts`). Meter hours
  that end after sunset are dimmed and keyed "After sunset"; in summer none
  are, from November to February the last one or two.
- **Market-aware "Big one"** (added 2026-09-16): the agent's own market's
  team outranks the rest of the state, so a Houston agent's headline says
  "Sunday belongs to the Texans" while a Dallas agent's says the Cowboys.
  A team whose home city is within 60 miles of the agent gets a big boost
  (and a gold "Your market" tag), within 150 miles a small one
  (`lib/weekend-games/markets.ts`). The agent's location comes from their
  latest open house with map coordinates, else their mobile number's area
  code (the ~50 largest metros are mapped), else the state's largest metro;
  the "Your market" tag is never shown from that last guess. Team home
  cities and coordinates live in `team-states.json`, geocoded once by
  `scripts/build-team-states.mjs` (Google key from `.env.local`; reruns
  reuse what's already there).
- **Sent to agents with open houses already booked too** (they can adjust).
- **Unsubscribe**: the same one-click link as the tips emails. Reminders,
  reports and billing mail are unaffected.
- **At most once per agent per weekend**: `agent_email_log` rows keyed
  `weekend_games_YYYY-MM-DD` (the Saturday). No migration needed.

## Setup steps (in order)

### 1. Deploy the code

Push to main as usual (Vercel).

### 2. Schedule the hourly Wednesday pg_cron job

In the Supabase SQL editor, replace `PASTE-CRON-SECRET-HERE` with the real
`CRON_SECRET` (the same value the drip job uses) and run:

```sql
select cron.schedule(
  'weekend-games-email',
  '0 12-20 * * 3',  -- hourly, Wednesdays 12:00 to 20:00 UTC
  $$
  select net.http_post(
    url := 'https://www.ohaccess.com/api/cron/weekend-games',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer PASTE-CRON-SECRET-HERE'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Those hours cover 8 to 10 AM local from Eastern through Hawaii, summer and
winter. Each run only emails the agents for whom it is currently 8, 9 or
10 AM on Wednesday; everyone else is skipped until their hour.

To verify it's registered: `select jobname, schedule from cron.job;`

## If a Wednesday is missed: catch-up send

If the 8 to 10 AM runs all failed (an ESPN outage, say), send the email by
hand any time Wednesday through Friday. The route's `?catchup=true` mode
ignores the time-of-day window and emails everyone who hasn't had this
weekend's email yet; the ledger stops anyone getting it twice. Run this in
the Supabase SQL editor (it reuses the scheduled job's secret, so there's
nothing to paste):

```sql
select net.http_post(
  url := 'https://www.ohaccess.com/api/cron/weekend-games?catchup=true',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', substring(
      (select command from cron.job where jobname = 'weekend-games-email')
      from 'Bearer [^'']+'
    )
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 120000
);
```

Then check the result a minute later:

```sql
select status_code, content::text from net._http_response order by id desc limit 3;
select count(*) from agent_email_log where email_key = 'weekend_games_' || to_char(current_date + (6 - extract(dow from current_date))::int, 'YYYY-MM-DD');
```

## Operational notes

- **ESPN quirks seen so far** (2026-09-16, three days after launch): the
  two-day range form of the schedule URL (`dates=20260919-20260920`) began
  returning HTTP 400 for every league, and `limit=1000` began silently
  returning only 25 games, while single-day requests with no limit (or a
  limit up to 500) still returned everything. The code now asks for each
  day separately, two ways, and merges the answers. If ESPN can't serve
  MLS, the WNBA or college basketball, the email still goes out without
  them and support@ gets a note; if it can't serve the NFL, college
  football, MLB, the NBA or the NHL, nothing is sent and support@ gets an
  alert (see `optional` in `lib/weekend-games/leagues.ts`).

- **Pause it**: `select cron.unschedule('weekend-games-email');`
- **Who got it**: `select * from agent_email_log where email_key like 'weekend_games_%' order by sent_at desc;`
- **Team moved or a new league team?** Once a year before football season,
  run `node scripts/build-team-states.mjs` and commit the updated
  `lib/weekend-games/team-states.json`.
- A send failure releases its claim, so the next hourly run retries it.
