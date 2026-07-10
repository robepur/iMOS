/**
 * CognitionContractService
 *
 * Manages the lifecycle, validation, provenance, correction, and expiry
 * of OperatorUnderstanding records.
 *
 * Contract rules:
 * - Every understanding must carry full provenance before persistence.
 * - Only 'operator_confirmed' understandings may personalize behavior.
 * - 'proposed' understandings may be displayed but must not silently change behavior.
 * - Rejected understandings must not reappear without materially new evidence.
 * - Unknown rule versions must not execute.
 * - Missing provenance invalidates an understanding (fail closed).
 */
import type {
  OperatorUnderstanding,
  UnderstandingContractState,
  UnderstandingProvenance,
  UnderstandingCorrection,
  CognitionFeatureSurface,
} from '../types/cognitive'
import { createId } from '../localData'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ContractValidationResult =
  | { valid: true }
  | { valid: false; reason: string }

/** Validates provenance completeness. Missing provenance fails closed. */
export function validateProvenance(provenance: unknown): ContractValidationResult {
  if (!provenance || typeof provenance !== 'object') {
    return { valid: false, reason: 'Provenance is missing or not an object.' }
  }
  const p = provenance as Record<string, unknown>
  if (typeof p['ruleId'] !== 'string' || !p['ruleId']) {
    return { valid: false, reason: 'Provenance ruleId must be a non-empty string.' }
  }
  if (typeof p['ruleVersion'] !== 'string' || !p['ruleVersion']) {
    return { valid: false, reason: 'Provenance ruleVersion must be a non-empty string.' }
  }
  if (!Array.isArray(p['evidenceTypes'])) {
    return { valid: false, reason: 'Provenance evidenceTypes must be an array.' }
  }
  if (typeof p['generatedAt'] !== 'string' || !p['generatedAt']) {
    return { valid: false, reason: 'Provenance generatedAt must be a non-empty string.' }
  }
  if (p['dataSource'] !== 'local_vault') {
    return { valid: false, reason: `Provenance dataSource must be 'local_vault', got: ${p['dataSource']}` }
  }
  return { valid: true }
}

const VALID_STATES: UnderstandingContractState[] = [
  'observed',
  'proposed',
  'operator_confirmed',
  'operator_corrected',
  'operator_rejected',
  'expired',
]

/** Validates a full OperatorUnderstanding record for contract compliance. */
export function validateUnderstanding(u: unknown): ContractValidationResult {
  if (!u || typeof u !== 'object') {
    return { valid: false, reason: 'Understanding is missing or not an object.' }
  }
  const obj = u as Record<string, unknown>

  if (typeof obj['id'] !== 'string' || !obj['id']) {
    return { valid: false, reason: 'Understanding id must be a non-empty string.' }
  }
  if (typeof obj['statement'] !== 'string' || !obj['statement']) {
    return { valid: false, reason: 'Understanding statement must be a non-empty string.' }
  }
  if (!Array.isArray(obj['evidenceIds'])) {
    return { valid: false, reason: 'Understanding evidenceIds must be an array.' }
  }
  if (typeof obj['ruleId'] !== 'string' || !obj['ruleId']) {
    return { valid: false, reason: 'Understanding ruleId must be a non-empty string.' }
  }
  if (typeof obj['ruleVersion'] !== 'string' || !obj['ruleVersion']) {
    return { valid: false, reason: 'Understanding ruleVersion must be a non-empty string.' }
  }
  if (!VALID_STATES.includes(obj['state'] as UnderstandingContractState)) {
    return { valid: false, reason: `Invalid understanding state: ${obj['state']}` }
  }
  if (typeof obj['confidenceBasis'] !== 'string' || !obj['confidenceBasis']) {
    return { valid: false, reason: 'Understanding confidenceBasis must be a non-empty string.' }
  }

  const provenanceResult = validateProvenance(obj['provenance'])
  if (!provenanceResult.valid) {
    return provenanceResult
  }

  return { valid: true }
}

// ---------------------------------------------------------------------------
// Lifecycle transitions
// ---------------------------------------------------------------------------

const ALLOWED_TRANSITIONS: Record<UnderstandingContractState, UnderstandingContractState[]> = {
  observed: ['proposed', 'operator_rejected'],
  proposed: ['operator_confirmed', 'operator_corrected', 'operator_rejected', 'expired'],
  operator_confirmed: ['operator_corrected', 'operator_rejected', 'expired'],
  operator_corrected: ['operator_confirmed', 'operator_rejected', 'expired'],
  operator_rejected: [],   // terminal — must not silently reappear
  expired: ['proposed'],   // may re-enter review with new evidence
}

/** Returns true when the state transition is permitted by the contract. */
export function isTransitionAllowed(
  from: UnderstandingContractState,
  to: UnderstandingContractState,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

/** Transition an understanding to a new state. Fails closed on invalid transition. */
export function transitionState(
  understanding: OperatorUnderstanding,
  to: UnderstandingContractState,
): OperatorUnderstanding {
  if (!isTransitionAllowed(understanding.state, to)) {
    // Fail closed — return unchanged
    return understanding
  }
  return {
    ...understanding,
    state: to,
    updatedAt: new Date().toISOString(),
    ...(to === 'expired' ? { expiredAt: new Date().toISOString() } : {}),
  }
}

// ---------------------------------------------------------------------------
// Operator actions
// ---------------------------------------------------------------------------

/** Confirm an understanding. Only confirmed understandings may personalize behavior. */
export function confirmUnderstanding(understanding: OperatorUnderstanding): OperatorUnderstanding {
  return transitionState(understanding, 'operator_confirmed')
}

/** Reject an understanding. Rejected understandings are terminal — they must not
 *  silently reappear without materially new evidence. */
export function rejectUnderstanding(understanding: OperatorUnderstanding): OperatorUnderstanding {
  return transitionState(understanding, 'operator_rejected')
}

/** Apply an operator correction. Records the correction in history. */
export function correctUnderstanding(
  understanding: OperatorUnderstanding,
  correctedStatement: string,
  reason?: string,
): OperatorUnderstanding {
  const next = transitionState(understanding, 'operator_corrected')
  if (next.state !== 'operator_corrected') return understanding // transition was invalid

  const correction: UnderstandingCorrection = {
    id: createId('correction'),
    timestamp: new Date().toISOString(),
    originalStatement: understanding.statement,
    correctedStatement,
    ...(reason ? { reason } : {}),
  }

  return {
    ...next,
    statement: correctedStatement,
    correctionHistory: [...understanding.correctionHistory, correction],
  }
}

/** Apply expiry to a stale understanding. */
export function expireUnderstanding(understanding: OperatorUnderstanding): OperatorUnderstanding {
  return transitionState(understanding, 'expired')
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a new OperatorUnderstanding in 'observed' state.
 *  Provenance is validated; creation fails closed if provenance is invalid. */
export function createUnderstanding(params: {
  statement: string
  evidenceIds: string[]
  ruleId: string
  ruleVersion: string
  confidenceBasis: string
  provenance: UnderstandingProvenance
  permittedFeatureUses?: CognitionFeatureSurface[]
  expiresAt?: string
}): OperatorUnderstanding | null {
  const provenanceResult = validateProvenance(params.provenance)
  if (!provenanceResult.valid) return null

  const now = new Date().toISOString()
  return {
    id: createId('understanding-contract'),
    statement: params.statement,
    evidenceIds: params.evidenceIds,
    ruleId: params.ruleId,
    ruleVersion: params.ruleVersion,
    createdAt: now,
    updatedAt: now,
    confidenceBasis: params.confidenceBasis,
    state: 'observed',
    correctionHistory: [],
    permittedFeatureUses: params.permittedFeatureUses ?? [],
    provenance: params.provenance,
    ...(params.expiresAt ? { expiresAt: params.expiresAt } : {}),
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Returns only understandings that may personalize system behavior. */
export function getConfirmedUnderstandings(understandings: OperatorUnderstanding[]): OperatorUnderstanding[] {
  return understandings.filter((u) => u.state === 'operator_confirmed')
}

/** Returns understandings awaiting operator review. */
export function getPendingReviewUnderstandings(understandings: OperatorUnderstanding[]): OperatorUnderstanding[] {
  return understandings.filter((u) => u.state === 'proposed' || u.state === 'observed')
}

/** Expire all understandings whose expiresAt has passed. */
export function applyExpirations(understandings: OperatorUnderstanding[]): OperatorUnderstanding[] {
  const now = new Date()
  return understandings.map((u) => {
    if (u.expiresAt && new Date(u.expiresAt) < now && u.state !== 'expired' && u.state !== 'operator_rejected') {
      return expireUnderstanding(u)
    }
    return u
  })
}

// ---------------------------------------------------------------------------
// Normalization — safe default hydration for vaults missing Phase 3 fields
// ---------------------------------------------------------------------------

/** Normalize a raw unknown value into a valid OperatorUnderstanding or null. */
export function normalizeUnderstanding(raw: unknown): OperatorUnderstanding | null {
  const result = validateUnderstanding(raw)
  if (!result.valid) return null
  const obj = raw as Record<string, unknown>
  return {
    id: String(obj['id']),
    statement: String(obj['statement']),
    evidenceIds: (Array.isArray(obj['evidenceIds']) ? obj['evidenceIds'] : []).map(String),
    ruleId: String(obj['ruleId']),
    ruleVersion: String(obj['ruleVersion']),
    createdAt: String(obj['createdAt'] ?? new Date().toISOString()),
    updatedAt: String(obj['updatedAt'] ?? obj['createdAt'] ?? new Date().toISOString()),
    confidenceBasis: String(obj['confidenceBasis']),
    state: obj['state'] as UnderstandingContractState,
    correctionHistory: Array.isArray(obj['correctionHistory']) ? obj['correctionHistory'] as UnderstandingCorrection[] : [],
    permittedFeatureUses: Array.isArray(obj['permittedFeatureUses']) ? obj['permittedFeatureUses'] as CognitionFeatureSurface[] : [],
    provenance: obj['provenance'] as UnderstandingProvenance,
    ...(obj['expiresAt'] ? { expiresAt: String(obj['expiresAt']) } : {}),
    ...(obj['expiredAt'] ? { expiredAt: String(obj['expiredAt']) } : {}),
  }
}
