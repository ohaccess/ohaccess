'use client'
import { useState } from 'react'
import Link from 'next/link'


export default function Home() 
{ const [billing, setBilling] = useState<'monthly' | 'annual' | '2year'>('monthly')
  return (
    <main style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#ffffff', color: '#1d1d1f' }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* NAV */}
      <nav style={{ background: '#1d1d1f', padding: '0 40px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontSize: '22px', fontWeight: '200', color: 'white', letterSpacing: '-0.5px' }}>
          oh<span style={{ fontWeight: '700' }}>ACCESS</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <a href="#how-it-works" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', textDecoration: 'none' }}>How it works</a>
          <a href="#pricing" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', textDecoration: 'none' }}>Pricing</a>
          <Link href="/login" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', textDecoration: 'none' }}>Sign in</Link>
          <Link href="/login" style={{ background: '#c9963a', color: '#1d1d1f', padding: '8px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', textDecoration: 'none' }}>
            Get started free
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ background: '#1d1d1f', padding: '100px 40px', textAlign: 'center' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'inline-block', background: 'rgba(201,150,58,0.15)', border: '1px solid rgba(201,150,58,0.3)', borderRadius: '20px', padding: '6px 16px', fontSize: '13px', color: '#c9963a', fontWeight: '600', marginBottom: '24px' }}>
            Built for real estate agents
          </div>
          <h1 style={{ fontSize: '64px', fontWeight: '700', color: 'white', letterSpacing: '-2px', lineHeight: '1.05', marginBottom: '24px' }}>
            The sign-in sheet<br />
            <span style={{ color: '#c9963a' }}>is finished.</span>
          </h1>
          <p style={{ fontSize: '20px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.6', marginBottom: '40px', maxWidth: '600px', margin: '0 auto 40px' }}>
            ohACCESS verifies every open house visitor&apos;s contact information in real time — via a code word sent to their phone and email. Fake info? No code. No entry.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" style={{ background: '#c9963a', color: '#1d1d1f', padding: '16px 32px', borderRadius: '12px', fontSize: '16px', fontWeight: '700', textDecoration: 'none' }}>
              Start free — no credit card
            </Link>
            <a href="#how-it-works" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '16px 32px', borderRadius: '12px', fontSize: '16px', fontWeight: '600', textDecoration: 'none' }}>
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section style={{ padding: '80px 40px', background: '#f5f5f7' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '40px', fontWeight: '700', color: '#1d1d1f', letterSpacing: '-1px', marginBottom: '12px' }}>
              The problem with paper sign-in sheets
            </h2>
            <p style={{ fontSize: '16px', color: '#6e6e73', maxWidth: '600px', margin: '0 auto' }}>
              Every weekend, agents let strangers into private homes and collect contact info they can never use.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
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
      <section id="how-it-works" style={{ padding: '80px 40px', background: 'white' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '40px', fontWeight: '700', color: '#1d1d1f', letterSpacing: '-1px', marginBottom: '12px' }}>
              How ohACCESS works
            </h2>
            <p style={{ fontSize: '16px', color: '#6e6e73' }}>
              Set up in 3 minutes. Works at every open house after that.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {[
              { step: '1', title: 'Create your open house', body: 'Enter your listing details and choose a secret code word. A unique QR code is generated instantly.' },
              { step: '2', title: 'Buyer scans the QR code', body: 'A mobile form loads. They enter their name, valid email, valid phone number, and buying timeline.' },
              { step: '3', title: 'Code word is delivered', body: 'A text and email with the code word hits their phone instantly. Fake info = no code = no entry.' },
              { step: '4', title: 'Agent is notified', body: 'You receive an instant SMS with the visitor\'s full details — before they even reach the door.' },
            ].map(item => (
              <div key={item.step} style={{ background: '#f5f5f7', borderRadius: '18px', padding: '24px', position: 'relative' }}>
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

      {/* STATS */}
      <section style={{ padding: '80px 40px', background: '#1d1d1f' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', textAlign: 'center' }}>
            {[
              { number: '1.5M+', label: 'Licensed agents in the US' },
              { number: '4M+', label: 'Open houses every year' },
              { number: '80M+', label: 'Unverified sign-ins annually' },
            ].map(stat => (
              <div key={stat.label}>
                <div style={{ fontSize: '48px', fontWeight: '700', color: '#c9963a', letterSpacing: '-2px', marginBottom: '8px' }}>{stat.number}</div>
                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: '80px 40px', background: '#f5f5f7' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '40px', fontWeight: '700', color: '#1d1d1f', letterSpacing: '-1px', marginBottom: '12px' }}>
              Everything agents need
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {[
              { emoji: '📱', title: 'QR code per open house', body: 'Every listing gets a unique QR code. Display it at the entrance — buyers scan and register in seconds.' },
              { emoji: '✅', title: 'Real-time verification', body: 'Code word delivered instantly via SMS and email. No valid contact info = no access code.' },
              { emoji: '🔔', title: 'Instant agent alerts', body: 'Know who is walking in before they reach the door. Name, phone, email, and buying timeline — instantly.' },
              { emoji: '📋', title: 'Verified visitor log', body: 'Every registration saved automatically. Mark visitors as verified at the door and export to CSV (with paid plan).' },
              { emoji: '🔗', title: 'CRM ready', body: 'Export visitor data to CSV and import into Follow Up Boss, Lofty, or any CRM you use (with paid plan).' },
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
<section id="pricing" style={{ padding: '80px 40px', background: 'white' }}>
  <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
    <div style={{ textAlign: 'center', marginBottom: '48px' }}>
      <h2 style={{ fontSize: '40px', fontWeight: '700', color: '#1d1d1f', letterSpacing: '-1px', marginBottom: '12px' }}>
        Plans & pricing
      </h2>
      <p style={{ fontSize: '16px', color: '#6e6e73', marginBottom: '32px' }}>
        Start free. Scale as your business grows.
      </p>

      {/* Billing toggle */}
      <div style={{ display: 'inline-flex', background: '#f5f5f7', borderRadius: '12px', padding: '4px', gap: '4px' }}>
        {['monthly', 'annual', '2year'].map(b => (
          <button
            key={b}
            onClick={() => setBilling(b as any)}
            style={{
              padding: '8px 20px',
              borderRadius: '9px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '13px',
              fontWeight: '600',
              background: billing === b ? '#1d1d1f' : 'transparent',
              color: billing === b ? 'white' : '#6e6e73',
              transition: 'all 0.15s'
            }}
          >
            {b === 'monthly' ? 'Monthly' : b === 'annual' ? 'Annual' : '2 Years'}
            {b === 'annual' && <span style={{ marginLeft: '6px', background: '#30d158', color: 'white', fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '10px' }}>2 FREE</span>}
            {b === '2year' && <span style={{ marginLeft: '6px', background: '#c9963a', color: '#1d1d1f', fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '10px' }}>50% OFF</span>}
          </button>
        ))}
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
      {[
        {
          name: 'Free',
          price: { monthly: '$0', annual: '$0', '2year': '$0' },
          per: { monthly: '/mo', annual: '/mo', '2year': '/mo' },
          sub: { monthly: '', annual: '', '2year': '' },
          description: 'Perfect for getting started',
          features: ['4 open houses/month', 'Up to 20 visitors each', 'SMS + email delivery', 'QR code PNG download', 'Multilingual welcome sign'],
          cta: 'Get started free',
          featured: false
        },
        {
          name: 'Pro',
          price: { monthly: '$15', annual: '$12.50', '2year': '$7.50' },
          per: { monthly: '/mo', annual: '/mo', '2year': '/mo' },
          sub: { monthly: '', annual: 'Billed $150/yr — 2 months free', '2year': 'Billed $180 — 50% off' },
          description: 'For the active agent',
          features: ['30 open houses/month', 'Unlimited visitors', 'Instant agent SMS alerts', 'Photo attachments', 'Agent CC on emails', 'CSV export'],
          cta: 'Start Pro',
          featured: true
        },
        {
          name: 'Team',
          price: { monthly: '$120', annual: '$100', '2year': '$60' },
          per: { monthly: '/mo', annual: '/mo', '2year': '/mo' },
          sub: { monthly: '', annual: 'Billed $1,200/yr — 2 months free', '2year': 'Billed $1,440 — 50% off' },
          description: 'For teams up to 10 agents',
          features: ['330 open houses/month', 'Up to 10 agents', 'All Pro features', 'Brand customization', 'Team logo', 'Admin dashboard'],
          cta: 'Start Team',
          featured: false
        },
        {
          name: 'Brokerage',
          price: { monthly: 'Custom', annual: 'Custom', '2year': 'Custom' },
          per: { monthly: '', annual: '', '2year': '' },
          sub: { monthly: '', annual: '', '2year': '' },
          description: 'For large brokerages',
          features: ['Unlimited agents', 'Unlimited open houses', 'All Team features', 'White-label branding', 'Dedicated support', 'SLA + onboarding'],
          cta: 'Contact us',
          featured: false
        },
      ].map(tier => (
        <div key={tier.name} style={{ background: tier.featured ? '#1d1d1f' : 'white', border: tier.featured ? '2px solid #c9963a' : '1px solid #d1d1d6', borderRadius: '22px', padding: '28px 22px', position: 'relative' }}>
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
            <div style={{ fontSize: '11px', color: tier.featured ? 'rgba(255,255,255,0.5)' : '#6e6e73', marginBottom: '8px' }}>
              {tier.sub[billing]}
            </div>
          )}
          <div style={{ borderTop: `1px solid ${tier.featured ? 'rgba(255,255,255,0.1)' : '#f2f2f7'}`, margin: '16px 0' }} />
          {tier.features.map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px', fontSize: '13px', color: tier.featured ? 'rgba(255,255,255,0.8)' : '#6e6e73' }}>
              <span style={{ color: '#30d158', fontWeight: '700', flexShrink: 0 }}>✓</span>
              {f}
            </div>
          ))}
          <Link href="/login" style={{ display: 'block', textAlign: 'center', marginTop: '20px', padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: '700', textDecoration: 'none', background: tier.featured ? '#c9963a' : '#1d1d1f', color: tier.featured ? '#1d1d1f' : 'white' }}>
            {tier.cta}
          </Link>
        </div>
      ))}
    </div>
  </div>
</section>

      {/* CTA */}
      <section style={{ padding: '80px 40px', background: '#1d1d1f', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '48px', fontWeight: '700', color: 'white', letterSpacing: '-1.5px', marginBottom: '16px' }}>
            Ready to verify your first open house?
          </h2>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.6)', marginBottom: '32px', lineHeight: '1.6' }}>
            Set up takes under 3 minutes. No credit card required. Start verifying visitors at your very next open house.
          </p>
          <Link href="/login" style={{ display: 'inline-block', background: '#c9963a', color: '#1d1d1f', padding: '16px 40px', borderRadius: '12px', fontSize: '16px', fontWeight: '700', textDecoration: 'none' }}>
            Get started free →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#111', padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '20px', fontWeight: '200', color: 'white', letterSpacing: '-0.5px', marginBottom: '16px' }}>
          oh<span style={{ fontWeight: '700' }}>ACCESS</span>
        </div>
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginBottom: '24px' }}>
          <a href="/terms" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Terms of Service</a>
          <a href="/privacy" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="mailto:david.sheehan@ohaccess.com" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Contact</a>
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
          © 2026 ohACCESS. All rights reserved.
        </div>
      </footer>
    </main>
  )
}