import { useMemo } from 'react'
import type { PersonalData, RosieRecommendation } from '../localData'
import { createId } from '../localData'
import { RosieEngine } from '../services/RosieEngine'

export type SnoozeOption = { label: string; days: number }

export const SNOOZE_OPTIONS: SnoozeOption[] = [
  { label: 'Tomorrow', days: 1 },
  { label: '3 Days', days: 3 },
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
]

export type UseRecommendationsReturn = {
  active: RosieRecommendation[]
  patterns: string[]
  count: number
  criticalCount: number
}

export function useRecommendations(data: PersonalData | null): UseRecommendationsReturn {
  return useMemo(() => {
    if (!data) return { active: [], patterns: [], count: 0, criticalCount: 0 }
    const active = RosieEngine.generateRecommendations(data)
    const patterns = RosieEngine.detectPatterns(data)
    return {
      active,
      patterns,
      count: active.length,
      criticalCount: active.filter((r) => r.severity === 'critical').length,
    }
  }, [data])
}

/** Build a dismissed recommendation record to persist in data.recommendations */
export function buildDismissed(original: RosieRecommendation): RosieRecommendation {
  return { ...original, dismissed: true }
}

/** Build a snoozed recommendation record with future date */
export function buildSnoozed(original: RosieRecommendation, days: number): RosieRecommendation {
  const until = new Date(Date.now() + days * 86_400_000).toISOString()
  return { ...original, snoozedUntil: until, dismissed: false }
}
