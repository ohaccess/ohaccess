import { escapeHtml } from './escape-html'
import { WELCOME_VIDEO_SETTINGS, WELCOME_VIDEO_OPEN_HOUSE } from './welcome-email'

// The lifecycle ("drip") email bodies, sent by /api/cron/drip on the
// schedule in lib/drip.ts. Pure builders (welcome-email pattern) so each can
// be unit-tested. Voice matches the welcome email: Dave writing personally,
// "hit reply" always open.
//
// Every drip email is promotional, so every one carries a visible
// unsubscribe link (the cron also sets the one-click List-Unsubscribe
// headers). Opting out stops these emails only — reminders, reports and
// billing mail are unaffected, and the footer says so.

const GOLD = '#c9963a'

type BuiltEmail = { subject: string; html: string }

type ShellOpts = {
  preheader: string
  title: string
  subtitle: string
  greeting: string
  bodyHtml: string
  unsubscribeUrl: string
}

function greetingFor(firstName: string | null | undefined): string {
  return firstName?.trim() ? `Hi ${escapeHtml(firstName.trim())},` : 'Hi there,'
}

function watchLink(label: string, url: string): string {
  return `
      <div style="font-size:14px;margin-top:12px;">
        <a href="${escapeHtml(url)}" style="color:${GOLD};font-weight:700;">▶ Watch: ${escapeHtml(label)}</a>
      </div>`
}

function ctaButton(label: string, url: string): string {
  return `
    <div style="margin-top:20px;">
      <a href="${escapeHtml(url)}" style="display:inline-block;background:#1d1d1f;color:white;border-radius:10px;padding:12px 28px;font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(label)}</a>
    </div>`
}

function shell(o: ShellOpts): string {
  const e = escapeHtml
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1d1d1f;">
    <div style="display:none;max-height:0;overflow:hidden;">${e(o.preheader)}</div>

    <div style="background:#1d1d1f;border-radius:14px;padding:20px 22px;color:white;">
      <div style="font-size:18px;font-weight:200;letter-spacing:-0.5px;">oh<span style="font-weight:700;">ACCESS</span></div>
      <div style="font-size:20px;font-weight:700;margin-top:8px;">${e(o.title)}</div>
      <div style="font-size:13px;opacity:0.7;margin-top:2px;">${e(o.subtitle)}</div>
    </div>

    <div style="font-size:14px;line-height:1.7;margin-top:20px;">${o.greeting}</div>
    ${o.bodyHtml}

    <div style="font-size:14px;line-height:1.7;margin-top:16px;">
      Questions? Just hit reply — a real person reads these (me).
    </div>

    <div style="font-size:14px;line-height:1.7;margin-top:16px;">
      Dave Sheehan<br/>
      <span style="color:#6e6e73;">Founder, ohACCESS</span>
    </div>

    <div style="font-size:12px;color:#aeaeb2;margin-top:24px;border-top:1px solid #e5e5ea;padding-top:12px;line-height:1.6;">
      You're receiving occasional tips because you have an ohACCESS account.
      <a href="${e(o.unsubscribeUrl)}" style="color:#aeaeb2;">Unsubscribe</a> from these anytime —
      emails about your own open houses (reminders, reports) are unaffected.
    </div>
  </div>`
}

// ── Day 2: signed up, never logged in ───────────────────────────────────────
export function buildFinishSetupEmail(o: {
  firstName?: string | null
  appUrl: string
  unsubscribeUrl: string
}): BuiltEmail {
  const loginUrl = `${o.appUrl}/login`
  const bodyHtml = `
    <div style="font-size:14px;line-height:1.7;margin-top:12px;">
      A couple of days ago you created an ohACCESS account — and it's sitting there ready for you.
      You're about 10 minutes away from replacing the paper sign-in sheet with verified digital
      check-ins: legible names, real phone numbers, real leads.
    </div>
    ${ctaButton('Log in and finish setting up', loginUrl)}
    <div style="margin-top:20px;background:#f5f5f7;border-radius:12px;padding:16px;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${GOLD};margin-bottom:8px;">What's waiting once you're in</div>
      <ul style="font-size:14px;line-height:1.7;margin:0;padding-left:20px;">
        <li style="margin-bottom:8px;"><strong>Your profile</strong> — headshot, logo and colors, so everything visitors see looks like you (about 5 minutes).</li>
        <li style="margin-bottom:8px;"><strong>Your first open house</strong> — address, date, codewords, printable QR sign (about 3 minutes).</li>
        <li><strong>Then it runs itself</strong> — visitor sign-ins, instant alerts, next-morning thank-yous, and a full lead report after every event.</li>
      </ul>
      ${watchLink('Setting up your profile', WELCOME_VIDEO_SETTINGS)}
    </div>
    <div style="font-size:14px;line-height:1.7;margin-top:16px;">
      Your first <strong>25 visitor sign-ins are free</strong> — no credit card needed. And if the
      confirmation email never reached you, just reply to this one and I'll get you sorted.
    </div>`

  return {
    subject: 'Your ohACCESS account is ready — pick up where you left off',
    html: shell({
      preheader: 'Ten minutes from your first verified open house sign-in.',
      title: 'Your account is waiting',
      subtitle: 'Ten minutes to your first open house',
      greeting: greetingFor(o.firstName),
      bodyHtml,
      unsubscribeUrl: o.unsubscribeUrl,
    }),
  }
}

// ── Day 5: logged in, no open house yet ─────────────────────────────────────
export function buildFirstOpenHouseEmail(o: {
  firstName?: string | null
  appUrl: string
  unsubscribeUrl: string
}): BuiltEmail {
  const newOhUrl = `${o.appUrl}/dashboard?view=new`
  const bodyHtml = `
    <div style="font-size:14px;line-height:1.7;margin-top:12px;">
      You're set up — the only thing left is your first open house. It takes about three minutes,
      and here's the whole recipe:
    </div>
    <div style="margin-top:16px;background:#f5f5f7;border-radius:12px;padding:16px;">
      <ol style="font-size:14px;line-height:1.7;margin:0;padding-left:20px;">
        <li style="margin-bottom:8px;">Click <a href="${escapeHtml(newOhUrl)}" style="color:${GOLD};font-weight:600;">New Open House</a> and start typing the address — we fill in the rest, including the time zone.</li>
        <li style="margin-bottom:8px;">Pick the date and times, then set your two codewords (or tap auto-generate). Visitors receive them by text and email — proof their contact info is real.</li>
        <li>Save, then tap <strong>📱 QR Code</strong> to print your branded sign. Tip: it deliberately has no address on it, so laminate it once and reuse it at every open house.</li>
      </ol>
      ${watchLink('Your first open house', WELCOME_VIDEO_OPEN_HOUSE)}
    </div>
    <div style="font-size:14px;line-height:1.7;margin-top:16px;">
      From there it's automatic: a reminder email the day before, instant alerts as visitors sign
      in, thank-you emails the next morning, and a full lead report about 30 minutes after you
      close. Your first <strong>25 sign-ins are free</strong> — one or two good open houses to see
      the difference.
    </div>
    ${ctaButton('Set up my first open house', newOhUrl)}`

  return {
    subject: 'Your first open house takes 3 minutes to set up',
    html: shell({
      preheader: 'Address, date, codewords — we handle everything else.',
      title: 'Ready for your first open house?',
      subtitle: 'Three minutes of setup, then it runs itself',
      greeting: greetingFor(o.firstName),
      bodyHtml,
      unsubscribeUrl: o.unsubscribeUrl,
    }),
  }
}

// ── Day 12: has held/created an open house — share your referral link ───────
export function buildReferralEmail(o: {
  firstName?: string | null
  appUrl: string
  referralUrl: string
  unsubscribeUrl: string
}): BuiltEmail {
  const e = escapeHtml
  const bodyHtml = `
    <div style="font-size:14px;line-height:1.7;margin-top:12px;">
      Quick one. You have a personal referral link — and it earns you free ohACCESS time:
    </div>
    <div style="margin-top:16px;background:#fff9ec;border:1px solid #f0dfb8;border-radius:12px;padding:16px;text-align:center;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${GOLD};margin-bottom:8px;">Your referral link</div>
      <a href="${e(o.referralUrl)}" style="font-size:16px;font-weight:700;color:#1d1d1f;word-break:break-all;">${e(o.referralUrl)}</a>
    </div>
    <div style="font-size:14px;line-height:1.7;margin-top:16px;">
      Share it with a colleague — text it, email it, drop it in the office group chat. When someone
      signs up through your link and goes Pro, you get <strong>a free month</strong>: added onto
      your annual or 2-year plan, or a $15 credit on your next bill if you're month-to-month.
    </div>
    <div style="font-size:14px;line-height:1.7;margin-top:12px;">
      There's no limit, and the link never changes — it's also in your dashboard under
      <a href="${e(`${o.appUrl}/dashboard?view=settings`)}" style="color:${GOLD};font-weight:600;">Settings</a>
      whenever you need it.
    </div>`

  return {
    subject: 'Give a colleague ohACCESS — earn a free month',
    html: shell({
      preheader: 'Your personal referral link is inside. Share it, earn free months.',
      title: 'Know an agent who still uses paper?',
      subtitle: 'Refer a colleague, earn a free month',
      greeting: greetingFor(o.firstName),
      bodyHtml,
      unsubscribeUrl: o.unsubscribeUrl,
    }),
  }
}

// ── Day 21: free tier — the 2-year founding-member hardware offer ───────────
export function buildHardwareOfferEmail(o: {
  firstName?: string | null
  appUrl: string
  unsubscribeUrl: string
}): BuiltEmail {
  const e = escapeHtml
  const settingsUrl = `${o.appUrl}/dashboard?view=settings`
  const bodyHtml = `
    <div style="font-size:14px;line-height:1.7;margin-top:12px;">
      A heads-up before it's gone: our founding-member offer is still open in most states.
    </div>
    <div style="margin-top:16px;background:#fff9ec;border:1px solid #f0dfb8;border-radius:12px;padding:16px;">
      <div style="font-size:14px;line-height:1.7;">
        🎁 The <strong>first 100 agents in your state</strong> to lock in a 2-year Pro plan get
        <strong>two pedestal sign stands or one A-frame sidewalk sign</strong> — shipped to your
        door, on us.
      </div>
    </div>
    <div style="font-size:14px;line-height:1.7;margin-top:16px;">
      The 2-year plan is <strong>$240</strong> — that works out to $10/month, our lowest rate —
      with unlimited visitor sign-ins the whole way. Pick your hardware right inside checkout:
      choose your plan under Settings and the shipping form appears automatically.
    </div>
    ${ctaButton('See plans in my dashboard', settingsUrl)}
    <div style="font-size:12px;color:#aeaeb2;margin-top:16px;line-height:1.6;">
      One claim per account, while your state's allotment lasts.
      <a href="${e(`${o.appUrl}/subscriber-terms`)}" style="color:#aeaeb2;">Offer terms</a>.
    </div>`

  return {
    subject: 'Free pedestal stands or an A-frame sign — while your state lasts',
    html: shell({
      preheader: 'First 100 agents per state on a 2-year plan get sign hardware free.',
      title: 'Your welcome sign, on us',
      subtitle: 'The founding-member 2-year offer',
      greeting: greetingFor(o.firstName),
      bodyHtml,
      unsubscribeUrl: o.unsubscribeUrl,
    }),
  }
}

// ── Day 30+ monthly, 3 lifetime: no recent open-house activity ──────────────
export function buildCheckinEmail(o: {
  firstName?: string | null
  appUrl: string
  unsubscribeUrl: string
}): BuiltEmail {
  const newOhUrl = `${o.appUrl}/dashboard?view=new`
  const bodyHtml = `
    <div style="font-size:14px;line-height:1.7;margin-top:12px;">
      Holding an open house soon? It's been a little while, so here's your 60-second refresher —
      setup is three steps:
    </div>
    <div style="margin-top:16px;background:#f5f5f7;border-radius:12px;padding:16px;">
      <ol style="font-size:14px;line-height:1.7;margin:0;padding-left:20px;">
        <li style="margin-bottom:8px;"><a href="${escapeHtml(newOhUrl)}" style="color:${GOLD};font-weight:600;">New Open House</a> — type the address, we fill in the rest.</li>
        <li style="margin-bottom:8px;">Pick date, times, and your two codewords.</li>
        <li>Print the QR sign from <strong>📱 QR Code</strong> — then reminders, sign-ins, thank-yous, and your lead report all happen automatically.</li>
      </ol>
      ${watchLink('Your first open house', WELCOME_VIDEO_OPEN_HOUSE)}
    </div>
    <div style="font-size:14px;line-height:1.7;margin-top:16px;">
      Already have one scheduled elsewhere? Add it to ohACCESS and try the <strong>💌 Invite</strong>
      button — one tap emails your past visitors who are still in their buying window a personal
      invitation. And if something's been getting in your way, hit reply and tell me — I read
      every one.
    </div>
    ${ctaButton('Set up an open house', newOhUrl)}`

  return {
    subject: 'Holding an open house soon?',
    html: shell({
      preheader: 'Three steps and your next open house runs itself.',
      title: 'Your next open house',
      subtitle: 'Three minutes of setup, verified sign-ins at the door',
      greeting: greetingFor(o.firstName),
      bodyHtml,
      unsubscribeUrl: o.unsubscribeUrl,
    }),
  }
}
