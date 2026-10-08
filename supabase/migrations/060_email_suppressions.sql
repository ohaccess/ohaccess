-- 060_email_suppressions.sql
-- Addresses that hard-bounced or filed a spam complaint on ANY ohACCESS email,
-- recorded by the Resend webhook (app/api/webhooks/resend). Every agent-facing
-- sender (drip, weekend games, reminders, reports) and the visitor codeword
-- email skip them (lib/email-suppressions): mailing a dead or hostile address
-- again only costs sender reputation, and repeated bounces and complaints are
-- the two signals Gmail punishes hardest.
--
-- Service-role access only: RLS is enabled with no policies.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.email_suppressions (
  email text PRIMARY KEY,
  reason text NOT NULL CHECK (reason IN ('bounced', 'complained')),
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
