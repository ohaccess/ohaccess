'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function Home() {
  const [billing, setBilling] = useState<'monthly' | 'annual' | '2year'>('monthly')
  const [menuOpen, setMenuOpen] = useState(false)

  const billingToInterval = { monthly: 'month', annual: 'year', '2year': 'two_year_prepay' } as const

  // CTA destination per tier. Pro and Team route through /login with checkout
  // params so the login page can hand off to Stripe Checkout after signup/signin.
  // Brokerage stays on the contact-sales path (custom pricing).
  const ctaHref = (tierName: string): string => {
    if (tierName === 'Brokerage') return '/contact'
    if (tierName === 'Trial') return '/login?signup=true'
    const plan = tierName === 'Team' ? 'team' : 'pro'
    return `/login?signup=true&plan=${plan}&interval=${billingToInterval[billing]}`
  }

  return (
    <main style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#ffffff', color: '#1d1d1f', overflowX: 'hidden' }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700&display=swap" rel="stylesheet" />

      <style>{`
        * { box-sizing: border-box; }
        .nav-links { display: flex; align-items: center; gap: 24px; }
        .nav-links a { color: rgba(255,255,255,0.7); font-size: 14px; text-decoration: none; }
        .mobile-menu { display: none; }
        .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .pricing-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .hero-title { font-size: 64px; font-weight: 700; color: white; letter-spacing: -2px; line-height: 1.05; margin-bottom: 24px; }
        .section-title { font-size: 40px; font-weight: 700; color: #1d1d1f; letter-spacing: -1px; margin-bottom: 12px; }
        .section-pad { padding: 80px 40px; }
        .billing-toggle { display: inline-flex; background: #f5f5f7; border-radius: 12px; padding: 4px; gap: 2px; justify-content: center; width: auto; }
        @media (max-width: 768px) {
          .nav-links { display: none; }
          .mobile-menu { display: block; }
          .grid-4 { grid-template-columns: 1fr 1fr; }
          .grid-3 { grid-template-columns: 1fr; }
          .grid-2 { grid-template-columns: 1fr; }
          .pricing-grid { grid-template-columns: 1fr; max-width: 360px; margin: 0 auto; }
          .hero-title { font-size: 40px; letter-spacing: -1px; }
          .section-title { font-size: 28px; }
          .section-pad { padding: 48px 20px; }
          .billing-toggle { width: auto; max-width: 100%; }
        }
        @media (max-width: 480px) {
          .grid-4 { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* NAV */}
      <nav style={{ background: '#1d1d1f', padding: '0 24px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontSize: '22px', fontWeight: '200', color: 'white', letterSpacing: '-0.5px', flexShrink: 0 }}>
          oh<span style={{ fontWeight: '700' }}>ACCESS</span>
        </div>
        <div className="nav-links">
          <a href="#problem">The Problem</a>
          <a href="#how-it-works">How it works</a>
          <a href="#safety">Safety</a>
          <a href="#features">What&apos;s Included</a>
          <a href="#pricing">Pricing</a>
          <Link href="/login" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', textDecoration: 'none' }}>Sign in</Link>
          <Link href="/login?signup=true" style={{ background: '#c9963a', color: '#1d1d1f', padding: '8px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', textDecoration: 'none' }}>
            Get started free
          </Link>
        </div>
        {/* Mobile menu button */}
        <div className="mobile-menu">
          <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer', padding: '4px 8px' }}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div style={{ background: '#2a2a2a', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '60px', zIndex: 99 }}>
          <a href="#problem" onClick={() => setMenuOpen(false)} style={{ color: 'rgba(255,255,255,0.8)', fontSize: '15px', textDecoration: 'none', fontWeight: '500' }}>The Problem</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)} style={{ color: 'rgba(255,255,255,0.8)', fontSize: '15px', textDecoration: 'none', fontWeight: '500' }}>How it works</a>
          <a href="#safety" onClick={() => setMenuOpen(false)} style={{ color: 'rgba(255,255,255,0.8)', fontSize: '15px', textDecoration: 'none', fontWeight: '500' }}>Safety</a>
          <a href="#features" onClick={() => setMenuOpen(false)} style={{ color: 'rgba(255,255,255,0.8)', fontSize: '15px', textDecoration: 'none', fontWeight: '500' }}>What&apos;s Included</a>
          <a href="#pricing" onClick={() => setMenuOpen(false)} style={{ color: 'rgba(255,255,255,0.8)', fontSize: '15px', textDecoration: 'none', fontWeight: '500' }}>Pricing</a>
          <Link href="/login" onClick={() => setMenuOpen(false)} style={{ color: 'rgba(255,255,255,0.8)', fontSize: '15px', textDecoration: 'none', fontWeight: '500' }}>Sign in</Link>
          <Link href="/login?signup=true" onClick={() => setMenuOpen(false)} style={{ background: '#c9963a', color: '#1d1d1f', padding: '12px 20px', borderRadius: '8px', fontSize: '15px', fontWeight: '700', textDecoration: 'none', textAlign: 'center' }}>
            Get started free
          </Link>
        </div>
      )}

      {/* HERO */}
      <section style={{ background: '#1d1d1f', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'inline-block', background: 'rgba(201,150,58,0.15)', border: '1px solid rgba(201,150,58,0.3)', borderRadius: '20px', padding: '6px 16px', fontSize: '13px', color: '#c9963a', fontWeight: '600', marginBottom: '24px' }}>
            Built for real estate agents
          </div>
          <h1 className="hero-title">
            The sign-in sheet<br />
            <span style={{ color: '#c9963a' }}>is finished.</span>
          </h1>
          <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.6', marginBottom: '40px', maxWidth: '600px', margin: '0 auto 40px' }}>
            ohACCESS verifies every open house visitor&apos;s contact information in real time — via a code word sent to their phone and email. Fake info? No code. No entry.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', padding: '0 16px' }}>
            <Link href="/login?signup=true" style={{ background: '#c9963a', color: '#1d1d1f', padding: '16px 32px', borderRadius: '12px', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: '340px', lineHeight: '1.4' }}>
              <span style={{ fontSize: '17px', fontWeight: '700' }}>Start free</span>
              <span style={{ fontSize: '13px', fontWeight: '500', opacity: 0.8 }}>25 visitor registrations on us</span>
            </Link>
            <a href="#how-it-works" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '16px 32px', borderRadius: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: '340px', fontSize: '16px', fontWeight: '600', textAlign: 'center' as const }}>
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section id="problem" className="section-pad" style={{ background: '#f5f5f7' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 className="section-title">The problem with paper sign-in sheets</h2>
            <p style={{ fontSize: '16px', color: '#6e6e73', maxWidth: '600px', margin: '0 auto' }}>
              Every weekend, agents let strangers into private homes and collect contact info they can never use.
            </p>
          </div>
          <div className="grid-4">
            {[
              { emoji: '😤', title: 'Fake information', body: 'Visitors write false names, dead email addresses, and wrong phone numbers with zero accountability.' },
              { emoji: '📖', title: 'Illegible handwriting', body: 'Paper sign-in sheets are often unreadable. Agents spend hours decoding contact info they can never use.' },
              { emoji: '🚫', title: 'No verification', body: 'There is no way to know if a visitor gave real contact info until you try — and fail — days later.' },
              { emoji: '🏠', title: 'Safety risk', body: 'Agents let complete strangers into private residences with no verified identity and no record of who walked through.' },
            ].map(item => (
              <div key={item.title} style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '24px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>{item.emoji}</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#1d1d1f', marginBottom: '8px' }}>{item.title}</div>
                <div style={{ fontSize: '13px', color: '#6e6e73', lineHeight: '1.6' }}>{item.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="section-pad" style={{ background: 'white' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 className="section-title">How ohACCESS works</h2>
            <p style={{ fontSize: '16px', color: '#6e6e73' }}>Set up in 3 minutes. Works at every open house after that.</p>
          </div>
          <div className="grid-4">
            {[
              { step: '1', title: 'Create your open house', body: 'Enter your listing details and choose a secret code word. A unique QR code is generated instantly.' },
              { step: '2', title: 'Buyer scans the QR code', body: 'A mobile form loads. They enter their name, valid email, valid phone number, and buying timeline.' },
              { step: '3', title: 'Code word is delivered', body: 'A text and email with the code word hits their phone instantly. Fake info = no code = no entry.' },
              { step: '4', title: 'Agent is notified', body: "You receive an instant SMS with the visitor's full details — before they even reach the door. Tap the link in the alert to verify the visitor and save private notes." },
            ].map(item => (
              <div key={item.step} style={{ background: '#f5f5f7', borderRadius: '18px', padding: '24px' }}>
                <div style={{ width: '36px', height: '36px', background: '#1d1d1f', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700', color: 'white', marginBottom: '16px' }}>
                  {item.step}
                </div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#1d1d1f', marginBottom: '8px' }}>{item.title}</div>
                <div style={{ fontSize: '13px', color: '#6e6e73', lineHeight: '1.6' }}>{item.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SAFETY & ACCOUNTABILITY */}
      <section id="safety" className="section-pad" style={{ background: '#f5f5f7' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 className="section-title">Every guest checks in. No anonymous walk-ins.</h2>
            <p style={{ fontSize: '16px', color: '#6e6e73', maxWidth: '640px', margin: '0 auto' }}>
              Open houses are the #1 situation where real estate agents report feeling unsafe.<sup>1</sup> A paper sign-in sheet doesn&apos;t change that — anyone can scribble a fake name and walk in. ohACCESS replaces the clipboard with a verified check-in.
            </p>
          </div>
          <div className="grid-4">
            {[
              { emoji: '🔒', title: 'Verified check-in', body: 'Every guest confirms a real, reachable phone or email before they get the entry code — not a name scribbled on paper.' },
              { emoji: '🗂️', title: 'A real attendance record', body: 'Traceable contact info for everyone who came through your open house, saved to your dashboard.' },
              { emoji: '⚡', title: 'Instant alerts', body: "You're notified the moment a visitor checks in, with their details — before they reach the door." },
              { emoji: '🛡️', title: 'A built-in deterrent', body: 'Requiring a verified contact signals attendance is logged, not anonymous — discouraging bad actors.' },
            ].map(item => (
              <div key={item.title} style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '24px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>{item.emoji}</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#1d1d1f', marginBottom: '8px' }}>{item.title}</div>
                <div style={{ fontSize: '13px', color: '#6e6e73', lineHeight: '1.6' }}>{item.body}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '12px', color: '#86868b', lineHeight: '1.6', maxWidth: '720px', margin: '28px auto 0', textAlign: 'center' }}>
            ohACCESS confirms that a visitor provided a reachable phone or email. It does not run background checks or verify identity, and it can&apos;t guarantee anyone&apos;s safety — it&apos;s about accountability and deterrence.<br />
            <sup>1</sup> Source: National Association of REALTORS®, <a href="https://www.nar.realtor/safety" target="_blank" rel="noopener noreferrer" style={{ color: '#86868b', textDecoration: 'underline' }}>2024 Member Safety Residential Report</a> (open houses were the most commonly cited situation in which members felt unsafe).
          </p>
        </div>
      </section>

      {/* STATS */}
      <section className="section-pad" style={{ background: '#1d1d1f' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="grid-3">
            {[
              { number: '1.5M+', label: 'Licensed agents in the US' },
              { number: '4M+', label: 'Open houses every year' },
              { number: '80M+', label: 'Unverified sign-ins annually' },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', fontWeight: '700', color: '#c9963a', letterSpacing: '-2px', marginBottom: '8px' }}>{stat.number}</div>
                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="section-pad" style={{ background: '#f5f5f7' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 className="section-title">Everything agents need</h2>
          </div>
          <div className="grid-3">
            {[
              { emoji: '📱', title: 'QR code per open house', body: 'Every listing gets a unique QR code. Display it at the entrance — buyers scan and register in seconds.' },
              { emoji: '✅', title: 'Real-time verification', body: 'Code word delivered instantly via SMS and email. No valid contact info = no access code.' },
              { emoji: '🔔', title: 'Instant agent alerts', body: 'Know who is walking in before they reach the door. Name, phone, email, and buying timeline — instantly. Tap the alert link to verify them and add private notes.' },
              { emoji: '📋', title: 'Verified visitor log', body: 'Every registration saved automatically. Mark visitors as verified at the door and export to CSV.' },
              { emoji: '🔗', title: 'CRM ready', body: 'Export visitor data to CSV and import into Follow Up Boss, Lofty, or any CRM you use.' },
              { emoji: '🌍', title: 'Multi-market ready', body: 'Built for real estate today — designed to expand to automotive, events, vacation rentals, and more.' },
            ].map(item => (
              <div key={item.title} style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '24px' }}>
                <div style={{ fontSize: '28px', marginBottom: '12px' }}>{item.emoji}</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#1d1d1f', marginBottom: '8px' }}>{item.title}</div>
                <div style={{ fontSize: '13px', color: '#6e6e73', lineHeight: '1.6' }}>{item.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="section-pad" style={{ background: 'white' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 className="section-title">Plans & Pricing</h2>
            <p style={{ fontSize: '16px', color: '#6e6e73', marginBottom: '28px' }}>Start free. Scale as your business grows.</p>
            <div className="billing-toggle">
              {(['monthly', 'annual', '2year'] as const).map(b => (
                <button key={b} onClick={() => setBilling(b)} style={{ padding: '8px 12px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', fontWeight: '600', background: billing === b ? '#1d1d1f' : 'transparent', color: billing === b ? 'white' : '#6e6e73' }}>
                  {b === 'monthly' ? 'Monthly' : b === 'annual' ? 'Annual' : '2 Years*'}
                  {b === 'annual' && <span style={{ marginLeft: '6px', background: '#30d158', color: 'white', fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '10px' }}>2 MOS FREE</span>}
                  {b === '2year' && <span style={{ marginLeft: '6px', background: '#c9963a', color: '#1d1d1f', fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '10px' }}>BEST VALUE</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="pricing-grid">
            {[
              {
                name: 'Trial', price: { monthly: 'Free', annual: 'Free', '2year': 'Free' },
                per: { monthly: '', annual: '', '2year': '' },
                sub: { monthly: '25 registrations, no credit card', annual: '25 registrations, no credit card', '2year': '25 registrations, no credit card' },
                description: 'Try the full Pro experience',
                features: ['25 visitor registrations free', 'Full Pro features included', 'SMS + email delivery', 'QR code PNG download', 'Agent SMS alerts', 'Visitor log + CSV export'],
                cta: 'Start free trial', featured: false
              },
              {
                name: 'Pro', price: { monthly: '$15', annual: '$12.50', '2year': '$10' },
                per: { monthly: '/mo', annual: '/mo', '2year': '/mo' },
                sub: { monthly: '', annual: 'Billed $150/yr — 2 months free', '2year': 'Billed $240 upfront — year 2 is half off' },
                description: 'For the active agent',
                features: ['Unlimited open houses', 'Unlimited visitor registrations', 'Instant agent SMS alerts', 'Agent CC on emails', 'QR code download', 'CSV export'],
                cta: 'Start Pro', featured: true
              },
              {
                name: 'Team', price: { monthly: '$120', annual: '$100', '2year': '$80' },
                per: { monthly: '/mo', annual: '/mo', '2year': '/mo' },
                sub: { monthly: '', annual: 'Billed $1,200/yr — 2 months free', '2year': 'Billed $1,920 upfront — year 2 is half off' },
                description: 'For teams up to 10 agents',
                features: ['Unlimited open houses', 'Unlimited visitor registrations', 'Up to 10 agents', 'All Pro features', 'Brand customization', 'Team logo'],
                cta: 'Start Team', featured: false
              },
              {
                name: 'Brokerage', price: { monthly: 'Custom', annual: 'Custom', '2year': 'Custom' },
                per: { monthly: '', annual: '', '2year': '' },
                sub: { monthly: '', annual: '', '2year': '' },
                description: 'For large brokerages',
                features: ['Custom agent pricing', 'Unlimited everything', 'All Team features', 'Branded visitor emails', 'Dedicated support', 'SLA + onboarding'],
                cta: 'Contact us', featured: false
              },
            ].map(tier => (
              <div key={tier.name} style={{ background: tier.featured ? '#1d1d1f' : 'white', border: tier.featured ? '2px solid #c9963a' : '1px solid #d1d1d6', borderRadius: '22px', padding: '28px 22px', position: 'relative', marginTop: tier.featured ? '0' : '0' }}>
                {tier.featured && (
                  <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#c9963a', color: '#1d1d1f', fontSize: '10px', fontWeight: '700', padding: '4px 14px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
                    MOST POPULAR
                  </div>
                )}
                <div style={{ fontSize: '18px', fontWeight: '700', color: tier.featured ? 'white' : '#1d1d1f', marginBottom: '4px' }}>{tier.name}</div>
                <div style={{ fontSize: '13px', color: tier.featured ? 'rgba(255,255,255,0.5)' : '#6e6e73', marginBottom: '16px' }}>{tier.description}</div>
                <div style={{ fontSize: '36px', fontWeight: '700', color: tier.featured ? '#c9963a' : '#1d1d1f', letterSpacing: '-1px', marginBottom: '2px' }}>
                  {tier.price[billing]}<span style={{ fontSize: '14px', fontWeight: '400', color: tier.featured ? 'rgba(255,255,255,0.5)' : '#6e6e73' }}>{tier.per[billing]}</span>
                </div>
                {tier.sub[billing] && (
                  <div style={{ fontSize: '11px', color: tier.featured ? 'rgba(255,255,255,0.5)' : '#6e6e73', marginBottom: '8px' }}>{tier.sub[billing]}</div>
                )}
                <div style={{ borderTop: `1px solid ${tier.featured ? 'rgba(255,255,255,0.1)' : '#f2f2f7'}`, margin: '16px 0' }} />
                {tier.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px', fontSize: '13px', color: tier.featured ? 'rgba(255,255,255,0.8)' : '#6e6e73' }}>
                    <span style={{ color: '#30d158', fontWeight: '700', flexShrink: 0 }}>✓</span>{f}
                  </div>
                ))}
                <Link href={ctaHref(tier.name)} style={{ display: 'block', textAlign: 'center', marginTop: '20px', padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: '700', textDecoration: 'none', background: tier.featured ? '#c9963a' : '#1d1d1f', color: tier.featured ? '#1d1d1f' : 'white' }}>
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>

          <p style={{ fontSize: '12px', color: '#6e6e73', textAlign: 'center', marginTop: '28px', fontStyle: 'italic' }}>
            * 2-year prepay pricing is a founding-member offer available for a limited time only.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="section-pad" style={{ background: '#1d1d1f', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 24px' }}>
          <h2 style={{ fontSize: '40px', fontWeight: '700', color: 'white', letterSpacing: '-1.5px', marginBottom: '16px' }}>
            Ready to verify your first open house?
          </h2>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.6)', marginBottom: '32px', lineHeight: '1.6' }}>
            Get 25 full Pro visitor registrations completely free — then just $15/month.
          </p>
          <Link href="/login?signup=true" style={{ display: 'inline-block', background: '#c9963a', color: '#1d1d1f', padding: '16px 40px', borderRadius: '12px', fontSize: '16px', fontWeight: '700', textDecoration: 'none' }}>
            Get started free →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#111', padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '20px', fontWeight: '200', color: 'white', letterSpacing: '-0.5px', marginBottom: '16px' }}>
          oh<span style={{ fontWeight: '700' }}>ACCESS</span>
        </div>
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
          <a href="/terms" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Visitor Terms</a>
          <a href="/subscriber-terms" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Subscriber Terms</a>
          <a href="/privacy" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/contact" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Contact</a>
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>© 2026 ohACCESS. All rights reserved.</div>
      </footer>
    </main>
  )
}