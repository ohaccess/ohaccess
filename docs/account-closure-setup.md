# Self-serve account closure: setup

Agents can close their own account from Settings → Close account
(bottom of the page). The rules live in `lib/account-closure.ts`:

- **Inside a paid period** (monthly, annual, 2-year, legacy prepay, or an
  admin comp with a future end date, and the subscription is their own,
  not a team lead's or a sponsor's): the account is scheduled to close on
  `current_period_end`. Any Stripe subscription is set to
  `cancel_at_period_end` so they are never billed past that date. A
  dashboard banner and the Settings card show the date with a
  **Keep my account** button until it arrives. Buying a new plan also
  cancels the scheduled closure.
- **Everyone else** (free trial, team members, sponsor-covered agents,
  lapsed prepays): deleted immediately on confirmation.

Both paths email a confirmation (`buildAccountClosureEmail`). The teardown
is `lib/delete-account.ts`, the same code the admin Delete-account tool
uses: visitors archived (3-year retention), then everything else removed,
then the auth login. A legal hold blocks it and the agent is told to email
support.

## 1. Run the migration

`supabase/migrations/057_account_closure.sql` adds
`profiles.deletion_scheduled_at`. Run it BEFORE deploying: the close route
and the dashboard both select the column.

## 2. Deploy the code

Push to main as usual (Vercel).

## 3. Schedule the daily pg_cron job

DONE 2026-09-26 (job `account-deletions`, 09:30 UTC daily, cloned from the
data-retention job's command so the secret was never displayed). To
re-create it, in the Supabase SQL editor, replace `PASTE-CRON-SECRET-HERE` with the real
`CRON_SECRET` (same value the other cron jobs use) and run:

```sql
select cron.schedule(
  'account-deletions',
  '30 9 * * *',  -- daily 09:30 UTC
  $$
  select net.http_post(
    url := 'https://www.ohaccess.com/api/cron/account-deletions',
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
To remove it: `select cron.unschedule('account-deletions');`

## 4. Smoke-test once by hand (optional)

```
curl -X POST https://www.ohaccess.com/api/cron/account-deletions \
  -H "Authorization: Bearer PASTE-CRON-SECRET-HERE"
```

Response lists `deleted`, `held` (legal hold, skipped) and `failed`. With
nothing due, all three are empty.

## Ops notes

- See who is scheduled: `select email, deletion_scheduled_at from profiles where deletion_scheduled_at is not null order by 2;`
- Undo one by hand (agent changed their mind by email): `update profiles set deletion_scheduled_at = null where email = '...';`
  That does not resume their Stripe subscription; do that in Stripe if they want to keep paying.
- Admin accounts (`isAdmin` emails) cannot use the button.
