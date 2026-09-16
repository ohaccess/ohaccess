import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import Footer from '../_components/Footer'
import Planner from './Planner'
import { normalizeStateCode } from '@/lib/hardware-offer'

export const metadata: Metadata = {
  title: 'Open House Game-Day Planner',
  description:
    'Free tool for real estate agents: pick your state and a date to see every NFL, college football, NBA, MLB, NHL, golf and racing event your buyers might be watching, hour by hour, before you choose your open house time.',
}

// The planner reads a Vercel geo header to guess the visitor's state, so
// the page is rendered per request.
export const dynamic = 'force-dynamic'

export default async function PlannerPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const sp = await searchParams
  const h = await headers()
  const geoState = h.get('x-vercel-ip-country') === 'US' ? normalizeStateCode(h.get('x-vercel-ip-country-region')) : null
  const initialState = normalizeStateCode(sp.state) ?? geoState ?? 'TX'

  return (
    <main style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#ffffff', color: '#1d1d1f', minHeight: '100vh' }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700&display=swap" rel="stylesheet" />

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

      <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '36px 16px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-block', background: 'rgba(201,150,58,0.1)', border: '1px solid rgba(201,150,58,0.3)', borderRadius: '20px', padding: '6px 16px', fontSize: '13px', color: '#c9963a', fontWeight: 600, marginBottom: '16px' }}>
            Free planning tool
          </div>
          <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 700, letterSpacing: '-1px', margin: '0 0 12px' }}>
            Open House Game-Day Planner
          </h1>
          <p style={{ fontSize: '16px', color: '#6e6e73', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
            Pick your state and a day. See every game your buyers might be watching, hour by hour, before you choose your open house time.
          </p>
        </div>

        <Planner initialState={initialState} />

        <div style={{ maxWidth: '760px', margin: '48px auto 0', fontSize: '14px', color: '#48484a', lineHeight: 1.7 }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 8px' }}>How to read it</h2>
          <p style={{ margin: '0 0 10px' }}>
            Each day is shaded by how many games overlap the usual open house hours, 10 AM to 6 PM: green means the coast is clear, amber means a game or two, red means game-day chaos. The dot marks a <strong>Big one</strong>, the game most of your buyers will be watching.
          </p>
          <p style={{ margin: '0 0 10px' }}>
            Pick a day and you get the sweet spot (the longest stretch with nothing on), the full lineup with TV channels, and sunrise and sunset so you know how much daylight you have to show the house.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Team &ldquo;Dodge the Game&rdquo;</strong> schedules around kickoff for more foot traffic. <strong>Team &ldquo;Go Bold&rdquo;</strong> opens during the big game, because whoever shows up then really wants the house. Either way, now you&rsquo;re choosing on purpose.
          </p>
        </div>
      </div>

      <Footer />
    </main>
  )
}
