import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact ohACCESS — Open House Sign-In Support',
  description:
    'Questions about verified open house check-in? Reach the ohACCESS team — brokerage plans, partner inquiries, and support.',
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
