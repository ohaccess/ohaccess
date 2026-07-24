-- 032_visitor_feedback.sql
-- Post-visit feedback captured on the sign-in success screen (asked "after your
-- tour"): an overall 1–10 rating and a price sentiment. Aggregated PII-free into
-- the seller report; shown per-visitor to the hosting agent.
--
-- feedback_token is a one-time, unguessable handle returned to the visitor's
-- browser at registration so it can submit feedback for exactly that visitor,
-- once, without authenticating. Write-once is enforced in the API by requiring
-- feedback_submitted_at IS NULL.

ALTER TABLE visitors
  ADD COLUMN IF NOT EXISTS feedback_rating       smallint    CHECK (feedback_rating BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS feedback_price        text        CHECK (feedback_price IN ('Too High','Reasonable','Too Low')),
  ADD COLUMN IF NOT EXISTS feedback_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS feedback_token        text;

CREATE UNIQUE INDEX IF NOT EXISTS visitors_feedback_token_idx
  ON visitors (feedback_token) WHERE feedback_token IS NOT NULL;
