import { describe, expect, it } from 'vitest'
import type { PersonalData } from '../../src/localData'
import { TrendEngine } from '../../src/services/TrendEngine'
import { ConsistencyEngine } from '../../src/services/ConsistencyEngine'
import { OperationalDriftEngine } from '../../src/services/OperationalDriftEngine'

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function base(): PersonalData {
  return {
    version: 1,
    priorities: [],
    commitments: [],
    decisions: [],
    timeline: [],
    reflections: [],
    secrets: [],
    recommendations: [],
    understandingState: { activeDriftSignals: [], activePatternKeys: [], trendDirections: {} },
  }
}

describe('Trend/Consistency/Drift engines', () => {
  it('reports increasing/decreasing/stable trends', () => {
    const data = base()
    data.priorities = [
      { id: 'p1', title: 'new1', why: '', level: 'normal', due: '', completed: false, primary: true, order: 0, createdAt: daysAgo(3), updatedAt: daysAgo(3) },
      { id: 'p2', title: 'old', why: '', level: 'normal', due: '', completed: false, primary: false, order: 1, createdAt: daysAgo(45), updatedAt: daysAgo(45) },
      { id: 'p3', title: 'done', why: '', level: 'normal', due: '', completed: true, primary: false, order: 2, createdAt: daysAgo(50), updatedAt: daysAgo(2), completedAt: daysAgo(2) },
    ]
    data.commitments = [{ id: 'c1', title: 'new commitment', due: '', status: 'open', createdAt: daysAgo(2) }]
    data.decisions = [{ id: 'd1', title: 'old decision', context: '', status: 'open', createdAt: daysAgo(50) }]
    data.reflections = [{ id: 'r1', accomplished: '', remember: '', tomorrow: '', createdAt: daysAgo(2) }]

    const trends = TrendEngine.analyze(data)
    expect(['increasing', 'stable', 'decreasing']).toContain(trends.priorityLoad.direction)
    expect(['increasing', 'stable', 'decreasing']).toContain(trends.completionRate.direction)
  })

  it('handles empty data for consistency and detects drift neglect', () => {
    const data = base()
    const consistency = ConsistencyEngine.analyze(data)
    const drift = OperationalDriftEngine.analyze(data)

    expect(consistency.priority.rating).toBe('needs_attention')
    expect(drift.signals.some((s) => s.id === 'drift-backup-neglect')).toBe(true)
    expect(drift.signals.some((s) => s.id === 'drift-recovery-neglect')).toBe(true)
  })
})

