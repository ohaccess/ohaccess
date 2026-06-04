-- ============================================================================
-- Migration 011: Structured open-house start/end times + report tracking
-- ============================================================================
-- WHY: the open house date/hours were free-text, so nothing could be scheduled
-- off them. These columns give a machine-readable start/end instant (stored as
-- UTC; the form computes them from the agent's local time) so we can (1) send a
-- post-event report ~30 min after an open house ends and (2) generate
-- "Add to Calendar" links. The existing open_house_date / open_house_hours TEXT
-- columns are kept for display.
--
-- Safe to re-run: every ADD COLUMN / CREATE INDEX uses IF NOT EXISTS.
-- ============================================================================

ALTER TABLE open_houses ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;
ALTER TABLE open_houses ADD COLUMN IF NOT EXISTS end_at   TIMESTAMPTZ;

-- IANA timezone the agent created the open house in (e.g. 'America/Chicago'),
-- so report/calendar times render in the property's local time, not UTC.
ALTER TABLE open_houses ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Set when the post-event report email has been sent, so the recurring job
-- never sends twice.
ALTER TABLE open_houses ADD COLUMN IF NOT EXISTS report_sent_at TIMESTAMPTZ;

-- Lets the report job cheaply find open houses that have ended and not yet
-- been reported on.
CREATE INDEX IF NOT EXISTS open_houses_report_due_idx
  ON open_houses (end_at)
  WHERE report_sent_at IS NULL;
