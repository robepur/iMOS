/**
 * UnderstandingReviewService
 *
 * Build 015: Converts valid proposed cognitive signals into operator-reviewable
 * understandings and manages review lifecycle transitions.
 *
 * Security and authority:
 * - Consent and permissions are enforced on every mutation.
 * - Source signal + provenance + rule version validation is mandatory.
 * - Invalid operations fail closed and return unchanged records.
 * - Rejected evidence signatures block silent reappearance.
 */

import { createId } from '../localData'
import type {
  CognitiveSignal,
  CognitionConsent,
  CognitiveSignalStatus,
  OperatorUnderstanding,
  UnderstandingContractState,
  UnderstandingReviewAction,
  UnderstandingReviewEvent,
  UnderstandingCorrection,
} from '../types/cognitive'
import { getRuleById } from './CognitiveSignalRuleRegistry'
import { isCognitionEnabled, isDataCategoryPermitted, isFeatureSurfacePermitted } from './CognitionConsentService'

type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string }

type ReviewMutationResult = {
  understandings: OperatorUnderstanding[]
  rejectedSignatures: string[]
  reviewAudit: UnderstandingReviewEvent[]
}

const ALLOWED_TRANSITIONS: Record<UnderstandingContractState, UnderstandingContractState[]> = {
  observed: ['proposed'],
  proposed: ['operator_confirmed', 'operator_corrected', 'operator_rejected', 'expired'],
  operator_confirmed: ['operator_corrected', 'operator_rejected', 'expired'],
  operator_corrected: ['operator_confirmed', 'operator_rejected'],
  operator_rejected: [],
  expired: ['proposed'],
}

function buildMaterialEvidenceSignature(input: {
  ruleId: string
  ruleVersion: string
  signalType: string
  evidenceIds: string[]
 }): string {
  const evidence = [...input.evidenceIds].map(String).sort().join(',')
  // Rejection and duplicate identity intentionally excludes timestamps and
  // wording. Unchanged evidence must not reappear merely because a new
  // analysis window or generated sentence changed.
  return `${input.ruleId}|${input.ruleVersion}|${input.signalType}|${evidence}`
}

function appendEvent(
  list: UnderstandingReviewEvent[],
  action: UnderstandingReviewAction,
  detail: string,
  now: Date,
  actor: UnderstandingReviewEvent['actor'] = 'local_operator',
): UnderstandingReviewEvent[] {
  return [
    ...list,
    {
      id: createId('understanding-review'),
      action,
      timestamp: now.toISOString(),
      actor,
      detail,
    },
  ]
}

function isTransitionAllowed(from: UnderstandingContractState, to: UnderstandingContractState): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

function validateConsentForReview(consent: CognitionConsent | undefined): ValidationResult {
  if (!consent) return { valid: false, reason: 'Cognition consent missing.' }
  if (!isCognitionEnabled(consent)) return { valid: false, reason: 'Cognition consent is not enabled.' }
  if (!isFeatureSurfacePermitted(consent, 'understanding_dashboard')) {
    return { valid: false, reason: 'Understanding dashboard surface is not permitted by consent.' }
  }
  return { valid: true }
}

export function validateSourceSignal(
  signal: CognitiveSignal | undefined,
  consent: CognitionConsent | undefined,
): ValidationResult {
  if (!signal) return { valid: false, reason: 'Source signal missing.' }
  const consentValidation = validateConsentForReview(consent)
  if (!consentValidation.valid) return consentValidation
  if (signal.status !== 'proposed') return { valid: false, reason: `Signal status must be proposed. Got ${signal.status}.` }
  if (!Array.isArray(signal.evidenceIds) || signal.evidenceIds.length === 0) {
    return { valid: false, reason: 'Signal evidence is missing.' }
  }
  if (!signal.provenance || !signal.provenance.deterministicRuleId || !signal.provenance.ruleVersion) {
    return { valid: false, reason: 'Signal provenance is incomplete.' }
  }
  if (
    signal.provenance.deterministicRuleId !== signal.deterministicRuleId
    || signal.provenance.ruleVersion !== signal.deterministicRuleVersion
  ) {
    return { valid: false, reason: 'Signal provenance does not match its deterministic rule.' }
  }
  const evidence = [...signal.evidenceIds].map(String).sort()
  const provenanceEvidence = [...signal.provenance.evidenceIds].map(String).sort()
  if (signal.evidenceCount !== evidence.length || JSON.stringify(evidence) !== JSON.stringify(provenanceEvidence)) {
    return { valid: false, reason: 'Signal evidence and provenance are inconsistent.' }
  }
  if (!isDataCategoryPermitted(consent, signal.dataCategory)) {
    return { valid: false, reason: `Data category ${signal.dataCategory} is not permitted.` }
  }

  const rule = getRuleById(signal.deterministicRuleId, signal.deterministicRuleVersion)
  if (!rule) {
    return { valid: false, reason: `Unknown deterministic rule ${signal.deterministicRuleId}@${signal.deterministicRuleVersion}.` }
  }
  if (signal.evidenceCount < rule.minimumEvidenceCount) {
    return { valid: false, reason: `Insufficient evidence for rule threshold ${rule.minimumEvidenceCount}.` }
  }
  return { valid: true }
}

export function validateUnderstandingReview(
  understanding: OperatorUnderstanding | undefined,
  toState: UnderstandingContractState,
): ValidationResult {
  if (!understanding) return { valid: false, reason: 'Understanding missing.' }
  if (!isTransitionAllowed(understanding.state, toState)) {
    return { valid: false, reason: `Invalid transition ${understanding.state} -> ${toState}.` }
  }
  return { valid: true }
}

export function hasMateriallyNewEvidence(previous: OperatorUnderstanding, signal: CognitiveSignal): boolean {
  const prevEvidence = new Set(previous.evidenceIds.map(String))
  const nextEvidence = new Set(signal.evidenceIds.map(String))

  for (const id of nextEvidence) {
    if (!prevEvidence.has(id)) return true
  }

  if (previous.ruleVersion !== signal.deterministicRuleVersion) return true
  if (
    previous.provenance.generatedAt !== signal.provenance.analysisTimestamp
    && signal.evidenceIds.length > previous.evidenceIds.length
  ) {
    return true
  }

  // Reordered evidence, timestamp-only changes, and regenerated unchanged signals are not material.
  return false
}

export function deduplicateUnderstandings(understandings: OperatorUnderstanding[]): OperatorUnderstanding[] {
  const seen = new Set<string>()
  const deduped: OperatorUnderstanding[] = []
  for (const understanding of [...understandings].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (seen.has(understanding.materialEvidenceSignature)) continue
    seen.add(understanding.materialEvidenceSignature)
    deduped.push(understanding)
  }
  return deduped
}

export function createProposedUnderstanding(params: {
  signal: CognitiveSignal
  consent: CognitionConsent | undefined
  existingUnderstandings: OperatorUnderstanding[]
  rejectedSignatures: string[]
  reviewAudit: UnderstandingReviewEvent[]
  now?: Date
}): ReviewMutationResult {
  const now = params.now ?? new Date()
  const validation = validateSourceSignal(params.signal, params.consent)
  if (!validation.valid) {
    const audit = appendEvent(params.reviewAudit, 'blocked_by_consent', validation.reason, now, 'system')
    return {
      understandings: params.existingUnderstandings,
      rejectedSignatures: params.rejectedSignatures,
      reviewAudit: audit,
    }
  }

  const signature = buildMaterialEvidenceSignature({
    ruleId: params.signal.deterministicRuleId,
    ruleVersion: params.signal.deterministicRuleVersion,
    signalType: params.signal.signalType,
    evidenceIds: params.signal.evidenceIds,
  })

  if (params.rejectedSignatures.includes(signature)) {
    const blocked = appendEvent(
      params.reviewAudit,
      'reappearance_blocked',
      `Reappearance blocked for signature ${signature}.`,
      now,
      'system',
    )
    return {
      understandings: params.existingUnderstandings,
      rejectedSignatures: params.rejectedSignatures,
      reviewAudit: blocked,
    }
  }

  const equivalent = params.existingUnderstandings.find((u) => u.materialEvidenceSignature === signature)
  if (equivalent && equivalent.state !== 'expired') {
    return {
      understandings: params.existingUnderstandings,
      rejectedSignatures: params.rejectedSignatures,
      reviewAudit: appendEvent(params.reviewAudit, 'duplicate_prevented', 'Duplicate understanding prevented.', now, 'system'),
    }
  }

  if (equivalent && equivalent.state === 'expired' && !hasMateriallyNewEvidence(equivalent, params.signal)) {
    return {
      understandings: params.existingUnderstandings,
      rejectedSignatures: params.rejectedSignatures,
      reviewAudit: appendEvent(params.reviewAudit, 'reappearance_blocked', 'Expired understanding not materially changed.', now, 'system'),
    }
  }

  const created: OperatorUnderstanding = {
    id: createId('understanding'),
    statement: params.signal.plainLanguageStatement,
    sourceSignalId: params.signal.id,
    signalType: params.signal.signalType,
    sourceSignalStatus: params.signal.status,
    evidenceIds: [...params.signal.evidenceIds],
    evidenceCount: params.signal.evidenceCount,
    ruleId: params.signal.deterministicRuleId,
    ruleVersion: params.signal.deterministicRuleVersion,
    confidenceBasis: params.signal.confidenceBasis,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    state: 'proposed',
    permittedFeatureUses: [...params.signal.permittedFeatureUses],
    correctionHistory: [],
    reviewHistory: appendEvent([], 'review_opened', 'Proposed understanding created from source signal.', now, 'system'),
    materialEvidenceSignature: signature,
    personalizationEligible: false,
    provenance: {
      ruleId: params.signal.provenance.deterministicRuleId,
      ruleVersion: params.signal.provenance.ruleVersion,
      evidenceTypes: [params.signal.dataCategory],
      generatedAt: params.signal.provenance.analysisTimestamp,
      dataSource: 'local_vault',
    },
    ...(params.signal.expiresAt ? { expiresAt: params.signal.expiresAt } : {}),
  }

  return {
    understandings: deduplicateUnderstandings([...params.existingUnderstandings, created]),
    rejectedSignatures: params.rejectedSignatures,
    reviewAudit: appendEvent(params.reviewAudit, 'review_opened', `Understanding ${created.id} proposed.`, now, 'system'),
  }
}

function mutateUnderstanding(
  understanding: OperatorUnderstanding,
  toState: UnderstandingContractState,
  now: Date,
  action: UnderstandingReviewAction,
  detail: string,
): OperatorUnderstanding {
  return {
    ...understanding,
    state: toState,
    updatedAt: now.toISOString(),
    personalizationEligible: toState === 'operator_confirmed',
    ...(toState === 'expired' ? { expiredAt: now.toISOString() } : {}),
    reviewHistory: appendEvent(understanding.reviewHistory ?? [], action, detail, now),
  }
}

export function confirmUnderstanding(
  understandings: OperatorUnderstanding[],
  understandingId: string,
  now?: Date,
  consent?: CognitionConsent,
): OperatorUnderstanding[] {
  if (!validateConsentForReview(consent).valid) return understandings
  const at = now ?? new Date()
  return understandings.map((u) => {
    if (u.id !== understandingId) return u
    if (!isTransitionAllowed(u.state, 'operator_confirmed')) return u
    const action: UnderstandingReviewAction = u.state === 'operator_corrected' ? 'corrected_confirmed' : 'confirmed'
    return mutateUnderstanding(u, 'operator_confirmed', at, action, 'Understanding explicitly confirmed by operator.')
  })
}

export function correctUnderstanding(
  understandings: OperatorUnderstanding[],
  understandingId: string,
  correctedStatement: string,
  reason?: string,
  now?: Date,
  consent?: CognitionConsent,
): OperatorUnderstanding[] {
  if (!validateConsentForReview(consent).valid) return understandings
  const at = now ?? new Date()
  return understandings.map((u) => {
    if (u.id !== understandingId) return u
    if (!correctedStatement.trim()) return u
    if (!isTransitionAllowed(u.state, 'operator_corrected')) return u

    const correction: UnderstandingCorrection = {
      id: createId('understanding-correction'),
      timestamp: at.toISOString(),
      originalStatement: u.statement,
      correctedStatement: correctedStatement.trim(),
      ...(reason ? { reason } : {}),
    }

    return {
      ...mutateUnderstanding(u, 'operator_corrected', at, 'correction_submitted', 'Operator submitted corrected statement.'),
      statement: correctedStatement.trim(),
      correctionHistory: [...u.correctionHistory, correction],
      personalizationEligible: false,
    }
  })
}

export function rejectUnderstanding(
  understandings: OperatorUnderstanding[],
  understandingId: string,
  rejectedSignatures: string[],
  reason?: string,
  now?: Date,
  consent?: CognitionConsent,
): { understandings: OperatorUnderstanding[]; rejectedSignatures: string[] } {
  if (!validateConsentForReview(consent).valid) return { understandings, rejectedSignatures }
  const at = now ?? new Date()
  let signatureToReject: string | null = null
  const next = understandings.map((u) => {
    if (u.id !== understandingId) return u
    if (!isTransitionAllowed(u.state, 'operator_rejected')) return u
    signatureToReject = u.materialEvidenceSignature
    return mutateUnderstanding(
      u,
      'operator_rejected',
      at,
      'rejected',
      reason ? `Operator rejected understanding. Reason: ${reason}` : 'Operator rejected understanding.',
    )
  })
  if (!signatureToReject || rejectedSignatures.includes(signatureToReject)) {
    return { understandings: next, rejectedSignatures }
  }
  return { understandings: next, rejectedSignatures: [...rejectedSignatures, signatureToReject] }
}

export function expireUnderstanding(
  understandings: OperatorUnderstanding[],
  understandingId: string,
  now?: Date,
  consent?: CognitionConsent,
): OperatorUnderstanding[] {
  if (!validateConsentForReview(consent).valid) return understandings
  const at = now ?? new Date()
  return understandings.map((u) => {
    if (u.id !== understandingId) return u
    if (!isTransitionAllowed(u.state, 'expired')) return u
    return mutateUnderstanding(u, 'expired', at, 'expired', 'Understanding expired.')
  })
}

export function suppressSourceSignal(
  signals: CognitiveSignal[],
  signalId: string,
  now?: Date,
  consent?: CognitionConsent,
): CognitiveSignal[] {
  if (!validateConsentForReview(consent).valid) return signals
  const at = now ?? new Date()
  return signals.map((signal) => {
    if (signal.id !== signalId) return signal
    if (signal.status === 'suppressed' || signal.status === 'expired') return signal
    return {
      ...signal,
      status: 'suppressed' as CognitiveSignalStatus,
      suppressedAt: at.toISOString(),
      updatedAt: at.toISOString(),
      auditHistory: [
        ...signal.auditHistory,
        {
          id: createId('sig-audit'),
          action: 'suppressed',
          timestamp: at.toISOString(),
          detail: 'Source signal suppressed from understanding review.',
        },
      ],
    }
  })
}

export function getPendingReview(understandings: OperatorUnderstanding[]): OperatorUnderstanding[] {
  return understandings.filter((u) => u.state === 'proposed')
}

export function getConfirmed(understandings: OperatorUnderstanding[]): OperatorUnderstanding[] {
  return understandings.filter((u) => u.state === 'operator_confirmed')
}

export function getCorrected(understandings: OperatorUnderstanding[]): OperatorUnderstanding[] {
  return understandings.filter((u) => u.state === 'operator_corrected')
}

export function getRejected(understandings: OperatorUnderstanding[]): OperatorUnderstanding[] {
  return understandings.filter((u) => u.state === 'operator_rejected')
}

export function getExpired(understandings: OperatorUnderstanding[]): OperatorUnderstanding[] {
  return understandings.filter((u) => u.state === 'expired')
}

export function explainUnderstanding(understanding: OperatorUnderstanding): string {
  const uncertainty =
    understanding.state === 'proposed'
      ? 'This is a proposal and may be inaccurate until reviewed.'
      : 'No unresolved uncertainty has been recorded for this understanding.'

  return [
    `What Rosie noticed: ${understanding.statement}`,
    `Why Rosie noticed it: ${understanding.confidenceBasis}`,
    `Evidence used: ${understanding.evidenceCount} record(s)`,
    `Deterministic rule: ${understanding.ruleId} v${understanding.ruleVersion}`,
    `Confidence basis: ${understanding.confidenceBasis}`,
    `Uncertainty: ${uncertainty}`,
    'Operator actions: confirm, correct, reject, expire, suppress source signal, inspect evidence and provenance.',
  ].join('\n')
}

