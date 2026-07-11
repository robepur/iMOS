import { useMemo, useState } from 'react'
import type { CognitiveSignal, OperatorUnderstanding } from '../../types/cognitive'
import { explainUnderstanding } from '../../services/UnderstandingReviewService'
import { UNDERSTANDING_STATE_LABELS } from '../../constants'

type Props = {
  understandings: OperatorUnderstanding[]
  signals: CognitiveSignal[]
  onConfirm: (understandingId: string) => void
  onCorrect: (understandingId: string, statement: string, reason?: string) => void
  onReject: (understandingId: string, reason?: string) => void
  onExpire: (understandingId: string) => void
  onSuppressSignal: (signalId: string) => void
  onClose: () => void
}

type ViewFilter = 'pending' | 'confirmed' | 'corrected' | 'rejected' | 'expired' | 'all'

const FILTER_LABELS: Record<ViewFilter, string> = {
  pending: 'Pending Review',
  confirmed: 'Confirmed',
  corrected: 'Corrected',
  rejected: 'Rejected',
  expired: 'Expired',
  all: 'All Understandings',
}

export function UnderstandingReviewCenter({
  understandings,
  signals,
  onConfirm,
  onCorrect,
  onReject,
  onExpire,
  onSuppressSignal,
  onClose,
}: Props) {
  const [view, setView] = useState<ViewFilter>('pending')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [correctionDrafts, setCorrectionDrafts] = useState<Record<string, string>>({})
  const [confirmReject, setConfirmReject] = useState<string | null>(null)
  const [confirmExpire, setConfirmExpire] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (view === 'all') return understandings
    if (view === 'pending') return understandings.filter((u) => u.state === 'proposed')
    if (view === 'confirmed') return understandings.filter((u) => u.state === 'operator_confirmed')
    if (view === 'corrected') return understandings.filter((u) => u.state === 'operator_corrected')
    if (view === 'rejected') return understandings.filter((u) => u.state === 'operator_rejected')
    return understandings.filter((u) => u.state === 'expired')
  }, [understandings, view])

  const pendingCount = understandings.filter((u) => u.state === 'proposed').length
  const signalStatus = new Map(signals.map((s) => [s.id, s.status]))

  return (
    <section className="recoveryConsole panel" aria-label="Operator Understanding Review Center">
      <div className="recoveryHeader">
        <div>
          <p className="eyebrow">UNDERSTANDING REVIEW CENTER</p>
          <h2>Operator Understanding Review</h2>
          <p>
            Rosie proposes understandings from deterministic signals. You control what is accepted,
            corrected, rejected, or expired. Nothing personalizes behavior in Build 015.
          </p>
        </div>
        <button className="iconButton" onClick={onClose} aria-label="Close understanding review center">×</button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {(['pending', 'confirmed', 'corrected', 'rejected', 'expired', 'all'] as ViewFilter[]).map((key) => (
          <button
            key={key}
            className={view === key ? '' : 'secondaryButton'}
            onClick={() => setView(key)}
          >
            {FILTER_LABELS[key]}{key === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="emptyState">No understandings in this view.</p>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {filtered.map((u) => {
          const isExpanded = expanded === u.id
          const correctionDraft = correctionDrafts[u.id] ?? u.statement
          const sourceStatus = signalStatus.get(u.sourceSignalId) ?? u.sourceSignalStatus
          const canConfirm = u.state === 'proposed' || u.state === 'operator_corrected'
          const canCorrect = u.state === 'proposed' || u.state === 'operator_confirmed'
          const canReject = u.state !== 'operator_rejected'
          const canExpire = u.state === 'proposed' || u.state === 'operator_confirmed'

          return (
            <article key={u.id} style={{ border: '1px solid rgba(255,255,255,.1)', padding: 14, background: 'rgba(255,255,255,.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15 }}>{u.statement}</h3>
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#9fb1c2' }}>
                    {UNDERSTANDING_STATE_LABELS[u.state] ?? u.state} · Evidence {u.evidenceCount} · Rule {u.ruleId} v{u.ruleVersion}
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#9fb1c2' }}>
                    Window: {new Date(u.createdAt).toLocaleDateString()} · Source signal: {sourceStatus}
                  </p>
                </div>
                <button className="secondaryButton" onClick={() => setExpanded(isExpanded ? null : u.id)}>
                  {isExpanded ? 'Hide Detail' : 'Inspect'}
                </button>
              </div>

              {isExpanded && (
                <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 10 }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12, color: '#aebccc', lineHeight: 1.5 }}>
                    {explainUnderstanding(u)}
                  </pre>
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: '#8fa5b9' }}>
                    Permitted future uses: {u.permittedFeatureUses.join(', ') || 'none'}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#8fa5b9' }}>
                    Provenance: {u.provenance.ruleId} v{u.provenance.ruleVersion} · source {u.provenance.dataSource}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#8fa5b9' }}>
                    Review events: {u.reviewHistory.length} · Corrections: {u.correctionHistory.length}
                  </p>
                </div>
              )}

              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {canConfirm && (
                  <button onClick={() => onConfirm(u.id)}>Confirm</button>
                )}
                {canCorrect && (
                  <>
                    <input
                      value={correctionDraft}
                      onChange={(event) => setCorrectionDrafts((prev) => ({ ...prev, [u.id]: event.target.value }))}
                      aria-label="Corrected understanding statement"
                      style={{ minWidth: 260, flex: '1 1 260px', background: '#0f1418', color: '#dfe7ef', border: '1px solid #304556', padding: '6px 8px' }}
                    />
                    <button
                      className="secondaryButton"
                      onClick={() => onCorrect(u.id, correctionDraft)}
                    >
                      Correct
                    </button>
                  </>
                )}
                {canReject && (
                  <>
                    <button
                      className="dangerButton"
                      onClick={() => setConfirmReject((current) => (current === u.id ? null : u.id))}
                    >
                      {confirmReject === u.id ? 'Confirm Reject' : 'Reject'}
                    </button>
                    {confirmReject === u.id && (
                      <button className="dangerButton" onClick={() => { onReject(u.id); setConfirmReject(null) }}>
                        Final Reject
                      </button>
                    )}
                  </>
                )}
                {canExpire && (
                  <>
                    <button
                      className="secondaryButton"
                      onClick={() => setConfirmExpire((current) => (current === u.id ? null : u.id))}
                    >
                      {confirmExpire === u.id ? 'Confirm Expire' : 'Expire'}
                    </button>
                    {confirmExpire === u.id && (
                      <button className="secondaryButton" onClick={() => { onExpire(u.id); setConfirmExpire(null) }}>
                        Final Expire
                      </button>
                    )}
                  </>
                )}
                <button className="secondaryButton" onClick={() => onSuppressSignal(u.sourceSignalId)}>
                  Suppress Source Signal
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

