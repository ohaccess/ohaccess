import { describe, it, expect } from 'vitest'
import { signInEnded, rescheduleResetsReminder, editLocked } from '@/lib/signin-window'

// The Clifton case: ended Fri Sep 11, 6:00 PM Eastern (22:00 UTC).
const END = '2026-09-11T22:00:00Z'
const at = (iso: string) => Date.parse(iso)

describe('signInEnded', () => {
  it('stays open during the event and for 6 hours after it ends', () => {
    expect(signInEnded(END, at('2026-09-11T21:00:00Z'))).toBe(false)
    expect(signInEnded(END, at('2026-09-11T22:03:00Z'))).toBe(false) // a few minutes late
    expect(signInEnded(END, at('2026-09-12T04:00:00Z'))).toBe(false) // exactly 6 hours
  })
  it('closes once it is more than 6 hours past the end', () => {
    expect(signInEnded(END, at('2026-09-12T04:00:01Z'))).toBe(true)
    expect(signInEnded(END, at('2026-09-13T16:32:14Z'))).toBe(true) // the late Sunday sign-ins
  })
  it('reopens when the end time is edited to a later date', () => {
    expect(signInEnded('2026-09-20T22:00:00Z', at('2026-09-13T16:32:14Z'))).toBe(false)
  })
  it('never closes legacy rows without a structured end time', () => {
    expect(signInEnded(null, at('2030-01-01T00:00:00Z'))).toBe(false)
    expect(signInEnded('not a date', at('2030-01-01T00:00:00Z'))).toBe(false)
  })
})

describe('rescheduleResetsReminder', () => {
  const START = '2026-09-11T20:00:00Z'
  it('re-arms the reminder when the open house moves to another day', () => {
    expect(rescheduleResetsReminder(START, '2026-09-20T20:00:00Z')).toBe(true)
    expect(rescheduleResetsReminder(START, '2026-09-12T08:00:00Z')).toBe(true) // exactly 12 hours
  })
  it('does not re-send for a same-day time change', () => {
    expect(rescheduleResetsReminder(START, '2026-09-11T21:00:00Z')).toBe(false)
    expect(rescheduleResetsReminder(START, '2026-09-11T14:00:00Z')).toBe(false)
  })
  it('re-arms when there was no previous structured start', () => {
    expect(rescheduleResetsReminder(null, '2026-09-20T20:00:00Z')).toBe(true)
  })
  it('does nothing without a valid new start', () => {
    expect(rescheduleResetsReminder(START, null)).toBe(false)
  })
})

describe('editLocked', () => {
  it('stays editable before, during, and for 30 minutes after the end', () => {
    expect(editLocked(END, at('2026-09-10T12:00:00Z'))).toBe(false) // upcoming
    expect(editLocked(END, at('2026-09-11T21:00:00Z'))).toBe(false) // live
    expect(editLocked(END, at('2026-09-11T22:30:00Z'))).toBe(false) // exactly 30 minutes
  })
  it('locks once it is more than 30 minutes past the end', () => {
    expect(editLocked(END, at('2026-09-11T22:30:01Z'))).toBe(true)
    expect(editLocked(END, at('2026-09-13T16:32:14Z'))).toBe(true)
  })
  it('moves with the end time when an agent running over extends it', () => {
    expect(editLocked('2026-09-11T23:00:00Z', at('2026-09-11T22:45:00Z'))).toBe(false)
  })
  it('never locks rows without a structured end time', () => {
    expect(editLocked(null, at('2030-01-01T00:00:00Z'))).toBe(false)
    expect(editLocked('not a date', at('2030-01-01T00:00:00Z'))).toBe(false)
  })
})
