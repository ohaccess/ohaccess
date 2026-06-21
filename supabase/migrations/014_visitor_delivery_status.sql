-- Track deliverability of the visitor's code-word email + SMS so agents can
-- see when a lead's contact info is bad (bounced email / undeliverable SMS).
-- The Resend and Twilio webhooks match delivery events back to a visitor by
-- the provider message id, then write the resulting status here.
alter table public.visitors
  add column if not exists email_message_id text,
  add column if not exists email_status text,
  add column if not exists sms_message_sid text,
  add column if not exists sms_status text,
  add column if not exists delivery_updated_at timestamptz;

-- Webhooks look up the visitor by provider id, so index those lookups.
create index if not exists visitors_email_message_id_idx
  on public.visitors (email_message_id);
create index if not exists visitors_sms_message_sid_idx
  on public.visitors (sms_message_sid);
