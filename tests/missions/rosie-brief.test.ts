import { describe, expect, it } from 'vitest'
import { RosieEngine } from '../../src/services/RosieEngine'
import type { PersonalData } from '../../src/localData'

function data(): PersonalData {
  const now = new Date().toISOString()
  return {
    version: 1,
    priorities: [{ id: 'p1', title: 'Mission priority', why: 'Do mission', level: 'high', due: '', completed: false, primary: true, order: 0, createdAt: now, updatedAt: now }],
    commitments: [{ id: 'c1', title: 'Open commitment', due: '', status: 'open', createdAt: now }],
    decisions: [{ id: 'd1', title: 'Open decision', context: 'Need decision', status: 'open', createdAt: now }],
    reflections: [],
    timeline: [],
    secrets: [],
    recommendations: [],
    missionPlans: [{
      id: 'm1',
      title: 'Mission Alpha',
      objective: 'Execute mission',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      sourcePriorityIds: ['p1'],
      stepIds: ['s1', 's2'],
      explanation: 'Generated from active priority.',
      approved: true,
    }],
    missionSteps: [
      { id: 's1', title: 'Resolve blocker', description: '', order: 1, status: 'completed', dependsOn: [], evidence: ['Open decision'], estimatedEffort: 'small', completedAt: now },
      { id: 's2', title: 'Execute work', description: '', order: 2, status: 'active', dependsOn: ['s1'], evidence: ['Priority'], estimatedEffort: 'medium' },
    ],
    understandingState: { activeDriftSignals: [], activePatternKeys: [], trendDirections: {} },
  }
}

describe('Rosie mission brief integration', () => {
  it('includes active mission details in morning brief', () => {
    const morning = RosieEngine.getMorningBrief(data())
    expect(morning.activeMission?.title).toBe('Mission Alpha')
    expect(morning.currentMissionStep?.title).toBe('Execute work')
  })

  it('includes completed steps and next step in evening summary', () => {
    const evening = RosieEngine.getEveningSummary(data())
    expect(evening.completedMissionSteps).toContain('Resolve blocker')
    expect(evening.missionProgress).toBeGreaterThan(0)
  })
})

