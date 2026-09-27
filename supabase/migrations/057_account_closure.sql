-- Self-serve account closure (2026-09-26). An agent inside a paid period
-- keeps access until it ends; the account then closes itself. The date is
-- recorded here and /api/cron/account-deletions runs the teardown daily.
-- NULL = no closure pending. Cleared by "Keep my account" and by any new
-- paid checkout.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS profiles_deletion_scheduled_at_idx
  ON public.profiles (deletion_scheduled_at)
  WHERE deletion_scheduled_at IS NOT NULL;
