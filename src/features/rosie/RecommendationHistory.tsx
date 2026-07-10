import type { RosieRecommendation } from '../../localData'
import { ShieldCheck } from 'lucide-react'

type Props = {
  recs: RosieRecommendation[]
  onClose: () => void
}

export default function RecommendationHistory({ recs, onClose }: Props) {
  const dismissed = recs.filter((r) => r.dismissed)
  const snoozed = recs.filter((r) => !r.dismissed && r.snoozedUntil && r.snoozedUntil > new Date().toISOString())

  return (
    <section className="rec-history panel" aria-label="Recommendation History">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">ROSIE COGNITIVE PARTNER</p>
          <h2>Recommendation History</h2>
        </div>
        <button className="closeButton" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="rec-history-section">
        <h3>Snoozed ({snoozed.length})</h3>
        {snoozed.length === 0 ? (
          <p className="rec-empty-text">No snoozed recommendations.</p>
        ) : (
          <ul className="rec-history-list">
            {snoozed.map((r) => (
              <li key={r.id} className="rec-history-item">
                <span className={`rec-badge rec-badge--${r.severity}`}>{r.severity.toUpperCase()}</span>
                <span>{r.title}</span>
                <span className="rec-history-meta">
                  Snoozed until {r.snoozedUntil ? new Date(r.snoozedUntil).toLocaleDateString() : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rec-history-section">
        <h3>Dismissed ({dismissed.length})</h3>
        {dismissed.length === 0 ? (
          <p className="rec-empty-text">No dismissed recommendations.</p>
        ) : (
          <ul className="rec-history-list">
            {dismissed.map((r) => (
              <li key={r.id} className="rec-history-item rec-history-item--dismissed">
                <span className={`rec-badge rec-badge--${r.severity}`}>{r.severity.toUpperCase()}</span>
                <span>{r.title}</span>
                <span className="rec-history-meta">Dismissed</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
