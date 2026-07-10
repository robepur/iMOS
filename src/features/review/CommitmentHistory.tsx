import { useState } from 'react'
import { Commitment } from '../../localData'

type StatusFilter = 'all' | 'open' | 'complete'
type SortOrder = 'newest' | 'oldest' | 'due'

export default function CommitmentHistory({ commitments }: { commitments: Commitment[] }) {
  const [status, setStatus] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOrder>('newest')

  const filtered = commitments
    .filter((c) => {
      if (status !== 'all' && c.status !== status) return false
      if (search.trim() && !c.title.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      if (sort === 'newest') return b.createdAt.localeCompare(a.createdAt)
      if (sort === 'oldest') return a.createdAt.localeCompare(b.createdAt)
      const ad = a.due ?? '9999-99-99'
      const bd = b.due ?? '9999-99-99'
      return ad.localeCompare(bd)
    })

  return (
    <div className="historyView">
      <div className="historyToolbar">
        <input
          className="searchInput"
          type="search"
          placeholder="Search commitmentsâ€¦"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search commitments"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Filter by status">
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="complete">Completed</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortOrder)} aria-label="Sort order">
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="due">By Due Date</option>
        </select>
      </div>
      <p className="resultCount">{filtered.length} commitment{filtered.length !== 1 ? 's' : ''}</p>
      {filtered.length === 0
        ? <p className="emptyState">No commitments match the current filters.</p>
        : filtered.map((c) => (
            <div key={c.id} className={`historyRecord status-${c.status}`}>
              <div className="historyRecordMeta">
                <span className={`statusBadge ${c.status}`}>{c.status.toUpperCase()}</span>
                <span className="historyDate">{new Date(c.createdAt).toLocaleDateString()}</span>
                {c.due && <span className="historyDue">Due {c.due}</span>}
              </div>
              <strong>{c.title}</strong>
            </div>
          ))
      }
    </div>
  )
}

