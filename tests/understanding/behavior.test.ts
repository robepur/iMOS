import { describe, expect, it } from 'vitest'
import type { PersonalData } from '../../src/localData'
import { BehaviorEngine } from '../../src/services/BehaviorEngine'

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

describe('BehaviorEngine', () => {
  it('detects recurring overdue priorities and commitment churn', () => {
    const data = base()
    data.priorities = [
      { id: 'p1', title: 'Overdue one', why: '', level: 'critical', due: daysAgo(5), completed: false, primary: true, order: 0, createdAt: daysAgo(10), updatedAt: daysAgo(5) },
      { id: 'p2', title: 'Overdue two', why: '', level: 'high', due: daysAgo(4), completed: false, primary: false, order: 1, createdAt: daysAgo(12), updatedAt: daysAgo(4) },
      { id: 'p3', title: 'Completed', why: '', level: 'normal', due: daysAgo(2), completed: true, primary: false, order: 2, createdAt: daysAgo(7), updatedAt: daysAgo(1), completedAt: daysAgo(1) },
    ]
    data.commitments = [
      { id: 'c1', title: 'Old open', due: '', status: 'open', createdAt: daysAgo(40) },
      { id: 'c2', title: 'Done', due: '', status: 'complete', createdAt: daysAgo(20) },
    ]

    const report = BehaviorEngine.analyze(data)
    expect(report.recurringDelays.length).toBe(2)
    expect(report.commitmentChurn.openLongerThan30Days).toBe(1)
    expect(report.priorityChurn.totalCreated).toBe(3)
  })

  it('computes decision aging and completion rates', () => {
    const data = base()
    data.priorities = [
      { id: 'p1', title: 'Done', why: '', level: 'normal', due: '', completed: true, primary: false, order: 0, createdAt: daysAgo(5), updatedAt: daysAgo(2), completedAt: daysAgo(2) },
      { id: 'p2', title: 'Active', why: '', level: 'normal', due: '', completed: false, primary: true, order: 1, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
    ]
    data.commitments = [{ id: 'c1', title: 'Commit', due: '', status: 'complete', createdAt: daysAgo(2) }]
    data.decisions = [{ id: 'd1', title: 'Old decision', context: '', status: 'open', createdAt: daysAgo(15) }]

    const report = BehaviorEngine.analyze(data)
    expect(report.decisionAging.openDecisions).toBe(1)
    expect(report.decisionAging.avgAgeDays).toBeGreaterThanOrEqual(15)
    expect(report.completionRate.priorityCompletionPercent).toBe(50)
    expect(report.completionRate.commitmentCompletionPercent).toBe(100)
  })
})

