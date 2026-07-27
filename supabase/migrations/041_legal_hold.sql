-- 041_legal_hold.sql
-- Preservation hold: exempt specific records from EVERY automated purge and
-- every hard-delete path until the hold is explicitly released.
--
-- Why: Privacy Policy §5 promises deletion at 3 years, and §6 lets a visitor
-- request deletion sooner. Both are correct defaults and both destroy
-- evidence. Once ohACCESS is on notice of an investigation (preservation
-- letter, subpoena, litigation hold), continuing to run those deletions is a
-- materially worse position than never having collected the data. §5 already
-- reserves this: deletion requests are honored "subject to any legal
-- obligations to retain certain records."
--
-- DESIGN: the flag lives ON the row, not in a lookup table. A hold has to
-- survive the record moving from visitors -> visitor_archive, and it has to
-- be impossible for a purge query to "forget" to join. A boolean column that
-- travels with the row is checked by a single .eq() on every delete path.
--
-- The legal_holds table below is the PAPER TRAIL, not the enforcement. It
-- records who asked, when, and under what matter. The boolean is what the
-- code obeys. They must be written together — see the runbook at the bottom.
--
-- Enforced in code at:
--   * /api/cron/data-retention          — the monthly 3-year purge (3 tables)
--   * lib/visitor-archive purgeExpired  — opportunistic archive purge
--   * /api/open-house/[id] GET          — opportunistic qr_scans purge
--   * /api/admin/delete-open-house      — hard delete, BLOCKED when held
--   * /api/admin/delete-account         — hard delete, BLOCKED when held
--
-- Agent-facing deletes are deliberately NOT blocked. They archive before
-- deleting, so the record survives with its hold intact, and the agent sees
-- the normal result. Blocking them would tell whoever is holding the account
-- that their records are under preservation.
--
-- Safe to re-run.

ALTER TABLE public.visitors
  ADD COLUMN IF NOT EXISTS legal_hold boolean NOT NULL DEFAULT false;
ALTER TABLE public.visitor_archive
  ADD COLUMN IF NOT EXISTS legal_hold boolean NOT NULL DEFAULT false;
ALTER TABLE public.qr_scans
  ADD COLUMN IF NOT EXISTS legal_hold boolean NOT NULL DEFAULT false;

-- Partial indexes: held rows are rare, so only index the ones that exist.
CREATE INDEX IF NOT EXISTS visitors_legal_hold_idx
  ON public.visitors (legal_hold) WHERE legal_hold;
CREATE INDEX IF NOT EXISTS visitor_archive_legal_hold_idx
  ON public.visitor_archive (legal_hold) WHERE legal_hold;
CREATE INDEX IF NOT EXISTS qr_scans_legal_hold_idx
  ON public.qr_scans (legal_hold) WHERE legal_hold;

-- Paper trail. One row per matter, not per record held.
CREATE TABLE IF NOT EXISTS public.legal_holds (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference    text NOT NULL,          -- case/matter label, e.g. "APD 2026-114377"
  requested_by text,                   -- agency, department, or law firm
  scope_note   text NOT NULL,          -- plain English: what was held and why
  placed_at    timestamptz NOT NULL DEFAULT now(),
  placed_by    text NOT NULL,          -- admin email
  released_at  timestamptz,            -- NULL while active
  released_by  text,
  release_note text
);

CREATE INDEX IF NOT EXISTS legal_holds_active_idx
  ON public.legal_holds (placed_at) WHERE released_at IS NULL;

-- Service-role only (same pattern as qr_scans / visitor_archive).
ALTER TABLE public.legal_holds ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RUNBOOK — run these in the Supabase SQL editor
-- ============================================================================
-- Both steps in one transaction so the flag and the paper trail can never
-- disagree. Edit the address/date and the three text values, nothing else.
--
-- PLACE A HOLD (by property + date — the usual shape of a request):
--
--   BEGIN;
--   INSERT INTO legal_holds (reference, requested_by, scope_note, placed_by)
--   VALUES ('APD 2026-114377', 'Austin PD',
--           'All sign-ins and scans at 123 Main St open house on 2026-07-25.',
--           'dave.sheehan@reflectre.com');
--
--   UPDATE visitors v SET legal_hold = true
--     FROM open_houses o WHERE v.open_house_id = o.id
--     AND o.property_address ILIKE '%123 Main St%';
--
--   UPDATE visitor_archive SET legal_hold = true
--     WHERE property_address ILIKE '%123 Main St%';
--
--   UPDATE qr_scans q SET legal_hold = true
--     FROM open_houses o WHERE q.open_house_id = o.id
--     AND o.property_address ILIKE '%123 Main St%';
--   COMMIT;
--
-- NOTE: qr_scans has no FK to open_houses on purpose, so once the open house
-- row is deleted the join above finds nothing. If the listing is already
-- gone, hold the scans by time window instead:
--
--   UPDATE qr_scans SET legal_hold = true
--     WHERE created_at BETWEEN '2026-07-25 00:00' AND '2026-07-26 00:00';
--
-- HOLD ONE PERSON across every property:
--
--   UPDATE visitors       SET legal_hold = true WHERE phone = '+15125551234';
--   UPDATE visitor_archive SET legal_hold = true WHERE phone = '+15125551234';
--
-- CHECK WHAT IS CURRENTLY HELD:
--
--   SELECT 'visitors' t, count(*) FROM visitors WHERE legal_hold
--   UNION ALL SELECT 'visitor_archive', count(*) FROM visitor_archive WHERE legal_hold
--   UNION ALL SELECT 'qr_scans', count(*) FROM qr_scans WHERE legal_hold;
--
--   SELECT reference, requested_by, placed_at, scope_note
--     FROM legal_holds WHERE released_at IS NULL ORDER BY placed_at;
--
-- RELEASE (only when counsel confirms the matter is closed). Records past
-- their 3-year date are purged on the next monthly run, immediately and
-- permanently — release is not reversible:
--
--   BEGIN;
--   UPDATE legal_holds SET released_at = now(),
--          released_by = 'dave.sheehan@reflectre.com',
--          release_note = 'Matter closed, confirmed by counsel 2026-09-01.'
--     WHERE reference = 'APD 2026-114377';
--
--   UPDATE visitors       SET legal_hold = false WHERE legal_hold;
--   UPDATE visitor_archive SET legal_hold = false WHERE legal_hold;
--   UPDATE qr_scans       SET legal_hold = false WHERE legal_hold;
--   COMMIT;
--
-- The release statements clear ALL holds. If two matters are ever open at
-- once, narrow them with the same WHERE clause used to place the hold.
-- ============================================================================
