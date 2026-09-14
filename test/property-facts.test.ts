import { describe, expect, it } from 'vitest'
import { factsFrom, fillEmptyFacts, pickActiveListing } from '../lib/property-facts'

describe('pickActiveListing', () => {
  it('skips an old inactive listing and takes the active one', () => {
    const listing = pickActiveListing([
      { status: 'Inactive', price: 529000, listedDate: '2024-05-03T00:00:00.000Z' },
      { status: 'Active', price: 489000, listedDate: '2026-09-12T00:00:00.000Z' },
    ])
    expect(listing?.price).toBe(489000)
  })

  it('returns null when only inactive listings exist (listing-day stale price)', () => {
    expect(pickActiveListing([{ status: 'Inactive', price: 409000 }])).toBeNull()
  })

  it('prefers the newest active listing', () => {
    const listing = pickActiveListing([
      { status: 'Active', price: 1, listedDate: '2025-01-01T00:00:00.000Z' },
      { status: 'Active', price: 2, listedDate: '2026-01-01T00:00:00.000Z' },
    ])
    expect(listing?.price).toBe(2)
  })

  it('handles RentCast\'s 404 body and junk', () => {
    expect(pickActiveListing({ status: 404, error: 'resource/not-found' })).toBeNull()
    expect(pickActiveListing(null)).toBeNull()
    expect(pickActiveListing([])).toBeNull()
  })
})

describe('factsFrom', () => {
  it('formats an active listing for the form', () => {
    expect(factsFrom({ price: 64000000, bedrooms: 10, bathrooms: 14.5, squareFootage: 27092 }, true)).toEqual({
      listing_price: '$64,000,000',
      bedrooms: '10',
      bathrooms: '14.5',
      square_footage: '27,092',
    })
  })

  it('never takes a price from a public record', () => {
    expect(factsFrom({ price: 300000, bedrooms: 3, bathrooms: 2, squareFootage: 2211 }, false)).toEqual({
      listing_price: '',
      bedrooms: '3',
      bathrooms: '2',
      square_footage: '2,211',
    })
  })

  it('leaves missing or zero values blank', () => {
    expect(factsFrom({ price: null, bedrooms: 0 }, true)).toEqual({
      listing_price: '',
      bedrooms: '',
      bathrooms: '',
      square_footage: '',
    })
  })
})

describe('fillEmptyFacts', () => {
  const facts = { listing_price: '$489,000', bedrooms: '5', bathrooms: '3.5', square_footage: '3,471' }

  it('fills only the boxes the agent left empty', () => {
    expect(fillEmptyFacts({ listing_price: '$499,000', bedrooms: '', bathrooms: '  ', square_footage: undefined }, facts)).toEqual({
      bedrooms: '5',
      bathrooms: '3.5',
      square_footage: '3,471',
    })
  })

  it('does not blank a box when the lookup had nothing for it', () => {
    expect(fillEmptyFacts({ listing_price: '' }, { ...facts, listing_price: '' })).not.toHaveProperty('listing_price')
  })
})
