import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Questions about verified open house check-in? Reach the ohACCESS team — brokerage plans, partner inquiries, and support.',
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
