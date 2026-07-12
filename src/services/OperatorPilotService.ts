import type {
  PilotAuditEvent,
  PilotCheckIn,
  PilotCompletionVerdict,
  PilotConcern,
  PilotDayRecord,
  PilotSession,
} from '../types/operatorPilot'
import { OPERATOR_PILOT_SCHEMA_VERSION } from '../types/operatorPilot'
import type { PersonalData } from '../localData'

type VaultState = 'setup' | 'locked' | 'unlocked'

export class OperatorPilotService {
  static canActivate(data: PersonalData | null, vaultState: VaultState): { ok: boolean; reason?: string } {
    if (!data) return { ok: false, reason: 'Vault data unavailable.' }
    if (vaultState !== 'unlocked') return { ok: false, reason: 'Vault must be unlocked.' }
    if (!data.onboardingState || data.onboardingState.status !== 'completed') return { ok: false, reason: 'Onboarding must be completed.' }
    if (!data.onboardingState.recoveryBackupConfirmed) return { ok: false, reason: 'Recovery backup must be confirmed.' }
    if (data.syncOperatorControlState?.enabled) return { ok: false, reason: 'Synchronization must remain optional and disabled by default.' }
    return { ok: true }
  }

  static createReadySession(durationDays = 30): PilotSession {
    const clamped = Number.isInteger(durationDays) && durationDays >= 14 ? durationDays : 30
    const now = new Date().toISOString()
    return {
      id: `pilot-session:${crypto.randomUUID()}`,
      schemaVersion: OPERATOR_PILOT_SCHEMA_VERSION,
      status: 'ready',
      recommendedDurationDays: 30,
      minimumDurationDays: 14,
      selectedDurationDays: clamped,
      acknowledgedPurpose: false,
      acknowledgedLocalMeasurement: false,
      localOnlyConfirmed: true,
      synchronizationDisabledByDefault: true,
      lastUpdatedAt: now,
      dayCount: 0,
      remainingDays: clamped,
    }
  }

  static startPilot(session: PilotSession): PilotSession {
    const now = new Date().toISOString()
    return {
      ...session,
      status: 'active',
      startedAt: session.startedAt ?? now,
      resumedAt: now,
      pausedAt: undefined,
      lastUpdatedAt: now,
    }
  }

  static pausePilot(session: PilotSession): PilotSession {
    const now = new Date().toISOString()
    return { ...session, status: 'paused', pausedAt: now, lastUpdatedAt: now }
  }

  static resumePilot(session: PilotSession): PilotSession {
    const now = new Date().toISOString()
    return { ...session, status: 'active', resumedAt: now, pausedAt: undefined, lastUpdatedAt: now }
  }

  static extendPilot(session: PilotSession, extraDays: number): PilotSession {
    const safeExtra = Number.isInteger(extraDays) && extraDays > 0 ? extraDays : 0
    const now = new Date().toISOString()
    return {
      ...session,
      status: 'extended',
      selectedDurationDays: session.selectedDurationDays + safeExtra,
      remainingDays: session.remainingDays + safeExtra,
      extendedAt: now,
      lastUpdatedAt: now,
    }
  }

  static endEarly(session: PilotSession): PilotSession {
    const now = new Date().toISOString()
    return { ...session, status: 'ended_early', endedEarlyAt: now, lastUpdatedAt: now }
  }

  static complete(session: PilotSession): PilotSession {
    const now = new Date().toISOString()
    return { ...session, status: 'completed', completedAt: now, remainingDays: 0, lastUpdatedAt: now }
  }

  static markReviewRequired(session: PilotSession): PilotSession {
    return { ...session, status: 'review_required', lastUpdatedAt: new Date().toISOString() }
  }

  static markDeleted(session: PilotSession): PilotSession {
    const now = new Date().toISOString()
    return { ...session, status: 'deleted', deletedAt: now, lastUpdatedAt: now }
  }

  static appendDayRecord(
    records: PilotDayRecord[],
    session: PilotSession,
    input: Pick<PilotDayRecord, 'date' | 'workflowCompleted' | 'backupReady'>,
  ): { records: PilotDayRecord[]; session: PilotSession } {
    const dateKey = new Date(input.date).toISOString().slice(0, 10)
    const existing = records.find((r) => r.sessionId === session.id && r.date.slice(0, 10) === dateKey)
    if (existing) return { records, session }
    const nextRecord: PilotDayRecord = {
      id: `pilot-day:${crypto.randomUUID()}`,
      sessionId: session.id,
      dayNumber: records.filter((r) => r.sessionId === session.id).length + 1,
      date: new Date(input.date).toISOString(),
      workflowCompleted: input.workflowCompleted,
      backupReady: input.backupReady,
      createdAt: new Date().toISOString(),
    }
    const dayCount = session.dayCount + 1
    const remainingDays = Math.max(0, session.selectedDurationDays - dayCount)
    return {
      records: [...records, nextRecord],
      session: { ...session, dayCount, remainingDays, lastUpdatedAt: new Date().toISOString() },
    }
  }

  static createAudit(sessionId: string, action: PilotAuditEvent['action'], detail: string): PilotAuditEvent {
    return {
      id: `pilot-audit:${crypto.randomUUID()}`,
      sessionId,
      action,
      detail,
      createdAt: new Date().toISOString(),
    }
  }

  static buildExportPayload(
    session: PilotSession,
    records: PilotDayRecord[],
    checkIns: PilotCheckIn[],
    concerns: PilotConcern[],
    verdict: PilotCompletionVerdict,
  ): string {
    return JSON.stringify(
      {
        schemaVersion: OPERATOR_PILOT_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        session,
        records: records.filter((r) => r.sessionId === session.id),
        checkIns: checkIns.filter((r) => r.sessionId === session.id),
        concerns: concerns.filter((r) => r.sessionId === session.id),
        verdict,
      },
      null,
      2,
    )
  }
}
