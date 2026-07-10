import { useMemo, useState } from 'react'
import type { TimelineEntry } from '../localData'

export type TimelineSortOrder = 'newest' | 'oldest'
export type TimelineTypeFilter = TimelineEntry['type'] | 'all'

export function useTimeline(timeline: TimelineEntry[]) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<TimelineSortOrder>('newest')
  const [typeFilter, setTypeFilter] = useState<TimelineTypeFilter>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const filtered = useMemo(() => {
    return timeline
      .filter((e) => {
        if (typeFilter !== 'all' && e.type !== typeFilter) return false
        if (search.trim()) {
          const q = search.toLowerCase()
          if (!e.title.toLowerCase().includes(q) && !e.detail.toLowerCase().includes(q)) return false
        }
        if (fromDate && e.createdAt < fromDate) return false
        if (toDate && e.createdAt > toDate + 'T23:59:59') return false
        return true
      })
      .sort((a, b) => sort === 'newest'
        ? b.createdAt.localeCompare(a.createdAt)
        : a.createdAt.localeCompare(b.createdAt)
      )
  }, [timeline, search, sort, typeFilter, fromDate, toDate])

  return { search, setSearch, sort, setSort, typeFilter, setTypeFilter, fromDate, setFromDate, toDate, setToDate, filtered }
}
