-- 039_custom_questions.sql
-- Agent-defined questions layered on top of the fixed sign-in fields and the
-- fixed post-visit feedback questions.
--
-- profiles.custom_questions: jsonb array of
--   {"id":"<uuid>","prompt":"...","type":"text"|"choice",
--    "options":["..."],            -- choice only, max 4
--    "surface":"signin"|"success"}
--
-- Caps are enforced in application code (1 signin, 2 success, 4 options) and
-- re-validated on read via lib/custom-questions normalizeCustomQuestions --
-- the stored jsonb is never trusted as-is.
--
-- Questions are deliberately OPTIONAL for the visitor: the sign-in form is an
-- entry gate, and a visitor who can't get past a required question can't get
-- into the house.
--
-- The two built-in feedback questions (visitors.feedback_rating /
-- feedback_price, migration 032) are NOT represented here. They stay fixed
-- because lib/seller-report.ts aggregates them by name, and an agent deleting
-- them would silently break their own seller report.
--
-- visitors.custom_answers: jsonb ARRAY that SNAPSHOTS the prompt next to the
-- answer, so the record always shows the question that was actually asked:
--   [{"id":"<uuid>","prompt":"Are you pre-approved?","answer":"Yes"}]
--
-- The prompt is stored per-answer (not looked up from profiles at read time)
-- because an agent editing or deleting a question in Settings must never be
-- able to relabel or orphan a past visitor's answer. Same reasoning as
-- visitors.disclosures_sent and sponsor_name.
--
-- The id is kept alongside it so answers to the same question can still be
-- grouped later even if the wording was tweaked. NOTE for any future seller-
-- report aggregation: grouping happens by id, so an agent who materially
-- rewords a question without changing its id would blend two different
-- questions into one aggregate.
--
-- Sign-in answers are written by /api/register; success-screen answers arrive
-- later on the same visitor via /api/feedback and are MERGED onto the row
-- rather than overwriting it.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS custom_questions jsonb;

ALTER TABLE visitors
  ADD COLUMN IF NOT EXISTS custom_answers jsonb;
