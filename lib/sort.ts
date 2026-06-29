// Shared client-side table sorting: a toggle hook + a stable comparator.
// Used by the admin tables and the dashboard's per-open-house visitor list
// so header-click sorting behaves identically in both.
import { useState } from 'react'

export type SortDir = 'asc' | 'desc'
export type SortState = { key: string; dir: SortDir }
export type Sortable = string | number | boolean | null

// Click a header: same key flips direction, a new key starts ascending.
export function useSortable(defaultKey: string, defaultDir: SortDir = 'asc') {
  const [state, setState] = useState<SortState>({ key: defaultKey, dir: defaultDir })
  const onSort = (k: string) =>
    setState((s) => (s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' }))
  return { state, onSort }
}

// Sort a copy of `rows` by an accessor. Blanks always sort last regardless
// of direction; strings compare naturally (numeric, case-insensitive).
export function applySort<T>(rows: T[], get: (r: T) => Sortable, dir: SortDir): T[] {
  const m = dir === 'asc' ? 1 : -1
  return [...rows].sort((x, y) => {
    const a = get(x)
    const b = get(y)
    const an = a === null || a === undefined || a === ''
    const bn = b === null || b === undefined || b === ''
    if (an && bn) return 0
    if (an) return 1
    if (bn) return -1
    let r: number
    if (typeof a === 'number' && typeof b === 'number') r = a - b
    else if (typeof a === 'boolean' && typeof b === 'boolean') r = a === b ? 0 : a ? 1 : -1
    else r = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
    return r * m
  })
}
