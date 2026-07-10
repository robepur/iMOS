import { describe, expect, it } from 'vitest'
import type { PersonalData } from '../../src/localData'
import { migrateToLatest } from '../../src/SchemaVersion'
import { UnderstandingEngine } from '../../src/services/UnderstandingEngine'

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

describe('UnderstandingEngine', () => {
  it('generates summary, statistics, and outcome metrics', () => {
    const data = base()
    data.priorities = [
      { id: 'p1', title: 'Done priority', why: '', level: 'high', due: daysAgo(1), completed: true, primary: false, order: 0, createdAt: daysAgo(5), updatedAt: daysAgo(1), completedAt: daysAgo(1) },
    ]
    data.recommendations = [
      { id: 'r1', category: 'priority', severity: 'high', confidence: 'high', title: 'R1', explanation: '', evidence: ['x'], recommendedAction: '', createdAt: daysAgo(10), dismissed: false, completed: true, completedAt: daysAgo(2) },
      { id: 'r2', category: 'decision', severity: 'normal', confidence: 'medium', title: 'R2', explanation: '', evidence: ['y'], recommendedAction: '', createdAt: daysAgo(9), dismissed: true, dismissedAt: daysAgo(8) },
    ]
    data.timeline = [{ id: 't1', type: 'priority', title: 'Priority completed', detail: 'Done priority', createdAt: daysAgo(1) }]

    const understanding = UnderstandingEngine.analyze(data)
    expect(understanding.summary.length).toBeGreaterThan(0)
    expect(understanding.statistics.recommendationOutcomes.total).toBe(2)
    expect(understanding.statistics.recommendationOutcomes.completed).toBe(1)
  })

  it('supports empty and legacy payloads', () => {
    const legacy = migrateToLatest({ version: 1, priorities: [], commitments: [], decisions: [], timeline: [], reflections: [] })
    const understanding = UnderstandingEngine.analyze(legacy)
    expect(understanding.behavior.executionFrequency.prioritiesCompletedAllTime).toBe(0)
    expect(understanding.statistics.recommendationOutcomes.total).toBe(0)
  })

  it('limits morning/evening observations to max 3', () => {
    const data = base()
    data.priorities = [
      { id: 'p1', title: 'Old critical', why: '', level: 'critical', due: daysAgo(15), completed: false, primary: true, order: 0, createdAt: daysAgo(20), updatedAt: daysAgo(15) },
    ]
    data.commitments = [{ id: 'c1', title: 'Open', due: '', status: 'open', createdAt: daysAgo(1) }]
    data.decisions = [{ id: 'd1', title: 'Old', context: '', status: 'open', createdAt: daysAgo(20) }]
    data.reflections = [{ id: 'f1', accomplished: '', remember: '', tomorrow: '', createdAt: daysAgo(40) }]
    data.recommendations = [{ id: 'r1', category: 'priority', severity: 'high', confidence: 'high', title: 'Rec', explanation: '', evidence: ['e'], recommendedAction: '', createdAt: daysAgo(20), dismissed: false }]
    data.timeline = [{ id: 't1', type: 'priority', title: 'Any activity', detail: 'x', createdAt: daysAgo(1) }]

    const understanding = UnderstandingEngine.analyze(data)
    expect(UnderstandingEngine.getMorningObservations(understanding).length).toBeLessThanOrEqual(3)
    expect(UnderstandingEngine.getEveningObservations(understanding).length).toBeLessThanOrEqual(3)
  })
})

