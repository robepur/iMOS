/**
 * RosieEngine — deterministic operator intelligence.
 *
 * Rules:
 * - No AI, no inference, no external services.
 * - Every output is derived from existing operator-supplied data.
 * - Rosie never invents memory or context.
 * - All methods are pure functions or depend only on PersonalData.
 */

import type { PersonalData, Priority, ReviewPeriod, RosieMemoryItem, RosieRecommendation } from '../localData'
import { getRosieMemory } from '../localData'
import { isInPeriod, isOverdue } from '../utils/date'

// Thresholds
const DECISION_STALE_DAYS = 14
const REFLECTION_GAP_DAYS = 7
const BACKUP_GAP_DAYS = 30
const PRIORITY_OVERLOAD = 6
const COMMITMENT_OVERLOAD = 10
const MAX_RECOMMENDATIONS = 5

function recId(rule: string, targetId: string): string {
  return `rec-${rule}-${targetId}`
}

function confidence(evidenceCount: number): 'high' | 'medium' | 'low' {
  if (evidenceCount >= 3) return 'high'
  if (evidenceCount >= 2) return 'medium'
  return 'low'
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000)
}

function isActive(id: string, stored: RosieRecommendation[]): boolean {
  const match = stored.find((s) => s.id === id)
  if (!match) return true
  if (match.dismissed) return false
  if (match.snoozedUntil && new Date(match.snoozedUntil) > new Date()) return false
  return true
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 }

export type MorningBriefData = {
  priorities: Priority[]
  criticalWork: Priority[]
  overdueCommitments: { id: string; title: string; due: string }[]
  openDecisions: { id: string; title: string }[]
}

export type EveningSummaryData = {
  completedPriorities: string[]
  completedCommitments: string[]
  decisionsMade: string[]
  reflectionNeeded: boolean
}

export type HealthSignalLevel = 'green' | 'amber' | 'red'

export type HealthSignals = {
  priorityLoad: HealthSignalLevel
  commitmentLoad: HealthSignalLevel
  decisionLoad: HealthSignalLevel
  reflectionFrequency: HealthSignalLevel
  backupHealth: HealthSignalLevel
  recoveryHealth: HealthSignalLevel
}

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

  /**
   * Generate the active recommendation list for this session.
   * Filters out dismissed or currently-snoozed recommendations.
   * Capped at MAX_RECOMMENDATIONS, sorted by severity.
   */
  generateRecommendations(data: PersonalData): RosieRecommendation[] {
    const stored = data.recommendations ?? []
    const now = new Date().toISOString()
    const recs: RosieRecommendation[] = []
    const active = data.priorities.filter((p) => !p.completed)
    const today = new Date().toDateString()

    // Rule: No primary priority
    if (active.length > 0 && !active.some((p) => p.primary)) {
      const id = recId('no-primary', 'global')
      if (isActive(id, stored)) {
        recs.push({
          id, category: 'priority', severity: 'high', confidence: confidence(active.length),
          title: 'No primary priority selected',
          explanation: 'Rosie detected no primary priority. Without a primary focus, work is diffuse and mission execution is at risk.',
          evidence: [`${active.length} active priorit${active.length !== 1 ? 'ies' : 'y'} with none marked primary`],
          recommendedAction: 'Open the Priority Console and designate one priority as primary.',
          createdAt: now, dismissed: false,
        })
      }
    }

    // Rule: Critical priority overdue
    for (const p of active.filter((p) => p.level === 'critical' && isOverdue(p.due))) {
      const id = recId('critical-overdue', p.id)
      if (isActive(id, stored)) {
        const daysPast = Math.floor((Date.now() - new Date(p.due).getTime()) / 86_400_000)
        recs.push({
          id, category: 'priority', severity: 'critical', confidence: 'high',
          title: `Critical priority overdue: ${p.title}`,
          explanation: `The critical priority "${p.title}" passed its due date ${daysPast} day${daysPast !== 1 ? 's' : ''} ago with no completion recorded.`,
          evidence: [`Priority: ${p.title}`, `Due: ${p.due}`, `Level: critical`, `Status: active`],
          recommendedAction: `Complete "${p.title}" or update its due date to reflect current plans.`,
          createdAt: now, dismissed: false,
        })
      }
    }

    // Rule: Commitment overdue
    const overdueCommitments = data.commitments.filter((c) => c.status === 'open' && c.due && new Date(c.due) < new Date(today))
    for (const c of overdueCommitments) {
      const id = recId('commitment-overdue', c.id)
      if (isActive(id, stored)) {
        recs.push({
          id, category: 'commitment', severity: 'high', confidence: 'high',
          title: `Commitment overdue: ${c.title}`,
          explanation: `The commitment "${c.title}" was due ${c.due} and remains open.`,
          evidence: [`Commitment: ${c.title}`, `Due: ${c.due}`, `Status: open`],
          recommendedAction: `Complete or reschedule "${c.title}" today.`,
          createdAt: now, dismissed: false,
        })
      }
    }

    // Rule: Decision stale
    const staleDate = daysAgo(DECISION_STALE_DAYS)
    for (const d of data.decisions.filter((d) => d.status === 'open' && new Date(d.createdAt) < staleDate)) {
      const id = recId('decision-stale', d.id)
      if (isActive(id, stored)) {
        const days = Math.floor((Date.now() - new Date(d.createdAt).getTime()) / 86_400_000)
        recs.push({
          id, category: 'decision', severity: 'high', confidence: confidence(2),
          title: `Decision unresolved for ${days} days: ${d.title}`,
          explanation: `The decision "${d.title}" has remained open for ${days} days. Unresolved decisions create execution risk.`,
          evidence: [`Decision: ${d.title}`, `Created: ${new Date(d.createdAt).toLocaleDateString()}`, `Status: open for ${days} days`],
          recommendedAction: `Decide on "${d.title}" or close it if no longer relevant.`,
          createdAt: now, dismissed: false,
        })
      }
    }

    // Rule: No recent reflection
    const lastReflection = data.reflections[0]
    const reflectionGap = daysAgo(REFLECTION_GAP_DAYS)
    if (!lastReflection || new Date(lastReflection.createdAt) < reflectionGap) {
      const id = recId('no-reflection', 'global')
      if (isActive(id, stored)) {
        const daysSince = lastReflection
          ? Math.floor((Date.now() - new Date(lastReflection.createdAt).getTime()) / 86_400_000)
          : null
        recs.push({
          id, category: 'reflection', severity: 'normal', confidence: 'high',
          title: 'No executive reflection in recent sessions',
          explanation: daysSince
            ? `The last reflection was ${daysSince} days ago. Regular reflection improves execution quality and captures Rosie memory.`
            : 'No reflections have been recorded. Reflection closes the loop and builds Rosie memory.',
          evidence: daysSince ? [`Last reflection: ${daysSince} days ago`] : ['No reflections recorded'],
          recommendedAction: 'Complete a session and record an executive reflection.',
          createdAt: now, dismissed: false,
        })
      }
    }

    // Rule: No backup recently
    const backupDate = daysAgo(BACKUP_GAP_DAYS)
    const lastBackup = data.timeline.find((e) => e.type === 'system' && e.title.toLowerCase().includes('backup'))
    if (!lastBackup || new Date(lastBackup.createdAt) < backupDate) {
      const id = recId('no-backup', 'global')
      if (isActive(id, stored)) {
        recs.push({
          id, category: 'security', severity: 'high', confidence: 'high',
          title: 'No vault backup in the last 30 days',
          explanation: 'Without a recent backup, encrypted operator data is at risk if the browser storage is cleared.',
          evidence: lastBackup
            ? [`Last backup: ${new Date(lastBackup.createdAt).toLocaleDateString()}`]
            : ['No backup events found in timeline'],
          recommendedAction: 'Open VAULT and create an encrypted backup now.',
          createdAt: now, dismissed: false,
        })
      }
    }

    // Rule: Recovery never tested
    const recoveryTest = data.timeline.find((e) => (e.type === 'recovery') || (e.type === 'system' && e.title.toLowerCase().includes('recovery test')))
    if (!recoveryTest) {
      const id = recId('no-recovery-test', 'global')
      if (isActive(id, stored)) {
        recs.push({
          id, category: 'security', severity: 'normal', confidence: 'high',
          title: 'Recovery has never been tested',
          explanation: 'A backup is only useful if recovery works. No recovery test has been recorded.',
          evidence: ['No recovery test events found in timeline'],
          recommendedAction: 'Open VAULT → RECOVERY and run a recovery test against your backup.',
          createdAt: now, dismissed: false,
        })
      }
    }

    // Rule: Priority overload
    if (active.length >= PRIORITY_OVERLOAD) {
      const id = recId('priority-overload', 'global')
      if (isActive(id, stored)) {
        recs.push({
          id, category: 'priority', severity: 'normal', confidence: confidence(active.length),
          title: `${active.length} active priorities may diffuse focus`,
          explanation: `Rosie detected ${active.length} active priorities. Maintaining focus across too many priorities reduces completion rate.`,
          evidence: [`${active.length} active priorities in the system`],
          recommendedAction: 'Review priorities and complete, defer, or remove those that are not current mission-critical.',
          createdAt: now, dismissed: false,
        })
      }
    }

    // Rule: Commitment overload
    const openCommitments = data.commitments.filter((c) => c.status === 'open').length
    if (openCommitments >= COMMITMENT_OVERLOAD) {
      const id = recId('commitment-overload', 'global')
      if (isActive(id, stored)) {
        recs.push({
          id, category: 'commitment', severity: 'normal', confidence: confidence(openCommitments),
          title: `${openCommitments} open commitments require attention`,
          explanation: `A large open commitment backlog signals over-commitment or incomplete execution tracking.`,
          evidence: [`${openCommitments} open commitments`],
          recommendedAction: 'Review open commitments. Complete overdue ones and close stale ones.',
          createdAt: now, dismissed: false,
        })
      }
    }

    // Rule: Cross-reference reflection "remember" with incomplete priorities
    for (const r of data.reflections.slice(0, 5)) {
      if (!r.remember.trim()) continue
      const remember = r.remember.toLowerCase()
      for (const p of active) {
        const titleWords = p.title.toLowerCase().split(/\s+/).filter((w) => w.length > 4)
        const match = titleWords.some((w) => remember.includes(w))
        if (match) {
          const id = recId('memory-priority-link', `${r.id}-${p.id}`)
          if (isActive(id, stored)) {
            recs.push({
              id, category: 'priority', severity: 'normal', confidence: 'medium',
              title: `Reflection memory linked to incomplete priority: ${p.title}`,
              explanation: `A reflection from ${new Date(r.createdAt).toLocaleDateString()} asked Rosie to remember context related to "${p.title}", which remains incomplete.`,
              evidence: [
                `Reflection from ${new Date(r.createdAt).toLocaleDateString()}: "${r.remember.slice(0, 80)}"`,
                `Priority "${p.title}" is still active`,
              ],
              recommendedAction: `Review "${p.title}" in light of this reflection context.`,
              createdAt: now, dismissed: false,
            })
          }
        }
      }
    }

    return recs
      .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4))
      .slice(0, MAX_RECOMMENDATIONS)
  },

  /**
   * Detect observable patterns across operator history.
   * Never predicts — only reports what is measurable.
   */
  detectPatterns(data: PersonalData): string[] {
    const patterns: string[] = []

    // Repeated overdue commitments
    const overdueCount = data.commitments.filter((c) => c.status === 'open' && c.due && new Date(c.due) < new Date(new Date().toDateString())).length
    if (overdueCount >= 3) patterns.push(`${overdueCount} commitments are overdue simultaneously — a recurring pattern.`)

    // Declining completion rate
    const recent = data.priorities.filter((p) => p.createdAt > daysAgo(30).toISOString())
    const completedRecent = recent.filter((p) => p.completed).length
    const total = data.priorities.length
    const totalCompleted = data.priorities.filter((p) => p.completed).length
    const overallRate = total > 0 ? totalCompleted / total : 0
    const recentRate = recent.length > 0 ? completedRecent / recent.length : 0
    if (recent.length >= 3 && recentRate < overallRate - 0.2) {
      patterns.push('Priority completion rate has declined in the last 30 days compared to all-time.')
    }

    // Reflection gap
    if (data.reflections.length >= 3) {
      const gaps = data.reflections.slice(0, 5).map((r, i, arr) =>
        i < arr.length - 1 ? new Date(arr[i].createdAt).getTime() - new Date(arr[i + 1].createdAt).getTime() : null
      ).filter((g): g is number => g !== null)
      const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length / 86_400_000
      if (avgGap > REFLECTION_GAP_DAYS * 2) patterns.push(`Average time between reflections is ${Math.round(avgGap)} days — reflection cadence is low.`)
    }

    return patterns
  },

  /**
   * Morning brief: forward-looking summary for the operator's session.
   */
  getMorningBrief(data: PersonalData): MorningBriefData {
    const today = new Date().toDateString()
    return {
      priorities: data.priorities.filter((p) => !p.completed).slice(0, 5),
      criticalWork: data.priorities.filter((p) => !p.completed && p.level === 'critical'),
      overdueCommitments: data.commitments
        .filter((c) => c.status === 'open' && c.due && new Date(c.due) < new Date(today))
        .map((c) => ({ id: c.id, title: c.title, due: c.due })),
      openDecisions: data.decisions
        .filter((d) => d.status === 'open')
        .slice(0, 5)
        .map((d) => ({ id: d.id, title: d.title })),
    }
  },

  /**
   * Evening summary: backward-looking close-of-session summary.
   */
  getEveningSummary(data: PersonalData): EveningSummaryData {
    const todayStart = new Date(new Date().toDateString()).toISOString()
    return {
      completedPriorities: data.priorities
        .filter((p) => p.completed && p.completedAt && p.completedAt >= todayStart)
        .map((p) => p.title),
      completedCommitments: data.commitments
        .filter((c) => c.status === 'complete')
        .slice(0, 5)
        .map((c) => c.title),
      decisionsMade: data.decisions
        .filter((d) => d.status === 'decided')
        .slice(0, 5)
        .map((d) => d.title),
      reflectionNeeded: !data.reflections[0] || new Date(data.reflections[0].createdAt) < new Date(new Date().toDateString()),
    }
  },

  /**
   * Health signals — visual indicators derived from observable metrics.
   * No diagnosis. No scoring. Just observable states.
   */
  getHealthSignals(data: PersonalData): HealthSignals {
    const active = data.priorities.filter((p) => !p.completed).length
    const openC = data.commitments.filter((c) => c.status === 'open').length
    const openD = data.decisions.filter((d) => d.status === 'open').length
    const lastReflection = data.reflections[0]
    const lastBackup = data.timeline.find((e) => e.type === 'system' && e.title.toLowerCase().includes('backup'))
    const recoveryTested = data.timeline.some((e) => e.type === 'recovery' || (e.type === 'system' && e.title.toLowerCase().includes('recovery test')))
    const daysSinceReflection = lastReflection ? (Date.now() - new Date(lastReflection.createdAt).getTime()) / 86_400_000 : 999
    const daysSinceBackup = lastBackup ? (Date.now() - new Date(lastBackup.createdAt).getTime()) / 86_400_000 : 999

    return {
      priorityLoad: active === 0 ? 'green' : active < PRIORITY_OVERLOAD ? 'amber' : 'red',
      commitmentLoad: openC < 5 ? 'green' : openC < COMMITMENT_OVERLOAD ? 'amber' : 'red',
      decisionLoad: openD === 0 ? 'green' : openD < 5 ? 'amber' : 'red',
      reflectionFrequency: daysSinceReflection < 3 ? 'green' : daysSinceReflection < REFLECTION_GAP_DAYS ? 'amber' : 'red',
      backupHealth: daysSinceBackup < 7 ? 'green' : daysSinceBackup < BACKUP_GAP_DAYS ? 'amber' : 'red',
      recoveryHealth: recoveryTested ? 'green' : 'red',
    }
  },
}
