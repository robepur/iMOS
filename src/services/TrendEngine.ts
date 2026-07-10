/**
 * TrendEngine — measures direction of change across operational dimensions.
 * Compares recent window (last 30 days) against prior window (31–90 days).
 * Returns Increasing | Stable | Decreasing with evidence.
 */

import type { PersonalData } from '../localData'

export type TrendDirection = 'increasing' | 'stable' | 'decreasing'

export type TrendMetric = {
  dimension: string
  direction: TrendDirection
  recentValue: number
  priorValue: number
  change: number
  evidence: string[]
}

export type TrendReport = {
  priorityLoad: TrendMetric
  commitmentLoad: TrendMetric
  decisionLoad: TrendMetric
  reflectionFrequency: TrendMetric
  recommendationVolume: TrendMetric
  completionRate: TrendMetric
}

const MS_PER_DAY = 86_400_000

function cutoff(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * MS_PER_DAY).toISOString()
}

function direction(recent: number, prior: number): TrendDirection {
  if (prior === 0 && recent === 0) return 'stable'
  if (prior === 0) return 'increasing'
  const delta = (recent - prior) / prior
  if (delta > 0.15) return 'increasing'
  if (delta < -0.15) return 'decreasing'
  return 'stable'
}

function mkMetric(dimension: string, recent: number, prior: number, unit: string): TrendMetric {
  const dir = direction(recent, prior)
  const change = prior > 0 ? Math.round(((recent - prior) / prior) * 100) : 0
  const evidence = [
    `Last 30 days: ${recent} ${unit}`,
    `Prior 30–90 days: ${prior} ${unit}`,
    dir === 'stable' ? 'No significant change' : `${Math.abs(change)}% ${dir === 'increasing' ? 'increase' : 'decrease'}`,
  ]
  return { dimension, direction: dir, recentValue: recent, priorValue: prior, change, evidence }
}

export const TrendEngine = {
  analyze(data: PersonalData): TrendReport {
    const c30  = cutoff(30)
    const c60  = cutoff(60)
    const c90  = cutoff(90)

    // Priority load: new priorities created per window
    const priorityRecent = data.priorities.filter((p) => p.createdAt >= c30).length
    const priorityPrior  = data.priorities.filter((p) => p.createdAt >= c60 && p.createdAt < c30).length

    // Commitment load: new commitments per window
    const commitRecent = data.commitments.filter((c) => c.createdAt >= c30).length
    const commitPrior  = data.commitments.filter((c) => c.createdAt >= c60 && c.createdAt < c30).length

    // Decision load: new decisions per window
    const decisionRecent = data.decisions.filter((d) => d.createdAt >= c30).length
    const decisionPrior  = data.decisions.filter((d) => d.createdAt >= c60 && d.createdAt < c30).length

    // Reflection frequency: reflections per window
    const reflRecent = data.reflections.filter((r) => r.createdAt >= c30).length
    const reflPrior  = data.reflections.filter((r) => r.createdAt >= c60 && r.createdAt < c30).length

    // Recommendation volume: recs generated per window (from timeline events)
    const recRecent = (data.recommendations ?? []).filter((r) => r.createdAt >= c30).length
    const recPrior  = (data.recommendations ?? []).filter((r) => r.createdAt >= c60 && r.createdAt < c30).length

    // Completion rate trend: ratio of completed priorities per window
    const compRecent = data.priorities.filter((p) => p.completed && p.completedAt && p.completedAt >= c30).length
    const compPrior  = data.priorities.filter((p) => p.completed && p.completedAt && p.completedAt >= c60 && p.completedAt < c30).length
    const compRateRecent = priorityRecent > 0 ? Math.round((compRecent / Math.max(priorityRecent, 1)) * 100) : 0
    const compRatePrior  = priorityPrior  > 0 ? Math.round((compPrior  / Math.max(priorityPrior, 1)) * 100) : 0

    return {
      priorityLoad:      mkMetric('Priority Load', priorityRecent, priorityPrior, 'priorities created'),
      commitmentLoad:    mkMetric('Commitment Load', commitRecent, commitPrior, 'commitments created'),
      decisionLoad:      mkMetric('Decision Load', decisionRecent, decisionPrior, 'decisions created'),
      reflectionFrequency: mkMetric('Reflection Frequency', reflRecent, reflPrior, 'reflections'),
      recommendationVolume: mkMetric('Recommendation Volume', recRecent, recPrior, 'recommendations'),
      completionRate:    mkMetric('Completion Rate', compRateRecent, compRatePrior, '% completion ratio'),
    }
  },
}
