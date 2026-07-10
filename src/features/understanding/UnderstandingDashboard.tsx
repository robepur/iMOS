import { useState } from 'react'
import type { OperatorUnderstanding } from '../../services/UnderstandingEngine'
import type { ConsistencyRating } from '../../services/ConsistencyEngine'
import type { TrendDirection } from '../../services/TrendEngine'
import type { DriftSeverity } from '../../services/OperationalDriftEngine'

// ── Shared helpers ─────────────────────────────────────────────────────────────

const RATING_LABEL: Record<ConsistencyRating, string> = {
  excellent: 'Excellent',
  good: 'Good',
  needs_attention: 'Needs Attention',
}

const TREND_SYMBOL: Record<TrendDirection, string> = {
  increasing: '↑',
  stable: '→',
  decreasing: '↓',
}

const DRIFT_LABEL: Record<DriftSeverity, string> = {
  critical: 'CRITICAL',
  warning: 'WARNING',
  info: 'INFO',
}

// ── Tab types ──────────────────────────────────────────────────────────────────

type Tab = 'summary' | 'behavior' | 'patterns' | 'trends' | 'consistency' | 'drift' | 'statistics'

const TABS: { id: Tab; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'behavior', label: 'Behavior' },
  { id: 'patterns', label: 'Patterns' },
  { id: 'trends', label: 'Trends' },
  { id: 'consistency', label: 'Consistency' },
  { id: 'drift', label: 'Drift' },
  { id: 'statistics', label: 'Statistics' },
]

// ── Main dashboard ─────────────────────────────────────────────────────────────

type Props = {
  understanding: OperatorUnderstanding
  onClose: () => void
}

export default function UnderstandingDashboard({ understanding, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('summary')
  const { behavior, patterns, trends, consistency, drift, summary, statistics } = understanding

  return (
    <section className="understanding-dashboard panel" aria-label="Rosie Understanding Engine">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">ROSIE UNDERSTANDING ENGINE</p>
          <h2>Operator Understanding</h2>
        </div>
        <button className="closeButton" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <nav className="ud-tabs" aria-label="Understanding sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`ud-tab${tab === t.id ? ' ud-tab--active' : ''}${t.id === 'drift' && drift.hasCritical ? ' ud-tab--alert' : ''}`}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            {t.label}
            {t.id === 'drift' && drift.signals.length > 0 && (
              <span className="ud-tab-badge">{drift.signals.length}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="ud-content">

        {/* ── Summary ── */}
        {tab === 'summary' && (
          <div className="ud-section">
            <p className="eyebrow">OPERATOR UNDERSTANDING SUMMARY</p>
            {summary.length === 0 ? (
              <p className="ud-empty">Not enough data yet to generate a summary. Complete priorities, reflections, and commitments to build understanding.</p>
            ) : (
              <ul className="ud-summary-list">
                {summary.map((line, i) => <li key={i} className="ud-summary-item">{line}</li>)}
              </ul>
            )}
            <div className="ud-meta">
              <span>Generated {new Date(understanding.generatedAt).toLocaleTimeString()}</span>
            </div>
            <div className="ud-card">
              <p className="eyebrow">RECOMMENDATION OUTCOMES</p>
              <div className="ud-stat-row"><span>Completed</span><strong>{statistics.recommendationOutcomes.completed}</strong></div>
              <div className="ud-stat-row"><span>Dismissed</span><strong>{statistics.recommendationOutcomes.dismissed}</strong></div>
              <div className="ud-stat-row"><span>Snoozed</span><strong>{statistics.recommendationOutcomes.snoozed}</strong></div>
              <div className="ud-stat-row"><span>Ignored</span><strong>{statistics.recommendationOutcomes.ignored}</strong></div>
              <div className="ud-stat-row"><span>Active</span><strong>{statistics.recommendationOutcomes.active}</strong></div>
            </div>
          </div>
        )}

        {/* ── Behavior ── */}
        {tab === 'behavior' && (
          <div className="ud-section">
            <div className="ud-grid-2">
              <div className="ud-card">
                <p className="eyebrow">EXECUTION FREQUENCY</p>
                <div className="ud-stat-row"><span>Completed (7 days)</span><strong>{behavior.executionFrequency.prioritiesCompletedLast7Days}</strong></div>
                <div className="ud-stat-row"><span>Completed (30 days)</span><strong>{behavior.executionFrequency.prioritiesCompletedLast30Days}</strong></div>
                <div className="ud-stat-row"><span>Completed (all time)</span><strong>{behavior.executionFrequency.prioritiesCompletedAllTime}</strong></div>
                <div className="ud-stat-row"><span>Avg days to complete</span><strong>{behavior.executionFrequency.avgDaysToCompletePriority ?? '—'}</strong></div>
                <EvidenceList evidence={behavior.executionFrequency.evidence} />
              </div>

              <div className="ud-card">
                <p className="eyebrow">COMPLETION RATES</p>
                <div className="ud-stat-row"><span>Priority rate</span><strong>{behavior.completionRate.priorityCompletionPercent}%</strong></div>
                <div className="ud-stat-row"><span>Commitment rate</span><strong>{behavior.completionRate.commitmentCompletionPercent}%</strong></div>
                <EvidenceList evidence={behavior.completionRate.evidence} />
              </div>

              <div className="ud-card">
                <p className="eyebrow">DECISION AGING</p>
                <div className="ud-stat-row"><span>Open decisions</span><strong>{behavior.decisionAging.openDecisions}</strong></div>
                <div className="ud-stat-row"><span>Avg age (days)</span><strong>{behavior.decisionAging.avgAgeDays ?? '—'}</strong></div>
                {behavior.decisionAging.oldestTitle && (
                  <div className="ud-stat-row"><span>Oldest</span><strong className="ud-truncate">{behavior.decisionAging.oldestTitle}</strong></div>
                )}
                <EvidenceList evidence={behavior.decisionAging.evidence} />
              </div>

              <div className="ud-card">
                <p className="eyebrow">CHURN</p>
                <div className="ud-stat-row"><span>Priority churn rate</span><strong>{behavior.priorityChurn.churnRate}%</strong></div>
                <div className="ud-stat-row"><span>Open commitments &gt;30d</span><strong>{behavior.commitmentChurn.openLongerThan30Days}</strong></div>
                {behavior.recurringDelays.length > 0 && (
                  <div className="ud-stat-row"><span>Overdue priorities</span><strong>{behavior.recurringDelays.length}</strong></div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Patterns ── */}
        {tab === 'patterns' && (
          <div className="ud-section">
            <div className="ud-grid-2">
              <div className="ud-card">
                <p className="eyebrow">COMPLETION STREAK</p>
                <div className="ud-stat-row"><span>Current streak</span><strong>{patterns.completionStreak.current} days</strong></div>
                <div className="ud-stat-row"><span>Longest streak</span><strong>{patterns.completionStreak.longest} days</strong></div>
                <EvidenceList evidence={patterns.completionStreak.evidence} />
              </div>
              <div className="ud-card">
                <p className="eyebrow">REFLECTION STREAK</p>
                <div className="ud-stat-row"><span>Current streak</span><strong>{patterns.reflectionStreak.current} days</strong></div>
                <div className="ud-stat-row"><span>Longest streak</span><strong>{patterns.reflectionStreak.longest} days</strong></div>
                <EvidenceList evidence={patterns.reflectionStreak.evidence} />
              </div>
            </div>

            {patterns.reflectionThemes.length > 0 && (
              <div className="ud-card ud-full">
                <p className="eyebrow">RECURRING REFLECTION THEMES</p>
                <div className="ud-theme-grid">
                  {patterns.reflectionThemes.map((t) => (
                    <div key={t.keyword} className="ud-theme-item">
                      <span className="ud-theme-word">{t.keyword}</span>
                      <span className="ud-theme-count">{t.occurrences}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {patterns.repeatedRecommendationDismissals.length > 0 && (
              <div className="ud-card ud-full">
                <p className="eyebrow">REPEATED RECOMMENDATION DISMISSALS</p>
                {patterns.repeatedRecommendationDismissals.map((d) => (
                  <div key={d.category} className="ud-stat-row">
                    <span>{d.category}</span><strong>{d.count}× dismissed</strong>
                  </div>
                ))}
              </div>
            )}

            {patterns.repeatedSuccesses.length > 0 && (
              <div className="ud-card ud-full">
                <p className="eyebrow">REPEATED SUCCESSES</p>
                <ul className="ud-list">{patterns.repeatedSuccesses.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}

            {patterns.repeatedFailures.length > 0 && (
              <div className="ud-card ud-full">
                <p className="eyebrow">RECURRING FAILURES</p>
                <ul className="ud-list">{patterns.repeatedFailures.map((f, i) => <li key={i}>{f}</li>)}</ul>
              </div>
            )}
          </div>
        )}

        {/* ── Trends ── */}
        {tab === 'trends' && (
          <div className="ud-section">
            <div className="ud-trend-table">
              {Object.values(trends).map((metric) => (
                <div key={metric.dimension} className={`ud-trend-row ud-trend-row--${metric.direction}`}>
                  <span className="ud-trend-name">{metric.dimension}</span>
                  <span className={`ud-trend-dir ud-trend-dir--${metric.direction}`}>{TREND_SYMBOL[metric.direction]} {metric.direction.toUpperCase()}</span>
                  <span className="ud-trend-values">{metric.priorValue} → {metric.recentValue}</span>
                  <details className="ud-trend-ev">
                    <summary>Evidence</summary>
                    <ul>{metric.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
                  </details>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Consistency ── */}
        {tab === 'consistency' && (
          <div className="ud-section">
            <div className={`ud-overall-rating ud-overall-rating--${consistency.overall}`}>
              <p className="eyebrow">OVERALL CONSISTENCY</p>
              <h3>{RATING_LABEL[consistency.overall]}</h3>
            </div>
            <div className="ud-consistency-grid">
              {(['priority','commitment','decision','reflection','backup','recovery'] as const).map((key) => {
                const dim = consistency[key]
                return (
                  <div key={key} className={`ud-consist-card ud-consist-card--${dim.rating}`}>
                    <div className="ud-consist-header">
                      <span className={`ud-consist-badge ud-consist-badge--${dim.rating}`}>{RATING_LABEL[dim.rating]}</span>
                      <span className="ud-consist-label">{dim.label}</span>
                    </div>
                    <p className="ud-consist-desc">{dim.description}</p>
                    <EvidenceList evidence={dim.evidence} />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Drift ── */}
        {tab === 'drift' && (
          <div className="ud-section">
            {drift.isClean ? (
              <div className="ud-drift-clean">
                <p className="eyebrow">OPERATIONAL DRIFT</p>
                <p>No operational drift detected. All systems nominal.</p>
              </div>
            ) : (
              <div className="ud-drift-list">
                {drift.signals.map((signal) => (
                  <div key={signal.id} className={`ud-drift-card ud-drift-card--${signal.severity}`}>
                    <div className="ud-drift-header">
                      <span className={`ud-drift-badge ud-drift-badge--${signal.severity}`}>{DRIFT_LABEL[signal.severity]}</span>
                      <span className="ud-drift-title">{signal.title}</span>
                    </div>
                    <p className="ud-drift-desc">{signal.description}</p>
                    <EvidenceList evidence={signal.evidence} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Statistics ── */}
        {tab === 'statistics' && (
          <div className="ud-section">
            <p className="eyebrow">OPERATOR STATISTICS</p>
            <table className="ud-stats-table">
              <tbody>
                <StatRow label="Most common reflection theme" value={statistics.mostCommonPattern ?? '—'} />
                <StatRow label="Longest completion streak" value={`${statistics.longestCompletionStreak} days`} />
                <StatRow label="Longest reflection streak" value={`${statistics.longestReflectionStreak} days`} />
                <StatRow label="Average decision age" value={statistics.avgDecisionAgeDays !== null ? `${statistics.avgDecisionAgeDays} days` : '—'} />
                <StatRow label="Average priority lifetime" value={statistics.avgPriorityLifetimeDays !== null ? `${statistics.avgPriorityLifetimeDays} days` : '—'} />
                <StatRow label="Average commitment lifetime" value={statistics.avgCommitmentLifetimeDays !== null ? `${statistics.avgCommitmentLifetimeDays} days` : '—'} />
                <StatRow label="Recommendation resolution rate" value={`${statistics.recommendationCompletionRate}%`} />
                <StatRow label="Recommendations completed" value={statistics.recommendationOutcomes.completed} />
                <StatRow label="Recommendations dismissed" value={statistics.recommendationOutcomes.dismissed} />
                <StatRow label="Recommendations snoozed" value={statistics.recommendationOutcomes.snoozed} />
                <StatRow label="Recommendations ignored" value={statistics.recommendationOutcomes.ignored} />
              </tbody>
            </table>
          </div>
        )}

      </div>
    </section>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function EvidenceList({ evidence }: { evidence: string[] }) {
  if (evidence.length === 0) return null
  return (
    <ul className="ud-evidence-list">
      {evidence.map((e, i) => <li key={i}>{e}</li>)}
    </ul>
  )
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <tr>
      <td className="ud-stat-label">{label}</td>
      <td className="ud-stat-value">{value}</td>
    </tr>
  )
}
