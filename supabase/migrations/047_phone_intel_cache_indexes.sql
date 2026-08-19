-- Phone-intel cache: before paying Twilio Lookup for a number's carrier +
-- line type, /api/register now checks whether the same number (for the same
-- visitor, within 12 months) was already looked up at an earlier ohACCESS
-- sign-in — live or archived — and reuses that answer. See
-- pickCachedPhoneIntel in lib/register-helpers.ts for the rules.
--
-- That check is a `phone IN (...)` against both tables, neither of which had
-- a phone index. Plain btree indexes keep the check instant as the tables
-- grow. The code works without them (sequential scan, fine at today's size),
-- so this can be run before or after the deploy, any time.
create index if not exists visitors_phone_idx
  on public.visitors (phone);

create index if not exists visitor_archive_phone_idx
  on public.visitor_archive (phone);
