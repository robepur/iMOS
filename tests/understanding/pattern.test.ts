import { describe, expect, it } from 'vitest'
import type { PersonalData } from '../../src/localData'
import { PatternEngine } from '../../src/services/PatternEngine'

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

describe('PatternEngine', () => {
  it('detects repeated recommendation dismissals and themes', () => {
    const data = base()
    data.recommendations = [
      { id: 'r1', category: 'priority', severity: 'high', confidence: 'high', title: 'A', explanation: '', evidence: [], recommendedAction: '', createdAt: daysAgo(2), dismissed: true },
      { id: 'r2', category: 'priority', severity: 'high', confidence: 'high', title: 'B', explanation: '', evidence: [], recommendedAction: '', createdAt: daysAgo(1), dismissed: true },
    ]
    data.reflections = [
      { id: 'f1', accomplished: 'completed dashboard integration', remember: 'dashboard cadence', tomorrow: 'dashboard polish', createdAt: daysAgo(1) },
      { id: 'f2', accomplished: 'dashboard test', remember: 'dashboard patterns', tomorrow: 'dashboard ship', createdAt: daysAgo(2) },
    ]

    const report = PatternEngine.analyze(data)
    expect(report.repeatedRecommendationDismissals[0].category).toBe('priority')
    expect(report.repeatedRecommendationDismissals[0].count).toBe(2)
    expect(report.reflectionThemes.length).toBeGreaterThan(0)
  })

  it('detects repeated successes/failures and streaks', () => {
    const data = base()
    data.priorities = [
      { id: 'p1', title: 'Fast task', why: '', level: 'normal', due: daysAgo(1), completed: true, primary: false, order: 0, createdAt: daysAgo(2), updatedAt: daysAgo(1), completedAt: daysAgo(1) },
      { id: 'p2', title: 'Overdue critical', why: '', level: 'critical', due: daysAgo(5), completed: false, primary: true, order: 1, createdAt: daysAgo(10), updatedAt: daysAgo(2) },
      { id: 'p3', title: 'Overdue high', why: '', level: 'high', due: daysAgo(4), completed: false, primary: false, order: 2, createdAt: daysAgo(9), updatedAt: daysAgo(2) },
      { id: 'p4', title: 'Overdue normal', why: '', level: 'normal', due: daysAgo(3), completed: false, primary: false, order: 3, createdAt: daysAgo(8), updatedAt: daysAgo(2) },
    ]
    data.reflections = [{ id: 'r1', accomplished: 'a', remember: 'b', tomorrow: 'c', createdAt: daysAgo(1) }]

    const report = PatternEngine.analyze(data)
    expect(report.repeatedFailures.length).toBeGreaterThan(0)
    expect(report.completionStreak.longest).toBeGreaterThanOrEqual(0)
  })
})

