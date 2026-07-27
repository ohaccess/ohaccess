import { describe, expect, it } from 'vitest'
import { inWeekend, pastHiddenByDefault, weekendWindow } from '../lib/map-filters'

// 2026-07-22 is a Wednesday; the weekend that follows is Sat 07-25 / Sun 07-26.
const WED = new Date(2026, 6, 22, 12, 0)
const SAT = new Date(2026, 6, 25, 12, 0)
const SUN = new Date(2026, 6, 26, 12, 0)

describe('weekendWindow', () => {
  it('midweek points at the upcoming Saturday through Sunday', () => {
    const { start, end } = weekendWindow(WED)
    expect(start).toEqual(new Date(2026, 6, 25))
    expect(end).toEqual(new Date(2026, 6, 27))
  })

  it('on Saturday the window starts that day', () => {
    expect(weekendWindow(SAT).start).toEqual(new Date(2026, 6, 25))
  })

  it('on Sunday the window is the weekend in progress, not next week', () => {
    const { start, end } = weekendWindow(SUN)
    expect(start).toEqual(new Date(2026, 6, 25))
    expect(end).toEqual(new Date(2026, 6, 27))
  })
})

describe('inWeekend', () => {
  const iso = (d: Date) => d.toISOString()

  it('includes an open house on Saturday afternoon', () => {
    expect(inWeekend(iso(new Date(2026, 6, 25, 13)), iso(new Date(2026, 6, 25, 15)), WED)).toBe(true)
  })

  it('excludes a weekday open house', () => {
    expect(inWeekend(iso(new Date(2026, 6, 23, 13)), iso(new Date(2026, 6, 23, 15)), WED)).toBe(false)
  })

  it('excludes next-Monday and later', () => {
    expect(inWeekend(iso(new Date(2026, 6, 27, 10)), iso(new Date(2026, 6, 27, 12)), WED)).toBe(false)
  })

  it('includes an event straddling the Friday/Saturday boundary', () => {
    expect(inWeekend(iso(new Date(2026, 6, 24, 22)), iso(new Date(2026, 6, 25, 2)), WED)).toBe(true)
  })

  it('legacy rows without a start time are excluded', () => {
    expect(inWeekend(null, null, WED)).toBe(false)
    expect(inWeekend('not-a-date', null, WED)).toBe(false)
  })
})

describe('pastHiddenByDefault', () => {
  it('hides past when it dominates (9 past vs 2 active)', () => {
    expect(pastHiddenByDefault(0, 2, 9)).toBe(true)
  })

  it('keeps past visible on a young map (few past pins)', () => {
    expect(pastHiddenByDefault(1, 2, 4)).toBe(false)
  })

  it('keeps past visible when active pins outnumber it', () => {
    expect(pastHiddenByDefault(4, 4, 7)).toBe(false)
  })
})
