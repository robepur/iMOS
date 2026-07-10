import { useState } from 'react'
import { Decision } from '../../localData'

type StatusFilter = 'all' | 'open' | 'decided'
type SortOrder = 'newest' | 'oldest'

export default function DecisionHistory({ decisions }: { decisions: Decision[] }) {
  const [status, setStatus] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOrder>('newest')

  const filtered = decisions
    .filter((d) => {
      if (status !== 'all' && d.status !== status) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!d.title.toLowerCase().includes(q) && !(d.context ?? '').toLowerCase().includes(q)) return false
      }
      return true
    })
    .sort((a, b) => sort === 'newest'
      ? b.createdAt.localeCompare(a.createdAt)
      : a.createdAt.localeCompare(b.createdAt)
    )

  return (
    <div className="historyView">
      <div className="historyToolbar">
        <input
          className="searchInput"
          type="search"
          placeholder="Search decisionsâ€¦"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search decisions"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Filter by status">
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="decided">Decided</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortOrder)} aria-label="Sort order">
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>
      </div>
      <p className="resultCount">{filtered.length} decision{filtered.length !== 1 ? 's' : ''}</p>
      {filtered.length === 0
        ? <p className="emptyState">No decisions match the current filters.</p>
        : filtered.map((d) => (
            <div key={d.id} className={`historyRecord status-${d.status}`}>
              <div className="historyRecordMeta">
                <span className={`statusBadge ${d.status}`}>{d.status.toUpperCase()}</span>
                <span className="historyDate">{new Date(d.createdAt).toLocaleDateString()}</span>
              </div>
              <strong>{d.title}</strong>
              {d.context && <p className="historyContext">{d.context}</p>}
            </div>
          ))
      }
    </div>
  )
}

