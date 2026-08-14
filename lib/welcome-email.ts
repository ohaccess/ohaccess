import { escapeHtml } from './escape-html'

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
  const gold = '#c9963a'
  const settingsUrl = `${o.appUrl}/dashboard?view=settings`
  const newOhUrl = `${o.appUrl}/dashboard?view=new`
  const greeting = o.firstName?.trim() ? `Hi ${e(o.firstName.trim())},` : 'Hi there,'

  const sectionTitle = (label: string) => `
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${gold};margin-bottom:8px;">${label}</div>`

  const watchLink = (label: string, url: string) => `
      <div style="font-size:14px;margin-top:12px;">
        <a href="${e(url)}" style="color:${gold};font-weight:700;">▶ Watch: ${e(label)}</a>
      </div>`

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1d1d1f;">
    <div style="display:none;max-height:0;overflow:hidden;">Two quick steps now. We handle the rest automatically.</div>

    <div style="background:#1d1d1f;border-radius:14px;padding:20px 22px;color:white;">
      <div style="font-size:18px;font-weight:200;letter-spacing:-0.5px;">oh<span style="font-weight:700;">ACCESS</span></div>
      <div style="font-size:20px;font-weight:700;margin-top:8px;">Welcome to ohACCESS</div>
      <div style="font-size:13px;opacity:0.7;margin-top:2px;">Your first open house is 10 minutes away</div>
    </div>

    <div style="font-size:14px;line-height:1.7;margin-top:20px;">${greeting}</div>
    <div style="font-size:14px;line-height:1.7;margin-top:12px;">
      Welcome to ohACCESS! You're about to replace the paper sign-in sheet with verified digital
      check-ins — legible names, real phone numbers, real leads.
    </div>
    <div style="font-size:14px;line-height:1.7;margin-top:12px;">Getting started takes two steps:</div>

    <div style="margin-top:16px;background:#f5f5f7;border-radius:12px;padding:16px;">
      ${sectionTitle('Step 1 — Set up your profile (about 5 minutes)')}
      <div style="font-size:14px;line-height:1.7;">
        Go to <a href="${e(settingsUrl)}" style="color:${gold};font-weight:600;">Settings</a> and fill
        in your Agent Profile: name, brokerage, phone, and the email you want visitors to see. Then add
        your headshot, logo, and brand colors under <strong>Branding</strong>. Your logo and colors
        dress up your printed QR sign, and your headshot appears on every email visitors receive — so
        it all looks like <em>you</em>, not us.
      </div>
      <div style="font-size:14px;line-height:1.7;margin-top:10px;">
        If you use a CRM (Follow Up Boss, kvCORE, Lofty, and others), paste your lead-intake address
        under <strong>Send Leads to Your CRM</strong> and every sign-in flows straight in as a
        formatted lead.
      </div>
      ${watchLink('Setting up your profile', WELCOME_VIDEO_SETTINGS)}
    </div>

    <div style="margin-top:16px;background:#f5f5f7;border-radius:12px;padding:16px;">
      ${sectionTitle('Step 2 — Create your first open house (about 3 minutes)')}
      <div style="font-size:14px;line-height:1.7;">
        Click <a href="${e(newOhUrl)}" style="color:${gold};font-weight:600;">New Open House</a>.
        Start typing the address and we'll fill in the rest — city, state, zip, even the correct time
        zone. Pick the date and times, then set your two codewords: create your own branded or unique
        words, or use our auto-generate buttons if you prefer. (The codewords are what visitors receive
        by text and email to show you at the door — proof their contact info is real.)
      </div>
      <div style="font-size:14px;line-height:1.7;margin-top:10px;">
        Save it, then tap <strong>📱 QR Code</strong> to print your branded sign. There's also
        <strong>📌 My QR code</strong> — one permanent code that always points to your next open house,
        whichever it is. Tip: the sign deliberately has no address on it, so laminate it once and reuse
        it at every open house.
      </div>
      ${watchLink('Your first open house', WELCOME_VIDEO_OPEN_HOUSE)}
    </div>

    <div style="margin-top:16px;background:#f5f5f7;border-radius:12px;padding:16px;">
      ${sectionTitle('Then ohACCESS takes over')}
      <div style="font-size:14px;line-height:1.7;">Here's what happens automatically — no buttons to press:</div>
      <ul style="font-size:14px;line-height:1.7;margin:10px 0 0;padding-left:20px;">
        <li style="margin-bottom:8px;"><strong>The day before</strong>, you get a reminder email with your printable sign, a sign-placement tip, and two ready-to-read door scripts.</li>
        <li style="margin-bottom:8px;"><strong>At the door</strong>, every visitor scans, fills out a 30-second form (in any of 16 languages), and instantly gets their codewords by text and email. You get an alert the moment each one signs in.</li>
        <li style="margin-bottom:8px;"><strong>The next morning</strong>, every visitor gets a thank-you email with your photo and contact info.</li>
        <li style="margin-bottom:8px;"><strong>About 30 minutes after you close</strong>, you get a full report — every lead grouped by how soon they're buying.</li>
        <li><strong>For your seller:</strong> tap <strong>📊 Seller report</strong> for a shareable results page — visitor counts, buyer timelines, and honest feedback, with no visitor contact info exposed.</li>
      </ul>
    </div>

    <div style="margin-top:16px;background:#f5f5f7;border-radius:12px;padding:16px;">
      ${sectionTitle('Three features people love once they find them')}
      <ul style="font-size:14px;line-height:1.7;margin:0;padding-left:20px;">
        <li style="margin-bottom:8px;"><strong>💌 Invite</strong> — scheduling a new open house? One tap emails your past visitors who are still in their buying window a personal invitation. Your open houses start filling themselves.</li>
        <li style="margin-bottom:8px;"><strong>⧉ Duplicate</strong> — holding the same property open again? Two clicks makes next weekend's event.</li>
        <li><strong>🎁 Refer an Agent</strong> — share your link from Settings; when a colleague goes Pro, you earn a free month.</li>
      </ul>
    </div>

    <div style="font-size:14px;line-height:1.7;margin-top:16px;">
      Your first <strong>25 visitor sign-ins are free</strong> — no credit card needed. That's one or
      two good open houses to see the difference verified sign-ins make.
    </div>

    <div style="font-size:14px;line-height:1.7;margin-top:16px;">
      Questions? Just hit reply — a real person reads these (me).
    </div>

    <div style="font-size:14px;line-height:1.7;margin-top:16px;">
      Dave Sheehan<br/>
      <span style="color:#6e6e73;">Founder, ohACCESS</span>
    </div>

    <div style="font-size:12px;color:#aeaeb2;margin-top:24px;border-top:1px solid #e5e5ea;padding-top:12px;line-height:1.6;">
      You're receiving this one-time email because you created an ohACCESS account.
      Manage everything anytime from your <a href="${e(`${o.appUrl}/dashboard`)}" style="color:#aeaeb2;">dashboard</a>.
    </div>
  </div>`

  return { subject: 'Welcome to ohACCESS — your first open house is 10 minutes away', html }
}
