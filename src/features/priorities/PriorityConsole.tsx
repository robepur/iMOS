import { FormEvent, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Plus,
  RotateCcw,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { createId, Priority, PriorityLevel } from '../../localData'

type Filter = 'active' | 'completed'

type Props = {
  priorities: Priority[]
  onChange: (priorities: Priority[], event: string, detail: string) => void
  onClose: () => void
}

const LEVEL_LABELS: Record<PriorityLevel, string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  normal: 'NORMAL',
  low: 'LOW',
}

export default function PriorityConsole({ priorities, onChange, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('active')
  const [editing, setEditing] = useState<Priority | null>(null)

  const active = useMemo(
    () => priorities.filter((p) => !p.completed).sort((a, b) => a.order - b.order),
    [priorities]
  )
  const completed = useMemo(
    () =>
      priorities
        .filter((p) => p.completed)
        .sort((a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt)),
    [priorities]
  )

  const list = filter === 'active' ? active : completed
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((p) => `${p.title} ${p.why}`.toLowerCase().includes(q))
  }, [list, query])

  function save(draft: Priority) {
    const now = new Date().toISOString()
    const isNew = !priorities.some((p) => p.id === draft.id)
    let next = isNew
      ? [...priorities, { ...draft, createdAt: now, updatedAt: now, order: active.length }]
      : priorities.map((p) => (p.id === draft.id ? { ...draft, updatedAt: now } : p))

    if (draft.primary) {
      next = next.map((p) => (p.id === draft.id ? p : { ...p, primary: false }))
    }

    const event = isNew ? 'Priority created' : 'Priority updated'
    onChange(next, event, draft.title)
    setEditing(null)
  }

  function complete(p: Priority) {
    const now = new Date().toISOString()
    const next = priorities.map((item) =>
      item.id === p.id
        ? { ...item, completed: true, primary: false, updatedAt: now, completedAt: now }
        : item
    )
    // Assign primary to first remaining incomplete if none exists
    const stillActive = next.filter((item) => !item.completed)
    const hasPrimary = stillActive.some((item) => item.primary)
    const resolved = hasPrimary || stillActive.length === 0
      ? next
      : next.map((item, _, arr) =>
          item.id === arr.find((x) => !x.completed)?.id ? { ...item, primary: true } : item
        )
    onChange(resolved, 'Priority completed', p.title)
  }

  function reopen(p: Priority) {
    const now = new Date().toISOString()
    const next = priorities.map((item) =>
      item.id === p.id ? { ...item, completed: false, completedAt: undefined, updatedAt: now } : item
    )
    onChange(next, 'Priority reopened', p.title)
  }

  function remove(p: Priority) {
    if (!window.confirm(`Delete "${p.title}"? This action is permanent after the vault saves.`)) return
    const next = priorities.filter((item) => item.id !== p.id)
    onChange(next, 'Priority deleted', p.title)
  }

  function setPrimary(p: Priority) {
    if (p.completed) return
    const next = priorities.map((item) => ({ ...item, primary: item.id === p.id }))
    onChange(next, 'Primary priority changed', p.title)
  }

  function moveUp(p: Priority) {
    const idx = active.findIndex((item) => item.id === p.id)
    if (idx <= 0) return
    const prev = active[idx - 1]
    const next = priorities.map((item) => {
      if (item.id === p.id) return { ...item, order: prev.order }
      if (item.id === prev.id) return { ...item, order: p.order }
      return item
    })
    onChange(next, 'Priority reordered', p.title)
  }

  function moveDown(p: Priority) {
    const idx = active.findIndex((item) => item.id === p.id)
    if (idx < 0 || idx >= active.length - 1) return
    const next_ = active[idx + 1]
    const next = priorities.map((item) => {
      if (item.id === p.id) return { ...item, order: next_.order }
      if (item.id === next_.id) return { ...item, order: p.order }
      return item
    })
    onChange(next, 'Priority reordered', p.title)
  }

  return (
    <section className="priorityConsole panel" aria-label="Priority Command Console">
      <div className="recoveryHeader">
        <div>
          <p className="eyebrow">BUILD 006 PRIORITY CONSOLE</p>
          <h2>Priority Command</h2>
          <p>Create, organize, and manage active priorities. All changes remain inside the encrypted vault.</p>
        </div>
        <button className="iconButton" onClick={onClose} aria-label="Close priority console">
          <X size={18} />
        </button>
      </div>

      <div className="priorityToolbar">
        <label className="secretSearch" aria-label="Search priorities">
          <Search size={17} />
          <input
            placeholder="Search priorities"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search priorities"
          />
        </label>
        <div className="priorityFilterGroup" role="group" aria-label="Filter priorities">
          <button
            className={filter === 'active' ? 'priorityFilterActive' : 'secondaryButton'}
            onClick={() => setFilter('active')}
          >
            ACTIVE ({active.length})
          </button>
          <button
            className={filter === 'completed' ? 'priorityFilterActive' : 'secondaryButton'}
            onClick={() => setFilter('completed')}
          >
            COMPLETED ({completed.length})
          </button>
        </div>
        <button onClick={() => setEditing(emptyPriority())}>
          <Plus size={17} /> NEW PRIORITY
        </button>
      </div>

      {filtered.length === 0 && (
        <p className="emptyState priorityEmptyState">
          {query ? 'No priorities match the search.' : filter === 'active' ? 'No active priorities. Create one to begin.' : 'No completed priorities.'}
        </p>
      )}

      <div className="priorityList">
        {filtered.map((p, idx) => (
          <article key={p.id} className={`priorityRow${p.primary ? ' priorityRowPrimary' : ''}${p.level === 'critical' ? ' priorityRowCritical' : ''}`} aria-label={`Priority: ${p.title}`}>
            <div className="priorityRowTop">
              <div className="priorityRowMeta">
                <span className={`priorityLevel priorityLevel-${p.level}`} aria-label={`Level: ${LEVEL_LABELS[p.level]}`}>
                  {LEVEL_LABELS[p.level]}
                </span>
                {p.primary && !p.completed && (
                  <span className="priorityPrimaryBadge" aria-label="Primary priority">
                    <Star size={11} fill="currentColor" /> PRIMARY
                  </span>
                )}
                {p.due && (
                  <span className={`priorityDue${isOverdue(p) ? ' priorityDueOverdue' : ''}`} aria-label={`Due: ${p.due}`}>
                    {isOverdue(p) ? 'âš  OVERDUE ' : 'DUE '}{formatDate(p.due)}
                  </span>
                )}
              </div>
              <div className="priorityRowActions">
                {!p.completed && (
                  <>
                    <button
                      className="iconButton"
                      onClick={() => moveUp(p)}
                      disabled={idx === 0}
                      aria-label="Move priority up"
                      title="Move up"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      className="iconButton"
                      onClick={() => moveDown(p)}
                      disabled={idx === filtered.length - 1}
                      aria-label="Move priority down"
                      title="Move down"
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      className={`iconButton${p.primary ? ' priorityPrimaryButton' : ''}`}
                      onClick={() => setPrimary(p)}
                      aria-label={p.primary ? 'Primary priority' : 'Set as primary'}
                      title={p.primary ? 'Primary' : 'Set as primary'}
                    >
                      <Star size={15} fill={p.primary ? 'currentColor' : 'none'} />
                    </button>
                  </>
                )}
                <button
                  className="iconButton"
                  onClick={() => setEditing(p)}
                  aria-label="Edit priority"
                  title="Edit"
                >
                  <span className="srOnly">Edit</span>âœŽ
                </button>
                {!p.completed ? (
                  <button
                    className="iconButton"
                    onClick={() => complete(p)}
                    aria-label="Mark priority complete"
                    title="Complete"
                  >
                    <CheckCircle2 size={15} />
                  </button>
                ) : (
                  <button
                    className="iconButton"
                    onClick={() => reopen(p)}
                    aria-label="Reopen priority"
                    title="Reopen"
                  >
                    <RotateCcw size={15} />
                  </button>
                )}
                <button
                  className="iconButton dangerButton"
                  onClick={() => remove(p)}
                  aria-label="Delete priority"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <h3 className="priorityTitle">{p.title}</h3>
            {p.why && <p className="priorityWhy">{p.why}</p>}
          </article>
        ))}
      </div>

      {editing && (
        <PriorityEditor
          priority={editing}
          hasPrimary={active.some((p) => p.primary && p.id !== editing.id)}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
    </section>
  )
}

function emptyPriority(): Priority {
  const now = new Date().toISOString()
  return {
    id: createId('priority'),
    title: '',
    why: '',
    level: 'normal',
    due: '',
    completed: false,
    primary: false,
    order: 0,
    createdAt: now,
    updatedAt: now,
  }
}

function isOverdue(p: Priority): boolean {
  if (!p.due || p.completed) return false
  return new Date(p.due) < new Date(new Date().toDateString())
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
}

function PriorityEditor({
  priority,
  hasPrimary,
  onCancel,
  onSave,
}: {
  priority: Priority
  hasPrimary: boolean
  onCancel: () => void
  onSave: (p: Priority) => void
}) {
  const [draft, setDraft] = useState(priority)
  const isNew = !draft.createdAt || draft.createdAt === draft.updatedAt

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft.title.trim()) return
    onSave({ ...draft, title: draft.title.trim(), why: draft.why.trim() })
  }

  return (
    <div className="secretEditorBackdrop" role="dialog" aria-modal="true" aria-label={isNew ? 'Create priority' : 'Edit priority'}>
      <form className="priorityEditor panel" onSubmit={submit}>
        <div className="recoveryHeader">
          <div>
            <p className="eyebrow">PRIORITY RECORD</p>
            <h3>{isNew ? 'Create priority' : 'Edit priority'}</h3>
          </div>
          <button type="button" className="iconButton" onClick={onCancel} aria-label="Cancel">
            <X size={18} />
          </button>
        </div>

        <div className="priorityEditorGrid">
          <label className="priorityEditorFull">
            TITLE
            <input
              autoFocus
              required
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Priority title"
            />
          </label>

          <label>
            LEVEL
            <select
              value={draft.level}
              onChange={(e) => setDraft({ ...draft, level: e.target.value as PriorityLevel })}
              aria-label="Priority level"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </label>

          <label>
            DUE DATE
            <input
              type="date"
              value={draft.due}
              onChange={(e) => setDraft({ ...draft, due: e.target.value })}
            />
          </label>

          <label className="priorityEditorFull">
            WHY IT MATTERS
            <textarea
              value={draft.why}
              onChange={(e) => setDraft({ ...draft, why: e.target.value })}
              placeholder="Mission context and reasoning"
            />
          </label>

          {!draft.completed && (
            <label className="priorityEditorFull priorityEditorCheckbox">
              <input
                type="checkbox"
                checked={draft.primary}
                onChange={(e) => setDraft({ ...draft, primary: e.target.checked })}
              />
              SET AS PRIMARY PRIORITY
              {hasPrimary && !draft.primary && (
                <span className="priorityEditorNote"> â€” will replace the current primary</span>
              )}
            </label>
          )}
        </div>

        <div className="captureActions">
          <button type="submit">SAVE PRIORITY</button>
          <button type="button" className="secondaryButton" onClick={onCancel}>
            CANCEL
          </button>
        </div>
      </form>
    </div>
  )
}

