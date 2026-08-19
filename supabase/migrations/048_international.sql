-- 048_international.sql
-- ohACCESS is open to agents in any country (2026-08-19). Three small
-- columns carry the "where" so the app can regionalize itself:
--
--   profiles.country       ISO 3166-1 alpha-2 of the AGENT ("US", "CA", "AU"…).
--                          Drives the Settings labels (Brokerage vs Agency,
--                          licence fields, state/province lists), the phone
--                          picker's default dial code, and which country the
--                          address search looks in. Null = not chosen yet; the
--                          app infers US (or CA from a Canadian province in
--                          the legacy `state` field) until the agent saves
--                          Settings once. See inferProfileCountry in
--                          lib/regions.ts.
--
--   open_houses.country    ISO code of the PROPERTY, set from the Google
--                          address result at create/edit time (falls back to
--                          the agent's country). Tells the visitor sign-in
--                          form which dial code to default the phone field
--                          to, and whether to show the US-only NAR notice.
--                          Null on rows created before this migration = US/CA
--                          (the only countries the address search allowed).
--
--   visitors.codeword_channel  How the codeword message actually went out:
--                          'sms' (default, everything before today) or
--                          'whatsapp' (numbers in countries our SMS routes
--                          can't reach — see lib/messaging-channel.ts). The
--                          delivery status columns from migration 014 are
--                          shared: a WhatsApp message has a Twilio SID and
--                          posts the same status callbacks. Mirrored into
--                          visitor_archive because it's part of the delivery
--                          proof (migration 040's reasoning).
--
-- No CHECK constraints on the country columns on purpose: the app validates
-- against libphonenumber's country list, which moves faster than we would
-- edit a constraint. Safe to re-run: every ADD COLUMN uses IF NOT EXISTS.
--
-- Deploy order doesn't matter. The code detects whether these columns exist
-- (the profile row either has a `country` key or it doesn't) and simply
-- doesn't persist the country until they do — everything else works
-- meanwhile, with the country inferred. Run this any time; once it's in, the
-- agent's Country choice starts saving.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country text;

ALTER TABLE public.open_houses
  ADD COLUMN IF NOT EXISTS country text;

ALTER TABLE public.visitors
  ADD COLUMN IF NOT EXISTS codeword_channel text;

ALTER TABLE public.visitor_archive
  ADD COLUMN IF NOT EXISTS codeword_channel text;
