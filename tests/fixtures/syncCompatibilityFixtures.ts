/**
 * Synchronization state compatibility fixtures for Builds 016–021.
 *
 * Used to verify that normalizePersonalData produces safe disabled defaults
 * when sync fields are absent (Builds 016–018) and preserves valid sync state
 * when present (Builds 019–021).
 *
 * All fixtures represent only the sync-relevant fields. Mix into a full vault
 * fixture from compatibilityVaults.ts as needed.
 */

/** Minimal base vault fields shared by all fixtures. */
const BASE_VAULT = {
  version: 1,
  priorities: [],
  commitments: [],
  decisions: [],
  timeline: [],
  reflections: [],
  secrets: [],
  recommendations: [],
  understandingState: { activeDriftSignals: [], activePatternKeys: [], trendDirections: {} },
  missionPlans: [],
  missionSteps: [],
  cognitionConsent: {
    status: 'off',
    version: '1.0.0',
    purpose: 'fixture',
    updatedAt: '2026-01-01T00:00:00.000Z',
    permittedDataCategories: [],
    permittedFeatureSurfaces: [],
    auditHistory: [],
  },
  operatorUnderstandings: [],
  cloudSyncConsentDeclaration: { status: 'not_offered', updatedAt: '2026-01-01T00:00:00.000Z' },
  connectorConsentDeclarations: [],
  cognitiveSignals: [],
  cognitiveRuleRegistryVersion: '1.0.0',
  rejectedUnderstandingSignatures: [],
  understandingReviewAudit: [],
  presentationPersonalizationEnabled: false,
  presentationProfile: {
    profileVersion: 'v1',
    generatedAt: '2026-01-01T00:00:00.000Z',
    sourceUnderstandingIds: [],
    sourceRuleVersions: [],
    summaryDetailMode: 'balanced',
    informationDensity: 'standard',
    evidenceDepth: 'standard',
    briefingSectionOrder: ['overview', 'recommendations', 'focus', 'evidence'],
    planningSequenceMode: 'sequential',
    reviewTimingMode: 'neutral',
    expansionDefaults: {
      briefingDetailsExpanded: false,
      reviewDetailsExpanded: false,
      missionDetailsExpanded: false,
      evidenceExpanded: false,
    },
    activeAdaptations: [],
    operatorOverrides: [],
    explanations: [],
    validationState: 'neutral',
  },
  presentationOverrides: [],
  presentationAdaptationAudit: [],
  presentationMappingRegistryVersion: '2026.07.11',
} as const

/**
 * Build 016: Adaptive Presentation was finalized.
 * Sync fields not yet introduced — normalization must produce a safe disabled default.
 */
export const build016SyncFixture: Record<string, unknown> = {
  ...BASE_VAULT,
  // No syncOperatorControlState, no syncQuarantine
}

/**
 * Build 017: Connectivity Policy layer.
 * Sync fields not yet introduced — normalization must produce a safe disabled default.
 */
export const build017SyncFixture: Record<string, unknown> = {
  ...BASE_VAULT,
  // No syncOperatorControlState, no syncQuarantine
}

/**
 * Build 018: Device Identity hardening.
 * Sync fields not yet introduced — normalization must produce a safe disabled default.
 */
export const build018SyncFixture: Record<string, unknown> = {
  ...BASE_VAULT,
  // No syncOperatorControlState, no syncQuarantine
}

/**
 * Build 019: Encrypted Sync Transport foundation.
 * Sync transport is present and explicitly disabled.
 * Quarantine list is empty.
 */
export const build019SyncFixture: Record<string, unknown> = {
  ...BASE_VAULT,
  syncOperatorControlState: {
    schemaVersion: '1.0.0',
    enabled: false,
    localEndpointConfigured: false,
  },
  syncQuarantine: [],
}

/**
 * Build 019 variant: valid local-reference endpoint configured but transport disabled.
 */
export const build019SyncFixtureWithLocalEndpoint: Record<string, unknown> = {
  ...BASE_VAULT,
  syncOperatorControlState: {
    schemaVersion: '1.0.0',
    enabled: false,
    localEndpointConfigured: true,
    localReferenceEndpoint: 'http://localhost:8080',
    configuredAt: '2026-01-01T00:00:00.000Z',
  },
  syncQuarantine: [],
}

/**
 * Build 019 variant: quarantine record present, transport disabled.
 */
export const build019SyncFixtureWithQuarantine: Record<string, unknown> = {
  ...BASE_VAULT,
  syncOperatorControlState: {
    schemaVersion: '1.0.0',
    enabled: false,
    localEndpointConfigured: false,
  },
  syncQuarantine: [
    {
      schemaVersion: '1.0.0',
      id: 'sync-quarantine:fixture-001',
      reason: 'bad_signature',
      disposition: 'pending_review',
      requestId: 'req-fixture-001',
      namespace: 'sync:test-namespace',
      objectId: 'obj:fixture-object-001',
      createdAt: '2026-01-01T00:00:00.000Z',
      detail: 'signature verification failed during transport test',
      diagnosticCode: 'SIG_VERIFY_FAIL',
    },
  ],
}

/**
 * Build 020: Sync Key Architecture.
 * Transport disabled, sync state includes key architecture version field.
 * Build 020 did not add new vault-level fields beyond Build 019's syncOperatorControlState.
 */
export const build020SyncFixture: Record<string, unknown> = {
  ...BASE_VAULT,
  syncOperatorControlState: {
    schemaVersion: '1.0.0',
    enabled: false,
    localEndpointConfigured: false,
    configuredAt: '2026-06-01T00:00:00.000Z',
  },
  syncQuarantine: [],
}

/**
 * Build 021: Sync Convergence Engine.
 * Same vault-level sync shape as Build 020 — convergence ledger is in-memory only.
 * Transport disabled.
 */
export const build021SyncFixture: Record<string, unknown> = {
  ...BASE_VAULT,
  syncOperatorControlState: {
    schemaVersion: '1.0.0',
    enabled: false,
    localEndpointConfigured: false,
    configuredAt: '2026-07-01T00:00:00.000Z',
  },
  syncQuarantine: [],
}

/**
 * Build 021 variant: vault with unknown additive fields.
 * These must be preserved by normalization for rollback compatibility.
 */
export const build021SyncFixtureWithFutureFields: Record<string, unknown> = {
  ...BASE_VAULT,
  syncOperatorControlState: {
    schemaVersion: '1.0.0',
    enabled: false,
    localEndpointConfigured: false,
    // Unknown future field — must not cause normalization failure
    _futureSyncFeatureFlag: false,
  },
  syncQuarantine: [],
  // Unknown top-level vault field — normalization spreads raw so it is preserved
  _unknownFutureTopLevelField: { addedInFutureBuild: true },
}

/**
 * Malformed sync operator control state — normalization must reset to safe disabled default.
 */
export const malformedSyncOperatorControlFixture: Record<string, unknown> = {
  ...BASE_VAULT,
  syncOperatorControlState: {
    schemaVersion: '1.0.0',
    enabled: 'yes',          // invalid: must be boolean
    localEndpointConfigured: 1,  // invalid: must be boolean
  },
  syncQuarantine: [],
}

/**
 * Sync state with enabled=true — normalization must reject and replace with disabled default.
 * Build 019 only permits loopback/local-reference endpoints.
 * Production endpoints are not permitted.
 */
export const productionEndpointSyncFixture: Record<string, unknown> = {
  ...BASE_VAULT,
  syncOperatorControlState: {
    schemaVersion: '1.0.0',
    enabled: true,
    localEndpointConfigured: true,
    localReferenceEndpoint: 'https://sync.example.com/api',  // production — must be rejected
  },
  syncQuarantine: [],
}

/**
 * Quarantine record with a forbidden plaintext field — must be filtered by normalization.
 */
export const quarantineWithForbiddenFieldFixture: Record<string, unknown> = {
  ...BASE_VAULT,
  syncOperatorControlState: {
    schemaVersion: '1.0.0',
    enabled: false,
    localEndpointConfigured: false,
  },
  syncQuarantine: [
    {
      schemaVersion: '1.0.0',
      id: 'sync-quarantine:bad-001',
      reason: 'INVALID_REASON',  // unsupported reason — record must be filtered
      disposition: 'pending_review',
      requestId: 'req-bad-001',
      namespace: 'sync:test',
      objectId: 'obj:test-001',
      createdAt: '2026-01-01T00:00:00.000Z',
      detail: 'authorization: Bearer secret-token',  // credential in detail — must be rejected
      diagnosticCode: 'BAD',
    },
  ],
}
