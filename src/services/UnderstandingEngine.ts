/**
 * UnderstandingEngine — orchestrates all sub-engines and produces
 * a deterministic OperatorUnderstanding from encrypted vault data.
 *
 * Rules:
 * - No AI, no ML, no probabilistic inference.
 * - Every summary statement includes evidence.
 * - All data derived from operator-supplied encrypted records only.
 */

import type { PersonalData } from '../localData'
import { BehaviorEngine } from './BehaviorEngine'
import { PatternEngine } from './PatternEngine'
import { TrendEngine } from './TrendEngine'
import { ConsistencyEngine } from './ConsistencyEngine'
import { OperationalDriftEngine } from './OperationalDriftEngine'
import type { BehaviorReport } from './BehaviorEngine'
import type { PatternReport } from './PatternEngine'
import type { TrendReport } from './TrendEngine'
import type { ConsistencyReport } from './ConsistencyEngine'
import type { DriftReport } from './OperationalDriftEngine'

export type OperatorUnderstanding = {
  behavior: BehaviorReport
  patterns: PatternReport
  trends: TrendReport
  consistency: ConsistencyReport
  drift: DriftReport
  summary: string[]
  statistics: UnderstandingStatistics
  generatedAt: string
}

export type UnderstandingStatistics = {
  mostCommonPattern: string | null
  longestCompletionStreak: number
  longestReflectionStreak: number
  avgDecisionAgeDays: number | null
  avgPriorityLifetimeDays: number | null
  avgCommitmentLifetimeDays: number | null
  recommendationCompletionRate: number
}

const MS_PER_DAY = 86_400_000

export const UnderstandingEngine = {
  /**
   * Analyze all vault data and produce a complete OperatorUnderstanding.
   */
  analyze(data: PersonalData): OperatorUnderstanding {
    const behavior    = BehaviorEngine.analyze(data)
    const patterns    = PatternEngine.analyze(data)
    const trends      = TrendEngine.analyze(data)
    const consistency = ConsistencyEngine.analyze(data)
    const drift       = OperationalDriftEngine.analyze(data)
    const statistics  = UnderstandingEngine.computeStatistics(data, behavior, patterns)
    const summary     = UnderstandingEngine.generateSummary(behavior, patterns, trends, consistency, drift)

    return { behavior, patterns, trends, consistency, drift, summary, statistics, generatedAt: new Date().toISOString() }
  },

  /**
   * Generate plain-language understanding summary.
   * Every statement is derived from evidence — never invented.
   */
  generateSummary(
    behavior: BehaviorReport,
    patterns: PatternReport,
    trends: TrendReport,
    consistency: ConsistencyReport,
    drift: DriftReport,
  ): string[] {
    const lines: string[] = []

    // Execution frequency
    const { prioritiesCompletedLast30Days, avgDaysToCompletePriority } = behavior.executionFrequency
    if (prioritiesCompletedLast30Days > 0) {
      lines.push(`You completed ${prioritiesCompletedLast30Days} priorit${prioritiesCompletedLast30Days !== 1 ? 'ies' : 'y'} in the last 30 days.`)
    }
    if (avgDaysToCompletePriority !== null) {
      lines.push(`On average, priorities are completed within ${avgDaysToCompletePriority} days of creation.`)
    }

    // Completion rate
    const { priorityCompletionPercent, commitmentCompletionPercent } = behavior.completionRate
    if (priorityCompletionPercent >= 70) {
      lines.push(`Priority completion rate is ${priorityCompletionPercent}% — a strong execution record.`)
    } else if (priorityCompletionPercent > 0) {
      lines.push(`Priority completion rate is ${priorityCompletionPercent}%. There is room to improve execution follow-through.`)
    }
    if (commitmentCompletionPercent >= 60) {
      lines.push(`Commitment completion has reached ${commitmentCompletionPercent}%.`)
    }

    // Decision aging
    if (behavior.decisionAging.avgAgeDays !== null && behavior.decisionAging.avgAgeDays > 14) {
      lines.push(`Open decision age averages ${behavior.decisionAging.avgAgeDays} days — decisions are aging without resolution.`)
    }

    // Reflection streak
    if (patterns.reflectionStreak.current >= 3) {
      lines.push(`An active reflection streak of ${patterns.reflectionStreak.current} days is in progress.`)
    }

    // Trend: reflection frequency
    if (trends.reflectionFrequency.direction === 'decreasing') {
      lines.push(`Reflection frequency has decreased compared to the prior period (${trends.reflectionFrequency.priorValue} → ${trends.reflectionFrequency.recentValue}).`)
    } else if (trends.reflectionFrequency.direction === 'increasing') {
      lines.push(`Reflection frequency has increased — ${trends.reflectionFrequency.recentValue} reflections in the last 30 days.`)
    }

    // Trend: completion rate
    if (trends.completionRate.direction === 'decreasing') {
      lines.push(`Priority completion rate has declined compared to the prior 30-day period.`)
    } else if (trends.completionRate.direction === 'increasing') {
      lines.push(`Priority completion rate has improved compared to the prior 30-day period.`)
    }

    // Consistency summary
    if (consistency.overall === 'excellent') {
      lines.push(`Overall operational consistency is excellent across all dimensions.`)
    } else if (consistency.overall === 'needs_attention') {
      const dims = Object.values(consistency)
        .filter((d): d is import('./ConsistencyEngine').ConsistencyDimension => typeof d === 'object' && 'label' in d && d.rating === 'needs_attention')
        .map((d) => d.label)
      if (dims.length > 0) lines.push(`Consistency needs attention in: ${dims.join(', ')}.`)
    }

    // Operational drift
    if (drift.hasCritical) {
      lines.push(`Critical operational drift detected. Immediate attention is required.`)
    } else if (drift.hasWarnings) {
      lines.push(`${drift.signals.filter((s) => s.severity === 'warning').length} drift warning${drift.signals.length !== 1 ? 's' : ''} detected. Review recommended.`)
    } else if (drift.isClean) {
      lines.push(`No operational drift detected. Operational state is within normal parameters.`)
    }

    // Repeated successes
    if (patterns.repeatedSuccesses.length > 0) {
      lines.push(...patterns.repeatedSuccesses)
    }

    return lines
  },

  /**
   * Compute summary statistics for the Statistics panel.
   */
  computeStatistics(
    data: PersonalData,
    behavior: BehaviorReport,
    patterns: PatternReport,
  ): UnderstandingStatistics {
    // Most common reflection theme
    const mostCommonPattern = patterns.reflectionThemes[0]?.keyword ?? null

    // Avg priority lifetime (creation to completion)
    const completedWithDuration = data.priorities
      .filter((p) => p.completed && p.completedAt)
      .map((p) => (new Date(p.completedAt!).getTime() - new Date(p.createdAt).getTime()) / MS_PER_DAY)
      .filter((d) => d >= 0)
    const avgPriorityLifetimeDays = completedWithDuration.length > 0
      ? parseFloat((completedWithDuration.reduce((a, b) => a + b, 0) / completedWithDuration.length).toFixed(1))
      : null

    // Avg commitment lifetime (creation to completion)
    const completedCommits = data.commitments
      .filter((c) => c.status === 'complete')
      .map((c) => (Date.now() - new Date(c.createdAt).getTime()) / MS_PER_DAY)
      .filter((d) => d >= 0)
    const avgCommitmentLifetimeDays = completedCommits.length > 0
      ? parseFloat((completedCommits.reduce((a, b) => a + b, 0) / completedCommits.length).toFixed(1))
      : null

    // Recommendation completion rate (dismissed = acted on or deliberately skipped)
    const recs = data.recommendations ?? []
    const dismissed = recs.filter((r) => r.dismissed).length
    const recCompletionRate = recs.length > 0 ? Math.round((dismissed / recs.length) * 100) : 0

    return {
      mostCommonPattern,
      longestCompletionStreak: patterns.completionStreak.longest,
      longestReflectionStreak: patterns.reflectionStreak.longest,
      avgDecisionAgeDays: behavior.decisionAging.avgAgeDays,
      avgPriorityLifetimeDays,
      avgCommitmentLifetimeDays,
      recommendationCompletionRate: recCompletionRate,
    }
  },
}
