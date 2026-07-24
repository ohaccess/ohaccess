-- 034_visitor_thank_you.sql
-- Marks when a visitor was sent the post-event "thanks for visiting" email, so
-- the next-morning cron sends it exactly once. NULL = not yet sent. The partial
-- index keeps the cron's "pending" scan cheap as the visitors table grows.

ALTER TABLE visitors
  ADD COLUMN IF NOT EXISTS thank_you_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS visitors_thank_you_pending_idx
  ON visitors (registered_at) WHERE thank_you_sent_at IS NULL;
