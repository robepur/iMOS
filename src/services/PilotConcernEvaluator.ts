import type { PilotConcern, PilotMeasurementSummary, PilotSession } from '../types/operatorPilot'

type ConcernInput = {
  readonly securityConcern: boolean
  readonly suspectedDataLoss: boolean
  readonly recoveryFailure: boolean
}

export class PilotConcernEvaluator {
  static evaluate(
    session: PilotSession,
    summary: PilotMeasurementSummary,
    input: ConcernInput,
  ): { concerns: PilotConcern[]; shouldPause: boolean; shouldRequireReview: boolean } {
    const now = new Date().toISOString()
    const concerns: PilotConcern[] = []

    if (input.securityConcern) {
      concerns.push({
        id: `pilot-concern:${crypto.randomUUID()}`,
        sessionId: session.id,
        type: 'critical_security',
        severity: 'critical',
        message: 'Critical security concern detected. Pilot must pause.',
        evidence: ['critical_security_flag=true'],
        createdAt: now,
      })
    }

    if (input.suspectedDataLoss) {
      concerns.push({
        id: `pilot-concern:${crypto.randomUUID()}`,
        sessionId: session.id,
        type: 'suspected_data_loss',
        severity: 'critical',
        message: 'Suspected vault data loss detected. Pilot must pause.',
        evidence: ['suspected_data_loss_flag=true'],
        createdAt: now,
      })
    }

    if (input.recoveryFailure) {
      concerns.push({
        id: `pilot-concern:${crypto.randomUUID()}`,
        sessionId: session.id,
        type: 'recovery_failure',
        severity: 'high',
        message: 'Recovery failure detected. Review is required.',
        evidence: ['recovery_failure_flag=true'],
        createdAt: now,
      })
    }

    if (!summary.backupReady) {
      concerns.push({
        id: `pilot-concern:${crypto.randomUUID()}`,
        sessionId: session.id,
        type: 'backup_not_ready',
        severity: 'high',
        message: 'Backup is not ready.',
        evidence: ['backup_ready=false'],
        createdAt: now,
      })
    }

    if (summary.trustConcernReports >= 3) {
      concerns.push({
        id: `pilot-concern:${crypto.randomUUID()}`,
        sessionId: session.id,
        type: 'repeated_trust_concern',
        severity: 'high',
        message: 'Repeated trust concerns detected.',
        evidence: [`trust_concern_reports=${summary.trustConcernReports}`],
        createdAt: now,
      })
    }

    const shouldPause = concerns.some((c) => c.type === 'critical_security' || c.type === 'suspected_data_loss')
    const shouldRequireReview = concerns.some((c) => c.type === 'recovery_failure' || c.type === 'repeated_trust_concern')
    return { concerns, shouldPause, shouldRequireReview }
  }
}
