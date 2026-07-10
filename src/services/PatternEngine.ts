/**
 * PatternEngine — detects repeated observable behaviors over time.
 * No prediction. No inference. Only what has actually happened.
 */

import type { PersonalData, Priority, Reflection, RosieRecommendation } from '../localData'

export type PatternReport = {
  completionStreak: Streak
  reflectionStreak: Streak
  repeatedRecommendationDismissals: RepeatedDismissal[]
  reflectionThemes: ReflectionTheme[]
  repeatedSuccesses: string[]
  repeatedFailures: string[]
}

export type Streak = {
  current: number
  longest: number
  unit: 'days'
  evidence: string[]
}

export type RepeatedDismissal = {
  category: string
  count: number
  evidence: string
}

export type ReflectionTheme = {
  keyword: string
  occurrences: number
  examples: string[]
}

const MS_PER_DAY = 86_400_000

function dateStr(iso: string): string {
  return iso.slice(0, 10)
}

export const PatternEngine = {
  analyze(data: PersonalData): PatternReport {
    return {
      completionStreak: PatternEngine.getCompletionStreak(data.priorities),
      reflectionStreak: PatternEngine.getReflectionStreak(data.reflections),
      repeatedRecommendationDismissals: PatternEngine.getRepeatedDismissals(data.recommendations ?? []),
      reflectionThemes: PatternEngine.getReflectionThemes(data.reflections),
      repeatedSuccesses: PatternEngine.detectRepeatedSuccesses(data.priorities),
      repeatedFailures: PatternEngine.detectRepeatedFailures(data.priorities),
    }
  },

  getCompletionStreak(priorities: Priority[]): Streak {
    const completedDays = new Set(
      priorities
        .filter((p) => p.completed && p.completedAt)
        .map((p) => dateStr(p.completedAt!))
    )

    if (completedDays.size === 0) {
      return { current: 0, longest: 0, unit: 'days', evidence: ['No priorities completed yet'] }
    }

    const sorted = Array.from(completedDays).sort().reverse()
    let current = 0
    const today = dateStr(new Date().toISOString())
    const yesterday = dateStr(new Date(Date.now() - MS_PER_DAY).toISOString())

    if (sorted[0] === today || sorted[0] === yesterday) {
      let prev = new Date(sorted[0])
      for (const d of sorted) {
        const diff = Math.round((prev.getTime() - new Date(d).getTime()) / MS_PER_DAY)
        if (diff <= 1) { current++; prev = new Date(d) }
        else break
      }
    }

    // Longest streak
    let longest = 0, run = 1
    for (let i = 1; i < sorted.length; i++) {
      const gap = Math.round((new Date(sorted[i - 1]).getTime() - new Date(sorted[i]).getTime()) / MS_PER_DAY)
      if (gap === 1) { run++; if (run > longest) longest = run }
      else run = 1
    }
    if (run > longest) longest = run

    return {
      current, longest: Math.max(current, longest), unit: 'days',
      evidence: [
        `${completedDays.size} distinct days with a priority completed`,
        current > 0 ? `Current streak: ${current} day${current !== 1 ? 's' : ''}` : 'No active streak',
        longest > 1 ? `Longest streak: ${longest} days` : '',
      ].filter(Boolean),
    }
  },

  getReflectionStreak(reflections: Reflection[]): Streak {
    const days = new Set(reflections.map((r) => dateStr(r.createdAt)))
    if (days.size === 0) {
      return { current: 0, longest: 0, unit: 'days', evidence: ['No reflections recorded yet'] }
    }

    const sorted = Array.from(days).sort().reverse()
    let current = 0
    const today = dateStr(new Date().toISOString())
    const yesterday = dateStr(new Date(Date.now() - MS_PER_DAY).toISOString())

    if (sorted[0] === today || sorted[0] === yesterday) {
      let prev = new Date(sorted[0])
      for (const d of sorted) {
        const gap = Math.round((prev.getTime() - new Date(d).getTime()) / MS_PER_DAY)
        if (gap <= 1) { current++; prev = new Date(d) }
        else break
      }
    }

    let longest = 0, run = 1
    for (let i = 1; i < sorted.length; i++) {
      const gap = Math.round((new Date(sorted[i - 1]).getTime() - new Date(sorted[i]).getTime()) / MS_PER_DAY)
      if (gap === 1) { run++; if (run > longest) longest = run }
      else run = 1
    }
    if (run > longest) longest = run

    return {
      current, longest: Math.max(current, longest), unit: 'days',
      evidence: [
        `${reflections.length} total reflections across ${days.size} days`,
        current > 0 ? `Current reflection streak: ${current} day${current !== 1 ? 's' : ''}` : 'No active reflection streak',
      ].filter(Boolean),
    }
  },

  getRepeatedDismissals(recommendations: RosieRecommendation[]): RepeatedDismissal[] {
    const dismissed = recommendations.filter((r) => r.dismissed)
    const byCategory = new Map<string, number>()
    for (const r of dismissed) {
      byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1)
    }
    return Array.from(byCategory.entries())
      .filter(([, count]) => count >= 2)
      .map(([category, count]) => ({
        category, count,
        evidence: `${count} "${category}" recommendations have been dismissed`,
      }))
      .sort((a, b) => b.count - a.count)
  },

  getReflectionThemes(reflections: Reflection[]): ReflectionTheme[] {
    if (reflections.length < 2) return []
    const freq = new Map<string, string[]>()

    for (const r of reflections) {
      const text = `${r.accomplished} ${r.remember} ${r.tomorrow}`
      const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 5)
      const seen = new Set<string>()
      for (const w of words) {
        if (!seen.has(w)) {
          seen.add(w)
          const arr = freq.get(w) ?? []
          arr.push(r.createdAt.slice(0, 10))
          freq.set(w, arr)
        }
      }
    }

    // Common stop words to filter
    const stopWords = new Set(['should', 'could', 'would', 'today', 'tomorrow', 'complete', 'completed', 'finish', 'finished', 'working', 'review', 'continue'])
    return Array.from(freq.entries())
      .filter(([w, dates]) => dates.length >= 2 && !stopWords.has(w))
      .map(([keyword, examples]) => ({ keyword, occurrences: examples.length, examples: examples.slice(0, 3) }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 10)
  },

  detectRepeatedSuccesses(priorities: Priority[]): string[] {
    const completed = priorities.filter((p) => p.completed && p.completedAt && p.due)
    const onTime = completed.filter((p) => new Date(p.completedAt!) <= new Date(p.due))
    if (onTime.length >= 3) {
      return [`${onTime.length} of ${completed.length} time-boxed priorities were completed on or before their due date`]
    }
    return []
  },

  detectRepeatedFailures(priorities: Priority[]): string[] {
    const failures: string[] = []
    const overdue = priorities.filter((p) => !p.completed && p.due && new Date(p.due) < new Date(new Date().toDateString()))
    if (overdue.length >= 3) {
      failures.push(`${overdue.length} priorities are overdue simultaneously — a recurring pattern`)
    }
    const critical = overdue.filter((p) => p.level === 'critical')
    if (critical.length > 0) {
      failures.push(`${critical.length} critical priorit${critical.length !== 1 ? 'ies' : 'y'} overdue — consistent execution gap`)
    }
    return failures
  },
}
