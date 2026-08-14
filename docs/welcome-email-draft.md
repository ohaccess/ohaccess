# Getting-Started Email — Copy Draft (for Dave's sign-off)

**Status:** ✅ APPROVED & BUILT (2026-08-13) — implemented in `lib/welcome-email.ts`,
sent by `app/api/notify/new-account/route.ts` on first dashboard load, flagged
at-most-once via `welcome_email_sent_at` (migration 045). This doc stays the copy
source of truth — if you edit the email, change this doc and the code together.

**Sender:** `ohACCESS <hello@mail.ohaccess.com>` (matches our existing friendly sends)
**Reply-to:** your support inbox, so "just hit reply" below actually works — confirm which address you want.
**Timing:** fires once, when the agent first lands on the dashboard after confirming their email.
**Video links:** both live — the Settings tutorial (https://youtu.be/dzKb4RE3fO4) and the
New Open House tutorial (https://youtu.be/Rf_6rUxUQpQ), verified resolving to the right videos.

---

**Subject:** Welcome to ohACCESS — your first open house is 10 minutes away

**Preheader:** Two quick steps now. We handle the rest automatically.

---

Hi [First Name],

Welcome to ohACCESS! You're about to replace the paper sign-in sheet with
verified digital check-ins — legible names, real phone numbers, real leads.

Getting started takes two steps:

## Step 1 — Set up your profile (about 5 minutes)

Go to **Settings** and fill in your Agent Profile: name, brokerage, phone,
and the email you want visitors to see. Then add your headshot, logo, and
brand colors under **Branding**. Your logo and colors dress up your printed
QR sign, and your headshot appears on every email visitors receive — so it
all looks like *you*, not us.

If you use a CRM (Follow Up Boss, kvCORE, Lofty, and others), paste your
lead-intake address under **Send Leads to Your CRM** and every sign-in flows
straight in as a formatted lead.

▶ [**Watch: Setting up your profile**](https://youtu.be/dzKb4RE3fO4)

## Step 2 — Create your first open house (about 3 minutes)

Click **New Open House**. Start typing the address and we'll fill in the
rest — city, state, zip, even the correct time zone. Pick the date and
times, then set your two codewords: create your own branded or unique
words, or use our auto-generate buttons if you prefer. (The codewords are
what visitors receive by text and email to show you at the door — proof
their contact info is real.)

Save it, then tap **📱 QR Code** to print your branded sign. There's also
**📌 My QR code** — one permanent code that always points to your next
open house, whichever it is. Tip: the sign deliberately has no address on
it, so laminate it once and reuse it at every open house.

▶ [**Watch: Your first open house**](https://youtu.be/Rf_6rUxUQpQ)

## Then ohACCESS takes over

Here's what happens automatically — no buttons to press:

- **The day before**, you get a reminder email with your printable sign, a
  sign-placement tip, and two ready-to-read door scripts.
- **At the door**, every visitor scans, fills out a 30-second form (in any
  of 16 languages), and instantly gets their codewords by text and email.
  You get an alert the moment each one signs in.
- **The next morning**, every visitor gets a thank-you email with your
  photo and contact info.
- **About 30 minutes after you close**, you get a full report — every lead
  grouped by how soon they're buying.
- **For your seller:** tap **📊 Seller report** for a shareable results
  page — visitor counts, buyer timelines, and honest feedback, with no
  visitor contact info exposed.

## Three features people love once they find them

- **💌 Invite** — scheduling a new open house? One tap emails your past
  visitors who are still in their buying window a personal invitation.
  Your open houses start filling themselves.
- **⧉ Duplicate** — holding the same property open again? Two clicks makes
  next weekend's event.
- **🎁 Refer an Agent** — share your link from Settings; when a colleague
  goes Pro, you earn a free month.

Your first **25 visitor sign-ins are free** — no credit card needed. That's
one or two good open houses to see the difference verified sign-ins make.

Questions? Just hit reply — a real person reads these (me).

Dave Sheehan
Founder, ohACCESS

---

*Draft notes (not part of the email):*
- *"codeword"/"codewords" (one word) used throughout — matches the dashboard's "Access Codewords" section and all visitor-facing copy (Dave's call, 2026-08-13).*
- *The 25-free-sign-ins line intentionally frames the trial as "one or two open houses" — sets the expectation that upgrading is normal.*
- *Nothing here mentions Teams, Sponsorships, or gifting — a brand-new solo agent doesn't need them on day one, and the email stays scannable.*
