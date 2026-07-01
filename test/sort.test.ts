import { describe, it, expect } from 'vitest'
import { applySort } from '@/lib/sort'

type Row = { name: string; count: number | null }

describe('applySort', () => {
  const rows: Row[] = [
    { name: 'Charlie', count: 2 },
    { name: 'alice', count: 10 },
    { name: 'Bob', count: null },
  ]

  it('sorts numbers ascending and descending', () => {
    const asc = applySort(rows.filter((r) => r.count !== null), (r) => r.count, 'asc')
    expect(asc.map((r) => r.count)).toEqual([2, 10])
    const desc = applySort(rows.filter((r) => r.count !== null), (r) => r.count, 'desc')
    expect(desc.map((r) => r.count)).toEqual([10, 2])
  })

  it('sorts blanks last regardless of direction', () => {
    const asc = applySort(rows, (r) => r.count, 'asc')
    expect(asc[asc.length - 1].count).toBeNull()
    const desc = applySort(rows, (r) => r.count, 'desc')
    expect(desc[desc.length - 1].count).toBeNull()
  })

  it('compares strings case-insensitively and numerically', () => {
    const items = [{ v: 'item10' }, { v: 'item2' }, { v: 'Item1' }]
    const asc = applySort(items, (r) => r.v, 'asc')
    expect(asc.map((r) => r.v)).toEqual(['Item1', 'item2', 'item10'])
  })

  it('does not mutate the input array', () => {
    const input = [{ v: 3 }, { v: 1 }]
    const copy = [...input]
    applySort(input, (r) => r.v, 'asc')
    expect(input).toEqual(copy)
  })
})
