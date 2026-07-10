/**
 * CognitionConsentService
 *
 * Manages the operator's explicit cognition consent lifecycle.
 * No cognitive signal capture, analysis, or persistence is permitted
 * before consent status is 'on'.
 *
 * All operations are local-only, deterministic, and produce an audit event.
 */
import type {
  CognitionConsent,
  CognitionConsentAuditEvent,
  CognitionDataCategory,
  CognitionFeatureSurface,
} from '../types/cognitive'
import { createDefaultCognitionConsent, COGNITION_CONSENT_VERSION, createId } from '../localData'

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/** Returns true only when the operator has explicitly enabled cognition. */
export function isCognitionEnabled(consent: CognitionConsent | undefined): boolean {
  return consent?.status === 'on'
}

/** Returns true when the operator has revoked consent. */
export function isCognitionRevoked(consent: CognitionConsent | undefined): boolean {
  return consent?.status === 'revoked'
}

/**
 * Returns true when a specific data category is permitted.
 * Always false when cognition is not enabled.
 */
export function isDataCategoryPermitted(
  consent: CognitionConsent | undefined,
  category: CognitionDataCategory,
): boolean {
  if (!isCognitionEnabled(consent)) return false
  return consent!.permittedDataCategories.includes(category)
}

/**
 * Returns true when a specific feature surface is permitted.
 * Always false when cognition is not enabled.
 */
export function isFeatureSurfacePermitted(
  consent: CognitionConsent | undefined,
  surface: CognitionFeatureSurface,
): boolean {
  if (!isCognitionEnabled(consent)) return false
  return consent!.permittedFeatureSurfaces.includes(surface)
}

// ---------------------------------------------------------------------------
// Mutations — each returns a new CognitionConsent (immutable pattern)
// ---------------------------------------------------------------------------

function makeAuditEvent(
  action: CognitionConsentAuditEvent['action'],
  detail: string,
): CognitionConsentAuditEvent {
  return {
    id: createId('consent-audit'),
    action,
    timestamp: new Date().toISOString(),
    detail,
  }
}

/**
 * Enable cognition with the specified permitted categories and surfaces.
 * Produces an 'enabled' audit event.
 * Fails closed if called on a 'revoked' consent — use reset first.
 */
export function enableCognition(
  consent: CognitionConsent,
  categories: CognitionDataCategory[],
  surfaces: CognitionFeatureSurface[],
): CognitionConsent {
  if (consent.status === 'revoked') {
    // Fail closed: revoked consent cannot be re-enabled without reset
    return consent
  }
  const now = new Date().toISOString()
  return {
    ...consent,
    status: 'on',
    grantedAt: consent.grantedAt ?? now,
    updatedAt: now,
    permittedDataCategories: categories,
    permittedFeatureSurfaces: surfaces,
    auditHistory: [
      ...consent.auditHistory,
      makeAuditEvent('enabled', `Cognition enabled with ${categories.length} data categories and ${surfaces.length} surfaces.`),
    ],
  }
}

/**
 * Disable cognition. Stops new signal capture immediately.
 * Existing understandings are preserved in vault.
 * Produces a 'disabled' audit event.
 */
export function disableCognition(consent: CognitionConsent): CognitionConsent {
  if (consent.status !== 'on') return consent
  return {
    ...consent,
    status: 'off',
    updatedAt: new Date().toISOString(),
    auditHistory: [
      ...consent.auditHistory,
      makeAuditEvent('disabled', 'Cognition disabled. No new signal capture will occur.'),
    ],
  }
}

/**
 * Revoke consent. Permanently disables cognition capture and flags the record.
 * The operator must reset before enabling again.
 * Produces a 'revoked' audit event.
 */
export function revokeCognition(consent: CognitionConsent): CognitionConsent {
  const now = new Date().toISOString()
  return {
    ...consent,
    status: 'revoked',
    revokedAt: now,
    updatedAt: now,
    permittedDataCategories: [],
    permittedFeatureSurfaces: [],
    auditHistory: [
      ...consent.auditHistory,
      makeAuditEvent('revoked', 'Consent revoked. Cognition capture stopped. Reset required before re-enabling.'),
    ],
  }
}

/**
 * Reset cognition consent to the safe default (status:'off').
 * Preserves the full audit history of the previous record.
 * Produces a 'reset' audit event.
 * Requires explicit operator confirmation before calling.
 */
export function resetCognition(consent: CognitionConsent): CognitionConsent {
  const previousAudit = consent.auditHistory
  const fresh = createDefaultCognitionConsent()
  return {
    ...fresh,
    version: COGNITION_CONSENT_VERSION,
    auditHistory: [
      ...previousAudit,
      makeAuditEvent('reset', 'Cognition consent reset. All permitted categories and surfaces cleared.'),
    ],
  }
}

/**
 * Update the permitted categories and/or surfaces without changing status.
 * Produces an 'updated' audit event.
 */
export function updateCognitionPermissions(
  consent: CognitionConsent,
  categories: CognitionDataCategory[],
  surfaces: CognitionFeatureSurface[],
): CognitionConsent {
  return {
    ...consent,
    permittedDataCategories: categories,
    permittedFeatureSurfaces: surfaces,
    updatedAt: new Date().toISOString(),
    auditHistory: [
      ...consent.auditHistory,
      makeAuditEvent('updated', `Permissions updated: ${categories.length} categories, ${surfaces.length} surfaces.`),
    ],
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ConsentValidationResult =
  | { valid: true }
  | { valid: false; reason: string }

/** Validates a CognitionConsent record for structural integrity. */
export function validateConsent(consent: unknown): ConsentValidationResult {
  if (!consent || typeof consent !== 'object') {
    return { valid: false, reason: 'Consent record is missing or not an object.' }
  }
  const c = consent as Record<string, unknown>

  if (!['off', 'on', 'revoked'].includes(c['status'] as string)) {
    return { valid: false, reason: `Invalid consent status: ${c['status']}` }
  }
  if (typeof c['version'] !== 'string' || !c['version']) {
    return { valid: false, reason: 'Consent version must be a non-empty string.' }
  }
  if (typeof c['purpose'] !== 'string' || !c['purpose']) {
    return { valid: false, reason: 'Consent purpose must be a non-empty string.' }
  }
  if (typeof c['updatedAt'] !== 'string') {
    return { valid: false, reason: 'Consent updatedAt must be a string.' }
  }
  if (!Array.isArray(c['permittedDataCategories'])) {
    return { valid: false, reason: 'Consent permittedDataCategories must be an array.' }
  }
  if (!Array.isArray(c['permittedFeatureSurfaces'])) {
    return { valid: false, reason: 'Consent permittedFeatureSurfaces must be an array.' }
  }
  if (!Array.isArray(c['auditHistory'])) {
    return { valid: false, reason: 'Consent auditHistory must be an array.' }
  }
  if (c['status'] === 'revoked' && typeof c['revokedAt'] !== 'string') {
    return { valid: false, reason: 'Revoked consent must have a revokedAt timestamp.' }
  }
  return { valid: true }
}

/** Normalize a raw unknown cognition consent value into a valid record.
 *  Fails closed: invalid or corrupt records return the safe default. */
export function normalizeCognitionConsent(raw: unknown): CognitionConsent {
  const result = validateConsent(raw)
  if (!result.valid) {
    return createDefaultCognitionConsent()
  }
  const c = raw as Record<string, unknown>
  return {
    status: c['status'] as CognitionConsent['status'],
    version: String(c['version']),
    purpose: String(c['purpose']),
    updatedAt: String(c['updatedAt']),
    ...(c['grantedAt'] ? { grantedAt: String(c['grantedAt']) } : {}),
    ...(c['revokedAt'] ? { revokedAt: String(c['revokedAt']) } : {}),
    permittedDataCategories: (c['permittedDataCategories'] as string[]).filter(
      (v): v is CognitionDataCategory => typeof v === 'string',
    ),
    permittedFeatureSurfaces: (c['permittedFeatureSurfaces'] as string[]).filter(
      (v): v is CognitionFeatureSurface => typeof v === 'string',
    ),
    auditHistory: Array.isArray(c['auditHistory'])
      ? (c['auditHistory'] as Record<string, unknown>[]).filter(
          (e) => typeof e?.['id'] === 'string' && typeof e?.['action'] === 'string' && typeof e?.['timestamp'] === 'string',
        ) as CognitionConsentAuditEvent[]
      : [],
  }
}
