import { describe, expect, it } from 'vitest'
import type { MissionPlan, MissionStep } from '../../src/localData'
import { MissionIntegrityService } from '../../src/services/MissionIntegrityService'

function makePlan(overrides: Partial<MissionPlan> = {}): MissionPlan {
  const now = new Date().toISOString()
  return {
    id: 'm1',
    title: 'Mission',
    objective: 'Objective',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    sourcePriorityIds: ['p1'],
    stepIds: ['s1', 's2'],
    explanation: 'Explain',
    approved: false,
    ...overrides,
  }
}

function makeSteps(overrides: Array<Partial<MissionStep>> = []): MissionStep[] {
  const base: MissionStep[] = [
    { id: 's1', title: 'Step 1', description: '', order: 1, status: 'pending', dependsOn: [], evidence: ['ev1'], estimatedEffort: 'small' },
    { id: 's2', title: 'Step 2', description: '', order: 2, status: 'pending', dependsOn: ['s1'], evidence: ['ev2'], estimatedEffort: 'medium' },
  ]
  return base.map((step, index) => ({ ...step, ...(overrides[index] ?? {}) }))
}

describe('MissionIntegrityService transitions', () => {
  it('allows only defined mission transitions', () => {
    const steps = makeSteps()
    const approved = MissionIntegrityService.transitionMission(makePlan(), 'approved', steps)
    expect(approved.status).toBe('approved')
    expect(() => MissionIntegrityService.transitionMission(makePlan(), 'active', steps)).toThrow()
  })

  it('rejects completion when required steps are incomplete', () => {
    const plan = makePlan({ status: 'active', approved: true })
    const steps = makeSteps([{ status: 'completed' }, { status: 'pending' }])
    expect(() => MissionIntegrityService.transitionMission(plan, 'completed', steps)).toThrow()
  })

  it('enforces dependency completion before activating blocked work', () => {
    const steps = makeSteps()
    expect(() => MissionIntegrityService.transitionStep(steps[1], 'active', steps)).toThrow()
    const completedDep = [{ ...steps[0], status: 'completed' as const }, steps[1]]
    expect(MissionIntegrityService.transitionStep(completedDep[1], 'active', completedDep).status).toBe('active')
  })
})

describe('MissionIntegrityService validation', () => {
  it('rejects circular and duplicate dependencies', () => {
    const plan = makePlan()
    const steps = makeSteps([
      { dependsOn: ['s2'] },
      { dependsOn: ['s1', 's1'] },
    ])
    const issues = MissionIntegrityService.validatePlan(plan, steps)
    expect(issues.some((issue) => issue.includes('Circular'))).toBe(true)
    expect(issues.some((issue) => issue.includes('duplicate dependency'))).toBe(true)
  })

  it('normalizes step order sequentially', () => {
    const reordered = MissionIntegrityService.normalizeStepOrder(makeSteps([{ order: 9 }, { order: 2 }]))
    expect(reordered.map((step) => step.order)).toEqual([1, 2])
  })
})
