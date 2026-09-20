-- 056_lock_ended_open_houses.sql
-- An open house becomes read-only for its agent 30 minutes after it ends.
--
-- WHY: every visitor's consent record names the address and date they signed
-- in at (the consent SMS says "at [address]"; the proof page and seller report
-- read the same row). The open_houses_owner_all policy (migration 010) lets an
-- agent rewrite any column of a finished open house, which re-points those
-- visitors' records at a different property or day. Running the same property
-- again goes through Duplicate (a new row) instead.
--
-- WHAT THIS DOES: a trigger that, for browser requests only
-- (current_user 'authenticated' / 'anon'), refuses an UPDATE once now() is
-- more than 30 minutes past the STORED end_at. Checked against OLD, so sending
-- a later end time can't unlock a finished event; while the event is live or
-- inside the 30 minutes, the agent can still push the end out, which moves the
-- lock with it. Keep the interval in step with EDIT_LOCKS_AFTER_END_MS in
-- lib/signin-window.ts.
--
-- Unaffected: server routes (service_role) such as the report/reminder crons
-- (report_sent_at, reminder_sent_at), the map geocoder (lat/lng), admin tools,
-- and the SQL editor, so support can still fix a typo on a finished open
-- house. DELETE is not touched (the delete API route has its own rules). Rows
-- with no end_at never lock (there were none when this was written).
--
-- Browser writes audited 2026-09-19: the only one is Update in
-- app/dashboard/page.tsx (updateOpenHouse), which checks the same rule first
-- and shows a friendly message on OPEN_HOUSE_LOCKED.
-- Same pattern as require_verified_agent_for_open_house (migration 051).
--
-- Safe to re-run.

CREATE OR REPLACE FUNCTION lock_ended_open_house()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND OLD.end_at IS NOT NULL
     AND now() > OLD.end_at + interval '30 minutes' THEN
    RAISE EXCEPTION 'OPEN_HOUSE_LOCKED'
      USING HINT = 'This open house is over, so its details are locked. Duplicate it to run another.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_ended_open_house ON open_houses;
CREATE TRIGGER lock_ended_open_house
  BEFORE UPDATE ON open_houses
  FOR EACH ROW EXECUTE FUNCTION lock_ended_open_house();
