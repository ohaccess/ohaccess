-- 058_forewarn.sql
-- Opt-in "Safety check with FOREWARN" button on visitor records (2026-10-06).
--
-- FOREWARN (forewarn.com) is the US agent-safety lookup most real estate
-- associations include as a member benefit: paste a phone number, get an
-- identity + records report. Agents who have it turn this on in Settings and
-- every US visitor's record gets a button that copies the number and opens
-- FOREWARN (lib/forewarn.ts). Off by default: many agents don't have an
-- account, and the button would be noise for them.
--
-- Safe to re-run.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS forewarn_enabled boolean NOT NULL DEFAULT false;
