-- ============================================================================
-- Migration 022: Pre-event reminder tracking
-- ============================================================================
-- WHY: a recurring job emails the agent ~24h before each scheduled open house
-- (address + directions, bring-the-sign checklist, door script, live samples
-- of the visitor SMS/email). This column is the idempotency guard so the job
-- never sends the same reminder twice — mirrors report_sent_at (migration 011).
--
-- Safe to re-run: every ADD COLUMN / CREATE INDEX uses IF NOT EXISTS.
-- ============================================================================

ALTER TABLE open_houses ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- Lets the reminder job cheaply find open houses starting soon that haven't
-- been reminded about yet.
CREATE INDEX IF NOT EXISTS open_houses_reminder_due_idx
  ON open_houses (start_at)
  WHERE reminder_sent_at IS NULL;
