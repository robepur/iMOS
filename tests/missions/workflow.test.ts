import { describe, expect, it } from 'vitest'
import type { MissionPlan, MissionStep } from '../../src/localData'
import { MissionPlanningEngine } from '../../src/services/MissionPlanningEngine'

function applyStatus(plan: MissionPlan, status: MissionPlan['status']): MissionPlan {
  return { ...plan, status, approved: status === 'approved' || plan.approved, updatedAt: new Date().toISOString() }
}

function applyStepStatus(steps: MissionStep[], stepId: string, status: MissionStep['status']): MissionStep[] {
  return steps.map((s) => s.id === stepId ? { ...s, status } : s)
}

describe('Mission workflow transitions', () => {
  it('supports approval, activation, pause, resume, completion transitions', () => {
    const generated = MissionPlanningEngine.generateMission({
      version: 1,
      priorities: [{ id: 'p1', title: 'Execute plan', why: 'Need execution', level: 'high', due: '', completed: false, primary: true, order: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      commitments: [],
      decisions: [],
      reflections: [],
      timeline: [],
      secrets: [],
      recommendations: [],
      missionPlans: [],
      missionSteps: [],
      understandingState: { activeDriftSignals: [], activePatternKeys: [], trendDirections: {} },
    })

    let plan = generated.plan
    plan = applyStatus(plan, 'approved')
    expect(plan.approved).toBe(true)
    plan = applyStatus(plan, 'active')
    expect(plan.status).toBe('active')
    plan = applyStatus(plan, 'paused')
    expect(plan.status).toBe('paused')
    plan = applyStatus(plan, 'active')
    expect(plan.status).toBe('active')
    plan = applyStatus(plan, 'completed')
    expect(plan.status).toBe('completed')
  })

  it('tracks step completion and computes mission completion', () => {
    const generated = MissionPlanningEngine.generateMission({
      version: 1,
      priorities: [{ id: 'p1', title: 'Deliver mission', why: 'Deliver', level: 'high', due: '', completed: false, primary: true, order: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      commitments: [],
      decisions: [],
      reflections: [],
      timeline: [],
      secrets: [],
      recommendations: [],
      missionPlans: [],
      missionSteps: [],
      understandingState: { activeDriftSignals: [], activePatternKeys: [], trendDirections: {} },
    })

    let steps = generated.steps
    for (const step of steps) {
      steps = applyStepStatus(steps, step.id, 'completed')
    }
    const progress = MissionPlanningEngine.getProgress(steps)
    expect(progress.completionPercent).toBe(100)
    expect(progress.completedSteps).toBe(steps.length)
  })
})

