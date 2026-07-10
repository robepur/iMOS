import { Trash2, X } from 'lucide-react'
import type { Reflection } from './localData'

type Props = {
  reflections: Reflection[]
  onDelete: (id: string) => void
  onClose: () => void
}

export default function ReflectionHistory({ reflections, onDelete, onClose }: Props) {
  function handleDelete(r: Reflection) {
    const date = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(r.createdAt))
    if (!window.confirm(`Delete the reflection from ${date}? This cannot be undone.`)) return
    onDelete(r.id)
  }

  return (
    <section className="reflectionHistory panel" aria-label="Reflection History">
      <div className="recoveryHeader">
        <div>
          <p className="eyebrow">REFLECTION HISTORY</p>
          <h2>Prior Reflections</h2>
          <p>Review your executive reflection records. Newest first.</p>
        </div>
        <button className="iconButton" onClick={onClose} aria-label="Close reflection history">
          <X size={18} />
        </button>
      </div>

      {reflections.length === 0 && (
        <p className="emptyState" style={{ marginTop: '24px' }}>
          No reflections recorded yet. Complete a session to create the first reflection.
        </p>
      )}

      <div className="reflectionHistoryList">
        {reflections.map((r) => (
          <article key={r.id} className="reflectionEntry">
            <div className="reflectionEntryHeader">
              <time className="reflectionEntryDate" dateTime={r.createdAt}>
                {new Intl.DateTimeFormat('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }).format(new Date(r.createdAt))}
              </time>
              <button
                className="iconButton dangerButton"
                onClick={() => handleDelete(r)}
                aria-label={`Delete reflection from ${new Date(r.createdAt).toLocaleDateString()}`}
                title="Delete reflection"
              >
                <Trash2 size={15} />
              </button>
            </div>
            {r.accomplished && (
              <div className="reflectionField">
                <span className="reflectionFieldLabel">ACCOMPLISHED</span>
                <p>{r.accomplished}</p>
              </div>
            )}
            {r.remember && (
              <div className="reflectionField reflectionFieldMemory">
                <span className="reflectionFieldLabel">ROSIE REMEMBERS</span>
                <p>{r.remember}</p>
              </div>
            )}
            {r.tomorrow && (
              <div className="reflectionField">
                <span className="reflectionFieldLabel">TOMORROW</span>
                <p>{r.tomorrow}</p>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
