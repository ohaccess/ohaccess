import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Open House Sign-In FAQ',
  description:
    'Answers to common questions about verified open house sign-in — how QR-code check-in works, capturing leads at an open house, CRM sync, pricing, and visitor privacy.',
}

// Server-rendered so the Q&A is in the initial HTML (SEO) and the FAQPage
// JSON-LD below matches the visible text exactly. Answers are plain text for
// the same reason — structured data should mirror what the visitor reads.
const FAQS: { q: string; a: string }[] = [
  {
    q: 'What is a verified open house sign-in?',
    a: 'A verified open house sign-in confirms a visitor’s contact information is real at the moment they register. With ohACCESS, guests scan a QR code, complete a quick digital form, and receive a one-time codeword by text and email. Sharing that codeword with the host proves the phone number and email are genuine — replacing the fake names and bad numbers common on paper sign-in sheets.',
  },
  {
    q: 'How do real estate agents capture leads at an open house?',
    a: 'Instead of a paper sign-in sheet, agents use a QR-code digital check-in. Every visitor’s name, verified phone, email, and buying timeline flow into a live dashboard and straight into the agent’s CRM — no transcribing, no lost leads.',
  },
  {
    q: 'Do open house visitors need to download an app?',
    a: 'No. Visitors simply scan the QR code with their phone camera and fill out a short web form. There is nothing to install.',
  },
  {
    q: 'Is ohACCESS better than a paper open house sign-in sheet?',
    a: 'Paper sheets are unreadable, unverified, and easy to fake. ohACCESS captures clean, verified contact information, creates a record of everyone who entered the home, and delivers leads to your CRM automatically — protecting both the agent and the seller.',
  },
  {
    q: 'How does the QR code open house registration work?',
    a: 'The agent prints one branded QR sign. Visitors scan it, register in about 30 seconds, and receive their codeword. The agent gets an instant alert and a running visitor log for the event.',
  },
  {
    q: 'Can I send open house leads to my CRM?',
    a: 'Yes. ohACCESS delivers every verified lead to your CRM automatically — including Follow Up Boss, with others supported via email parsing or Zapier — free on every plan.',
  },
  {
    q: 'How much does ohACCESS cost?',
    a: 'You can start free with 25 verified check-ins. After that, Pro is $15/month for a single agent, with Team and Brokerage plans for offices.',
  },
  {
    q: 'Is open house sign-in data private and secure?',
    a: 'Visitor contact details are shared only with the hosting agent, protected with industry-standard security, and never sold. Visitors consent at sign-in and can opt out of texts at any time.',
  },
]

export default function FAQ() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  return (
    <main style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#ffffff', color: '#1d1d1f', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* NAV */}
      <nav style={{ background: '#1d1d1f', padding: '0 24px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: '22px', fontWeight: 200, color: 'white', letterSpacing: '-0.5px' }}>
            oh<span style={{ fontWeight: 700 }}>ACCESS</span>
          </div>
        </Link>
        <Link href="/login?signup=true" style={{ background: '#c9963a', color: '#1d1d1f', padding: '8px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>
          Start Free
        </Link>
      </nav>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#c9963a', marginBottom: '10px' }}>
          Frequently Asked Questions
        </div>
        <h1 style={{ fontSize: '34px', fontWeight: 800, letterSpacing: '-0.5px', margin: '0 0 8px' }}>
          Open house sign-in, answered
        </h1>
        <p style={{ fontSize: '16px', color: '#6e6e73', margin: '0 0 8px', lineHeight: 1.6 }}>
          Everything agents and visitors ask about verified open house check-in.
        </p>

        <div style={{ marginTop: '24px' }}>
          {FAQS.map((f) => (
            <div key={f.q} style={{ padding: '22px 0', borderTop: '1px solid #ececf0' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 8px' }}>{f.q}</h2>
              <p style={{ fontSize: '15px', lineHeight: 1.7, color: '#48484a', margin: 0 }}>{f.a}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ borderTop: '1px solid #ececf0', marginTop: '8px', paddingTop: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>Ready to verify your next open house?</div>
          <p style={{ fontSize: '15px', color: '#6e6e73', margin: '0 0 18px' }}>Start free with 25 verified check-ins — no credit card required.</p>
          <Link href="/login?signup=true" style={{ display: 'inline-block', background: '#c9963a', color: '#1d1d1f', padding: '12px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 700, textDecoration: 'none' }}>
            Start Free
          </Link>
          <div style={{ fontSize: '14px', color: '#6e6e73', marginTop: '16px' }}>
            Still have a question? <Link href="/contact" style={{ color: '#0071e3', textDecoration: 'none' }}>Contact us →</Link>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{ background: '#111', padding: '40px 24px', textAlign: 'center', marginTop: '60px' }}>
        <div style={{ fontSize: '20px', fontWeight: 200, color: 'white', letterSpacing: '-0.5px', marginBottom: '16px' }}>
          oh<span style={{ fontWeight: 700 }}>ACCESS</span>
        </div>
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
          <a href="/faq" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>FAQ</a>
          <a href="/resources" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Resources</a>
          <a href="/partners" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Partners</a>
          <a href="/contact" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Contact</a>
          <a href="/terms" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Terms of Service</a>
          <a href="/privacy" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Privacy Policy</a>
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>© 2026 ohACCESS. All rights reserved. · <span style={{ fontWeight: 600 }}>Patent Pending</span></div>
      </footer>
    </main>
  )
}
