/**
 * RosieEngine — deterministic operator intelligence.
 *
 * Rules:
 * - No AI, no inference, no external services.
 * - Every output is derived from existing operator-supplied data.
 * - Rosie never invents memory or context.
 * - All methods are pure functions or depend only on PersonalData.
 */

import type { PersonalData, Priority, ReviewPeriod, RosieMemoryItem } from '../localData'
import { getRosieMemory } from '../localData'
import { isInPeriod, isOverdue } from '../utils/date'

export const RosieEngine = {
  /**
   * Time-aware greeting. Derived from system clock only.
   */
  getGreeting(): string {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  },

  /**
   * Primary priority recommendation. Returns a message based on the
   * operator's own data. Never invented.
   */
  getRecommendation(primary?: Priority): string {
    if (!primary) return 'No primary priority is set. Open the Priority Console to select your next mission.'
    return `I recommend beginning with ${primary.title}. ${primary.why}`
  },

  /**
   * Rosie memory items, derived from reflection "remember" fields.
   * Capped at LIMITS.ROSIE_MEMORY_ITEMS. Never invents memory.
   */
  getMemory(data: PersonalData, period?: ReviewPeriod): RosieMemoryItem[] {
    return getRosieMemory(data, period)
  },

  /**
   * Executive summary — a deterministic list of accomplishment strings
   * derived from the operator's encrypted records for a given period.
   */
  getExecutiveSummary(data: PersonalData, period: ReviewPeriod): string[] {
    const commitments = data.commitments.filter((c) => isInPeriod(c.createdAt, period))
    const decisions = data.decisions.filter((d) => isInPeriod(d.createdAt, period))
    const reflections = data.reflections.filter((r) => isInPeriod(r.createdAt, period))
    const priorities = data.priorities.filter((p) => isInPeriod(p.createdAt, period))

    const completedCommitments = commitments.filter((c) => c.status === 'complete').length
    const decidedDecisions = decisions.filter((d) => d.status === 'decided').length
    const activePriorities = priorities.filter((p) => !p.completed)
    const criticalOverdue = activePriorities.filter((p) => p.level === 'critical' && isOverdue(p.due)).length

    const lines: string[] = []
    if (completedCommitments > 0) lines.push(`Completed ${completedCommitments} commitment${completedCommitments !== 1 ? 's' : ''}`)
    if (decidedDecisions > 0) lines.push(`Resolved ${decidedDecisions} decision${decidedDecisions !== 1 ? 's' : ''}`)
    if (commitments.length > 0) lines.push(`Captured ${commitments.length} commitment${commitments.length !== 1 ? 's' : ''}`)
    if (reflections.length > 0) lines.push(`Completed ${reflections.length} reflection${reflections.length !== 1 ? 's' : ''}`)
    if (criticalOverdue > 0) lines.push(`Outstanding ${criticalOverdue} critical priorit${criticalOverdue !== 1 ? 'ies' : 'y'}`)
    return lines
  },

  /**
   * Short executive brief line shown in sidebar or arrivals.
   */
  getBriefLine(data: PersonalData): string {
    const active = data.priorities.filter((p) => !p.completed)
    const open = data.commitments.filter((c) => c.status === 'open').length
    const critical = active.filter((p) => p.level === 'critical').length
    if (critical > 0) return `${critical} critical priorit${critical !== 1 ? 'ies' : 'y'} require attention.`
    if (active.length > 0) return `${active.length} active priorit${active.length !== 1 ? 'ies' : 'y'}. ${open} open commitment${open !== 1 ? 's' : ''}.`
    return 'All priorities resolved. Capture what comes next.'
  },
}
