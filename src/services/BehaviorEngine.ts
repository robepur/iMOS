/**
 * BehaviorEngine — measures observable operator execution behavior.
 * No inference. No prediction. Only what is recorded.
 */

import type { PersonalData, Priority, Commitment, Decision } from '../localData'

export type BehaviorReport = {
  executionFrequency: ExecutionFrequency
  completionRate: CompletionRate
  recurringDelays: RecurringDelay[]
  priorityChurn: PriorityChurn
  commitmentChurn: CommitmentChurn
  decisionAging: DecisionAging
}

export type ExecutionFrequency = {
  prioritiesCompletedLast7Days: number
  prioritiesCompletedLast30Days: number
  prioritiesCompletedAllTime: number
  avgDaysToCompletePriority: number | null
  evidence: string[]
}

export type CompletionRate = {
  priorityCompletionPercent: number
  commitmentCompletionPercent: number
  allTimePriorities: number
  completedPriorities: number
  allTimeCommitments: number
  completedCommitments: number
  evidence: string[]
}

export type RecurringDelay = {
  priorityId: string
  priorityTitle: string
  overdueByDays: number
  evidence: string
}

export type PriorityChurn = {
  totalCreated: number
  neverWorked: number
  churned: number
  churnRate: number
  evidence: string[]
}

export type CommitmentChurn = {
  totalCreated: number
  neverClosed: number
  openLongerThan30Days: number
  evidence: string[]
}

export type DecisionAging = {
  openDecisions: number
  avgAgeDays: number | null
  oldestAgeDays: number | null
  oldestTitle: string | null
  evidence: string[]
}

const MS_PER_DAY = 86_400_000

function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / MS_PER_DAY)
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * MS_PER_DAY)
}

export const BehaviorEngine = {
  analyze(data: PersonalData): BehaviorReport {
    return {
      executionFrequency: BehaviorEngine.getExecutionFrequency(data.priorities),
      completionRate: BehaviorEngine.getCompletionRate(data.priorities, data.commitments),
      recurringDelays: BehaviorEngine.getRecurringDelays(data.priorities),
      priorityChurn: BehaviorEngine.getPriorityChurn(data.priorities),
      commitmentChurn: BehaviorEngine.getCommitmentChurn(data.commitments),
      decisionAging: BehaviorEngine.getDecisionAging(data.decisions),
    }
  },

  getExecutionFrequency(priorities: Priority[]): ExecutionFrequency {
    const cutoff7  = daysAgo(7).toISOString()
    const cutoff30 = daysAgo(30).toISOString()

    const completed = priorities.filter((p) => p.completed && p.completedAt)
    const last7  = completed.filter((p) => p.completedAt! >= cutoff7).length
    const last30 = completed.filter((p) => p.completedAt! >= cutoff30).length

    const durations = completed
      .filter((p) => p.completedAt)
      .map((p) => (new Date(p.completedAt!).getTime() - new Date(p.createdAt).getTime()) / MS_PER_DAY)
      .filter((d) => d >= 0)

    const avgDays = durations.length > 0
      ? parseFloat((durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1))
      : null

    const evidence: string[] = [`${completed.length} total priorities completed`]
    if (last7 > 0)  evidence.push(`${last7} completed in last 7 days`)
    if (last30 > 0) evidence.push(`${last30} completed in last 30 days`)
    if (avgDays !== null) evidence.push(`Average ${avgDays} days to complete a priority`)

    return { prioritiesCompletedLast7Days: last7, prioritiesCompletedLast30Days: last30, prioritiesCompletedAllTime: completed.length, avgDaysToCompletePriority: avgDays, evidence }
  },

  getCompletionRate(priorities: Priority[], commitments: Commitment[]): CompletionRate {
    const completedP = priorities.filter((p) => p.completed).length
    const completedC = commitments.filter((c) => c.status === 'complete').length
    const pRate = priorities.length > 0 ? Math.round((completedP / priorities.length) * 100) : 0
    const cRate = commitments.length > 0 ? Math.round((completedC / commitments.length) * 100) : 0
    return {
      priorityCompletionPercent: pRate,
      commitmentCompletionPercent: cRate,
      allTimePriorities: priorities.length,
      completedPriorities: completedP,
      allTimeCommitments: commitments.length,
      completedCommitments: completedC,
      evidence: [
        `${completedP} of ${priorities.length} priorities completed (${pRate}%)`,
        `${completedC} of ${commitments.length} commitments completed (${cRate}%)`,
      ],
    }
  },

  getRecurringDelays(priorities: Priority[]): RecurringDelay[] {
    const today = new Date().toDateString()
    return priorities
      .filter((p) => !p.completed && p.due && new Date(p.due) < new Date(today))
      .map((p) => ({
        priorityId: p.id,
        priorityTitle: p.title,
        overdueByDays: Math.floor((Date.now() - new Date(p.due).getTime()) / MS_PER_DAY),
        evidence: `"${p.title}" due ${p.due}, still active`,
      }))
      .sort((a, b) => b.overdueByDays - a.overdueByDays)
  },

  getPriorityChurn(priorities: Priority[]): PriorityChurn {
    const active = priorities.filter((p) => !p.completed)
    // Never worked = active, no due date set, created >14 days ago
    const neverWorked = active.filter((p) => !p.due && daysSince(p.createdAt) > 14).length
    const churned = neverWorked
    const rate = priorities.length > 0 ? Math.round((churned / priorities.length) * 100) : 0
    return {
      totalCreated: priorities.length,
      neverWorked,
      churned,
      churnRate: rate,
      evidence: [
        `${priorities.length} total priorities created`,
        neverWorked > 0 ? `${neverWorked} active priorities have no due date and are >14 days old` : 'No stale unworked priorities detected',
      ],
    }
  },

  getCommitmentChurn(commitments: Commitment[]): CommitmentChurn {
    const open = commitments.filter((c) => c.status === 'open')
    const old30 = open.filter((c) => daysSince(c.createdAt) > 30).length
    return {
      totalCreated: commitments.length,
      neverClosed: open.length,
      openLongerThan30Days: old30,
      evidence: [
        `${open.length} of ${commitments.length} commitments remain open`,
        old30 > 0 ? `${old30} commitments open longer than 30 days` : 'No long-running open commitments',
      ],
    }
  },

  getDecisionAging(decisions: Decision[]): DecisionAging {
    const open = decisions.filter((d) => d.status === 'open')
    if (open.length === 0) {
      return { openDecisions: 0, avgAgeDays: null, oldestAgeDays: null, oldestTitle: null, evidence: ['No open decisions'] }
    }
    const ages = open.map((d) => daysSince(d.createdAt))
    const avg = parseFloat((ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1))
    const maxIdx = ages.indexOf(Math.max(...ages))
    return {
      openDecisions: open.length,
      avgAgeDays: avg,
      oldestAgeDays: ages[maxIdx],
      oldestTitle: open[maxIdx].title,
      evidence: [
        `${open.length} open decisions`,
        `Average decision age: ${avg} days`,
        `Oldest: "${open[maxIdx].title}" at ${ages[maxIdx]} days`,
      ],
    }
  },
}
