# Drip emails — one-time setup

The lifecycle ("drip") email system (built 2026-09-05) sends five automated
emails to agents on the schedule in `lib/drip.ts`:

| When | Who | Email |
|---|---|---|
| Day 2 | Signed up, never logged in | Finish your setup (one nudge, ever) |
| Day 5 | Logged in, no open house yet | Set up your first open house |
| Day 12 | Has created an open house | Your referral link (earn a free month) |
| Day 21 | Free tier | 2-year plan + free sign hardware offer |
| Day 30+, monthly | No open-house activity in 30 days | "Holding an open house soon?" (3 lifetime) |

Guardrails: max one drip email per agent per 7 days; every email has one-click
unsubscribe (sets `profiles.drip_opt_out_at`; transactional mail unaffected);
at-most-once per (agent, email) via the `agent_email_log` unique constraint;
at most 50 sends per daily run, so the existing base drains gradually.

## Setup steps (in order)

### 1. Run migration 050

Run `supabase/migrations/050_drip_emails.sql` in the Supabase SQL editor.
It adds `profiles.drip_unsubscribe_token` / `drip_opt_out_at` and creates
`agent_email_log`. Run it BEFORE deploying the code (the welcome-email route
now selects the token column).

### 2. Deploy the code

Push to main as usual (Vercel).

### 3. Schedule the daily pg_cron job

In the Supabase SQL editor, replace `PASTE-CRON-SECRET-HERE` with the real
`CRON_SECRET` (same value the other cron jobs use) and run:

```sql
select cron.schedule(
  'drip-emails',
  '0 15 * * *',  -- daily 15:00 UTC = 10/11am ET, 7/8am PT
  $$
  select net.http_post(
    url := 'https://www.ohaccess.com/api/cron/drip',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer PASTE-CRON-SECRET-HERE'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

To verify it's registered: `select jobname, schedule from cron.job;`
To remove it: `select cron.unschedule('drip-emails');`

### 4. Smoke-test once by hand (optional but recommended)

```
curl -X POST https://www.ohaccess.com/api/cron/drip \
  -H "Authorization: Bearer $CRON_SECRET"
```

The JSON response reports `{ eligible, sent, failed }`. Because of the
50-per-run budget, the first few daily runs work through the existing base
(onboarding nudges first, check-ins last).

## Operational notes

- **Pause everything**: `select cron.unschedule('drip-emails');` — nothing
  else to turn off.
- **Retire the hardware email only**: flip `HARDWARE_OFFER_ACTIVE` in
  `lib/hardware-offer.ts` (already controls the pricing page + checkout).
- **Who got what**: `select * from agent_email_log order by sent_at desc;`
- **Opt-outs**: `select email from profiles where drip_opt_out_at is not null;`
- A send failure releases its claim row, so the next daily run retries it.
- The day-2 nudge can create a minimal `profiles` row for signups that never
  confirmed (they normally get one at confirmation), so those accounts start
  appearing in the admin dashboard's agent list / "never logged in" panel —
  which is exactly the spam-victim segment that panel tracks.
