import type { Metadata } from 'next'
import OpenHouseMap from '@/app/_components/OpenHouseMap'

// The shareable open-house map: same map as the admin Map tab, reachable by
// secret link only (/map/<MAP_SHARE_CODE>) with no login. Deliberately not
// linked from anywhere public and marked noindex; the API route 404s any
// code that doesn't match, so a wrong guess shows an empty page with an
// error message rather than data.

export const metadata: Metadata = {
  title: 'Open Houses Map · ohACCESS',
  robots: { index: false, follow: false },
}

export default async function SharedMapPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return (
    <div style={{ background: '#ffffff', color: '#1d1d1f', minHeight: '100vh', width: '100%' }}>
      <main
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '28px 20px 64px',
          fontFamily: '"Plus Jakarta Sans", Arial, sans-serif',
        }}
      >
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
          oh<span style={{ fontWeight: 300 }}>ACCESS</span> · Open Houses
        </h1>
        <div style={{ fontSize: 13, color: '#6e6e73', marginTop: 4 }}>
          Every open house on the platform — green is happening now, blue is upcoming, gray is past. Click a pin for details.
        </div>
        <OpenHouseMap shareCode={code} />
      </main>
    </div>
  )
}
