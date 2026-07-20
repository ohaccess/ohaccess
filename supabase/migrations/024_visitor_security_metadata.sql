-- Security/forensic metadata captured at visitor sign-in (disclosed in
-- Privacy Policy v1.2): the request IP + browser, and the phone number's
-- carrier + line type from Twilio Lookup. Line type distinguishes real
-- mobile lines from VoIP "burner app" numbers (TextNow, Google Voice, ...),
-- which is the pivot authorities need if a sign-in is ever investigated.
alter table public.visitors
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists phone_carrier text,
  add column if not exists phone_line_type text;
