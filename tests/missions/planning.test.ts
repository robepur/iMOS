import { describe, expect, it } from 'vitest'
import type { PersonalData } from '../../src/localData'
import { createInitialData } from '../../src/localData'
import { MissionPlanningEngine } from '../../src/services/MissionPlanningEngine'
import { DependencyEngine } from '../../src/services/DependencyEngine'

function base(): PersonalData {
  return {
    ...createInitialData(),
    priorities: [
      { id: 'p1', title: 'Launch mission control', why: 'Primary objective', level: 'critical', due: '', completed: false, primary: true, order: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'p2', title: 'Stabilize mission timeline', why: 'Secondary objective', level: 'high', due: '', completed: false, primary: false, order: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ],
    commitments: [{ id: 'c1', title: 'Review launch checklist', due: '', status: 'open', createdAt: new Date().toISOString() }],
    decisions: [{ id: 'd1', title: 'Select launch sequence', context: 'Required before execution', status: 'open', createdAt: new Date().toISOString() }],
    missionPlans: [],
    missionSteps: [],
  }
}

describe('MissionPlanningEngine', () => {
  it('generates deterministic mission plans with explainable steps', () => {
    const data = base()
    const { plan, steps } = MissionPlanningEngine.generateMission(data)
    expect(plan.status).toBe('draft')
    expect(plan.approved).toBe(false)
    expect(plan.stepIds.length).toBe(steps.length)
    expect(steps.every((s) => s.evidence.length > 0)).toBe(true)
    expect(plan.explanation.length).toBeGreaterThan(20)
  })

  it('validates and computes progress', () => {
    const data = base()
    const generated = MissionPlanningEngine.generateMission(data)
    const issues = MissionPlanningEngine.validatePlan(generated.plan, generated.steps, data)
    expect(issues).toEqual([])

    const progress = MissionPlanningEngine.getProgress(generated.steps)
    expect(progress.completionPercent).toBeGreaterThanOrEqual(0)
    expect(progress.remainingSteps).toBe(generated.steps.length)
  })

  it('orders dependencies deterministically and flags circular dependencies', () => {
    const data = base()
    const generated = MissionPlanningEngine.generateMission(data)
    const ordered = DependencyEngine.sortSteps(generated.steps)
    expect(ordered.map((s) => s.order)).toEqual(ordered.map((_, i) => i + 1))

    const circular = [
      { ...generated.steps[0], id: 'a', dependsOn: ['b'] },
      { ...generated.steps[1], id: 'b', dependsOn: ['a'] },
    ]
    const report = DependencyEngine.analyze({ ...generated.plan, stepIds: ['a', 'b'] }, circular, data)
    expect(report.circularDependency).toBe(true)
  })
})

