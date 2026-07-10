import type { RosieRecommendation } from '../../localData'
import type { SnoozeOption } from '../../hooks/useRecommendations'
import { SNOOZE_OPTIONS } from '../../hooks/useRecommendations'
import type { HealthSignals } from '../../services/RosieEngine'
import { ShieldCheck, AlertTriangle, Info, ChevronDown } from 'lucide-react'
import { useState } from 'react'

// ── Severity icon ──────────────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: RosieRecommendation['severity'] }) {
  if (severity === 'critical') return <AlertTriangle size={16} className="rec-icon rec-icon--critical" />
  if (severity === 'high') return <AlertTriangle size={16} className="rec-icon rec-icon--high" />
  return <Info size={16} className="rec-icon rec-icon--normal" />
}

// ── Single recommendation card ─────────────────────────────────────────────────

type RecCardProps = {
  rec: RosieRecommendation
  onComplete: (rec: RosieRecommendation) => void
  onDismiss: (rec: RosieRecommendation) => void
  onSnooze: (rec: RosieRecommendation, days: number) => void
}

function RecCard({ rec, onComplete, onDismiss, onSnooze }: RecCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showSnooze, setShowSnooze] = useState(false)

  return (
    <article className={`rec-card rec-card--${rec.severity}`} aria-label={rec.title}>
      <div className="rec-card-header">
        <SeverityIcon severity={rec.severity} />
        <div className="rec-card-meta">
          <span className="rec-badge rec-badge--category">{rec.category.toUpperCase()}</span>
          <span className="rec-badge rec-badge--confidence">{rec.confidence.toUpperCase()} CONFIDENCE</span>
        </div>
        <button
          className="rec-expand-btn"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse details' : 'Expand details'}
          onClick={() => setExpanded((v) => !v)}
        >
          <ChevronDown size={14} className={expanded ? 'rotated' : ''} />
        </button>
      </div>
      <h4 className="rec-title">{rec.title}</h4>
      {expanded && (
        <div className="rec-details">
          <p className="rec-explanation">{rec.explanation}</p>
          {rec.evidence.length > 0 && (
            <ul className="rec-evidence">
              {rec.evidence.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <p className="rec-action"><strong>Recommended:</strong> {rec.recommendedAction}</p>
        </div>
      )}
      <div className="rec-actions">
        <button className="rec-complete-btn" onClick={() => onComplete(rec)}>Mark complete</button>
        <button className="rec-dismiss-btn" onClick={() => onDismiss(rec)}>Dismiss</button>
        <div className="rec-snooze-wrapper">
          <button className="rec-snooze-btn" onClick={() => setShowSnooze((v) => !v)}>Snooze ▾</button>
          {showSnooze && (
            <ul className="rec-snooze-menu" role="menu">
              {SNOOZE_OPTIONS.map((opt: SnoozeOption) => (
                <li key={opt.days} role="menuitem">
                  <button onClick={() => { onSnooze(rec, opt.days); setShowSnooze(false) }}>{opt.label}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  )
}

// ── RecommendationCenter ───────────────────────────────────────────────────────

type Props = {
  recs: RosieRecommendation[]
  patterns: string[]
  healthSignals: HealthSignals | null
  onComplete: (rec: RosieRecommendation) => void
  onDismiss: (rec: RosieRecommendation) => void
  onSnooze: (rec: RosieRecommendation, days: number) => void
  onClose: () => void
}

export default function RecommendationCenter({ recs, patterns, healthSignals, onComplete, onDismiss, onSnooze, onClose }: Props) {
  return (
    <section className="rosie-center panel" aria-label="Rosie Recommendation Center">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">ROSIE COGNITIVE PARTNER</p>
          <h2>Recommendation Center</h2>
        </div>
        <button className="closeButton" onClick={onClose} aria-label="Close Recommendation Center">✕</button>
      </div>

      {healthSignals && (
        <div className="health-signals" aria-label="Health Signals">
          <p className="eyebrow">OPERATIONAL HEALTH</p>
          <div className="health-grid">
            {Object.entries(healthSignals).map(([key, level]) => (
              <div key={key} className={`health-cell health-cell--${level}`}>
                <span className="health-label">{key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}</span>
                <span className={`health-dot health-dot--${level}`} aria-label={level} />
              </div>
            ))}
          </div>
        </div>
      )}

      {recs.length === 0 ? (
        <div className="rec-empty">
          <ShieldCheck size={32} />
          <p>No active recommendations. Operational state is within normal parameters.</p>
        </div>
      ) : (
        <div className="rec-list" aria-label="Active recommendations">
          {recs.map((rec) => (
            <RecCard key={rec.id} rec={rec} onComplete={onComplete} onDismiss={onDismiss} onSnooze={onSnooze} />
          ))}
        </div>
      )}

      {patterns.length > 0 && (
        <div className="pattern-section">
          <p className="eyebrow">DETECTED PATTERNS</p>
          <ul className="pattern-list">
            {patterns.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}
    </section>
  )
}
