/**
 * Phase 3 cognitive contract, consent, identity, and authority types.
 *
 * These types define the safety and data foundation for Rosie's cognitive
 * personalization layer. No signal capture, analysis, or persistence is
 * permitted before the operator explicitly enables cognition consent.
 *
 * Build 013: foundation types only.
 * Adaptive behavior, cloud synchronization, and external connectors are
 * NOT authorized in this build.
 */

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

/** Categories of operator-authored data Rosie may use for cognition. */
export type CognitionDataCategory =
  | 'priorities'
  | 'commitments'
  | 'decisions'
  | 'reflections'
  | 'review_history'
  | 'understanding_history'
  | 'missions'
  | 'recommendation_outcomes'
  | 'preferences'

/** Application surfaces that may use operator-confirmed understandings. */
export type CognitionFeatureSurface =
  | 'briefing'
  | 'review'
  | 'missions'
  | 'recommendations'
  | 'understanding_dashboard'
  // Build 014 additional surfaces
  | 'rosie_recommendations'
  | 'review_center'
  | 'morning_brief'
  | 'evening_summary'
  | 'mission_planning'

/** Recorded action on the operator's cognition consent. */
export type CognitionConsentAction =
  | 'enabled'
  | 'disabled'
  | 'revoked'
  | 'reset'
  | 'updated'

/** Immutable audit record for a single consent state change. */
export type CognitionConsentAuditEvent = {
  id: string
  action: CognitionConsentAction
  timestamp: string
  detail: string
}

/**
 * Operator's explicit cognition consent record.
 * Defaults to status:'off'. No cognitive signal capture before status:'on'.
 */
export type CognitionConsent = {
  /** Whether cognition is currently active. */
  status: 'off' | 'on' | 'revoked'
  /** Consent schema version. Increment when consent structure changes. */
  version: string
  /** Plain-language purpose statement shown to the operator at grant time. */
  purpose: string
  /** ISO timestamp when status was last set to 'on'. */
  grantedAt?: string
  /** ISO timestamp of the most recent consent state change. */
  updatedAt: string
  /** ISO timestamp when consent was revoked (sets status to 'revoked'). */
  revokedAt?: string
  /** Operator-permitted data categories. */
  permittedDataCategories: CognitionDataCategory[]
  /** Operator-permitted application surfaces. */
  permittedFeatureSurfaces: CognitionFeatureSurface[]
  /** Append-only audit history of all consent state changes. */
  auditHistory: CognitionConsentAuditEvent[]
}

// ---------------------------------------------------------------------------
// Understanding contract
// ---------------------------------------------------------------------------

/** Lifecycle state of a persisted operator understanding. */
export type UnderstandingContractState =
  | 'observed'
  | 'proposed'
  | 'operator_confirmed'
  | 'operator_corrected'
  | 'operator_rejected'
  | 'expired'

/** Provenance record that every understanding must carry. */
export type UnderstandingProvenance = {
  /** Identifier of the deterministic rule that produced this understanding. */
  ruleId: string
  /** Semver string of the rule at generation time. */
  ruleVersion: string
  /** Human-readable labels of evidence categories used. */
  evidenceTypes: string[]
  /** ISO timestamp of generation. */
  generatedAt: string
  /** Description of the data source (e.g. 'local_vault'). */
  dataSource: 'local_vault'
}

/** Single correction applied by the operator to an understanding statement. */
export type UnderstandingCorrection = {
  id: string
  /** ISO timestamp of the correction. */
  timestamp: string
  /** Statement before the operator's correction. */
  originalStatement: string
  /** Operator-supplied corrected statement. */
  correctedStatement: string
  /** Optional operator-supplied reason. */
  reason?: string
}

/**
 * Persisted operator understanding derived from local encrypted records.
 *
 * Only 'operator_confirmed' understandings may influence personalization.
 * 'proposed' understandings may be displayed for review but must not
 * silently change system behavior.
 */
export type OperatorUnderstanding = {
  id: string
  /** Plain-language description of what Rosie observed. */
  statement: string
  /** IDs of the local vault records that provided evidence. */
  evidenceIds: string[]
  /** Deterministic rule identifier (mirrors provenance.ruleId). */
  ruleId: string
  /** Semver string of the rule version (mirrors provenance.ruleVersion). */
  ruleVersion: string
  createdAt: string
  updatedAt: string
  /**
   * Plain-language explanation of how confidence was derived
   * (e.g., 'Based on 7 consistent observations over 14 days').
   */
  confidenceBasis: string
  state: UnderstandingContractState
  correctionHistory: UnderstandingCorrection[]
  /** Surfaces that are permitted to use this understanding if confirmed. */
  permittedFeatureUses: CognitionFeatureSurface[]
  /** ISO timestamp after which this understanding returns to 'proposed'. */
  expiresAt?: string
  /** ISO timestamp when expiry was applied. */
  expiredAt?: string
  /** Full provenance record required for validation. */
  provenance: UnderstandingProvenance
}

// ---------------------------------------------------------------------------
// Future cloud sync consent declaration (not implemented in Build 013)
// ---------------------------------------------------------------------------

/**
 * Declaration that the operator has been offered cloud sync consent.
 * Status defaults to 'not_offered'. Synchronization is NOT implemented
 * in Build 013.
 */
export type CloudSyncConsentDeclaration = {
  status: 'not_offered' | 'declined' | 'enabled' | 'revoked'
  offeredAt?: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Future connector consent declarations (not implemented in Build 013)
// ---------------------------------------------------------------------------

/** Permission level for a single connector action type. */
export type ConnectorPermissionLevel =
  | 'never'
  | 'view'
  | 'search'
  | 'summarize'
  | 'recommend'
  | 'prepare'
  | 'execute_with_approval'
  | 'execute_within_rule'

/** Permission grant for one data/action class within a connector. */
export type ConnectorPermissionGrant = {
  dataClass: string
  actionClass: string
  level: ConnectorPermissionLevel
  grantedAt: string
  expiresAt?: string
}

/**
 * Per-connector consent declaration.
 * Status defaults to 'not_offered'. Connectors are NOT implemented in Build 013.
 */
export type ConnectorConsentDeclaration = {
  connectorId: string
  connectorName: string
  status: 'not_offered' | 'declined' | 'enabled' | 'revoked'
  offeredAt?: string
  enabledAt?: string
  revokedAt?: string
  updatedAt: string
  permissionGrants: ConnectorPermissionGrant[]
  auditHistory: CognitionConsentAuditEvent[]
}

// ---------------------------------------------------------------------------
// Phase 3 consent state (top-level container in PersonalData)
// ---------------------------------------------------------------------------

/**
 * All Phase 3 consent declarations in one container.
 * Every field defaults to the most restrictive safe state.
 */
export type Phase3ConsentState = {
  cognitionConsent: CognitionConsent
  cloudSyncConsentDeclaration: CloudSyncConsentDeclaration
  connectorConsentDeclarations: ConnectorConsentDeclaration[]
}

// ---------------------------------------------------------------------------
// Build 014: Cognitive Signal types
// ---------------------------------------------------------------------------

/**
 * Permitted deterministic signal types.
 * Prohibited inference types (emotion, health, personality, etc.) are not listed
 * and must never be added without explicit architecture review.
 */
export type CognitiveSignalType =
  | 'repeated_decision_reopening'
  | 'overdue_commitment_recurrence'
  | 'recommendation_response_pattern'
  | 'mission_completion_sequence'
  | 'review_timing_preference'
  | 'summary_vs_detail_preference'
  | 'preferred_evidence_depth'

/** Lifecycle status of a cognitive signal. */
export type CognitiveSignalStatus = 'observed' | 'proposed' | 'suppressed' | 'expired'

/** Audit action types for a cognitive signal. */
export type CognitiveSignalAuditAction =
  | 'analysis_initiated'
  | 'analysis_blocked'
  | 'proposed'
  | 'updated'
  | 'suppressed'
  | 'expired'
  | 'rejected'
  | 'duplicate_prevented'

/** Immutable audit record for a cognitive signal state change. */
export type CognitiveSignalAuditEvent = {
  id: string
  action: CognitiveSignalAuditAction
  timestamp: string
  detail: string
}

/**
 * A deterministic cognitive signal produced by the CognitiveSignalEngine.
 *
 * Signals are proposed (not confirmed). They must not change system behavior.
 * Only future operator-confirmed understandings (Build 015) may personalize.
 *
 * Every signal must carry full provenance. Signals missing provenance are invalid.
 */
export type CognitiveSignal = {
  /** Unique signal identifier. */
  id: string
  /** Type of cognitive pattern detected. */
  signalType: CognitiveSignalType
  /** Plain-language description of what Rosie observed. */
  plainLanguageStatement: string
  /** Primary data category used for this signal. */
  dataCategory: CognitionDataCategory
  /** IDs of vault records used as evidence (no raw values). */
  evidenceIds: string[]
  /** Count of evidence items observed. */
  evidenceCount: number
  /** ID of the deterministic rule that produced this signal. */
  deterministicRuleId: string
  /** Semver of the rule version at analysis time. */
  deterministicRuleVersion: string
  /** Plain-language explanation of the confidence basis. */
  confidenceBasis: string
  createdAt: string
  updatedAt: string
  /** ISO start of the observation window used. */
  observationWindowStart: string
  /** ISO end of the observation window (analysis time). */
  observationWindowEnd: string
  /** Feature surfaces permitted to display this signal (if confirmed). */
  permittedFeatureUses: CognitionFeatureSurface[]
  /** Full provenance record required for validation. */
  provenance: CognitiveSignalProvenance
  status: CognitiveSignalStatus
  /** ISO expiry timestamp — signal returns to observed/expires after this date. */
  expiresAt?: string
  /** ISO timestamp when signal was expired. */
  expiredAt?: string
  /** ISO timestamp when signal was suppressed. */
  suppressedAt?: string
  /** Stable deterministic signature used for deduplication. */
  signature: string
  /** Append-only audit history. */
  auditHistory: CognitiveSignalAuditEvent[]
}

/** Provenance record for a cognitive signal. */
export type CognitiveSignalProvenance = {
  deterministicRuleId: string
  ruleVersion: string
  /** IDs of vault records used as evidence. */
  evidenceIds: string[]
  analysisTimestamp: string
  observationWindowStart: string
  observationWindowEnd: string
}

/**
 * Definition of a versioned deterministic rule.
 * Every rule must be explicitly registered. Unknown versions must not execute.
 */
export type DeterministicRule = {
  ruleId: string
  ruleVersion: string
  purpose: string
  permittedInputCategories: CognitionDataCategory[]
  minimumEvidenceCount: number
  /** Days to look back when gathering evidence. */
  observationWindowDays: number
  outputSignalType: CognitiveSignalType
  /** Days until an emitted signal expires (undefined = no automatic expiry). */
  expirationDays?: number
  permittedFeatureSurfaces: CognitionFeatureSurface[]
  /** Template for the plain-language statement. Use {count} and {detail} placeholders. */
  plainLanguageTemplate: string
  /** Plain-language description of what this rule must NOT infer. */
  prohibitedInferenceNote: string
}
