import type { Commitment, Decision, MissionPlan, MissionStep, PersonalData } from '../localData'

export type DependencyReport = {
  blockingDecisions: Decision[]
  blockingCommitments: Commitment[]
  missingPrerequisites: string[]
  completedDependencies: number
  circularDependency: boolean
  blockedSteps: string[]
}

function detectCircular(stepMap: Map<string, MissionStep>): boolean {
  const visiting = new Set<string>()
  const visited = new Set<string>()

  function walk(id: string): boolean {
    if (visiting.has(id)) return true
    if (visited.has(id)) return false
    visiting.add(id)
    const step = stepMap.get(id)
    if (step) {
      for (const dep of step.dependsOn) {
        if (stepMap.has(dep) && walk(dep)) return true
      }
    }
    visiting.delete(id)
    visited.add(id)
    return false
  }

  for (const id of stepMap.keys()) {
    if (walk(id)) return true
  }
  return false
}

export const DependencyEngine = {
  analyze(plan: MissionPlan, steps: MissionStep[], data: PersonalData): DependencyReport {
    const stepMap = new Map(steps.map((s) => [s.id, s]))
    const missingPrerequisites: string[] = []
    let completedDependencies = 0
    const blockedSteps: string[] = []

    for (const step of steps) {
      for (const dep of step.dependsOn) {
        const depStep = stepMap.get(dep)
        if (!depStep) {
          missingPrerequisites.push(`${step.id} -> ${dep}`)
          continue
        }
        if (depStep.status === 'completed') completedDependencies++
        if (depStep.status !== 'completed') blockedSteps.push(step.id)
      }
    }

    const relatedDecisions = data.decisions.filter(
      (d) => d.status === 'open' && steps.some((s) => s.evidence.some((e) => e.toLowerCase().includes(d.title.toLowerCase().slice(0, 16))))
    )
    const relatedCommitments = data.commitments.filter(
      (c) => c.status === 'open' && steps.some((s) => s.evidence.some((e) => e.toLowerCase().includes(c.title.toLowerCase().slice(0, 16))))
    )

    return {
      blockingDecisions: relatedDecisions,
      blockingCommitments: relatedCommitments,
      missingPrerequisites,
      completedDependencies,
      circularDependency: detectCircular(stepMap),
      blockedSteps: Array.from(new Set(blockedSteps)),
    }
  },

  sortSteps(steps: MissionStep[]): MissionStep[] {
    const stepMap = new Map(steps.map((s) => [s.id, s]))
    const indegree = new Map<string, number>()
    steps.forEach((s) => indegree.set(s.id, 0))
    steps.forEach((s) => {
      s.dependsOn.forEach((dep) => {
        if (stepMap.has(dep)) indegree.set(s.id, (indegree.get(s.id) ?? 0) + 1)
      })
    })

    const effortWeight = { small: 0, medium: 1, large: 2 }
    const queue = steps
      .filter((s) => (indegree.get(s.id) ?? 0) === 0)
      .sort((a, b) => a.order - b.order || effortWeight[a.estimatedEffort] - effortWeight[b.estimatedEffort])

    const ordered: MissionStep[] = []
    while (queue.length > 0) {
      const step = queue.shift()!
      ordered.push(step)
      steps.forEach((candidate) => {
        if (candidate.dependsOn.includes(step.id)) {
          indegree.set(candidate.id, (indegree.get(candidate.id) ?? 0) - 1)
          if ((indegree.get(candidate.id) ?? 0) === 0) queue.push(candidate)
        }
      })
      queue.sort((a, b) => a.order - b.order || effortWeight[a.estimatedEffort] - effortWeight[b.estimatedEffort])
    }

    if (ordered.length !== steps.length) return [...steps].sort((a, b) => a.order - b.order)
    return ordered.map((s, index) => ({ ...s, order: index + 1 }))
  },
}

