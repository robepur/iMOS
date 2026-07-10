import type { MissionPlan, MissionStep, PersonalData, Priority } from '../localData'
import { createId } from '../localData'
import { DependencyEngine } from './DependencyEngine'

export type MissionProgress = {
  completedSteps: number
  remainingSteps: number
  blockedSteps: number
  completionPercent: number
  activeStep: MissionStep | null
}

function effortFromTitle(text: string): MissionStep['estimatedEffort'] {
  const length = text.trim().length
  if (length < 40) return 'small'
  if (length < 90) return 'medium'
  return 'large'
}

function selectSourcePriorities(data: PersonalData): Priority[] {
  const active = data.priorities.filter((p) => !p.completed)
  const primary = active.find((p) => p.primary)
  if (primary) {
    const related = active.filter((p) => p.id !== primary.id && p.level === primary.level).slice(0, 2)
    return [primary, ...related]
  }
  return active.slice(0, 3)
}

export const MissionPlanningEngine = {
  generateMission(data: PersonalData, objective?: string): { plan: MissionPlan; steps: MissionStep[] } {
    const now = new Date().toISOString()
    const priorities = selectSourcePriorities(data)
    const sourcePriorityIds = priorities.map((p) => p.id)

    const steps: MissionStep[] = []

    data.decisions.filter((d) => d.status === 'open').slice(0, 3).forEach((d, i) => {
      steps.push({
        id: createId('mission-step'),
        title: `Resolve decision: ${d.title}`,
        description: 'Resolve unresolved decision before dependent execution.',
        order: i + 1,
        status: 'pending',
        dependsOn: [],
        evidence: [`Open decision detected: ${d.title}`, `Created ${d.createdAt.slice(0, 10)}`],
        estimatedEffort: effortFromTitle(d.title),
      })
    })

    data.commitments.filter((c) => c.status === 'open').slice(0, 3).forEach((c, i) => {
      const deps = steps.filter((s) => s.title.startsWith('Resolve decision')).map((s) => s.id)
      steps.push({
        id: createId('mission-step'),
        title: `Close commitment: ${c.title}`,
        description: 'Required commitment closure before full mission execution.',
        order: steps.length + i + 1,
        status: 'pending',
        dependsOn: deps,
        evidence: [`Outstanding commitment: ${c.title}`, c.due ? `Due ${c.due}` : 'No due date set'],
        estimatedEffort: effortFromTitle(c.title),
      })
    })

    priorities.forEach((p, i) => {
      const deps = steps.map((s) => s.id).slice(0, Math.min(2, steps.length))
      steps.push({
        id: createId('mission-step'),
        title: `Execute priority: ${p.title}`,
        description: p.why || 'Complete mission-critical priority work.',
        order: steps.length + i + 1,
        status: i === 0 && steps.length === 0 ? 'active' : 'pending',
        dependsOn: deps,
        evidence: [
          `Priority level: ${p.level}`,
          p.due ? `Priority due: ${p.due}` : 'No due date set',
          `Priority selected for mission planning`,
        ],
        estimatedEffort: p.level === 'critical' ? 'large' : 'medium',
      })
    })

    steps.push({
      id: createId('mission-step'),
      title: 'Capture reflection and adjust next mission',
      description: 'Close planning loop with reflection and plan adjustment.',
      order: steps.length + 1,
      status: 'pending',
      dependsOn: steps.filter((s) => s.title.startsWith('Execute priority')).map((s) => s.id),
      evidence: ['Reflection closes execution loop', 'Rosie memory quality depends on reflection cadence'],
      estimatedEffort: 'small',
    })

    const ordered = DependencyEngine.sortSteps(steps)
    const plan: MissionPlan = {
      id: createId('mission'),
      title: objective ?? (priorities[0] ? `Mission Plan: ${priorities[0].title}` : 'Mission Plan'),
      objective: objective ?? (priorities[0]?.why || 'Execute current operational priorities in dependency order.'),
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      sourcePriorityIds,
      stepIds: ordered.map((s) => s.id),
      explanation: MissionPlanningEngine.explainPlan(ordered, priorities.map((p) => p.title)),
      approved: false,
    }
    return { plan, steps: ordered }
  },

  explainPlan(steps: MissionStep[], sourceTitles: string[]): string {
    const dependencyCount = steps.reduce((acc, step) => acc + step.dependsOn.length, 0)
    return [
      `Rosie generated this plan from ${sourceTitles.length} source priorit${sourceTitles.length !== 1 ? 'ies' : 'y'}: ${sourceTitles.join(', ') || 'none selected'}.`,
      `Steps are ordered by dependency-first execution, blockers before execution tasks, and deterministic effort sequencing.`,
      `${dependencyCount} explicit dependency link${dependencyCount !== 1 ? 's' : ''} identified across ${steps.length} steps.`,
      `Recommended path: resolve blockers, execute prioritized work, then close with reflection.`,
    ].join(' ')
  },

  validatePlan(plan: MissionPlan, steps: MissionStep[], data: PersonalData): string[] {
    const issues: string[] = []
    if (plan.stepIds.length === 0) issues.push('Plan has no steps.')
    if (steps.length !== plan.stepIds.length) issues.push('Plan step index does not match step records.')
    const report = DependencyEngine.analyze(plan, steps, data)
    if (report.circularDependency) issues.push('Circular dependency detected.')
    if (report.missingPrerequisites.length > 0) issues.push('Missing prerequisites detected.')
    return issues
  },

  getProgress(steps: MissionStep[]): MissionProgress {
    const completedSteps = steps.filter((s) => s.status === 'completed').length
    const blockedSteps = steps.filter((s) => s.status === 'blocked').length
    const activeStep = steps.find((s) => s.status === 'active') ?? null
    const remainingSteps = steps.length - completedSteps
    const completionPercent = steps.length === 0 ? 0 : Math.round((completedSteps / steps.length) * 100)
    return { completedSteps, remainingSteps, blockedSteps, completionPercent, activeStep }
  },
}

