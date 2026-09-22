import { escapeHtml } from './escape-html'
import { brandedEmailShell, OHACCESS_BRAND, EMAIL_OHACCESS_SIGNOFF } from './email-shell'

// The one-time "getting started" email for a brand-new agent account, sent
// from /api/notify/new-account on the first authenticated dashboard load.
// Pure builder so it can be unit-tested; the route claims the send flag and
// dispatches. Copy approved by Dave 2026-08-13 (docs/welcome-email-draft.md
// is the copy source of truth).

export const WELCOME_VIDEO_SETTINGS = 'https://youtu.be/dzKb4RE3fO4'
export const WELCOME_VIDEO_OPEN_HOUSE = 'https://youtu.be/Rf_6rUxUQpQ'

// Best first name we can get for a freshly-created profile: the profile's
// full_name is usually still empty, so fall back to the auth user_metadata
// (Google OAuth fills full_name/name there). Empty string if nothing usable —
// the greeting then reads "Hi there,".
export function welcomeFirstName(
  profileFullName: string | null | undefined,
  userMetadata: Record<string, unknown> | null | undefined
): string {
  const candidates = [
    profileFullName,
    userMetadata?.full_name,
    userMetadata?.name,
  ]
  for (const c of candidates) {
    const first = String(c || '').trim().split(/\s+/)[0]
    if (first) return first
  }
  return ''
}

export function buildWelcomeEmail(o: { firstName?: string | null; appUrl: string }): {
  subject: string
  html: string
} {
  const e = escapeHtml
  const gold = OHACCESS_BRAND.accent
  const settingsUrl = `${o.appUrl}/dashboard?view=settings`
  const newOhUrl = `${o.appUrl}/dashboard?view=new`
  const pricingUrl = `${o.appUrl}/#pricing`
  const greeting = o.firstName?.trim() ? `Hi ${e(o.firstName.trim())},` : 'Hi there,'

  const sectionTitle = (label: string) => `
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${gold};margin-bottom:6px;">${label}</div>`

  const watchLink = (label: string, url: string) => `
      <div style="font-size:14px;margin-top:12px;">
        <a href="${e(url)}" style="color:${gold};font-weight:700;">▶ Watch: ${e(label)}</a>
      </div>`

  // Same layout as every other email (lib/email-shell), in ohACCESS colors.
  const html = brandedEmailShell({
    brand: OHACCESS_BRAND,
    preheaderHtml: 'Two quick steps now. We handle the rest automatically.',
    headerTitleHtml: 'Welcome to ohACCESS',
    headerSubHtml: 'Your first open house is 10 minutes away',
    signoffHtml: EMAIL_OHACCESS_SIGNOFF,
    bodyHtml: `
    <div style="font-size:14px;line-height:1.7;">${greeting}</div>
    <div style="font-size:14px;line-height:1.7;margin-top:12px;">
      Welcome to ohACCESS! You're about to replace the paper sign-in sheet with verified digital
      check-ins: legible names, real phone numbers, real leads.
    </div>
    <div style="font-size:14px;line-height:1.7;margin-top:12px;">Getting started takes three steps:</div>

    <div style="margin-top:16px;background:#f6f7f9;border-radius:12px;padding:16px 18px;">
      ${sectionTitle('Step 1: Set up your profile (about 5 minutes)')}
      <div style="font-size:14px;line-height:1.7;">
        Go to <a href="${e(settingsUrl)}" style="color:${gold};font-weight:600;">Settings</a> and fill
        in your Agent Profile: name, brokerage, phone, and the email you want visitors to see. Then add
        your headshot, logo, and brand colors under <strong>Branding</strong>. Your logo and colors
        dress up your printed QR sign, and your headshot appears on every email visitors receive, so
        it all looks like <em>you</em>, not us.
      </div>
      <div style="font-size:14px;line-height:1.7;margin-top:10px;">
        If you use a CRM (Follow Up Boss, kvCORE, Lofty, and others), paste your lead-intake address
        under <strong>Send Leads to Your CRM</strong> and every sign-in flows straight in as a
        formatted lead.
      </div>
      ${watchLink('Setting up your profile', WELCOME_VIDEO_SETTINGS)}
    </div>

    <div style="margin-top:16px;background:#f6f7f9;border-radius:12px;padding:16px 18px;">
      ${sectionTitle('Step 2: Create your first open house (about 3 minutes)')}
      <div style="font-size:14px;line-height:1.7;">
        Click <a href="${e(newOhUrl)}" style="color:${gold};font-weight:600;">New Open House</a>.
        Start typing the address and we'll fill in the rest: city, state, zip, even the correct time
        zone. Pick the date and times, then set your two codewords: create your own branded or unique
        words, or use our auto-generate buttons if you prefer. (The codewords are what visitors receive
        by text and email to show you at the door, which proves their contact info is real.)
      </div>
      <div style="font-size:14px;line-height:1.7;margin-top:10px;">
        Save it, then tap <strong>📌 My QR code</strong> to print your branded sign. It's one permanent
        code that always points to your next open house, whichever it is, and the sign deliberately has
        no address on it: print it once, laminate it, and reuse it at every open house. (Each open house
        card also has its own <strong>📱 QR Code</strong> button if you ever want a sign for just that one.)
      </div>
      ${watchLink('Your first open house', WELCOME_VIDEO_OPEN_HOUSE)}
    </div>

    <div style="margin-top:16px;background:#f6f7f9;border-radius:12px;padding:16px 18px;">
      ${sectionTitle('Step 3: Display your welcome sign (optional)')}
      <div style="font-size:14px;line-height:1.7;">Two ways agents display it at the door:</div>
      <div style="font-size:14px;line-height:1.7;margin-top:10px;background:#fff9ec;border:1px solid #f0dfb8;border-radius:8px;padding:12px 14px;">
        🎁 <strong>Founding-member bonus:</strong> the first 100 agents in your state to lock in a
        2-year plan get two pedestal stands or one A-frame sign, on us.
        <a href="${e(pricingUrl)}" style="color:${gold};font-weight:700;">See pricing →</a> for details.
      </div>
      <ul style="font-size:14px;line-height:1.7;margin:10px 0 0;padding-left:20px;">
        <li style="margin-bottom:10px;">
          <strong>Pedestal stand</strong>: a weighted floor stand for an 8.5×11" sign, right at the
          entrance. <a href="https://amzn.to/4vgxnAr" style="color:${gold};font-weight:700;">Get one on Amazon →</a>
          Pair it with the <a href="https://canva.link/b76tfh40e386it6" style="color:${gold};font-weight:700;">8.5×11 Canva template</a>,
          or just use the branded sign from <strong>📱 QR Code</strong> on your open house card, same
          size, already carrying your branding and that event's QR code. Its <strong>📌 My QR code</strong>
          button gives you one 8.5×11 sign you can reuse at every open house without reprinting.
        </li>
        <li>
          <strong>A-frame sidewalk sign</strong>: a double-sided sign to guide visitors in from the
          street. <a href="https://amzn.to/4v48sQg" style="color:${gold};font-weight:700;">Get one on Amazon →</a>
          Pair it with the <a href="https://canva.link/0c68v28pdk4m53p" style="color:${gold};font-weight:700;">24×36 Canva template</a> sized to fit.
        </li>
      </ul>
      <div style="font-size:14px;line-height:1.7;margin-top:10px;">
        Best practice: place the sign outside, between the house and the road, slightly closer to the
        house, but far enough from the front door that you still control who's approaching before they
        reach it.
      </div>
      <div style="font-size:12px;color:#aeaeb2;margin-top:12px;line-height:1.6;">
        As an Amazon Associate, ohACCESS earns from qualifying purchases. These links cost you nothing extra.
      </div>
    </div>

    <div style="margin-top:16px;background:#f6f7f9;border-radius:12px;padding:16px 18px;">
      ${sectionTitle('Then ohACCESS takes over')}
      <div style="font-size:14px;line-height:1.7;">Here's what happens automatically, with no buttons to press:</div>
      <ul style="font-size:14px;line-height:1.7;margin:10px 0 0;padding-left:20px;">
        <li style="margin-bottom:8px;"><strong>The day before</strong>, you get a reminder email with your printable sign, a sign-placement tip, and two ready-to-read door scripts.</li>
        <li style="margin-bottom:8px;"><strong>At the door</strong>, every visitor scans, fills out a 30-second form (in any of 16 languages), and instantly gets their codewords by text and email. You get an alert the moment each one signs in.</li>
        <li style="margin-bottom:8px;"><strong>The next morning</strong>, every visitor gets a thank-you email with your photo and contact info.</li>
        <li style="margin-bottom:8px;"><strong>About 30 minutes after you close</strong>, you get a full report: every lead grouped by how soon they're buying.</li>
        <li><strong>For your seller:</strong> tap <strong>📊 Seller report</strong> for a shareable results page: visitor counts, buyer timelines, and honest feedback, with no visitor contact info exposed.</li>
      </ul>
    </div>

    <div style="margin-top:16px;background:#f6f7f9;border-radius:12px;padding:16px 18px;">
      ${sectionTitle('Three features people love once they find them')}
      <ul style="font-size:14px;line-height:1.7;margin:0;padding-left:20px;">
        <li style="margin-bottom:8px;"><strong>💌 Invite</strong>: scheduling a new open house? One tap emails your past visitors who are still in their buying window a personal invitation. Your open houses start filling themselves.</li>
        <li style="margin-bottom:8px;"><strong>⧉ Duplicate</strong>: holding the same property open again? Two clicks makes next weekend's event.</li>
        <li><strong>🎁 Refer an Agent</strong>: share your link from Settings; when a colleague goes Pro, you earn a free month.</li>
      </ul>
    </div>

    <div style="font-size:14px;line-height:1.7;margin-top:16px;">
      Your first <strong>25 visitor sign-ins are free</strong>. No credit card needed. That's one or
      two good open houses to see the difference verified sign-ins make.
    </div>

    <div style="font-size:14px;line-height:1.7;margin-top:16px;">
      Questions? Just hit reply. A real person reads these (me).
    </div>

    <div style="font-size:14px;line-height:1.7;margin-top:16px;">
      Dave Sheehan<br/>
      <span style="color:#6e6e73;">Founder, ohACCESS</span>
    </div>`,
    footerHtml: `You're receiving this one-time email because you created an ohACCESS account.
      Manage everything anytime from your <a href="${e(`${o.appUrl}/dashboard`)}" style="color:#9a9aa0;">dashboard</a>.`,
  })

  return { subject: 'Welcome to ohACCESS. Your first open house is 10 minutes away', html }
}
