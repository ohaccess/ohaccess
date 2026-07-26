import type { Metadata } from 'next'
import TheRecord from './TheRecord'

// Parallel "The Record" landing page (design-drop handoff). Noindexed until
// the 90-second film is delivered and this page is promoted to /.
// Title is absolute (skips the "%s · ohACCESS" template) so ohACCESS leads
// and survives browser-tab truncation. openGraph overrides the layout's only
// to pin og:url here — Facebook uses og:url as the card's click-through, and
// the layout's value would send shares of this page to the old homepage.
export const metadata: Metadata = {
  title: { absolute: 'ohACCESS – Verified Open House Check-In' },
  robots: { index: false, follow: false },
  openGraph: {
    title: 'ohACCESS – Verified Open House Check-In',
    description:
      'Replace paper sign-in sheets with verified QR-code digital check-in. Know exactly who walked through your open house.',
    url: 'https://www.ohaccess.com/new',
    type: 'website',
    images: [{ url: 'https://www.ohaccess.com/og-image.png', width: 1200, height: 630 }],
  },
}

export default function Page() {
  return <TheRecord />
}
