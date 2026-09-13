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

## Operational notes

- **Pause it**: `select cron.unschedule('weekend-games-email');`
- **Who got it**: `select * from agent_email_log where email_key like 'weekend_games_%' order by sent_at desc;`
- **Team moved or a new league team?** Once a year before football season,
  run `node scripts/build-team-states.mjs` and commit the updated
  `lib/weekend-games/team-states.json`.
- A send failure releases its claim, so the next hourly run retries it.
