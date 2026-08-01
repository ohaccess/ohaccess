import { headers } from 'next/headers'
import { getClientIpFromHeaders } from '@/lib/rate-limit'
import { getOpenHouseDisplay } from '@/lib/open-house-display'
import RegisterClient from './RegisterClient'

// Server page: fetches the safe display data (and records the qr_scans
// entry) during the initial render, so the visitor's phone gets the form
// with the data already in it instead of loading a spinner and then making
// a second round trip to /api/open-house/[id]. This page is the phone-at-
// the-front-door path — every saved round trip matters.
export default async function RegisterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const h = await headers()

  const openHouse = await getOpenHouseDisplay(id, {
    ip: getClientIpFromHeaders(h),
    userAgent: h.get('user-agent'),
  })

  return <RegisterClient id={id} initialOpenHouse={openHouse} />
}
