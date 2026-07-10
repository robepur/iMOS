/**
 * OperationalDriftEngine — detects multi-factor operational drift.
 * Drift = sustained deviation from healthy operational norms.
 * Every detection cites specific evidence. Never guesses.
 */

import type { PersonalData } from '../localData'

export type DriftSeverity = 'critical' | 'warning' | 'info'

export type DriftSignal = {
  id: string
  title: string
  description: string
  severity: DriftSeverity
  evidence: string[]
  detectedAt: string
}

export type DriftReport = {
  signals: DriftSignal[]
  hasCritical: boolean
  hasWarnings: boolean
  isClean: boolean
}

const MS_PER_DAY = 86_400_000

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / MS_PER_DAY)
}

function cutoff(days: number): string {
  return new Date(Date.now() - days * MS_PER_DAY).toISOString()
}

export const OperationalDriftEngine = {
  analyze(data: PersonalData): DriftReport {
    const now = new Date().toISOString()
    const signals: DriftSignal[] = []
    const today = new Date().toDateString()

    // ── 1. Growing priority backlog ────────────────────────────────────────────
    const active = data.priorities.filter((p) => !p.completed)
    const overdue = active.filter((p) => p.due && new Date(p.due) < new Date(today))
    const recentCreated = data.priorities.filter((p) => p.createdAt >= cutoff(30)).length
    const recentCompleted = data.priorities.filter((p) => p.completed && p.completedAt && p.completedAt >= cutoff(30)).length
    if (recentCreated > recentCompleted + 3) {
      signals.push({
        id: 'drift-priority-backlog',
        title: 'Priority backlog is growing',
        description: `More priorities are being created than completed. The active backlog is expanding.`,
        severity: 'warning',
        evidence: [
          `${recentCreated} priorities created in last 30 days`,
          `${recentCompleted} priorities completed in last 30 days`,
          `Net backlog growth: +${recentCreated - recentCompleted}`,
        ],
        detectedAt: now,
      })
    }

    // ── 2. Repeated overdue priorities ────────────────────────────────────────
    if (overdue.length >= 3) {
      signals.push({
        id: 'drift-repeated-delays',
        title: 'Repeated priority delays',
        description: `${overdue.length} priorities are simultaneously overdue — a recurring execution gap.`,
        severity: overdue.some((p) => p.level === 'critical') ? 'critical' : 'warning',
        evidence: [
          `${overdue.length} overdue priorities`,
          ...overdue.slice(0, 3).map((p) => `"${p.title}" — overdue ${Math.floor((Date.now() - new Date(p.due).getTime()) / MS_PER_DAY)} days`),
        ],
        detectedAt: now,
      })
    }

    // ── 3. Increasing workload (commitments) ──────────────────────────────────
    const openCommitments = data.commitments.filter((c) => c.status === 'open')
    const old30 = openCommitments.filter((c) => daysSince(c.createdAt) > 30).length
    if (openCommitments.length >= 8 || old30 >= 3) {
      signals.push({
        id: 'drift-commitment-overload',
        title: 'Commitment workload accumulating',
        description: `Open commitments are accumulating without sufficient closure.`,
        severity: openCommitments.length >= 12 ? 'critical' : 'warning',
        evidence: [
          `${openCommitments.length} open commitments`,
          old30 > 0 ? `${old30} commitments open for more than 30 days` : '',
        ].filter(Boolean),
        detectedAt: now,
      })
    }

    // ── 4. Declining completion (compare recent vs prior) ─────────────────────
    const c30 = cutoff(30)
    const c60 = cutoff(60)
    const compRecent = data.priorities.filter((p) => p.completed && p.completedAt && p.completedAt >= c30).length
    const compPrior  = data.priorities.filter((p) => p.completed && p.completedAt && p.completedAt >= c60 && p.completedAt < c30).length
    if (compPrior > 0 && compRecent < compPrior * 0.5) {
      signals.push({
        id: 'drift-declining-completion',
        title: 'Priority completion rate declining',
        description: `Completion rate has dropped significantly compared to the prior 30-day period.`,
        severity: 'warning',
        evidence: [
          `Last 30 days: ${compRecent} priorities completed`,
          `Prior 30 days: ${compPrior} priorities completed`,
          `Decline: ${Math.round(((compPrior - compRecent) / compPrior) * 100)}%`,
        ],
        detectedAt: now,
      })
    }

    // ── 5. Recommendation accumulation ────────────────────────────────────────
    const recs = data.recommendations ?? []
    const activeRecs = recs.filter((r) => !r.dismissed && !(r.snoozedUntil && r.snoozedUntil > now))
    if (activeRecs.length >= 4) {
      signals.push({
        id: 'drift-recommendation-accumulation',
        title: 'Recommendations accumulating unaddressed',
        description: `${activeRecs.length} active recommendations are not being addressed.`,
        severity: activeRecs.some((r) => r.severity === 'critical') ? 'critical' : 'info',
        evidence: [
          `${activeRecs.length} active recommendations`,
          `${recs.filter((r) => r.dismissed).length} dismissed`,
          `${recs.filter((r) => r.snoozedUntil).length} snoozed`,
        ],
        detectedAt: now,
      })
    }

    // ── 6. Reflection decline ─────────────────────────────────────────────────
    const lastReflection = data.reflections[0]
    const daysSinceReflection = lastReflection ? daysSince(lastReflection.createdAt) : 999
    if (daysSinceReflection > 14) {
      signals.push({
        id: 'drift-reflection-decline',
        title: 'Reflection cadence has declined',
        description: `No reflection in ${daysSinceReflection} days. Reflection is a key component of the operational cycle.`,
        severity: daysSinceReflection > 30 ? 'critical' : 'warning',
        evidence: [
          lastReflection
            ? `Last reflection: ${daysSinceReflection} days ago (${lastReflection.createdAt.slice(0, 10)})`
            : 'No reflections recorded',
        ],
        detectedAt: now,
      })
    }

    // ── 7. Backup neglect ─────────────────────────────────────────────────────
    const backupEvent = data.timeline.find((e) => e.title.toLowerCase().includes('backup') || e.detail.toLowerCase().includes('backup'))
    const daysSinceBackup = backupEvent ? daysSince(backupEvent.createdAt) : 999
    if (daysSinceBackup > 30) {
      signals.push({
        id: 'drift-backup-neglect',
        title: 'Vault backup is overdue',
        description: `No backup in ${daysSinceBackup < 999 ? daysSinceBackup + ' days' : 'the recorded history'}. Encrypted data is at risk.`,
        severity: 'warning',
        evidence: [
          backupEvent ? `Last backup: ${daysSinceBackup} days ago` : 'No backup events in timeline',
        ],
        detectedAt: now,
      })
    }

    // ── 8. Recovery neglect ───────────────────────────────────────────────────
    const recoveryEvent = data.timeline.find((e) => e.type === 'recovery' || e.title.toLowerCase().includes('recovery test'))
    if (!recoveryEvent) {
      signals.push({
        id: 'drift-recovery-neglect',
        title: 'Recovery has never been tested',
        description: `Without a verified recovery test, vault restoration is unproven.`,
        severity: 'info',
        evidence: ['No recovery test events found in timeline'],
        detectedAt: now,
      })
    }

    // ── 9. Decision aging ─────────────────────────────────────────────────────
    const openDecisions = data.decisions.filter((d) => d.status === 'open')
    const staleDecisions = openDecisions.filter((d) => daysSince(d.createdAt) > 30)
    if (staleDecisions.length >= 2) {
      signals.push({
        id: 'drift-decision-aging',
        title: 'Decisions aging without resolution',
        description: `${staleDecisions.length} decisions have been open for more than 30 days.`,
        severity: 'warning',
        evidence: staleDecisions.slice(0, 3).map((d) => `"${d.title}" — open ${daysSince(d.createdAt)} days`),
        detectedAt: now,
      })
    }

    signals.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 }
      return order[a.severity] - order[b.severity]
    })

    return {
      signals,
      hasCritical: signals.some((s) => s.severity === 'critical'),
      hasWarnings: signals.some((s) => s.severity === 'warning'),
      isClean: signals.length === 0,
    }
  },
}
