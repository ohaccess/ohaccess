# Agent verification + bot check: setup

Shipped 2026-09-13. Two protections against non-agents using ohACCESS.

## 1. Agent verification (phone code + licence)

**What agents see:** the first time they click **New Open House**, they get a
"Verify your account" card instead of the form:

1. Pick their country, enter their licence number (and state/province) where
   that country requires one, and their mobile number. Then **Send my code**.
2. Type the 6-digit code from the text (WhatsApp in countries where our SMS
   can't reach). Done, and the open house form appears. It's a one-time step.

Refused numbers: internet/app numbers (Google Voice, TextNow), landlines, and
any number already verified on another ohACCESS account.

**Who skips it:** every agent who already had an open house (live or deleted)
or was on a team when the migration ran. Nobody using ohACCESS today is blocked.

**Enforcement:** in the database. An unverified agent's open house is refused
even if someone bypasses the screen, and agents can't mark themselves verified.

### Turn it on

1. Deploy the code (already safe: nothing changes until step 2).
2. Supabase → SQL Editor → run `supabase/migrations/051_agent_verification.sql`.

No new Vercel settings: it uses the existing Twilio number and WhatsApp template.

### Costs

About $0.01 per verification in the US (one lookup + one text), more for some
countries. Capped at 5 codes per agent per hour.

## 2. Bot check on sign-in and sign-up (Cloudflare Turnstile)

Invisible for real people. It stops bots creating accounts, including bots
that skip the website and hit Supabase directly. Covers: agent login/sign-up,
resend confirmation, reset password, sponsor login/sign-up, team invites,
sponsor invites. Google sign-in is unaffected.

### Turn it on (order matters)

1. **Cloudflare:** sign up free at dash.cloudflare.com → **Turnstile** →
   **Add widget**. Name: ohACCESS. Hostnames: `ohaccess.com` and
   `www.ohaccess.com`. Widget mode: **Invisible** (or Managed).
   Copy the **Site Key** and **Secret Key**.
2. **Vercel:** add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = the Site Key
   (Production). Redeploy.
3. **Supabase:** Authentication → Attack Protection → **Enable Captcha
   protection** → provider **Turnstile** → paste the **Secret Key** → Save.

Do step 3 only after step 2's deploy is live, or every email/password
sign-in fails until it is.

**To undo:** turn off Captcha protection in Supabase first, then remove the
Vercel variable.
