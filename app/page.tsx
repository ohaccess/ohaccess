import type { Metadata } from 'next'
import TheRecord from './new/TheRecord'
import { getSeason } from '@/lib/season'
import RecoveryRedirect from './_components/RecoveryRedirect'

// Homepage browser tab = the clean brand tagline. `absolute` skips the
// "%s · ohACCESS" template; other pages keep the SEO-rich layout default
// ("… for Real Estate Agents"). openGraph/social still come from layout.tsx.
export const metadata: Metadata = {
  title: { absolute: 'ohACCESS – Verified Open House Check-In' },
  description:
    "The verified open house sign-in for real estate agents. QR-code check-in that confirms every visitor's phone and email, and sends leads to your CRM.",
}

// Homepage: "The Record" design, promoted from /new on 2026-07-23. The
// 90-second-film section went live on 2026-08-16 when the film was delivered
// (https://youtu.be/hdKk1-WxNWU). References: /new = the same design,
// /old = archived previous homepage. SEO metadata inherits from layout.tsx.
// Organization schema so Google connects the brand name, logo, and domain.
const ORG_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ohACCESS',
  url: 'https://www.ohaccess.com',
  logo: 'https://www.ohaccess.com/favicon-192x192.png',
  description:
    'Verified open house sign-in for real estate agents: QR-code check-in that confirms every visitor’s phone and email.',
}

// Rebuild the prerendered homepage at most hourly, so the seasonal hero photo
// baked into the HTML (lib/season.ts) catches up within an hour of an
// equinox/solstice instead of waiting for the next deploy. TheRecord also
// corrects it in the browser, so this only keeps that correction from
// flashing the old photo first.
export const revalidate = 3600

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_SCHEMA) }} />
      <RecoveryRedirect />
      <TheRecord bakedSeason={getSeason() && "summer"} />
    </>
  )
}
