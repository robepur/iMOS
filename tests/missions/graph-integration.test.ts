import { describe, expect, it } from 'vitest'
import { KnowledgeGraph } from '../../src/services/KnowledgeGraph'
import type { PersonalData } from '../../src/localData'

function sample(): PersonalData {
  const now = new Date().toISOString()
  return {
    version: 1,
    priorities: [{ id: 'p1', title: 'Deliver alpha mission', why: 'Objective', level: 'critical', due: '', completed: false, primary: true, order: 0, createdAt: now, updatedAt: now }],
    commitments: [{ id: 'c1', title: 'Commit alpha', due: '', status: 'open', createdAt: now }],
    decisions: [{ id: 'd1', title: 'Decide alpha', context: 'Required', status: 'open', createdAt: now }],
    timeline: [],
    reflections: [],
    secrets: [],
    recommendations: [],
    missionPlans: [{
      id: 'm1',
      title: 'Mission Alpha',
      objective: 'Complete alpha',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      sourcePriorityIds: ['p1'],
      stepIds: ['s1', 's2'],
      explanation: 'From priority.',
      approved: true,
    }],
    missionSteps: [
      { id: 's1', title: 'Resolve alpha decision', description: '', order: 1, status: 'pending', dependsOn: [], evidence: ['Decide alpha'], estimatedEffort: 'small' },
      { id: 's2', title: 'Execute alpha', description: '', order: 2, status: 'pending', dependsOn: ['s1'], evidence: ['Deliver alpha mission'], estimatedEffort: 'medium' },
    ],
    understandingState: { activeDriftSignals: [], activePatternKeys: [], trendDirections: {} },
  }
}

describe('Mission graph integration', () => {
  it('adds mission and mission step nodes with relationship edges', () => {
    const graph = KnowledgeGraph.build(sample())
    expect(graph.nodes.some((n) => n.type === 'mission')).toBe(true)
    expect(graph.nodes.some((n) => n.type === 'mission_step')).toBe(true)
    expect(graph.edges.some((e) => e.type === 'generated_from')).toBe(true)
    expect(graph.edges.some((e) => e.type === 'depends_on')).toBe(true)
    expect(graph.edges.some((e) => e.type === 'blocked_by')).toBe(true)
  })
})

