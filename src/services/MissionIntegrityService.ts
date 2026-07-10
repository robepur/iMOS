import type { MissionPlan, MissionStep } from '../localData'
import { MISSION_LIMITS } from '../constants'

type MissionStatus = MissionPlan['status']
type StepStatus = MissionStep['status']

type MissionTransitionMap = Record<MissionStatus, MissionStatus[]>
type StepTransitionMap = Record<StepStatus, StepStatus[]>

const ALLOWED_MISSION_TRANSITIONS: MissionTransitionMap = {
  draft: ['approved', 'cancelled'],
  approved: ['active', 'cancelled'],
  active: ['paused', 'completed', 'cancelled'],
  paused: ['active', 'cancelled'],
  completed: [],
  cancelled: [],
}

const ALLOWED_STEP_TRANSITIONS: StepTransitionMap = {
  pending: ['active', 'blocked'],
  active: ['completed', 'blocked'],
  blocked: ['pending'],
  completed: [],
}

function hasCircularDependency(stepMap: Map<string, MissionStep>): boolean {
  const visiting = new Set<string>()
  const visited = new Set<string>()

  function visit(id: string): boolean {
    if (visiting.has(id)) return true
    if (visited.has(id)) return false
    visiting.add(id)
    const step = stepMap.get(id)
    if (step) {
      for (const dep of step.dependsOn) {
        if (stepMap.has(dep) && visit(dep)) return true
      }
    }
    visiting.delete(id)
    visited.add(id)
    return false
  }

  for (const id of stepMap.keys()) {
    if (visit(id)) return true
  }

  return false
}

export type StepPatch = Partial<Pick<MissionStep, 'title' | 'description' | 'estimatedEffort' | 'dependsOn'>> & {
  operatorOverrideReason?: string
}

export const MissionIntegrityService = {
  allowedMissionTransitions(): MissionTransitionMap {
    return ALLOWED_MISSION_TRANSITIONS
  },

  allowedStepTransitions(): StepTransitionMap {
    return ALLOWED_STEP_TRANSITIONS
  },

  normalizeStepOrder(steps: MissionStep[]): MissionStep[] {
    return [...steps]
      .sort((a, b) => a.order - b.order)
      .map((step, index) => ({ ...step, order: index + 1 }))
  },

  validatePlan(plan: MissionPlan, steps: MissionStep[]): string[] {
    const issues: string[] = []
    const stepMap = new Map(steps.map((s) => [s.id, s]))

    if (!plan.title.trim()) issues.push('Mission title is required.')
    if (!plan.objective.trim()) issues.push('Mission objective is required.')
    if (steps.length === 0) issues.push('Mission must include at least one step.')
    if (steps.length > MISSION_LIMITS.MAX_STEPS) issues.push(`Mission exceeds maximum step count (${MISSION_LIMITS.MAX_STEPS}).`)
    if (plan.stepIds.length !== steps.length) issues.push('Mission step index is out of sync with step records.')

    const orderSet = new Set<number>()
    steps.forEach((step, index) => {
      if (!step.title.trim()) issues.push(`Step ${step.id} is missing title.`)
      if (step.dependsOn.includes(step.id)) issues.push(`Step ${step.id} cannot depend on itself.`)
      if (step.evidence.length < MISSION_LIMITS.MIN_EVIDENCE_ITEMS) issues.push(`Step ${step.id} has insufficient evidence.`)
      if (step.evidence.length > MISSION_LIMITS.MAX_EVIDENCE_ITEMS) issues.push(`Step ${step.id} exceeds max evidence items.`)

      const depSet = new Set<string>()
      step.dependsOn.forEach((dep) => {
        if (depSet.has(dep)) issues.push(`Step ${step.id} has duplicate dependency ${dep}.`)
        depSet.add(dep)
        if (!stepMap.has(dep)) issues.push(`Step ${step.id} references missing dependency ${dep}.`)
      })

      if (orderSet.has(step.order)) issues.push(`Step order ${step.order} is duplicated.`)
      orderSet.add(step.order)
      if (step.order !== index + 1) issues.push(`Step ${step.id} order must be sequential.`)
    })

    if (hasCircularDependency(stepMap)) issues.push('Circular step dependency detected.')

    if (plan.status === 'completed') {
      const incompleteRequired = steps.some((step) => step.status !== 'completed')
      if (incompleteRequired) issues.push('Completed missions cannot contain incomplete steps.')
    }

    return issues
  },

  transitionMission(plan: MissionPlan, nextStatus: MissionStatus, steps: MissionStep[]): MissionPlan {
    if (plan.status === nextStatus) return plan
    const allowed = ALLOWED_MISSION_TRANSITIONS[plan.status]
    if (!allowed.includes(nextStatus)) {
      throw new Error(`Invalid mission transition: ${plan.status} -> ${nextStatus}`)
    }
    if (nextStatus === 'active' && !plan.approved) {
      throw new Error('Mission must be approved before activation.')
    }
    if (nextStatus === 'completed' && steps.some((step) => step.status !== 'completed')) {
      throw new Error('Cannot complete mission with incomplete required steps.')
    }

    return {
      ...plan,
      status: nextStatus,
      approved: nextStatus === 'approved' || plan.approved,
      lastModifiedBy: 'operator',
      updatedAt: new Date().toISOString(),
    }
  },

  transitionStep(step: MissionStep, nextStatus: StepStatus, allSteps: MissionStep[], reason?: string): MissionStep {
    if (step.status === nextStatus) return step
    const allowed = ALLOWED_STEP_TRANSITIONS[step.status]
    if (!allowed.includes(nextStatus)) {
      throw new Error(`Invalid mission step transition: ${step.status} -> ${nextStatus}`)
    }

    if (nextStatus === 'active') {
      const unresolved = step.dependsOn.some((dep) => allSteps.find((s) => s.id === dep)?.status !== 'completed')
      if (unresolved) throw new Error('Blocked step cannot become active while dependencies are incomplete.')
    }
    if (step.status === 'completed' && nextStatus !== 'completed') {
      throw new Error('Completed step cannot return to another status without explicit reopen logic.')
    }

    return {
      ...step,
      status: nextStatus,
      ...(nextStatus === 'completed' ? { completedAt: new Date().toISOString() } : {}),
      ...(reason ? { operatorOverrideReason: reason.trim() } : {}),
      operatorModified: true,
      lastModifiedBy: 'operator',
    }
  },

  patchStep(step: MissionStep, patch: StepPatch): MissionStep {
    const dependsOn = patch.dependsOn ? Array.from(new Set(patch.dependsOn.filter((dep) => dep !== step.id))) : step.dependsOn
    return {
      ...step,
      ...patch,
      dependsOn,
      operatorModified: true,
      lastModifiedBy: 'operator',
      ...(patch.operatorOverrideReason ? { operatorOverrideReason: patch.operatorOverrideReason.trim() } : {}),
    }
  },
}
