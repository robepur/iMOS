import { useState } from 'react'
import { MessageSquare, Trash2, Edit3, CheckCircle } from 'lucide-react'
import type { PilotFeedbackEntry, PilotRating, PilotRosieSurface, PilotMeasurements } from '../../types/pilotFeedback'
import {
  PILOT_ROSIE_SURFACES,
  PILOT_FEEDBACK_SCHEMA_VERSION,
} from '../../types/pilotFeedback'

interface PilotFeedbackPanelProps {
  entries: PilotFeedbackEntry[]
  measurements: PilotMeasurements
  onAdd: (entry: PilotFeedbackEntry) => void
  onUpdate: (entry: PilotFeedbackEntry) => void
  onDelete: (id: string) => void
  onClose: () => void
}

const SURFACE_LABELS: Record<PilotRosieSurface, string> = {
  daily_briefing: 'Daily Briefing',
  recommendation: 'Recommendation',
  morning_brief: 'Morning Brief',
  evening_summary: 'Evening Summary',
  priority_advice: 'Priority Advice',
  commitment_advice: 'Commitment Advice',
  decision_advice: 'Decision Advice',
  mission_planning: 'Mission Planning',
  review_center: 'Review Center',
  understanding_review: 'Understanding Review',
  general: 'General',
}

const RATING_LABELS: Record<number, string> = {
  1: '1 — Not useful',
  2: '2 — Slightly useful',
  3: '3 — Moderately useful',
  4: '4 — Useful',
  5: '5 — Very useful',
}

const EFFORT_LABELS: Record<number, string> = {
  1: '1 — Minimal',
  2: '2 — Low',
  3: '3 — Moderate',
  4: '4 — High',
  5: '5 — Significant',
}

function RatingSelect({ value, onChange, labels, id }: {
  value: PilotRating
  onChange: (v: PilotRating) => void
  labels: Record<number, string>
  id: string
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={e => onChange(Number(e.target.value) as PilotRating)}
    >
      {[1, 2, 3, 4, 5].map(n => (
        <option key={n} value={n}>{labels[n]}</option>
      ))}
    </select>
  )
}

function FeedbackForm({ initial, onSave, onCancel }: {
  initial?: Partial<PilotFeedbackEntry>
  onSave: (entry: PilotFeedbackEntry) => void
  onCancel: () => void
}) {
  const [surface, setSurface] = useState<PilotRosieSurface>(initial?.rosieSurface ?? 'general')
  const [usefulness, setUsefulness] = useState<PilotRating>(initial?.usefulness ?? 3)
  const [effort, setEffort] = useState<PilotRating>(initial?.cognitiveEffort ?? 3)
  const [incorrectAssumption, setIncorrectAssumption] = useState(initial?.incorrectAssumption ?? false)
  const [missingContext, setMissingContext] = useState(initial?.missingContext ?? false)
  const [trustConcern, setTrustConcern] = useState(initial?.trustConcern ?? false)
  const [comment, setComment] = useState(initial?.freeformComment ?? '')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const now = new Date().toISOString()
    onSave({
      id: initial?.id ?? `pilot-feedback:${crypto.randomUUID()}`,
      schemaVersion: PILOT_FEEDBACK_SCHEMA_VERSION,
      rosieSurface: surface,
      usefulness,
      cognitiveEffort: effort,
      incorrectAssumption,
      missingContext,
      trustConcern,
      freeformComment: comment.trim() || undefined,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    })
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <label>
        <span className="eyebrow">ROSIE SURFACE</span>
        <select value={surface} onChange={e => setSurface(e.target.value as PilotRosieSurface)}>
          {PILOT_ROSIE_SURFACES.map(s => (
            <option key={s} value={s}>{SURFACE_LABELS[s]}</option>
          ))}
        </select>
      </label>

      <label htmlFor="usefulness-select">
        <span className="eyebrow">USEFULNESS</span>
        <RatingSelect id="usefulness-select" value={usefulness} onChange={setUsefulness} labels={RATING_LABELS} />
      </label>

      <label htmlFor="effort-select">
        <span className="eyebrow">COGNITIVE EFFORT REQUIRED</span>
        <RatingSelect id="effort-select" value={effort} onChange={setEffort} labels={EFFORT_LABELS} />
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <p className="eyebrow">OBSERVATIONS</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={incorrectAssumption} onChange={e => setIncorrectAssumption(e.target.checked)} />
          Rosie made an incorrect assumption
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={missingContext} onChange={e => setMissingContext(e.target.checked)} />
          Important context was missing
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={trustConcern} onChange={e => setTrustConcern(e.target.checked)} />
          I had a concern about trust or accuracy
        </label>
      </div>

      <label>
        <span className="eyebrow">COMMENTS (OPTIONAL)</span>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Any additional observations..."
        />
      </label>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button type="submit" style={{ flex: 1 }} data-testid="feedback-save">
          <CheckCircle size={16} /> Save Feedback
        </button>
        <button type="button" className="secondaryButton" style={{ flex: 1 }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function PilotFeedbackPanel({ entries, measurements, onAdd, onUpdate, onDelete, onClose }: PilotFeedbackPanelProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const editingEntry = editingId ? entries.find(e => e.id === editingId) : undefined

  function handleSave(entry: PilotFeedbackEntry) {
    if (editingId) {
      onUpdate(entry)
      setEditingId(null)
    } else {
      onAdd(entry)
      setShowForm(false)
    }
  }

  return (
    <div className="recoveryConsole" data-testid="pilot-feedback-panel">
      <div className="recoveryHeader">
        <div>
          <p className="eyebrow">PILOT FEEDBACK</p>
          <h2>Operator Feedback</h2>
        </div>
        <button className="iconButton" onClick={onClose} aria-label="Close feedback panel">✕</button>
      </div>

      <p style={{ opacity: 0.7, marginBottom: '1.5rem' }}>
        Feedback is stored privately in your local vault. It is never transmitted. It does not automatically change Rosie.
      </p>

      {/* Measurements summary */}
      <section style={{ marginBottom: '1.5rem' }} aria-label="Pilot measurements">
        <p className="eyebrow" style={{ marginBottom: '0.75rem' }}>MEASUREMENTS</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
          {[
            ['Briefing usefulness', measurements.briefingUsefulness !== null ? measurements.briefingUsefulness.toFixed(1) : '—'],
            ['Recommendation usefulness', measurements.recommendationUsefulness !== null ? measurements.recommendationUsefulness.toFixed(1) : '—'],
            ['Avg cognitive effort', measurements.averageCognitiveEffort !== null ? measurements.averageCognitiveEffort.toFixed(1) : '—'],
            ['Corrections', measurements.correctionCount],
            ['Recommendations accepted', measurements.acceptedRecommendationCount],
            ['Recommendations rejected', measurements.rejectedRecommendationCount],
            ['Missing context reports', measurements.missingContextReports],
            ['Trust concerns', measurements.trustConcernReports],
            ['Daily completions', measurements.dailyWorkflowCompletions],
            ['Backup ready', measurements.backupReady ? 'Yes' : 'No'],
          ].map(([label, value]) => (
            <div key={String(label)} className="panel" style={{ padding: '0.5rem 0.75rem' }}>
              <p className="eyebrow" style={{ fontSize: '0.65rem' }}>{label}</p>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.5rem' }}>
          Measurements are private, local, and do not rank or score you.
        </p>
      </section>

      {/* Add feedback */}
      {!showForm && !editingId && (
        <button
          onClick={() => setShowForm(true)}
          style={{ marginBottom: '1.5rem' }}
          data-testid="feedback-add-button"
        >
          <MessageSquare size={16} /> Add Feedback
        </button>
      )}

      {(showForm && !editingId) && (
        <section style={{ marginBottom: '1.5rem' }}>
          <p className="eyebrow" style={{ marginBottom: '0.75rem' }}>NEW FEEDBACK</p>
          <FeedbackForm onSave={handleSave} onCancel={() => setShowForm(false)} />
        </section>
      )}

      {editingId && editingEntry && (
        <section style={{ marginBottom: '1.5rem' }}>
          <p className="eyebrow" style={{ marginBottom: '0.75rem' }}>EDIT FEEDBACK</p>
          <FeedbackForm initial={editingEntry} onSave={handleSave} onCancel={() => setEditingId(null)} />
        </section>
      )}

      {/* Entry list */}
      <section>
        <p className="eyebrow" style={{ marginBottom: '0.75rem' }}>
          ENTRIES ({entries.length})
        </p>
        {entries.length === 0 ? (
          <p style={{ opacity: 0.5 }} data-testid="feedback-empty">No feedback recorded yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[...entries].reverse().map(entry => (
              <div key={entry.id} className="panel" style={{ padding: '0.75rem 1rem' }} data-testid={`feedback-entry-${entry.id}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p className="eyebrow" style={{ fontSize: '0.65rem' }}>{SURFACE_LABELS[entry.rosieSurface]} · {new Date(entry.createdAt).toLocaleDateString()}</p>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>
                      Usefulness: {entry.usefulness}/5 · Effort: {entry.cognitiveEffort}/5
                      {entry.incorrectAssumption ? ' · Incorrect assumption' : ''}
                      {entry.missingContext ? ' · Missing context' : ''}
                      {entry.trustConcern ? ' · Trust concern' : ''}
                    </p>
                    {entry.freeformComment && (
                      <p style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: '0.25rem' }}>{entry.freeformComment}</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                    <button
                      className="iconButton"
                      onClick={() => setEditingId(entry.id)}
                      aria-label="Edit feedback"
                      data-testid={`feedback-edit-${entry.id}`}
                    >
                      <Edit3 size={14} />
                    </button>
                    {confirmDeleteId === entry.id ? (
                      <button
                        className="dangerButton"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        onClick={() => { onDelete(entry.id); setConfirmDeleteId(null) }}
                        data-testid={`feedback-delete-confirm-${entry.id}`}
                      >
                        Delete
                      </button>
                    ) : (
                      <button
                        className="iconButton"
                        onClick={() => setConfirmDeleteId(entry.id)}
                        aria-label="Delete feedback"
                        data-testid={`feedback-delete-${entry.id}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
