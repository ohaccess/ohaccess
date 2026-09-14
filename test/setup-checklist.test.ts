import { describe, it, expect } from 'vitest'
import { setupSteps, showSetupChecklist, signSavedKey } from '@/lib/setup-checklist'

const done = (input: Parameters<typeof setupSteps>[0]) =>
  Object.fromEntries(setupSteps(input).map(s => [s.id, s.done]))

describe('setupSteps', () => {
  it('starts with nothing done for a brand-new account', () => {
    expect(done({ profile: {}, openHouseCount: 0, signSaved: false }))
      .toEqual({ profile: false, open_house: false, sign: false })
    expect(done({ profile: null, openHouseCount: 0, signSaved: false }).profile).toBe(false)
  })
  it('needs a name AND a headshot or logo for the profile step', () => {
    expect(done({ profile: { full_name: 'Sarah Lee' }, openHouseCount: 0, signSaved: false }).profile).toBe(false)
    expect(done({ profile: { headshot_url: 'https://x/y.jpg' }, openHouseCount: 0, signSaved: false }).profile).toBe(false)
    expect(done({ profile: { full_name: 'Sarah Lee', headshot_url: 'https://x/y.jpg' }, openHouseCount: 0, signSaved: false }).profile).toBe(true)
    expect(done({ profile: { full_name: 'Sarah Lee', logo_url: 'https://x/logo.png' }, openHouseCount: 0, signSaved: false }).profile).toBe(true)
  })
  it('treats blank strings as not filled in', () => {
    expect(done({ profile: { full_name: '  ', logo_url: 'https://x/logo.png' }, openHouseCount: 0, signSaved: false }).profile).toBe(false)
    expect(done({ profile: { full_name: 'Sarah Lee', headshot_url: ' ', logo_url: '' }, openHouseCount: 0, signSaved: false }).profile).toBe(false)
  })
  it('ticks the open house and sign steps from their own inputs', () => {
    expect(done({ profile: {}, openHouseCount: 1, signSaved: true }))
      .toEqual({ profile: false, open_house: true, sign: true })
  })
})

describe('showSetupChecklist', () => {
  const someLeft = setupSteps({ profile: {}, openHouseCount: 1, signSaved: false })
  const allDone = setupSteps({ profile: { full_name: 'A', logo_url: 'u' }, openHouseCount: 1, signSaved: true })

  it('shows while steps remain and nobody has signed in', () => {
    expect(showSetupChecklist(someLeft, 0, false)).toBe(true)
  })
  it('hides once every step is done', () => {
    expect(showSetupChecklist(allDone, 0, false)).toBe(false)
  })
  it('hides after the first visitor, even with steps unticked', () => {
    expect(showSetupChecklist(someLeft, 1, false)).toBe(false)
  })
  it('stays hidden until the visitor count has loaded', () => {
    expect(showSetupChecklist(someLeft, null, false)).toBe(false)
  })
  it('never shows on a locked account', () => {
    expect(showSetupChecklist(someLeft, 0, true)).toBe(false)
  })
})

describe('signSavedKey', () => {
  it('is per agent', () => {
    expect(signSavedKey('a')).not.toBe(signSavedKey('b'))
  })
})
