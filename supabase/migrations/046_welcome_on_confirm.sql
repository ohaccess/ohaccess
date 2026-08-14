-- 046_welcome_on_confirm.sql
-- Send the getting-started (welcome) email the moment the agent clicks the
-- email-confirmation link, instead of waiting for their first dashboard
-- load. When auth.users.email_confirmed_at flips from NULL, an async pg_net
-- POST hits /api/notify/new-account with the CRON_SECRET; the endpoint's
-- conditional-UPDATE claims keep every send at-most-once, and the
-- dashboard-load call remains as a fallback (it also covers OAuth signups,
-- which are confirmed at creation and never fire this UPDATE trigger).
--
-- ⚠ BEFORE RUNNING: replace PASTE-CRON-SECRET-HERE below with the real
-- CRON_SECRET value (same one the pg_cron jobs use). If the placeholder is
-- left in, the trigger installs but only logs a warning instead of calling
-- the webhook — email confirmation itself is never affected.

create or replace function public.welcome_on_email_confirm()
returns trigger
security definer
set search_path = ''
language plpgsql
as $$
declare
  secret text := 'PASTE-CRON-SECRET-HERE';
begin
  -- Never let a webhook problem break the auth update itself: pg_net enqueues
  -- asynchronously, and any error here is swallowed into a warning.
  begin
    if secret = 'PASTE-CRON-SECRET-HERE' then
      raise warning 'welcome_on_email_confirm: CRON_SECRET placeholder was not replaced; webhook skipped';
    else
      perform net.http_post(
        url := 'https://www.ohaccess.com/api/notify/new-account',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || secret
        ),
        body := jsonb_build_object('userId', new.id::text)
      );
    end if;
  exception when others then
    raise warning 'welcome_on_email_confirm webhook failed: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists welcome_on_email_confirm on auth.users;
create trigger welcome_on_email_confirm
  after update on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.welcome_on_email_confirm();
