/**
 * CognitiveSignalsPanel
 *
 * Displays proposed cognitive signals from the CognitiveSignalEngine.
 *
 * Build 014 constraints:
 * - Signals are PROPOSED only. They must not change system behavior.
 * - Operator can inspect detail, suppress, or expire a signal.
 * - No confirmation or correction workflows (Build 015).
 */

import { useState } from 'react'
import type { CognitiveSignal } from '../../types/cognitive'
import { explainSignal } from '../../services/CognitiveSignalEngine'

type Props = {
  signals: CognitiveSignal[]
  onSuppress: (signalId: string) => void
  onClose: () => void
}

const STATUS_LABELS: Record<string, string> = {
  proposed: 'Proposed',
  observed: 'Observed',
  suppressed: 'Suppressed',
  expired: 'Expired',
}

const STATUS_STYLES: Record<string, string> = {
  proposed: 'background:#1a3a1a;color:#6dba6d;border:1px solid #2d6b2d;',
  observed: 'background:#1a2a3a;color:#5b9bd5;border:1px solid #1e5c99;',
  suppressed: 'background:#2a2a2a;color:#888;border:1px solid #444;',
  expired: 'background:#2a1a1a;color:#bb6060;border:1px solid #6b2020;',
}

export function CognitiveSignalsPanel({ signals, onSuppress, onClose }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'suppressed'>('active')

  const filtered = signals.filter((s) => {
    if (filter === 'active') return s.status === 'proposed' || s.status === 'observed'
    if (filter === 'suppressed') return s.status === 'suppressed'
    return true
  })

  const activeCount = signals.filter((s) => s.status === 'proposed' || s.status === 'observed').length

  return (
    <div style={{ padding: '1rem', maxWidth: 700, margin: '0 auto', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
          Cognitive Signals
          {activeCount > 0 && (
            <span style={{ marginLeft: 8, background: '#1a3a1a', color: '#6dba6d', borderRadius: 10, padding: '1px 8px', fontSize: '0.75rem', fontWeight: 500 }}>
              {activeCount} active
            </span>
          )}
        </h2>
        <button
          onClick={onClose}
          aria-label="Close cognitive signals panel"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#aaa', padding: '4px 8px' }}
        >
          ×
        </button>
      </div>

      <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '1rem', lineHeight: 1.5 }}>
        These are patterns Rosie has observed in your records. They are <strong>proposed only</strong> — they do not affect recommendations, missions, or any other behaviour.
        Review each signal and suppress those that are not meaningful to you.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
        {(['active', 'all', 'suppressed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '4px 12px',
              fontSize: '0.8rem',
              borderRadius: 4,
              border: filter === f ? '1px solid #5b9bd5' : '1px solid #444',
              background: filter === f ? '#1a2a3a' : 'transparent',
              color: filter === f ? '#5b9bd5' : '#aaa',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p style={{ color: '#666', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
          {filter === 'active' ? 'No active signals. Enable cognition and add more records to generate signals.' : 'No signals match this filter.'}
        </p>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map((signal) => {
          const isExpanded = expandedId === signal.id
          const statusStyle = STATUS_STYLES[signal.status] ?? STATUS_STYLES.proposed
          const canSuppress = signal.status === 'proposed' || signal.status === 'observed'

          return (
            <li
              key={signal.id}
              style={{ background: '#1c1c1c', border: '1px solid #333', borderRadius: 6, padding: '0.75rem 1rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '0.9rem', lineHeight: 1.4 }}>
                    {signal.plainLanguageStatement}
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
                    <span style={{ ...Object.fromEntries(statusStyle.split(';').filter(Boolean).map((p) => { const [k, v] = p.split(':'); return [k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v?.trim() ?? ''] })), borderRadius: 4, padding: '1px 6px', fontSize: '0.72rem', fontWeight: 500 } as React.CSSProperties}>
                      {STATUS_LABELS[signal.status] ?? signal.status}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#777' }}>
                      Rule: {signal.deterministicRuleId} v{signal.deterministicRuleVersion}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#777' }}>
                      Evidence: {signal.evidenceCount}
                    </span>
                    {signal.expiresAt && (
                      <span style={{ fontSize: '0.72rem', color: '#888' }}>
                        Expires: {new Date(signal.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : signal.id)}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'Collapse signal detail' : 'Inspect signal detail'}
                    style={{ padding: '3px 8px', fontSize: '0.75rem', background: '#222', border: '1px solid #444', borderRadius: 4, cursor: 'pointer', color: '#aaa' }}
                  >
                    {isExpanded ? 'Collapse' : 'Inspect'}
                  </button>
                  {canSuppress && (
                    <button
                      onClick={() => onSuppress(signal.id)}
                      aria-label={`Suppress signal: ${signal.plainLanguageStatement}`}
                      style={{ padding: '3px 8px', fontSize: '0.75rem', background: '#2a1a1a', border: '1px solid #6b2020', borderRadius: 4, cursor: 'pointer', color: '#bb6060' }}
                    >
                      Suppress
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div style={{ marginTop: '0.75rem', borderTop: '1px solid #333', paddingTop: '0.75rem' }}>
                  <pre style={{ fontSize: '0.75rem', color: '#aaa', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, lineHeight: 1.6, background: '#111', padding: '0.5rem', borderRadius: 4 }}>
                    {explainSignal(signal)}
                  </pre>
                  <p style={{ margin: '8px 0 0', fontSize: '0.72rem', color: '#666' }}>
                    Permitted uses: {signal.permittedFeatureUses.join(', ') || 'none'}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#666' }}>
                    Window: {new Date(signal.observationWindowStart).toLocaleDateString()} – {new Date(signal.observationWindowEnd).toLocaleDateString()}
                  </p>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
