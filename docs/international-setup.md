# International setup (any country + WhatsApp codewords)

ohACCESS now works for an agent anywhere in the world, not just the US and
Canada. The code is done; this is the short list of things only you can do
(one SQL paste, a few Twilio clicks, and — when you want it — a WhatsApp
sender). Until the WhatsApp part is set up, everything else still works
exactly as before: SMS codewords, email codewords, US/Canada unchanged.

## What changed for agents (no action needed)

- **Settings → Agent Profile** has a **Country** field. It pre-selects itself
  from the browser's location the first time (then the browser language, then
  US) and can be changed any time. Existing US agents stay US; an agent whose
  licence state is a Canadian province is recognised as Canada.
- That country drives: the phone field's dial code (🇦🇺 +61 …), the word
  **Brokerage** vs **Agency**, which licence fields appear and what they're
  called (License # + State in the US; Licence + Province in Canada; Licence +
  State/Territory in Australia; a national REA/PSRA/CEA/RERA number where
  that's the scheme; hidden in the UK where agents aren't licensed; a generic
  optional "Licence / registration number" everywhere else), and the address
  search, which now looks in the agent's own country (US/Canadian agents keep
  both).
- **Open house form** labels follow the property's country (State vs Province
  vs County; ZIP vs Postcode), and the state/region is only required where the
  country has them. Non-US/CA addresses are stored with the country name on
  the end ("…, NSW 2026, Australia") so maps links can't land on a same-named
  street abroad. US/CA addresses are stored exactly as they always were.
- **Visitor sign-in form**: the phone field has the same country picker,
  defaulting to the property's country. Numbers are checked against that
  country's numbering plan (US/Canadian numbers keep the strict rules they
  always had). The US-only NAR notice only shows on US properties. The 16
  translations no longer say "US or Canadian phone number".
- **Agent alert texts** now show the sign-in time in the property's timezone
  (was always Central Time) and can't break a sign-in if the alert itself
  can't be sent.

## Step 1 — Database (one paste)

Supabase Studio → SQL editor → paste and run
`supabase/migrations/048_international.sql` (it's tiny: three nullable
columns — `profiles.country`, `open_houses.country`,
`visitors.codeword_channel` — plus the archive mirror). Safe to re-run.

Order doesn't matter — the code notices whether the columns exist. Until
they do, an agent's Country choice is inferred (US, or Canada from a
Canadian province) but not saved; the moment the SQL is in, Settings starts
saving it. Nothing breaks either way.

## Step 2 — Twilio: let SMS out of North America

Twilio blocks SMS to other countries until you allow them.

1. Twilio Console → **Messaging → Settings → Geo permissions**.
2. Tick the countries you're happy to pay to text (or "select all" — it's
   per-message billing, nothing recurring). The usual suspects to make sure
   are on: Australia, New Zealand, United Kingdom, Ireland, South Africa,
   Singapore, Hong Kong, UAE, Mexico, Brazil, the EU.
3. Save. That's it — our toll-free number can send one-way SMS to any enabled
   country (replies/STOP only work from US/Canada, which is fine: the
   codeword is a one-time transactional text).

Costs: international SMS runs roughly $0.03–$0.10 per message depending on
the country (vs ~$0.01 domestic). The codeword stays under 160 GSM characters
so it's always one segment.

Optional, later: an **alphanumeric sender ID** ("ohACCESS" as the sender
name instead of a number) is supported in most countries outside the US/
Canada and looks more trustworthy. Messaging → Senders → Alphanumeric sender
IDs → add `ohACCESS` → add it to the `ohACCESS Production` Messaging Service's
sender pool. Twilio then picks it automatically for countries that allow it.
Some countries need pre-registration for it; Twilio's list says which.

## Step 3 — WhatsApp codewords (for countries SMS can't reach)

Some countries don't accept SMS from a foreign number at all (India, the
Gulf, Egypt, the Philippines, Indonesia, Vietnam…), and in many more
WhatsApp is simply what people read. For those, ohACCESS sends the codeword
as a **WhatsApp message** instead — same codeword, same email backup, and the
visitor's sign-in form already says "WhatsApp" instead of "SMS" for those
numbers. If an SMS to any other country bounces with a routing error, it
retries over WhatsApp automatically.

This is **off until both env vars below are set.** Nothing else changes.

### 3a. Register a WhatsApp sender (about 20 minutes + Meta's review)

You need a Meta (Facebook) Business account — the ohACCESS LLC one you'd use
for ads is perfect. Then:

1. Twilio Console → **Messaging → Senders → WhatsApp senders → Create new
   sender**.
2. Pick the phone number. Two good options:
   - **Reuse the toll-free +1 888 921 3995** — one number for everything. US
     toll-free numbers are supported, but Meta can only verify them by
     **voice call**: Twilio walks you through pointing the number's voice
     webhook at a Twilio-provided voicemail so the spoken OTP lands in your
     email (up to ~10 minutes). Fiddly but documented in the flow.
   - **Buy a cheap US local number** (~$1.15/mo) just for WhatsApp — the OTP
     arrives as a text in the Twilio console, done in a minute. Visitors see
     the display name "ohACCESS", not the number, so the number itself
     doesn't matter. **(Recommended — simpler.)**
3. **Continue with Facebook** → log in → choose the ohACCESS business
   portfolio → create the WhatsApp Business Account → business profile:
   display name **ohACCESS**, category *Business services* (or *Real estate*),
   description "Verified open-house check-in codewords", website
   https://www.ohaccess.com.
4. Enter the OTP. The sender shows **Online** in Twilio.
5. Meta reviews the display name (usually same day). Until Meta **business
   verification** is done (Business Settings → Security Center → Start
   verification; needs the LLC docs you already have — can take a couple of
   weeks), the sender is limited to **250 business-initiated conversations
   per 24 h**. Plenty to start; verification lifts it to 1,000 and up.

### 3b. Create the codeword template (5 minutes + approval)

WhatsApp only lets a business start a conversation with a **pre-approved
template**. Ours mirrors the SMS.

1. Twilio Console → **Messaging → Content Template Builder → Create new**.
2. Name: `ohaccess_checkin_link` · Language: **English** · Category:
   **Utility** · Content type: **Text**.
3. Body — paste exactly:

   ```
   You are checked in for the open house at {{1}}. Tap to view your check-in details: {{2}} (a copy was also emailed to you).
   ```

   Sample values when it asks: `{{1}}` = `123 Main St, 78701`, `{{2}}` =
   `https://ohaccess.com/r/abc123`.

   ⚠️ Why a LINK and not the word itself (learned 2026-08-19): Meta's
   reviewer rejects any Utility template that puts a secret word in the
   message — three wordings ("your codeword … is X", "tell the host the
   word X", "host will ask for today's greeting: X") all came back
   **INCORRECT_CATEGORY / authentication content** within seconds. The
   category Meta wants for that (Authentication, "X is your verification
   code") is **only available after Meta business verification**. A plain
   check-in confirmation with a link passes the classifier. The link opens
   `/checkin/<visitor>/<signature>` — a page showing the codeword(s),
   reachable only via that signed link, which is delivered to the WhatsApp
   number and nowhere else (lib/codeword-link.ts).

   Once business verification is approved you *can* switch to an
   Authentication template (word in the message, Meta's fixed wording, copy-
   code button) by creating it in Twilio with content type
   *whatsapp/authentication* and setting `TWILIO_WHATSAPP_TEMPLATE_KIND=auth`.
4. Save → **Submit for WhatsApp approval**. Approval is typically minutes to a
   few hours. The page shows the template's **Content SID** (`HX` + 32
   characters) — copy it.

If you ever change the wording you create a new template (new SID) and swap
the env var; the old one keeps working until you do.

### 3c. Set the env vars + redeploy

Vercel → ohACCESS project → Settings → Environment Variables (Production),
and the same two lines in `.env.local` (then re-paste into the locked Apple
Note):

| Variable | Value |
| --- | --- |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+1XXXXXXXXXX` — the sender number from 3a (the `whatsapp:` prefix is optional; the code adds it) |
| `TWILIO_WHATSAPP_CODEWORD_CONTENT_SID` | the `HX…` Content SID from 3b |
| `TWILIO_WHATSAPP_TEMPLATE_KIND` (optional) | what the template's variables carry: `link` (default — address + check-in link), `word` (address + the word), `auth` (Meta Authentication format, word only) |
| `WHATSAPP_FIRST_COUNTRIES` (optional) | comma-separated ISO codes to REPLACE the built-in WhatsApp-first list, e.g. `IN,AE,BR`. Leave unset for the default list (India, the Gulf states, Egypt, Philippines, Indonesia, Vietnam, Pakistan, Bangladesh, Sri Lanka, Nigeria, Kenya, Ghana, Turkey, Brazil, Argentina, Colombia) |

Redeploy. Done — WhatsApp is live.

### 3d. Check it works

Sign in to a test open house with a number from a WhatsApp-first country
(any Indian or Brazilian WhatsApp number of a friend works, with their OK).
They get the template message from "ohACCESS" on WhatsApp; the dashboard row
shows a green **WhatsApp** tag next to their number; the Twilio log shows the
message under the WhatsApp sender. Delivery failures show as "⚠ undelivered"
like SMS (same status webhook).

## What I deliberately did NOT change (your call, later)

- **Legal pages.** Privacy §"International" still says US-only / no GDPR,
  PIPEDA etc.; both Terms still cite TCPA, CAN-SPAM, Texas law and Tarrant
  County arbitration; the visitor consent language is TCPA-shaped. You said
  to open the product regardless — nothing in the code blocks anyone — but
  these are the documents to take to an attorney before marketing outside
  the US.
- **Stripe.** Checkout already accepts any country's card (no country
  restriction except the US-only sign-hardware offer). Prices stay USD and
  no VAT/GST is calculated — fine for "someone in Australia finds it", worth
  revisiting if international volume shows up.
- **Dashboard language + date formats** stay English / US-style; only the
  visitor form is translated.
- **Sponsor phone numbers** (sponsor portal) and the marketing contact forms
  still use the US mask — those audiences are US/Canada.

## Troubleshooting

- *Visitor in country X gets "⚠ undelivered" on SMS* → that country isn't
  enabled in Geo permissions (Step 2), or SMS can't reach it and WhatsApp
  isn't configured (Step 3).
- *WhatsApp send fails with Twilio error 63016* → the template isn't approved
  yet, or the Content SID is wrong.
- *Error 63007* → the `TWILIO_WHATSAPP_FROM` number isn't a registered
  WhatsApp sender (finish 3a).
- *Agent's address search finds nothing* → their **Country** in Settings
  doesn't match where the property is; the search looks in the agent's
  country.
