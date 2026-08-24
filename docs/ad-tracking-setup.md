# Ad tracking setup (Meta, Google Ads, YouTube)

The site already contains everything it needs to report to Meta and Google.
It is switched **off** until you paste the IDs below into Vercel. Nothing
loads on the visitor sign-in pages, the agent dashboard, admin, or the sponsor
portal — only on the public marketing pages (homepage, blog, FAQ, contact,
partners, resources, gift, and the sign-up/login page). Browsers that send the
Global Privacy Control signal get no ad tags at all.

YouTube ads run through Google Ads, so the one Google Ads tag covers both.

## Where to paste the IDs

Vercel → the ohACCESS project → **Settings → Environment Variables**. Add each
one for **Production** (Preview too if you want to test on a preview URL), then
**redeploy** — the values are baked in at build time.

| Variable | What it is | Where to find it |
| --- | --- | --- |
| `NEXT_PUBLIC_META_PIXEL_ID` | 15–16 digit number | Meta Events Manager → Data sources → your pixel ("Dataset ID") |
| `NEXT_PUBLIC_META_DOMAIN_VERIFICATION` | Long code from the `<meta name="facebook-domain-verification">` tag | Meta Business Settings → Brand Safety → Domains → add `ohaccess.com` → "Meta-tag verification" (DNS verification also works — either is fine) |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | `AW-` followed by digits | Google Ads → Tools → Google tag (or any conversion action's tag setup) |
| `NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL` | The part **after the slash** in `AW-123456789/AbCdEfGhIj` | Google Ads → Goals → Conversions → **+ New** → Website → "Add a conversion action manually": Sign-up, count **One** |
| `NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL` | Same idea | Another conversion action: Purchase, count **Every**, "Use different values for each conversion" |
| `NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL` | Same idea (optional) | Another conversion action: Submit lead form (contact / partner inquiry) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `G-` followed by letters/digits (optional) | Google Analytics 4 → Admin → Data streams → Web → Measurement ID |
| `META_CAPI_ACCESS_TOKEN` | Long token (a secret — no `NEXT_PUBLIC_` prefix, ever) | Meta Events Manager → your dataset → Settings → Conversions API → Generate access token |
| `META_TEST_EVENT_CODE` | `TEST` followed by digits (temporary) | Meta Events Manager → your dataset → Test events tab. Set it only while verifying, then delete it from Vercel — while it's set, events go to the test view instead of real reporting |

Only set the ones you have. A missing Google Ads label just means that
conversion isn't sent to Google Ads (the GA4 event still is); a missing pixel
ID means Meta simply doesn't load.

## What gets reported

| Moment | Meta | Google Ads / GA4 |
| --- | --- | --- |
| Any marketing page view (incl. clicking between pages) | `PageView` | Ads remarketing hit; GA4 `page_view` |
| Sign-up form submitted on /login | `CompleteRegistration` — sent twice (browser pixel + server Conversions API) with a shared event id so Meta counts it once; the server copy survives iOS tracking prevention and ad blockers | `sign_up` + Ads conversion (signup label) |
| Contact or Partners form submitted | `Lead` | `generate_lead` + Ads conversion (lead label) |
| Stripe checkout completed (back on the dashboard) | `Purchase` with amount + currency | `purchase` with amount, currency, Stripe session id + Ads conversion (purchase label) |

The purchase amount comes from Stripe after any promo code, so what Meta and
Google see is what was actually charged.

## Checking it works (5 minutes)

1. Deploy with at least the pixel ID and Ads ID set.
2. Open the homepage in Chrome with the **Meta Pixel Helper** extension — it
   should show one `PageView` for the pixel ID. Google's **Tag Assistant**
   extension should show the `AW-…` tag firing.
3. Open a visitor sign-in link (`/register/…`) — both extensions should show
   **nothing**. That's the privacy promise; if a tag shows up here, stop and
   ping me.
4. Meta Events Manager → Test events shows PageViews within a minute. Google
   Ads conversions show "Recording conversions" the first time one fires (a
   test signup with a throwaway email works).
5. **Conversions API dedup check**: with `META_CAPI_ACCESS_TOKEN` and
   `META_TEST_EVENT_CODE` set, do a test signup on /login. Test events should
   show `CompleteRegistration` twice — once "Browser", once "Server" — marked
   as deduplicated (one conversion, not two). Then delete
   `META_TEST_EVENT_CODE` from Vercel and redeploy.

## Good to know

- **Meta domain verification** is required before Meta will let you optimize
  campaigns for CompleteRegistration/Purchase. Do it first.
- **Link YouTube to Google Ads** (Google Ads → Tools → Linked accounts → YouTube)
  so video campaigns can use the same conversions and remarketing lists.
- **Ad URLs**: keep using `?ref=` in your ad destination URLs
  (e.g. `https://www.ohaccess.com/?ref=meta-launch`) — the admin Sources
  report already buckets signups by it, so you get your own count next to what
  Meta and Google claim.
- **Privacy Policy §10** was updated to disclose the Meta Pixel and Google
  tags, name the opt-outs, and state that GPC is honored. The version number
  and effective date were left alone for you to decide.
- **Meta Conversions API is installed** (added 2026-08-23): the signup
  conversion is also sent server-side with the email SHA-256-hashed, so iOS
  tracking prevention and ad blockers can't eat it. It obeys the same rules —
  inert until the token is set, skipped for Global Privacy Control browsers.
- Not done (say the word if you want them later): Google enhanced conversions
  (Google's equivalent of the above), a cookie-consent banner (not required
  for a US-only B2B audience; would be needed before advertising to EU/UK
  visitors).
