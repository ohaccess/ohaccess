import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Agent Resources & Setup Guide',
  description:
    'How ohACCESS works at a real open house: printable QR signs, sign placement tips, door scripts, and lead export to your CRM.',
}

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  return children
}
