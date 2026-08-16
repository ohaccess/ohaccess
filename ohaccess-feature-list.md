# ohACCESS — Complete Product & Feature Reference (Detailed)

*A single, exhaustive source of truth describing everything ohACCESS is and does — features, mechanics, exact copy, and rules. Written to hand to an AI assistant so it fully understands the product. Reflects what is actually shipped in production. Last updated 2026-08-11.*

---

## 1. What ohACCESS Is

ohACCESS replaces the paper open-house sign-in sheet with a **verified digital check-in**. A visitor scans a QR code at the door, fills out a short registration form, and instantly receives a **verification "codeword" by both SMS and email**. They share that codeword with the host agent to gain entry — which proves the phone number and email they entered are real, working, and theirs. The agent gets an instant alert (SMS + email) and a running, verified visitor log.

**Core value:** real estate agents (and the sellers whose homes they show) get a trustworthy record of who actually entered the property, with contact info verified in real time — instead of the fake names and bad numbers people write on paper sheets.

- **Website:** www.ohaccess.com
- **Status:** Live in production. Paid billing (real credit cards) and SMS delivery are both live.
- **Two codewords per visitor:** an **SMS codeword** (an adjective, the *primary*) and an **email codeword** (a home-themed noun, the *fallback*), so every visitor has a way in even if one channel is slow. At the door the agent is coached to ask for the **text code first** (a real phone is hardest to fake) and accept the email code only if the text didn't arrive.
- **Patent:** U.S. Provisional Patent Application filed May 2026 ("System and Method for Real-Time Contact Verification, Qualified Lead Capture, and Incentive-Based Engagement Validation at In-Person Events"). "Patent Pending" is displayed site-wide.

---

## 2. The Visitor Experience (no account needed)

### 2.1 The registration form
The visitor scans the QR and lands on a mobile-optimized form branded with the agent's (or team's) logo and colors. Fields collected:
- **First name** and **Last name** (must be two distinct words — validated).
- **Email** (format-validated).
- **Phone** (auto-formats to `(XXX) XXX-XXXX`; full North American structural validation — rejects impossible area/exchange codes, N11 service codes, 555-01xx fictional numbers, and all-identical-digit numbers).
- **Buying timeline** — one of four options (the exact stored values): **"0–3 Months," "3–6 Months," "6–12 Months," "12+ Months."**
- Optionally, **one agent-defined custom question** (typed answer or multiple choice — see §3.13). Always optional for the visitor; an unanswered question never blocks the codewords.

Everything is re-validated server-side so a crafted request can't slip a junk number in.

### 2.2 Sixteen languages
The form is fully translated into **English, Spanish, French, Chinese (Simplified), Tagalog, Chinese (Traditional), Vietnamese, Korean, German, Russian, Portuguese, Hindi, Punjabi, Italian, Polish, and Greek** — ordered roughly by US/Canada speaker counts. A flag picker sits in the top-right; the form auto-detects the device language and remembers the visitor's choice **durably**: a fresh tap is saved on the device (localStorage) and the language of their last completed sign-in also rides in the year-long returning-visitor cookie (§2.6), so the choice survives even Safari's ~7-day purge of site storage. Priority: most recent tap → last sign-in's language → device language → English.
- **Translated:** all labels, placeholders, timeline labels, error messages, buttons, both consent blocks, and the success screen.
- **Always English regardless of language:** the submitted timeline value (so dashboards/CRMs parse consistently), the SMS/email code messages themselves, the Terms and Privacy pages, and the words "STOP"/"HELP" (literal carrier keywords). Every non-English consent appends a line stating the English version governs.

### 2.3 Consent (named clickwrap)
Consent is an **extended clickwrap** — not a checkbox. By tapping the request button the visitor agrees to receive a one-time SMS codeword (with "Message & data rates may apply. Reply STOP to opt out, HELP for help.") and agrees to the ohACCESS Terms & Privacy Policy **and** to be contacted by the host agent — **and, if the open house is sponsored, the named sponsor** — by phone, text, and email. The consent line literally names the agent and sponsor.

There's also a **"Prefer not to register?"** block explaining the NAR-compliant alternative (schedule a private showing with the buyer's agent of your choice under a written buyer-representation agreement) — this preserves the legal validity of the consent by offering a real alternative.

### 2.4 What the visitor receives
- **SMS** (tuned to fit one 160-character segment): `SMS code at [address] is "[CODEWORD]". Share code w/ host for access. Reply STOP to opt out.` The word "at" before the address makes it tap-to-open in Apple/Google Maps; the listing short-link is appended only if it still fits in one segment.
- **Email** (subject: *Your ohACCESS email code: [CODEWORD]*): a branded header, the large email codeword, a cross-reference to the separately-texted SMS code, a property-facts card (address, date, hours, beds/baths/sqft, price, listing link), the **agent's contact card** (headshot, name, brokerage, tap-to-call phone, email, logo), and — where applicable — a **"Sponsored by" card** and an **"Upcoming Open Houses" section** (see §3.9 and §3.10).

### 2.5 US + Canada
Both US and Canadian addresses and phone numbers work (province → state field, postal codes supported). *Note: marketing into Canada is legally gated pending Canadian counsel, but organic Canadian sign-ins function fully.*

### 2.6 Returning visitors are remembered
A server-set 1-year cookie pre-fills the form at the visitor's *next* ohACCESS open house — any agent's, anywhere. They see a **"Welcome back, [name]"** banner with their info already typed — **in the language they signed in with last time** (the cookie carries it) — and a one-tap **"Not you?"** link clears it all (for borrowed phones). Ten-second sign-ins for repeat visitors.

### 2.7 Post-sign-in feedback
Below the success screen's confirmation, the visitor is optionally asked to **rate the home 1–10** and tag the price **Too High / Reasonable / Too Low** — plus up to **two more agent-defined questions** (§3.13). One-time and tokenized (can't be forged or spammed), entirely optional, and aggregated **PII-free** into the seller report. Honest market feedback, gathered automatically.

### 2.8 Touring-agreement e-signing
If the open house requires it, a signing step appears between the form and the codewords: the visitor views each PDF (tokenized link), types their full name, ticks an E-SIGN consent box, and signs on their phone. **The codewords are held back until they sign.** The signed PDF — the original document(s) merged with an appended signature-certificate page recording signer name, timestamp, IP, device, and a SHA-256 fingerprint per document — is emailed to the visitor **and** the agent in one send. **ohACCESS never stores the signed document** (only a one-line receipt row) — itself a privacy selling point. Agents upload up to **5 blank PDF templates** (≤5 pages, ≤2 MB each) in Settings and attach up to **3 per open house**; the visitor log shows **Signed / Not signed** chips.

### 2.9 Expired-QR lead capture (referral loop)
Scanning a sign after the open house is deleted doesn't dead-end: the visitor sees a friendly "this open house has ended" page with a short name/email/phone/zip form. If the hosting agent is **still on trial or on a paid plan**, the page shows the agent's contact card (name, brokerage, tap-to-call phone, email) and the completed form is **emailed straight to the agent** (reply-to = the buyer). If the account has lapsed, the lead goes to ohACCESS instead. A stale sign becomes a lead source — and staying subscribed keeps the leads flowing to you.

### 2.10 Next-morning thank-you email
Every visitor gets an automatic thank-you at **9am local time the day after** their visit: listing recap, the agent's contact card (headshot or initials avatar), the sponsor card where applicable, and the agent's upcoming open houses. If the send window is missed, the email is skipped rather than sent late.

### 2.11 One-click unsubscribe
Visitor marketing emails (thank-you, invites) carry RFC 8058 one-click unsubscribe honored **globally across all agents**, POST-only so inbox security scanners can't accidentally unsubscribe anyone. (This also satisfies the Gmail/Yahoo bulk-sender requirements.)

---

## 3. The Agent Experience

### 3.1 Account & access
Sign up / log in with email + password or **Google login** (branded "ohaccess.com" consent screen). Signup requires agreeing to Terms + Privacy. Password reset flow included.

### 3.2 Creating & editing an open house
A two-section form ("Property Details" + "Codewords"):
- **Property Details:** Street Address (with **Google Places autocomplete** that auto-fills city/state/zip **and the property's true time zone**), Unit/Suite, City, State/Province, Zip/Postal, Listing Price, Square Footage, Bedrooms, Bathrooms, a **date picker** (calendar), **start/end time** pickers, and a Listing URL. Required: address, city, state, date, start time, end time, and both codewords.
- **Time zones are handled correctly:** times are entered as wall-clock in the **property's** time zone and stored as precise UTC instants (DST-aware), so an agent scheduling a listing in another time zone still gets correct times everywhere.
- **Codewords:** the agent sets a **Text (SMS) codeword** and an **Email codeword**, each with an **auto-generate** button. SMS words are curated adjectives (BESPOKE, CHARMING, ELEGANT, LUXE, MODERN, PRISTINE, STATELY, STUNNING, TIMELESS, …); email words are curated home-themed nouns (BUNGALOW, COTTAGE, ESTATE, MANOR, PENTHOUSE, TOWNHOUSE, VILLA, …). Custom words auto-uppercase.
- Editing the schedule intelligently **re-arms the post-event report** only when the actual start/end instant changes (editing other fields won't re-send it).
- **Duplicate:** a "⧉ Duplicate" button pre-fills a new open house with every detail except date/times — same property, new day, two clicks.
- **Overlap warning:** saving an open house that overlaps another of the agent's events pops a soft warning listing the conflicts and explaining that the permanent QR will make guests choose (suggesting the per-event QR instead), with a "Save anyway" option — it never blocks.

### 3.3 QR codes — three kinds
1. **Per-open-house QR** — a unique QR for each listing (`/register/[id]`), rendered at 512px, high error-correction.
2. **Permanent per-agent QR** ("📌 My QR code") — one stable link (`ohaccess.com/r/<code>`) the agent prints **once and reuses forever**. At scan time it resolves dynamically: to the **soonest upcoming/live** open house; if none is upcoming, to the **most recent past** one (so test scans always work); if the agent has zero open houses, to a friendly branded "No open house right now" page with the agent's name. If two of the agent's open houses **overlap**, the scan shows a branded **"Which open house are you at?"** chooser card instead of guessing.
3. **Demo QR codes** — four printed sales-demo signs the admin can repoint on the fly (internal sales tool; see §7.5).

### 3.4 Printable branded sign
A print-ready, letter-portrait sign generated on demand (from the QR modal or via a public `/api/sign` link used in reminder emails). It carries the agent's/team's logo (or the ohACCESS wordmark as fallback), a **"PLEASE READ"** banner in the brand color, the QR framed in the accent color, and fixed wording:
> "For the safety of the host, the seller, and the property, all visitors must scan the QR-code and complete the registration form before entering."
> "A unique codeword to enter this Open House is immediately sent via SMS and Email. Share the codeword with the host to gain access."

**No address is printed** — so one laminated sign works for every open house *and* for the permanent QR. Other QR-modal actions: download PNG, copy registration URL, native share.

### 3.5 The visitor log
A live, sortable table per open house — columns: **Name, Phone, Email, Timeline, Registered, ✓ (verified)** — with three stat cards on top (Active Open Houses, Total Registrations, Verified at Door). Row features:
- **Verify toggle:** one click marks a visitor "Verified at door."
- **Status badges:**
  - 🚫 **Opted out** (grey) — the number replied STOP; do not contact.
  - ⚠ **undelivered** (red, phone) / ⚠ **bounced** (red, email) — the code couldn't be delivered (bad contact info).
  - ⚠ **VoIP** (amber) — the number is a non-fixed VoIP/burner (TextNow, Google Voice, etc.), suggesting extra ID verification. *(Legitimate cable/home VoIP is not flagged.)*
  - **Signed / Not signed** — touring-agreement status, when the open house requires agreements (§2.8).
  - 📝 next to a name — the agent has saved a private note.
- **Timeline pill** — color-coded hot→cold (0–3 mo orange → 12+ mo grey).

### 3.6 Visitor detail + private notes
Clicking a visitor opens a detail view (on desktop and a mobile `/visitor/[id]` page): tap-to-call/email links, all status badges, a **verify toggle**, and a **private notes** field (e.g. "Pre-approved, wants 3BR, following up Monday"). Includes a **per-visitor delete** — which **archives the record first** (so who-was-in-the-house history is never silently lost), then removes it.

### 3.7 CSV export
Export the visitor log (First Name, Last Name, Email, Phone, Timeline, Registered, Verified) to CSV per open house.

### 3.8 Add-to-calendar
Every scheduled open house offers **Google, Outlook, and Apple (.ics)** calendar links, anchored to the property's time zone.

### 3.9 Automated agent emails
- **Getting-started (welcome) email** — sent **once per account** the moment the agent clicks their email-confirmation link (a DB trigger fires the send; the first dashboard load is a fallback and covers Google OAuth signups, which are confirmed at creation): the two-step quick start (Settings profile/branding → first open house), links to the two **YouTube tutorials** (Settings, New Open House), the rundown of everything that happens automatically, three "hidden gem" features (💌 Invite, ⧉ Duplicate, 🎁 Refer an Agent), and the 25-free-sign-ins note. From `ohACCESS <hello@mail.ohaccess.com>`, replies to `support@ohaccess.com`. A per-account `welcome_email_sent_at` claim (migration 045) makes it at-most-once; existing accounts were backfilled so only new signups receive it. Copy source of truth: `docs/welcome-email-draft.md`.
- **~24-hour reminder email** — sent the day before each open house: the day/time and Google-Maps-linked address, **QR sign + PNG download links** (both the per-event and the universal QR), a sign-placement tip (near the front door, not the curb), two ready-to-read **door scripts** (a welcome ask and a gentle response to hesitation), **live samples** of the exact visitor SMS and email using that event's real codewords, and (for self-paid Pro agents) a referral nudge.
- **Post-event report email** — ~30 minutes after the open house ends: registration and verified-at-door counts, and the **full lead list grouped by buying timeline** (names, phones, emails — this internal email *does* contain full contact info), plus a "Share your results with the seller" button linking to the privacy-safe seller report.

Both emails inherit team/brokerage branding when the agent is on a team.

### 3.10 Upcoming Open Houses cross-promotion
The visitor's codeword email includes an **"Upcoming Open Houses"** section: the next 5 open houses (within 10 days, same state) from the agent **and their teammates** (never brokerage-wide, to avoid channel conflict), each with a Maps-linked address, price/beds/baths, and add-to-calendar links. Tagline: "Come explore our other listings."

### 3.11 Forensic / fraud capture
Every sign-in silently records **IP address, device/user-agent, and phone carrier + line type** (via Twilio Lookup) as a fraud/safety trail. Separately, a **QR scan log** records every time the registration page is loaded — even if the visitor abandons the form — which powers the "scanned but didn't register" analytics and the seller-report funnel.

### 3.12 Settings the agent controls
Profile (name, brokerage, display email shown to visitors, phone, license #, state), **branding** (headshot URL, logo URL, landing-page URL, primary + accent brand colors with live preview), **custom questions** (§3.13), **disclosures & required notices** (§3.14), **agreement templates** (§2.8), **CRM lead email + CRM type**, **Zapier webhook URL**, **referral link**, and **subscription management**. (For team members, brokerage name/logo/colors are locked and managed by the team lead.)

### 3.13 Custom questions
Agents can add their own questions to the flow: **1 on the sign-in form** and **up to 2 on the post-sign-in success screen** — free-typed or multiple choice (up to 4 options each). Always optional for the visitor: an unanswered question can never block the codewords. Each visitor's record stores the question **exactly as it was asked at the time** (later edits can't rewrite history), and answers flow everywhere leads go — the visitor detail view, CSV export, the CRM lead email, and (aggregated, PII-free) the seller report.

### 3.14 Disclosures & required notices
Agents attach up to **5 label + link pairs** (e.g. Texas IABS, agency disclosure, Consumer Information Statement; HTTPS links only). They're delivered on the sign-in success screen **and** in the codeword email — state-mandated disclosure on autopilot. On a team, brokerage-set disclosures override an individual member's. The exact links shown to each visitor are snapshotted onto their record.

### 3.15 "Invite past visitors" re-marketing
When an agent publishes a new open house, a 💌 **Invite** button (plus an auto-prompt right after saving) emails past visitors who are **still inside their stated buying window** a personal, agent-voiced invitation with the mapped address, add-to-calendar buttons, an RSVP reply link, and unsubscribe. The eligibility engine is deliberately conservative: invite windows are padded about a month past the stated timeline (0–3 mo → 4 months, 3–6 → 7, 6–12 → 13, 12+ → 16), a repeat visit resets the clock, each visitor gets **at most 2 invites per agent per rolling 30 days**, opt-outs/bounces/already-invited are excluded, batches cap at 200, and the hottest (soonest-expiring) buyers go first. The agent sees a checkbox list plus an honest "not included" breakdown before sending.

---

## 4. Seller Report Card

A shareable, **privacy-safe** results page for the home seller (`/report/<code>`), generated from the dashboard ("📊 Seller report") or linked from the post-event report email.

**Shows:** registered-visitor **count**, a **"Buying within 6 months"** headline (the two soonest timeline buckets), a **timeline distribution** (horizontal bars), a green verified-sign-in trust banner, an "interest at the door" **scan→registration funnel** (only shown when the scan data is reliable for that event), the **average 1–10 visitor rating** and **price sentiment** (Too High / Reasonable / Too Low) from post-sign-in feedback, **aggregated custom-question answers**, and a "Hosted by" agent contact card + listing link.

**Deliberately hides all visitor PII** — no names, phones, emails, notes, or per-visitor rows. Visitors consented to the *agent* having their info, not the seller. The page is noindex, rate-limited, one-tap shareable (native share sheet), and branded with the agent's/team's logo. Link previews show the property address.

---

## 5. Teams & Brokerages

### 5.1 Team tier (flat, 2–10 agents)
An owner buys a Team plan and becomes the **team lead** (`brokerage_admin`). They can:
- **Invite agents by email** (7-day invite links, seat-limited to 10, with a live "7 / 10" seat counter). Invites roll back if the email fails to send.
- **Manage the roster** — remove members or revoke pending invites. Removed members keep their account and data (dropped to free).
- **Control team branding** — team name, logo (pasted URL), and brand colors, which **mirror automatically onto every member's** visitor emails and printable signs.

When an agent accepts an invite, their profile links to the team, inherits the branding, and — critically — **any existing personal paid subscription is auto-scheduled to cancel at period end** so they're never double-billed.

### 5.2 Brokerage / Activity view
The team lead gets a **brokerage-wide activity dashboard**: 4 stat cards (agents, open houses, total registrations, verified), a sortable per-agent rollup, every agent's open houses, and the ability to drill into any open house's visitor log with **CSV export**.

### 5.3 Team CRM forwarding
The team lead can set a **shared team CRM email** and toggle "send every member sign-in to the team CRM too" — each agent still gets leads in their own CRM; this adds a copy to the team's (deduped if it's the same address).

### 5.4 Brokerage per-seat tier (11–100 agents)
A self-serve per-seat plan at a **flat $11/agent/month** (no volume bands — the bill is always strictly proportional to seats). Owners can:
- **Add/remove seats anytime** with a **live proration preview** — increases are charged the prorated difference immediately (a declined card aborts the change atomically); decreases apply at the next invoice (no mid-term refund, per terms) with a confirmation email.
- **Upgrade a flat Team plan to per-seat in place** when they outgrow 10 seats — same subscription, same billing schedule, prorated difference charged today.
- Over 100 agents = "Contact us" (admin-provisioned, invoice-based; seat changes then handled by an account manager).

### 5.5 Safety nets
- **Double-billing prevention** at checkout (blocks a second subscription) and on team-join (cancels the personal plan), plus an admin "Stop double-charge" tool.
- **Orphan rescue:** if a team subscription lapses (canceled/expired), members automatically drop to free, are unlinked, but **keep their accounts, all their data, and their own branding** — and can self-subscribe. Dunning states (past-due/unpaid) are treated as recoverable, not terminal.
- **Payment-failure banner** shown to members when the team's card fails.

---

## 6. Sponsorships (co-marketing for service providers)

Service providers — mortgage lenders, title companies, inspectors, insurance agents, etc. — can **co-brand the open houses of the agents they work with**.

- **Sponsor portal** (`/sponsor`, separate sign-up): the sponsor builds a **profile card** — full name, company, email, phone, license/NMLS number, landing-page URL, headshot, and logo.
- **Invite & accept:** the sponsor invites agents by email (7-day links, up to 10 agents by default); each agent must **explicitly accept**, which records the agent's on-file consent. Agents can end a sponsorship anytime from Settings; sponsors can remove agents too.
- **On the visitor side:** a gold **"Sponsored by" card** appears **below** the agent's card in the visitor codeword **and next-morning thank-you** emails (headshot, company, contact, license #, logo) with a mandatory RESPA-style disclaimer — *"You are not required to use [Company] for any service. You are free to shop around."* — and the **sign-in consent line names the sponsor** in all 16 languages.
- **Sponsor dashboard** (Dashboard / Agents / Settings tabs): a Team-style activity view showing **only** the sign-ins stamped to this sponsor (i.e., visitors whose consent named them — a hard privacy boundary; pre-sponsorship sign-ins are invisible), with per-agent rollups and **CSV export**. A sponsor **never** controls any agent's name, logo, or colors.
- **Legally cleared:** the named-clickwrap-consent + "Sponsored by" labeling + not-required-to-use disclaimer approach was **signed off by an attorney for RESPA/TCPA.**
- **Billing:** a paying sponsor's agents get Pro-level (uncapped) access. Sponsor billing mirrors Team pricing but is currently collected manually (no self-serve sponsor checkout yet).

*Note: the separate **Partners page** (§8.3) pitches a related but distinct motion — a provider buying a Team plan they fully control. Both mechanisms exist.*

---

## 7. Admin Tools (internal, email-allowlist gated at `/admin`)

A "god-tier" operations dashboard:

### 7.1 Overview & KPIs
Agents signed up (+ this week), paying vs free agents, open houses (live/upcoming/past), total & verified visitors, and a **double-billed** alert card. Plus **Lifetime Numbers** (open houses created / visitors logged / QR scans, across lifetime / 12-month / 30-day — counting deletion archives so history never shrinks) and a **scan→registration conversion %**.

### 7.2 Agents / Open Houses / Visitors tabs
Searchable, filterable, each with CSV export. Open Houses show live/upcoming/past status.

### 7.3 Per-agent actions
- **Impersonate** ("Sign in as") — become an agent for support (via a no-email magic-link swap; restores the admin session afterward; can't impersonate another admin).
- **🎁 Gift** — grant **bonus trial visitors** (raises the 25-registration free cap) or **comp Pro until a date** (no Stripe charge). Refuses agents who already have a live Stripe sub or are team members.
- **Stop double-charge** — cancel a team member's leftover personal subscription.
- **Delete account** — a full cascade delete (type-the-email to confirm; refuses self/other admins; keeps archived visitor records for the 3-year retention window).

### 7.4 Map view
All open houses on a Google Map, color-coded by status (live/upcoming/past), with a **shareable read-only map link** (secret-gated) and jump-to-agent.

### 7.5 Other admin tools
- **Scanned, Didn't Register** panel — recent QR scans with no matching registration (device label, timestamp, agent, IP).
- **Provision brokerage** — stand up an invoice-based brokerage for 100+/custom deals.
- **Demo QR codes** — repoint the four printed demo signs at any open house on the fly (Dave's in-person sales workflow).
- **Referral Sources** (`/admin/sources`) — signups, Pro conversions, and conversion % bucketed by referral code (30-day first-touch attribution), with expandable agent lists.
- **Legal / preservation holds** — place a hold on an open house's records; held data refuses the retention purge and admin hard-deletes until the hold is released (agent-side deletes still work silently — the archive keeps the held record).
- **Delete open house** — a true hard delete (for test cleanup / honoring a visitor deletion request; unlike agent-side deletes, this does *not* archive).

---

## 8. Growth Features: Referrals, Gifting, Partners

### 8.1 Referral links (all tiers)
Every agent gets a stable `ohaccess.com/r/<code>` link (`?ref=` tracked), with **Copy / Email / Text** share buttons that open the agent's own mail/messages app with a pre-written invite. Signups stamped with the code show up in the admin Referral Sources page. **Reward:** when a referred agent converts to paid, the referrer earns a **free month of Pro** (added to an annual/2-year plan) or a **$15 credit** (monthly). Reward payout is manual (via the admin Gift tool) for now; tracking is decoupled from reward so any agent can share.

### 8.2 Gift a Year of Pro
Anyone — **no account needed** — can pay a **one-time $150** at `/gift` to give a real estate agent **12 months of Pro** (one-time payment, never a subscription, so the giver is never re-billed; the amount tracks the live annual Pro price). Optional recipient name/email and a gift note. The purchase mints a claim code in the format **`GIFT-XXXX-XXXX`** (using a lookalike-free alphabet), emails the claim link to the giver (and a gift-wrapped version to the recipient if an email was given).
**Claiming** (`/gift/claim`): the recipient signs in (or creates a free account inline) and applies the code, which **always adds 12 months** on top of the later of "now" or their current paid-through date (a gift never evaporates into already-paid time). Brokerage-linked accounts are politely refused (without burning the code) and routed to support. Codes are consumed atomically and idempotently.

### 8.3 Partner Program page
`/partners` — a B2B landing page pitching affiliated businesses (lenders, title, inspectors, insurance, roofers, attorneys) to **buy a Team plan and share it with up to 10 agent partners** (or per-seat for more), owning the branding on every visitor email and receiving the leads. Includes an inquiry form (business type, partner count) and **RESPA-conscious** co-marketing language ("consult your own compliance counsel").

### 8.4 Free sign hardware (Pro 2-year)
The **first 100 individual Pro 2-year subscribers in each state** choose **two pedestal sign stands or one A-frame**, shipped free. The offer copy is phase-aware and always truthful: generic at first ("first 100 agents in each state"), social proof once enough are claimed in that state, scarcity once ≤25 remain, and the offer disappears entirely once the state's 100 are gone. The hardware choice and shipping address are collected right inside Stripe checkout, and a fulfillment email fires automatically on payment. *(Not offered on Team/Brokerage plans; codified in Subscriber Terms §4.9.)*

---

## 9. CRM Integrations (free on all tiers)

Three independent mechanisms push verified sign-ins into agents' systems:

### 9.1 Universal email-parse (the default)
Every new sign-in is emailed as a **formatted lead** to the agent's CRM intake address. The email carries both a **human-readable labeled body** (Name / Email / Phone / Timeline / Property / Agent / Source / Registered) *and* machine-readable **Lead Metadata Spec** tags, so it's parseable by most major CRMs. **Verified working with Follow Up Boss.** Some CRMs (e.g. Lofty) require a one-time provider registration on their end before they'll parse it. Agents pick their CRM from a dropdown (Follow Up Boss, BoldTrail/kvCORE, Lofty, Sierra Interactive, Real Geeks, CINC, Top Producer, Wise Agent, LionDesk, Other) and set the lead-intake email in Settings.

### 9.2 Zapier webhook integration
Agents can paste a **Zapier "Catch Hook" webhook URL** in Settings (Advanced) to fire new-visitor data into any of Zapier's thousands of app integrations — no ohACCESS-side setup. On every sign-in, ohACCESS POSTs a JSON payload — **first name, last name, email, phone, purchasing timeline, registered-at timestamp, property address, agent name, and a link to the visitor's detail page** — to the webhook. It's best-effort (a 3-second timeout, never blocks the sign-in) and **security-hardened**: the URL must be a genuine `https://hooks.zapier.com/` address (SSRF-guarded). Setup instructions in the app walk through creating the Zap. *(Requires a paid Zapier plan on the agent's side.)*

### 9.3 Team CRM forwarding
A team lead can forward all members' leads to a shared brokerage CRM in addition to each agent's own (see §5.3).

---

## 10. Billing & Pricing

### 10.1 Free trial
**25 free visitor registrations** (admins can gift bonus registrations on top). When the cap is hit, the account **locks** — the agent can't create/edit open houses, generate QR codes, export, or verify — until they subscribe. A banner warns as they approach the limit. Over-quota sign-ins are refused with a message asking the visitor to have the agent upgrade.

### 10.2 Tiers & prices
Every plan is a real **auto-renewing Stripe subscription** (including 2-year), billed monthly, annually (2 months free), or as a 2-year prepay (year 2 half-off — a limited-time founding-member offer).

| Tier | Monthly | Annual | 2-Year | Notes |
|---|---|---|---|---|
| **Pro** (1 agent) | $15/mo | $150/yr ($12.50/mo) | $240 ($10/mo) | The active agent |
| **Team** (2–10 agents) | $120/mo | $1,200/yr ($100/mo) | $1,920 ($80/mo) | Flat price, up to 10 seats |
| **Brokerage** (11–100 agents) | $11/agent/mo | $110/agent/yr | $176/agent/2yr | Self-serve per-seat; 100+ = Contact us |

### 10.3 Subscription mechanics
- **Stripe Checkout** (promo codes allowed), a self-serve **customer portal** ("Manage billing"), in-app **cancel** (at period end, with a "resume" option before the date), and **advance renewal-notice emails** for annual/2-year plans.
- **Webhooks** handle checkout completion, subscription create/update/delete, payment failure (which emails the customer a fix-your-card link), and upcoming renewals — all **idempotent** (deduped by event id).
- **Comped/gifted/legacy** accounts use a "paid tier, no Stripe, access-until-date" shape and cleanly fall back to free (prompting a renewal) once the date passes.

---

## 11. Security, Privacy & Compliance

- **Row-Level Security** on all core tables; rate limiting throughout; HTML-escaped emails; SSRF-guarded outbound calls; and **codewords are never returned in any API response** (preserving door verification).
- **Rate limits** on registration (per phone: 8/hr; per open house and per IP: 60/hr) and on sensitive endpoints (checkout, portal, invites, etc.).
- **Delivery monitoring** via signed Resend (email) and Twilio (SMS) status webhooks — failures are terminal and surface as badges; an agent-CC delivery can't overwrite a visitor's real bounce.
- **SMS compliance:** a **global STOP opt-out list** honored across *all* agents (a number that opts out via one agent is suppressed everywhere), HELP handling, and a Twilio toll-free-verified sending number.
- **Data retention:** visitor data, archives, and scan logs auto-purge on a **3-year schedule** (monthly cron). Agent-side open-house deletion archives the visitor log first; admin-side deletion is a true hard delete for genuine deletion requests.
- **Attorney-reviewed legal docs** published: Visitor Terms (`/terms`), Subscriber Terms/MSA (`/subscriber-terms`, venue Tarrant County TX), and Privacy Policy (`/privacy`, covering CCPA/CPRA and other state laws, minors, and retention).

---

## 12. Marketing Site & SEO

- **Homepage** ("The Record"): a dark editorial landing page with scroll animations, a live check-in demo, a seller-report phone mockup, safety-first messaging ("You owe it to your sellers to protect their home. You owe it to yourself to protect *you*."), a pricing section with a monthly/annual/2-year toggle, and gift + partner-sponsorship cards. *(A 90-second commercial film section is built but hidden until the video is delivered.)* The hero photo is **seasonal** — it swaps automatically at the astronomical solstice/equinox instants (table through 2035), with special Halloween (Oct 24–31) and Christmas (Dec 18–25) photos.
- **Blog** (`/blog`): SEO articles auto-published via an authenticated GrandRanker webhook (sanitized HTML, instant page revalidation, no manual review step); posts feed the sitemap.
- **FAQ** (`/faq`): 8 server-rendered Q&As with matching FAQPage structured data for Google rich results.
- **Other public pages:** Contact, Partners, Resources ("How ohACCESS works" story), Gift, plus the legal pages — all sharing one canonical footer (FAQ · Blog · Resources · Partners · Gift · Contact · legal links).
- **SEO:** Open Graph + Twitter cards site-wide, per-page titles/descriptions, robots.txt, sitemap.xml (including blog posts), Organization + FAQPage JSON-LD, Vercel Analytics, and Google Search Console verified.

---

## 13. Tech Stack (for reference)

- **Framework:** Next.js 16 / React 19.
- **Database & auth:** Supabase (Postgres + auth; custom auth domain `auth.ohaccess.com`).
- **SMS:** Twilio (toll-free-verified number; Lookup for carrier/line-type intelligence).
- **Email:** Resend.
- **Payments:** Stripe.
- **Maps/geo:** Google Places, Maps, and Time Zone APIs.
- **Hosting:** Vercel (auto-deploy from `main`).
- **Scheduled jobs:** Supabase pg_cron drives the reminder, post-event report, and data-retention crons.
