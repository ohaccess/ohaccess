import type { Metadata } from 'next'
import OldHome from './OldHome'

// Archived copy of the pre-2026-07-23 homepage, kept for reference after
// "The Record" design was promoted to /. Noindexed — reference only.
export const metadata: Metadata = {
  title: 'Previous homepage (archive)',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <OldHome />
}
