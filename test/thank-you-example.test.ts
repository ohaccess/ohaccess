import { describe, it, expect } from 'vitest'
import { exampleUpcomingOpenHouses } from '../lib/thank-you-email'

const OH = { city: 'Arlington', state: 'TX', listing_price: '$625,000', bedrooms: '4', bathrooms: '3' }

describe('exampleUpcomingOpenHouses', () => {
  it('lands on the next weekend at least 2 days out', () => {
    // Sunday Sep 13, 2026 → Saturday Sep 19 + Sunday Sep 20
    const [sat, sun] = exampleUpcomingOpenHouses(OH, new Date('2026-09-13T15:00:00Z'))
    expect(sat.open_house_date).toBe('Saturday, September 19, 2026')
    expect(sun.open_house_date).toBe('Sunday, September 20, 2026')
  })
  it('skips a Saturday that is too close', () => {
    // Friday Sep 18 → not tomorrow, the following Saturday Sep 26
    const [sat] = exampleUpcomingOpenHouses(OH, new Date('2026-09-18T15:00:00Z'))
    expect(sat.open_house_date).toBe('Saturday, September 26, 2026')
  })
  it('uses the previewed home’s city, state and facts', () => {
    const [first, second] = exampleUpcomingOpenHouses(OH, new Date('2026-09-13T15:00:00Z'))
    expect(first.property_address).toBe('123 Example Lane, Arlington, TX')
    expect(first.listing_price).toBe('$625,000')
    expect(second.property_address).toBe('456 Sample Court, Arlington, TX')
    expect(first.start_at! < first.end_at!).toBe(true)
  })
  it('falls back gracefully when the open house has no city or facts', () => {
    const [first] = exampleUpcomingOpenHouses({}, new Date('2026-09-13T15:00:00Z'))
    expect(first.property_address).toBe('123 Example Lane')
    expect(first.bedrooms).toBe('3')
    expect(first.listing_price).toBeNull()
  })
})
