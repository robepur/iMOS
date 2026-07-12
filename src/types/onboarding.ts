/**
 * Onboarding state types for Build 024 MVP Release Candidate.
 *
 * Onboarding is stored entirely in the local encrypted vault.
 * No onboarding data is transmitted externally.
 * Onboarding can be paused, resumed, and reviewed later.
 */

export type OnboardingSchemaVersion = '1.0.0'
export const ONBOARDING_SCHEMA_VERSION: OnboardingSchemaVersion = '1.0.0'

export const ONBOARDING_TOTAL_STEPS = 12

export type OnboardingStepId =
  | 'what_is_imos'
  | 'rosie_role'
  | 'operator_control'
  | 'vault_protection'
  | 'vault_ready'
  | 'recovery_backup'
  | 'recovery_confirmed'
  | 'daily_briefing'
  | 'features_overview'
  | 'rosie_corrections'
  | 'sync_optional'
  | 'complete'

export const ONBOARDING_STEPS: readonly OnboardingStepId[] = [
  'what_is_imos',
  'rosie_role',
  'operator_control',
  'vault_protection',
  'vault_ready',
  'recovery_backup',
  'recovery_confirmed',
  'daily_briefing',
  'features_overview',
  'rosie_corrections',
  'sync_optional',
  'complete',
]

export type OnboardingStatus =
  | 'not_started'
  | 'in_progress'
  | 'paused'
  | 'completed'

export type OnboardingState = {
  readonly schemaVersion: OnboardingSchemaVersion
  readonly status: OnboardingStatus
  /** Index into ONBOARDING_STEPS */
  readonly currentStepIndex: number
  readonly completedStepIds: readonly OnboardingStepId[]
  /** Operator must confirm recovery backup before onboarding can complete. */
  readonly recoveryBackupConfirmed: boolean
  readonly startedAt: string
  readonly completedAt?: string
  readonly lastUpdatedAt: string
}

export function createDefaultOnboardingState(now = new Date()): OnboardingState {
  const ts = now.toISOString()
  return {
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    status: 'not_started',
    currentStepIndex: 0,
    completedStepIds: [],
    recoveryBackupConfirmed: false,
    startedAt: ts,
    lastUpdatedAt: ts,
  }
}

export function isSafeOnboardingState(value: unknown): value is OnboardingState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  if (v.schemaVersion !== ONBOARDING_SCHEMA_VERSION) return false
  if (!['not_started', 'in_progress', 'paused', 'completed'].includes(String(v.status))) return false
  if (typeof v.currentStepIndex !== 'number' || v.currentStepIndex < 0 || v.currentStepIndex > ONBOARDING_TOTAL_STEPS) return false
  if (!Array.isArray(v.completedStepIds)) return false
  if (typeof v.recoveryBackupConfirmed !== 'boolean') return false
  if (typeof v.startedAt !== 'string') return false
  if (typeof v.lastUpdatedAt !== 'string') return false
  return true
}
