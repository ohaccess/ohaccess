-- 042_legal_holds_open_house.sql
-- Link a paper-trail row to the open house it covers, so the admin panel can
-- release exactly the hold it placed.
--
-- Migration 041 shipped with holds placed by hand in SQL, where "release"
-- meant clearing every flag at once. That is fine for one matter at a time
-- and wrong the moment two are open. The admin button scopes both place and
-- release to a single open house, and needs a key to match them on.
--
-- Nullable on purpose: holds placed by hand (a person across every property,
-- a date window on the scan log) legitimately have no single open house, and
-- those still release via the SQL runbook in 041.
--
-- No FK — same rule as the rest of the retention tables. A hold must survive
-- deletion of the listing it refers to, otherwise the record that proves what
-- was preserved disappears with the thing being investigated.
--
-- Safe to re-run.

ALTER TABLE public.legal_holds
  ADD COLUMN IF NOT EXISTS open_house_id uuid;

CREATE INDEX IF NOT EXISTS legal_holds_open_house_active_idx
  ON public.legal_holds (open_house_id) WHERE released_at IS NULL;
