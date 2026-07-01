'use client'
import Link from 'next/link'

export default function Resources() {
  return (
    <main style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#ffffff', color: '#1d1d1f', minHeight: '100vh' }}>
      <style>{`
        * { box-sizing: border-box; }
        .resources-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
        .tips-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
        .resources-header h1 { font-size: 36px; }
        @media (max-width: 768px) {
          .resources-grid { grid-template-columns: 1fr; }
          .tips-grid { grid-template-columns: 1fr; }
          .resources-header h1 { font-size: 26px; }
        }
      `}</style>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* NAV */}
      <nav style={{ background: '#1d1d1f', padding: '0 24px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: '22px', fontWeight: '200', color: 'white', letterSpacing: '-0.5px' }}>
            oh<span style={{ fontWeight: '700' }}>ACCESS</span>
          </div>
        </Link>
        <Link href="/dashboard" style={{ background: '#c9963a', color: '#1d1d1f', padding: '8px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', textDecoration: 'none' }}>
          Dashboard
        </Link>
      </nav>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 16px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ display: 'inline-block', background: 'rgba(201,150,58,0.1)', border: '1px solid rgba(201,150,58,0.3)', borderRadius: '20px', padding: '6px 16px', fontSize: '13px', color: '#c9963a', fontWeight: '600', marginBottom: '16px' }}>
            Agent Resources
          </div>
          <h1 className="resources-header" style={{ fontSize: '36px', fontWeight: '700', color: '#1d1d1f', letterSpacing: '-1px', marginBottom: '12px' }}>
            Everything you need to run a great open house
          </h1>
          <p style={{ fontSize: '16px', color: '#6e6e73', maxWidth: '560px', margin: '0 auto', lineHeight: '1.6' }}>
            Free templates, guides, and tools to help you get the most out of ohACCESS at every open house.
          </p>
        </div>

        {/* Welcome Sign Templates */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#1d1d1f', marginBottom: '4px' }}>
            🪧 Welcome Sign Templates
          </div>
          <div style={{ fontSize: '14px', color: '#6e6e73', marginBottom: '20px' }}>
            Print-ready welcome signs to display at your open house entrance. Visitors scan the QR code to register and receive their access code.
          </div>

          <div className="resources-grid">

            {/* Template 1 */}
            <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div style={{ background: '#1d1d1f', padding: '32px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: '200', color: 'white', letterSpacing: '-0.5px', marginBottom: '8px' }}>
                  oh<span style={{ fontWeight: '700' }}>ACCESS</span>
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>WELCOME SIGN</div>
                <div style={{ background: 'white', borderRadius: '8px', padding: '12px', display: 'inline-block' }}>
                  <div style={{ width: '60px', height: '60px', background: '#f5f5f7', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                    ▦
                  </div>
                </div>
              </div>
              <div style={{ padding: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1d1d1f', marginBottom: '4px' }}>Classic Dark</div>
                <div style={{ fontSize: '12px', color: '#6e6e73', marginBottom: '14px' }}>Navy background, white text. Professional and elegant.</div>
                
                  <a href="https://canva.link/ohaccess-sign-template-1"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'block', textAlign: 'center', background: '#1d1d1f', color: 'white', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', textDecoration: 'none' }}
                >
                  Open in Canva →
                </a>
              </div>
            </div>

            {/* More templates coming soon */}
            <div style={{ background: '#f5f5f7', borderRadius: '18px', border: '1px dashed #d1d1d6', padding: '32px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>🎨</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#1d1d1f', marginBottom: '6px' }}>More templates coming soon</div>
              <div style={{ fontSize: '12px', color: '#6e6e73', lineHeight: '1.6' }}>Light, branded, and multilingual versions on the way.</div>
            </div>

          </div>
        </div>

        {/* How to use section */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#1d1d1f', marginBottom: '4px' }}>
            📋 How to set up your open house
          </div>
          <div style={{ fontSize: '14px', color: '#6e6e73', marginBottom: '20px' }}>
            Follow these steps for a smooth, verified open house every time.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { step: '1', title: 'Create your open house in the dashboard', body: 'Enter the property address, date, hours, and listing URL. Create or auto-generate a code word.' },
              { step: '2', title: 'Download and print your QR code', body: 'Click "QR Code" on your open house card. Download the PNG, add it to the Canva template or your own custom sign. Print enough copies for each entry.' },
              { step: '3', title: 'Set up your welcome sign', body: 'Use a pedestal sign holder, easel, or A-frame poster and display the QR code with instructions prominently before the entrance.' },
              { step: '4', title: 'Greet visitors at the door', body: 'Ask visitors for their code word as they arrive. Only visitors who registered with real contact info will have received the code.' },
              { step: '5', title: 'Review your visitor log', body: 'After the open house, check your dashboard for the full verified visitor log. Export to CSV and import into your CRM.' },
            ].map(item => (
              <div key={item.step} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', background: 'white', borderRadius: '14px', border: '1px solid #d1d1d6', padding: '16px 20px' }}>
                <div style={{ width: '32px', height: '32px', background: '#1d1d1f', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', color: 'white', flexShrink: 0 }}>
                  {item.step}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#1d1d1f', marginBottom: '3px' }}>{item.title}</div>
                  <div style={{ fontSize: '13px', color: '#6e6e73', lineHeight: '1.6' }}>{item.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Open house essentials (affiliate) */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#1d1d1f', marginBottom: '4px' }}>
            🪧 Open house essentials
          </div>
          <div style={{ fontSize: '14px', color: '#6e6e73', marginBottom: '20px' }}>
            Our favorite sign stands and displays for showing your QR welcome sign at the door — and guiding visitors in from the street.
          </div>

          <div className="resources-grid">
            {[
              { emoji: '🪧', name: 'A-Frame Sidewalk Sign', body: 'Double-sided sidewalk sign to guide visitors from the street to your door. Slide in a poster with your QR code and address.', url: 'https://amzn.to/4v48sQg' },
              { emoji: '🏷️', name: 'Pedestal Sign Holder', body: 'Weighted floor stand for an 8.5×11" sign — ideal for your QR welcome sign right at the entrance. Adjustable height, portrait or landscape.', url: 'https://amzn.to/4wkUfj2' },
              { emoji: '🖼️', name: 'Poster Easel Stand', body: 'Lightweight, collapsible tripod easel — a simple, budget-friendly way to prop up a foam-board welcome sign indoors.', url: 'https://amzn.to/4eNmLnH' },
              { emoji: '✨', name: 'Gold Sign Easel', body: 'Elegant adjustable gold easel for a premium welcome sign at higher-end listings. Holds signs, posters, and framed displays.', url: 'https://amzn.to/4xZoSw4' },
            ].map(item => (
              <div key={item.name} style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>{item.emoji}</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#1d1d1f', marginBottom: '6px' }}>{item.name}</div>
                <div style={{ fontSize: '13px', color: '#6e6e73', lineHeight: '1.6', marginBottom: '16px', flex: 1 }}>{item.body}</div>
                <a href={item.url} target="_blank" rel="noopener noreferrer sponsored"
                  style={{ display: 'block', textAlign: 'center', background: '#c9963a', color: '#1d1d1f', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', textDecoration: 'none' }}>
                  View on Amazon →
                </a>
              </div>
            ))}
          </div>

          <div style={{ fontSize: '12px', color: '#aeaeb2', marginTop: '16px', lineHeight: '1.6' }}>
            As an Amazon Associate, ohACCESS earns from qualifying purchases. These are affiliate links — they cost you nothing extra and help support ohACCESS.
          </div>
        </div>

        {/* Tips section */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#1d1d1f', marginBottom: '4px' }}>
            💡 Pro tips
          </div>
          <div style={{ fontSize: '14px', color: '#6e6e73', marginBottom: '20px' }}>
            Get the most out of ohACCESS at every open house.
          </div>
          <div className="tips-grid">
            {[
              { emoji: '🪧', title: 'Use a pedestal, easel, or A-frame sign', body: 'Prominently display the QR code with instructions on a pedestal sign holder, easel, or A-frame poster well before the entrance.' },
              { emoji: '🔗', title: 'Add your listing URL', body: 'Include a link to the full listing so visitors can review details before and after the open house.' },
              { emoji: '🏷️', title: 'Choose a memorable code word', body: 'Pick a code word related to the property — like ACREAGE or LAKEHOUSE. Easier for visitors to remember.' },
              { emoji: '👤', title: 'Add your landing page URL', body: 'Add your bio page, website, or Instagram in Settings so every visitor email includes a link to your profile.' },
              { emoji: '🔔', title: 'Watch for agent alerts', body: 'You receive an instant SMS when a visitor registers — so you know who\'s coming before they reach the door. Tap the link in the alert to verify the visitor and save private notes.' },
              { emoji: '📊', title: 'Export after every open house', body: 'Export your visitor log to CSV immediately after and import into your CRM while leads are fresh.' },
            ].map(tip => (
              <div key={tip.title} style={{ background: 'white', borderRadius: '14px', border: '1px solid #d1d1d6', padding: '16px' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>{tip.emoji}</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1d1d1f', marginBottom: '4px' }}>{tip.title}</div>
                <div style={{ fontSize: '13px', color: '#6e6e73', lineHeight: '1.6' }}>{tip.body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ background: '#1d1d1f', borderRadius: '22px', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'white', marginBottom: '8px' }}>
            Ready to run your next open house?
          </div>
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginBottom: '24px' }}>
            Create your open house and generate your QR code in under 3 minutes.
          </div>
          <Link href="/dashboard" style={{ display: 'inline-block', background: '#c9963a', color: '#1d1d1f', padding: '14px 32px', borderRadius: '10px', fontSize: '15px', fontWeight: '700', textDecoration: 'none' }}>
            Go to dashboard →
          </Link>
        </div>

      </div>

      {/* FOOTER */}
      <footer style={{ background: '#111', padding: '40px 24px', textAlign: 'center', marginTop: '60px' }}>
        <div style={{ fontSize: '20px', fontWeight: '200', color: 'white', letterSpacing: '-0.5px', marginBottom: '16px' }}>
          oh<span style={{ fontWeight: '700' }}>ACCESS</span>
        </div>
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
          <a href="/terms" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Terms of Service</a>
          <a href="/privacy" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/contact" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Contact</a>
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>© 2026 ohACCESS. All rights reserved.</div>
      </footer>
    </main>
  )
}