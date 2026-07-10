import { useState } from 'react'
import { TimelineEntry } from './localData'

type SortOrder = 'newest' | 'oldest'
type EntryType = TimelineEntry['type'] | 'all'

export default function TimelineExplorer({ timeline }: { timeline: TimelineEntry[] }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOrder>('newest')
  const [typeFilter, setTypeFilter] = useState<EntryType>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const TYPES: { value: EntryType; label: string }[] = [
    { value: 'all', label: 'All Types' },
    { value: 'priority', label: 'Priority' },
    { value: 'commitment', label: 'Commitment' },
    { value: 'decision', label: 'Decision' },
    { value: 'reflection', label: 'Reflection' },
    { value: 'secret', label: 'Secret' },
    { value: 'recovery', label: 'Recovery' },
    { value: 'system', label: 'System' },
  ]

  const filtered = timeline
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

  return (
    <div className="timelineExplorer">
      <div className="historyToolbar">
        <input
          className="searchInput"
          type="search"
          placeholder="Search timeline…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search timeline"
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as EntryType)} aria-label="Filter by type">
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortOrder)} aria-label="Sort order">
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>
        <label className="dateFilter">From<input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></label>
        <label className="dateFilter">To<input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></label>
      </div>
      <p className="resultCount">{filtered.length} event{filtered.length !== 1 ? 's' : ''}</p>
      {filtered.length === 0
        ? <p className="emptyState">No timeline events match the current filters.</p>
        : filtered.map((entry) => (
            <div key={entry.id} className={`timelineExplorerItem type-${entry.type}`}>
              <div className="timelineExplorerMeta">
                <span className="timelineType">{entry.type.toUpperCase()}</span>
                <span className="timelineDate">{new Date(entry.createdAt).toLocaleString()}</span>
              </div>
              <strong>{entry.title}</strong>
              <p>{entry.detail}</p>
            </div>
          ))
      }
    </div>
  )
}
