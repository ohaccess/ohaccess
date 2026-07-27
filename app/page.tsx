import type { Metadata } from 'next'
import TheRecord from './new/TheRecord'

// Homepage browser tab = the clean brand tagline. `absolute` skips the
// "%s · ohACCESS" template; other pages keep the SEO-rich layout default
// ("… for Real Estate Agents"). openGraph/social still come from layout.tsx.
export const metadata: Metadata = {
  title: { absolute: 'ohACCESS – Verified Open House Check-In' },
  description:
    "The verified open house sign-in for real estate agents. Replace paper sheets with QR-code check-in that confirms every visitor's phone and email — and sends leads to your CRM.",
}

// Homepage: "The Record" design, promoted from /new on 2026-07-23 with the
// 90-second-film section hidden until the film is delivered. When it arrives,
// wire the video into TheRecord's film section and flip showFilm to true (or
// drop the prop). References: /new = complete design incl. film placeholder,
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

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_SCHEMA) }} />
      <TheRecord showFilm={false} />
    </>
  )
}
