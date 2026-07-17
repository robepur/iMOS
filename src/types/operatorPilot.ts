export type OperatorPilotSchemaVersion = '1.0.0'
export const OPERATOR_PILOT_SCHEMA_VERSION: OperatorPilotSchemaVersion = '1.0.0'

export type PilotStatus =
  | 'not_started'
  | 'ready'
  | 'active'
  | 'paused'
  | 'extended'
  | 'completed'
  | 'ended_early'
  | 'review_required'
  | 'deleted'

export type PilotCompletionVerdict =
  | 'continue_to_production_preparation'
  | 'extend_pilot'
  | 'pause_and_review'
  | 'rosie_refinement_required'
  | 'security_review_required'
  | 'recovery_review_required'

export type PilotConcernType =
  | 'critical_security'
  | 'suspected_data_loss'
  | 'repeated_trust_concern'
  | 'recovery_failure'
  | 'backup_not_ready'

export type PilotConcernSeverity = 'critical' | 'high' | 'normal'

export type PilotAuditAction =
  | 'pilot_created'
  | 'pilot_started'
  | 'pilot_paused'
  | 'pilot_resumed'
  | 'pilot_extended'
  | 'pilot_completed'
  | 'pilot_ended_early'
  | 'pilot_deleted'
  | 'pilot_checkin_saved'
  | 'pilot_exported'
  | 'pilot_concern_detected'

export type PilotSession = {
  readonly id: string
  readonly schemaVersion: OperatorPilotSchemaVersion
  readonly status: PilotStatus
  readonly recommendedDurationDays: 30
  readonly minimumDurationDays: 14
  readonly selectedDurationDays: number
  readonly acknowledgedPurpose: boolean
  readonly acknowledgedLocalMeasurement: boolean
  readonly localOnlyConfirmed: boolean
  readonly synchronizationDisabledByDefault: boolean
  readonly startedAt?: string
  readonly pausedAt?: string
  readonly resumedAt?: string
  readonly extendedAt?: string
  readonly completedAt?: string
  readonly endedEarlyAt?: string
  readonly deletedAt?: string
  readonly lastUpdatedAt: string
  readonly dayCount: number
  readonly remainingDays: number
}

export type PilotDayRecord = {
  readonly id: string
  readonly sessionId: string
  readonly dayNumber: number
  readonly date: string
  readonly workflowCompleted: boolean
  readonly backupReady: boolean
  readonly createdAt: string
}

export type PilotCheckIn = {
  readonly id: string
  readonly sessionId: string
  readonly dayNumber: number
  readonly date: string
  readonly briefingUsefulness: 1 | 2 | 3 | 4 | 5
  readonly recommendationUsefulness: 1 | 2 | 3 | 4 | 5
  readonly reasoningUnderstandable: boolean
  readonly missingContext: boolean
  readonly incorrectAssumption: boolean
  readonly reducedCognitiveEffort: boolean
  readonly improvedDecisionClarity: boolean
  readonly respectedOperatorAuthority: boolean
  readonly trustedRecommendationProcess: boolean
  readonly helpedAdvanceMission: boolean
  readonly cognitiveEffort: 1 | 2 | 3 | 4 | 5
  readonly acceptedRecommendations: number
  readonly rejectedRecommendations: number
  readonly operatorCorrections: number
  readonly comment?: string
  readonly createdAt: string
}

export type PilotConcern = {
  readonly id: string
  readonly sessionId: string
  readonly type: PilotConcernType
  readonly severity: PilotConcernSeverity
  readonly message: string
  readonly evidence: string[]
  readonly createdAt: string
  readonly resolvedAt?: string
}

export type PilotMeasurementSummary = {
  readonly sessionId: string
  readonly status: PilotStatus
  readonly activeDayCount: number
  readonly remainingDayCount: number
  readonly workflowCompletionTrend: number[]
  readonly briefingUsefulnessTrend: number[]
  readonly recommendationUsefulnessTrend: number[]
  readonly cognitiveEffortTrend: number[]
  readonly correctionCount: number
  readonly missingContextReports: number
  readonly trustConcernReports: number
  readonly acceptedRecommendations: number
  readonly rejectedRecommendations: number
  readonly unresolvedConcernCount: number
  readonly backupReady: boolean
}

export type PilotAuditEvent = {
  readonly id: string
  readonly sessionId: string
  readonly action: PilotAuditAction
  readonly detail: string
  readonly createdAt: string
}

function isIso(value: unknown): boolean {
  return typeof value === 'string' && value.length >= 20
}

export function isSafePilotSession(value: unknown): value is PilotSession {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  return (
    v.schemaVersion === OPERATOR_PILOT_SCHEMA_VERSION
    && typeof v.id === 'string'
    && typeof v.status === 'string'
    && typeof v.selectedDurationDays === 'number'
    && typeof v.acknowledgedPurpose === 'boolean'
    && typeof v.acknowledgedLocalMeasurement === 'boolean'
    && typeof v.localOnlyConfirmed === 'boolean'
    && typeof v.synchronizationDisabledByDefault === 'boolean'
    && isIso(v.lastUpdatedAt)
    && typeof v.dayCount === 'number'
    && typeof v.remainingDays === 'number'
  )
}

export function isSafePilotDayRecord(value: unknown): value is PilotDayRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string'
    && typeof v.sessionId === 'string'
    && typeof v.dayNumber === 'number'
    && isIso(v.date)
    && typeof v.workflowCompleted === 'boolean'
    && typeof v.backupReady === 'boolean'
    && isIso(v.createdAt)
  )
}

export function isSafePilotCheckIn(value: unknown): value is PilotCheckIn {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  const ratingOk = (n: unknown) => [1, 2, 3, 4, 5].includes(n as number)
  return (
    typeof v.id === 'string'
    && typeof v.sessionId === 'string'
    && typeof v.dayNumber === 'number'
    && isIso(v.date)
    && ratingOk(v.briefingUsefulness)
    && ratingOk(v.recommendationUsefulness)
    && ratingOk(v.cognitiveEffort)
    && typeof v.reasoningUnderstandable === 'boolean'
    && typeof v.missingContext === 'boolean'
    && typeof v.incorrectAssumption === 'boolean'
    && typeof v.reducedCognitiveEffort === 'boolean'
    && typeof v.improvedDecisionClarity === 'boolean'
    && typeof v.respectedOperatorAuthority === 'boolean'
    && typeof v.trustedRecommendationProcess === 'boolean'
    && typeof v.helpedAdvanceMission === 'boolean'
    && typeof v.acceptedRecommendations === 'number'
    && typeof v.rejectedRecommendations === 'number'
    && typeof v.operatorCorrections === 'number'
    && isIso(v.createdAt)
  )
}

export function isSafePilotConcern(value: unknown): value is PilotConcern {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string'
    && typeof v.sessionId === 'string'
    && typeof v.type === 'string'
    && typeof v.severity === 'string'
    && typeof v.message === 'string'
    && Array.isArray(v.evidence)
    && isIso(v.createdAt)
  )
}

export function isSafePilotAuditEvent(value: unknown): value is PilotAuditEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string'
    && typeof v.sessionId === 'string'
    && typeof v.action === 'string'
    && typeof v.detail === 'string'
    && isIso(v.createdAt)
  )
}
