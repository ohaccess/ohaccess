-- 040_visitor_archive_consent_fields.sql
-- Widen visitor_archive (migration 026) to carry the CONSENT EVIDENCE and
-- DELIVERY PROOF that the original archive dropped on the floor.
--
-- The archive was built to preserve "who was inside the house" and captured
-- 16 of the visitors table's ~30 columns. Everything added to visitors after
-- 026 -- sponsor consent (028), lang (033), disclosure links (038), custom
-- answers (039) -- plus the delivery-status columns from 014 were silently
-- lost on every archive path: the agent-facing open-house delete, the
-- agent-facing single-visitor delete, and (as of 2026-07-27) admin account
-- deletion.
--
-- Why these specifically matter:
--   * sponsor_name / disclosures_sent -- snapshots of what was actually
--     disclosed on the form this visitor signed. They exist BECAUSE the live
--     sponsor/disclosure records can change later; an archive that drops them
--     destroys the only proof of what the visitor agreed to.
--   * lang -- the consent copy ships in 6 languages. Which one was shown is
--     part of proving the consent was understood.
--   * sms_message_sid / sms_status -- the key to the Twilio delivery record,
--     i.e. the proof the codeword reached that handset. Possession of the
--     phone is the strongest link in the whole forensic chain; the number
--     alone only proves someone typed it.
--
-- Deliberately NOT archived: visitors.feedback_token. It is a live one-time
-- capability handle for submitting feedback, not a record of anything, and
-- copying credentials into a long-lived forensic table is the wrong default.
--
-- No CHECK constraints and no foreign keys here, matching 026's rules: the
-- archive must accept whatever the live row historically held (including
-- values a since-tightened constraint would now reject), and rows must
-- survive deletion of the sponsor, open house, and profile they reference.
--
-- Backfill is NOT possible. Rows archived before this migration lost these
-- fields at write time; the source rows are gone. This fixes the leak going
-- forward only.
--
-- Safe to re-run: every ADD COLUMN uses IF NOT EXISTS.

ALTER TABLE public.visitor_archive
  -- Consent evidence (028, 033, 038, 039)
  ADD COLUMN IF NOT EXISTS sponsor_id            uuid,
  ADD COLUMN IF NOT EXISTS sponsor_name          text,
  ADD COLUMN IF NOT EXISTS disclosures_sent      jsonb,
  ADD COLUMN IF NOT EXISTS lang                  text,
  ADD COLUMN IF NOT EXISTS custom_answers        jsonb,
  -- Delivery proof (014)
  ADD COLUMN IF NOT EXISTS email_message_id      text,
  ADD COLUMN IF NOT EXISTS email_status          text,
  ADD COLUMN IF NOT EXISTS sms_message_sid       text,
  ADD COLUMN IF NOT EXISTS sms_status            text,
  ADD COLUMN IF NOT EXISTS delivery_updated_at   timestamptz,
  -- Post-visit record (032, 034)
  ADD COLUMN IF NOT EXISTS feedback_rating       smallint,
  ADD COLUMN IF NOT EXISTS feedback_price        text,
  ADD COLUMN IF NOT EXISTS feedback_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS thank_you_sent_at     timestamptz;
