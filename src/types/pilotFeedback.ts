/**
 * Pilot feedback types for Build 024 MVP Release Candidate.
 *
 * All feedback is stored in the local encrypted vault only.
 * Feedback is never transmitted externally.
 * Feedback can be edited or deleted by the operator.
 * Feedback does not rank or score the operator.
 * Feedback does not automatically change Rosie's behaviour.
 */

export type PilotFeedbackSchemaVersion = '1.0.0'
export const PILOT_FEEDBACK_SCHEMA_VERSION: PilotFeedbackSchemaVersion = '1.0.0'

/** Rosie surfaces that can be associated with a feedback entry. */
export type PilotRosieSurface =
  | 'daily_briefing'
  | 'recommendation'
  | 'morning_brief'
  | 'evening_summary'
  | 'priority_advice'
  | 'commitment_advice'
  | 'decision_advice'
  | 'mission_planning'
  | 'review_center'
  | 'understanding_review'
  | 'general'

export const PILOT_ROSIE_SURFACES: readonly PilotRosieSurface[] = [
  'daily_briefing',
  'recommendation',
  'morning_brief',
  'evening_summary',
  'priority_advice',
  'commitment_advice',
  'decision_advice',
  'mission_planning',
  'review_center',
  'understanding_review',
  'general',
]

export type PilotRating = 1 | 2 | 3 | 4 | 5

export type PilotFeedbackEntry = {
  readonly id: string
  readonly schemaVersion: PilotFeedbackSchemaVersion
  readonly rosieSurface: PilotRosieSurface
  /** How useful was this Rosie output? 1 = not useful, 5 = very useful */
  readonly usefulness: PilotRating
  /** How much cognitive effort was required? 1 = minimal, 5 = significant */
  readonly cognitiveEffort: PilotRating
  readonly incorrectAssumption: boolean
  readonly missingContext: boolean
  readonly trustConcern: boolean
  readonly freeformComment?: string
  readonly createdAt: string
  readonly updatedAt: string
}

/** Computed pilot measurements — private, local, never used to rank the operator. */
export type PilotMeasurements = {
  readonly briefingUsefulness: number | null
  readonly recommendationUsefulness: number | null
  readonly averageCognitiveEffort: number | null
  readonly correctionCount: number
  readonly rejectedRecommendationCount: number
  readonly acceptedRecommendationCount: number
  readonly missingContextReports: number
  readonly trustConcernReports: number
  readonly dailyWorkflowCompletions: number
  readonly backupReady: boolean
  readonly totalFeedbackEntries: number
}

export function isSafePilotFeedbackEntry(value: unknown): value is PilotFeedbackEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  if (v.schemaVersion !== PILOT_FEEDBACK_SCHEMA_VERSION) return false
  if (typeof v.id !== 'string' || v.id.length === 0 || v.id.length > 128) return false
  if (!PILOT_ROSIE_SURFACES.includes(v.rosieSurface as PilotRosieSurface)) return false
  if (![1, 2, 3, 4, 5].includes(v.usefulness as number)) return false
  if (![1, 2, 3, 4, 5].includes(v.cognitiveEffort as number)) return false
  if (typeof v.incorrectAssumption !== 'boolean') return false
  if (typeof v.missingContext !== 'boolean') return false
  if (typeof v.trustConcern !== 'boolean') return false
  if (v.freeformComment !== undefined && (typeof v.freeformComment !== 'string' || v.freeformComment.length > 2000)) return false
  if (typeof v.createdAt !== 'string') return false
  if (typeof v.updatedAt !== 'string') return false
  return true
}
