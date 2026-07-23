import type { Metadata } from 'next'
import TheRecord from './TheRecord'

// Parallel "The Record" landing page (design-drop handoff). Noindexed until
// the 90-second film is delivered and this page is promoted to /.
export const metadata: Metadata = {
  title: 'The Verified Open House',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <TheRecord />
}
