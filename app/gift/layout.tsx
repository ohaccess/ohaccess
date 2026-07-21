import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Gift a Year of Pro',
  description:
    'Know a real estate agent? Give them a full year of verified open house check-in — one-time payment, no subscription.',
}

export default function GiftLayout({ children }: { children: React.ReactNode }) {
  return children
}
