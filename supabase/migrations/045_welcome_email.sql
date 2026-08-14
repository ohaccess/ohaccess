-- 045_welcome_email.sql
-- One-time "getting started" email to each new agent, sent on the first
-- authenticated dashboard load (i.e. right after email confirmation, or
-- immediately for OAuth signups). The send is claimed with a conditional
-- UPDATE on this column — only the call that flips it from NULL sends — so
-- an account can never receive it twice.
--
-- The backfill marks every EXISTING account as already handled: only
-- accounts created after this migration ever get the email.

alter table profiles add column if not exists welcome_email_sent_at timestamptz;

update profiles set welcome_email_sent_at = now() where welcome_email_sent_at is null;
