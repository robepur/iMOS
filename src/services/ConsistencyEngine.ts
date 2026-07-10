/**
 * ConsistencyEngine — rates operational consistency across key dimensions.
 * Ratings: Excellent | Good | Needs Attention (no numeric grades).
 */

import type { PersonalData, TimelineEntry } from '../localData'

export type ConsistencyRating = 'excellent' | 'good' | 'needs_attention'

export type ConsistencyDimension = {
  label: string
  rating: ConsistencyRating
  description: string
  evidence: string[]
}

export type ConsistencyReport = {
  priority: ConsistencyDimension
  commitment: ConsistencyDimension
  decision: ConsistencyDimension
  reflection: ConsistencyDimension
  backup: ConsistencyDimension
  recovery: ConsistencyDimension
  overall: ConsistencyRating
}

const MS_PER_DAY = 86_400_000

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / MS_PER_DAY)
}

function lastEventOfType(timeline: TimelineEntry[], keyword: string): TimelineEntry | undefined {
  return timeline.find((e) => e.title.toLowerCase().includes(keyword) || e.detail.toLowerCase().includes(keyword))
}

function overallRating(dimensions: ConsistencyDimension[]): ConsistencyRating {
  const needsAttention = dimensions.filter((d) => d.rating === 'needs_attention').length
  const good = dimensions.filter((d) => d.rating === 'good').length
  if (needsAttention >= 3) return 'needs_attention'
  if (needsAttention >= 1 || good >= 4) return 'good'
  return 'excellent'
}

export const ConsistencyEngine = {
  analyze(data: PersonalData): ConsistencyReport {
    const dimensions = {
      priority:   ConsistencyEngine.getPriorityConsistency(data),
      commitment: ConsistencyEngine.getCommitmentConsistency(data),
      decision:   ConsistencyEngine.getDecisionConsistency(data),
      reflection: ConsistencyEngine.getReflectionConsistency(data),
      backup:     ConsistencyEngine.getBackupConsistency(data),
      recovery:   ConsistencyEngine.getRecoveryConsistency(data),
    }
    return { ...dimensions, overall: overallRating(Object.values(dimensions)) }
  },

  getPriorityConsistency(data: PersonalData): ConsistencyDimension {
    const active = data.priorities.filter((p) => !p.completed)
    const overdue = active.filter((p) => p.due && new Date(p.due) < new Date(new Date().toDateString()))
    const total = data.priorities.length
    const completed = data.priorities.filter((p) => p.completed).length
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0

    let rating: ConsistencyRating
    if (overdue.length === 0 && rate >= 70) rating = 'excellent'
    else if (overdue.length <= 2 && rate >= 40) rating = 'good'
    else rating = 'needs_attention'

    return {
      label: 'Priority Execution',
      rating,
      description: rating === 'excellent'
        ? 'Priorities are being executed consistently on time.'
        : rating === 'good'
        ? 'Priority execution is generally on track with minor delays.'
        : 'Multiple overdue priorities signal an execution consistency gap.',
      evidence: [
        `${completed} of ${total} priorities completed (${rate}%)`,
        overdue.length > 0 ? `${overdue.length} active priorities are past their due date` : 'No overdue priorities',
      ],
    }
  },

  getCommitmentConsistency(data: PersonalData): ConsistencyDimension {
    const open = data.commitments.filter((c) => c.status === 'open')
    const today = new Date().toDateString()
    const overdueCommits = open.filter((c) => c.due && new Date(c.due) < new Date(today))
    const completed = data.commitments.filter((c) => c.status === 'complete').length
    const total = data.commitments.length
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0

    let rating: ConsistencyRating
    if (overdueCommits.length === 0 && rate >= 60) rating = 'excellent'
    else if (overdueCommits.length <= 3 && rate >= 30) rating = 'good'
    else rating = 'needs_attention'

    return {
      label: 'Commitment Follow-Through',
      rating,
      description: rating === 'excellent'
        ? 'Commitments are consistently honored and closed.'
        : rating === 'good'
        ? 'Most commitments are managed; some overdue items remain.'
        : 'Commitment follow-through needs attention — several items are overdue or unresolved.',
      evidence: [
        `${completed} of ${total} commitments completed (${rate}%)`,
        overdueCommits.length > 0 ? `${overdueCommits.length} commitments past due` : 'No overdue commitments',
      ],
    }
  },

  getDecisionConsistency(data: PersonalData): ConsistencyDimension {
    const open = data.decisions.filter((d) => d.status === 'open')
    const stale = open.filter((d) => daysSince(d.createdAt) > 14)
    const decided = data.decisions.filter((d) => d.status === 'decided').length
    const total = data.decisions.length
    const rate = total > 0 ? Math.round((decided / total) * 100) : 0

    let rating: ConsistencyRating
    if (stale.length === 0 && rate >= 60) rating = 'excellent'
    else if (stale.length <= 2) rating = 'good'
    else rating = 'needs_attention'

    return {
      label: 'Decision Resolution',
      rating,
      description: rating === 'excellent'
        ? 'Decisions are being resolved consistently.'
        : rating === 'good'
        ? 'Decisions are generally resolved; a few are aging.'
        : 'Multiple stale decisions indicate a decision resolution gap.',
      evidence: [
        `${decided} of ${total} decisions resolved (${rate}%)`,
        stale.length > 0 ? `${stale.length} decisions open longer than 14 days` : 'No stale open decisions',
      ],
    }
  },

  getReflectionConsistency(data: PersonalData): ConsistencyDimension {
    const total = data.reflections.length
    const lastReflection = data.reflections[0]
    const daysSinceReflection = lastReflection ? daysSince(lastReflection.createdAt) : 999

    let rating: ConsistencyRating
    if (daysSinceReflection <= 3 && total >= 5) rating = 'excellent'
    else if (daysSinceReflection <= 7) rating = 'good'
    else rating = 'needs_attention'

    return {
      label: 'Reflection Cadence',
      rating,
      description: rating === 'excellent'
        ? 'Reflection is a consistent part of the operational cycle.'
        : rating === 'good'
        ? 'Reflections are occurring, though not on a daily cadence.'
        : 'Reflection cadence has lapsed. Regular reflection improves execution quality.',
      evidence: [
        `${total} total reflections recorded`,
        lastReflection
          ? `Last reflection: ${daysSinceReflection} day${daysSinceReflection !== 1 ? 's' : ''} ago`
          : 'No reflections recorded',
      ],
    }
  },

  getBackupConsistency(data: PersonalData): ConsistencyDimension {
    const backupEvent = lastEventOfType(data.timeline, 'backup')
    const daysSinceBackup = backupEvent ? daysSince(backupEvent.createdAt) : 999

    let rating: ConsistencyRating
    if (daysSinceBackup < 7) rating = 'excellent'
    else if (daysSinceBackup < 30) rating = 'good'
    else rating = 'needs_attention'

    return {
      label: 'Vault Backup',
      rating,
      description: rating === 'excellent'
        ? 'Vault is being backed up regularly.'
        : rating === 'good'
        ? 'Vault has a recent backup; consider increasing frequency.'
        : 'No recent backup detected. Operator data is at risk if browser storage is cleared.',
      evidence: [
        backupEvent
          ? `Last backup: ${daysSinceBackup} day${daysSinceBackup !== 1 ? 's' : ''} ago`
          : 'No backup events found in timeline',
      ],
    }
  },

  getRecoveryConsistency(data: PersonalData): ConsistencyDimension {
    const recoveryEvent = data.timeline.find(
      (e) => e.type === 'recovery' || e.title.toLowerCase().includes('recovery test')
    )

    const rating: ConsistencyRating = recoveryEvent ? 'excellent' : 'needs_attention'
    return {
      label: 'Recovery Verification',
      rating,
      description: rating === 'excellent'
        ? 'Recovery has been tested. Vault restoration is verified.'
        : 'Recovery has never been tested. A backup is only useful if recovery works.',
      evidence: [
        recoveryEvent ? `Recovery test recorded on ${recoveryEvent.createdAt.slice(0, 10)}` : 'No recovery test found in timeline',
      ],
    }
  },
}
