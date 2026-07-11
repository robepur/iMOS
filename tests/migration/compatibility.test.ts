import { describe, expect, it } from 'vitest'
import { migrateToLatest } from '../../src/SchemaVersion'
import { compatibilityVaults } from '../fixtures/compatibilityVaults'

describe('Build compatibility migration coverage', () => {
  for (const [build, fixture] of Object.entries(compatibilityVaults)) {
    it(`normalizes ${build} vault data without data loss`, () => {
      const migrated = migrateToLatest(fixture)
      expect(migrated.version).toBe(1)
      expect(Array.isArray(migrated.priorities)).toBe(true)
      expect(Array.isArray(migrated.commitments)).toBe(true)
      expect(Array.isArray(migrated.decisions)).toBe(true)
      expect(Array.isArray(migrated.timeline)).toBe(true)
      expect(Array.isArray(migrated.reflections)).toBe(true)
      expect(Array.isArray(migrated.secrets)).toBe(true)
      expect(Array.isArray(migrated.missionPlans)).toBe(true)
      expect(Array.isArray(migrated.missionSteps)).toBe(true)
      expect(migrated.understandingState).toBeDefined()
    })
  }
})

// ---------------------------------------------------------------------------
// Phase 3 migration: Build 013 safe defaults
// ---------------------------------------------------------------------------

describe('Phase 3 migration — Build 013 safe defaults', () => {
  it('hydrates cognitionConsent with status off when absent in pre-013 vault', () => {
    const migrated = migrateToLatest(compatibilityVaults['build012'])
    expect(migrated.cognitionConsent).toBeDefined()
    expect(migrated.cognitionConsent!.status).toBe('off')
  })

  it('hydrates empty operatorUnderstandings when absent', () => {
    const migrated = migrateToLatest(compatibilityVaults['build012'])
    expect(Array.isArray(migrated.operatorUnderstandings)).toBe(true)
    expect(migrated.operatorUnderstandings).toHaveLength(0)
  })

  it('hydrates cloudSyncConsentDeclaration as not_offered when absent', () => {
    const migrated = migrateToLatest(compatibilityVaults['build012'])
    expect(migrated.cloudSyncConsentDeclaration).toBeDefined()
    expect(migrated.cloudSyncConsentDeclaration!.status).toBe('not_offered')
  })

  it('hydrates empty connectorConsentDeclarations when absent', () => {
    const migrated = migrateToLatest(compatibilityVaults['build012'])
    expect(Array.isArray(migrated.connectorConsentDeclarations)).toBe(true)
    expect(migrated.connectorConsentDeclarations).toHaveLength(0)
  })

  it('preserves existing cognitionConsent when present', () => {
    const migrated = migrateToLatest(compatibilityVaults['build013_consent_off'])
    expect(migrated.cognitionConsent!.status).toBe('off')
    expect(migrated.cognitionConsent!.version).toBe('1.0.0')
  })

  it('pre-013 vaults never have cognition enabled after migration — consent defaults off', () => {
    const skipBuilds = new Set(['build013_consent_off', 'build014_with_signals', 'build015_understanding_review', 'build016_adaptive_presentation'])
    for (const [build, fixture] of Object.entries(compatibilityVaults)) {
      if (skipBuilds.has(build)) continue
      const migrated = migrateToLatest(fixture)
      expect(migrated.cognitionConsent!.status).not.toBe('on')
    }
  })

  it('migration is idempotent — migrating twice produces same Phase 3 state', () => {
    const once = migrateToLatest(compatibilityVaults['build012'])
    const twice = migrateToLatest(once)
    expect(twice.cognitionConsent!.status).toBe(once.cognitionConsent!.status)
    expect(twice.operatorUnderstandings).toHaveLength(once.operatorUnderstandings!.length)
  })
})


describe('Phase 3 migration — malformed state fails closed', () => {
  it('replaces malformed enabled consent with the safe off default', () => {
    const fixture = {
      ...compatibilityVaults['build012'],
      cognitionConsent: {
        status: 'on',
        version: '1.0.0',
        purpose: 'corrupt',
        updatedAt: 'invalid',
        permittedDataCategories: 'all',
        permittedFeatureSurfaces: [],
        auditHistory: [],
      },
    }
    const migrated = migrateToLatest(fixture as never)
    expect(migrated.cognitionConsent!.status).toBe('off')
    expect(migrated.cognitionConsent!.permittedDataCategories).toEqual([])
  })

  it('drops understandings with missing or inconsistent provenance', () => {
    const fixture = {
      ...compatibilityVaults['build012'],
      operatorUnderstandings: [{
        id: 'invalid-understanding',
        statement: 'Unsupported claim',
        evidenceIds: [],
        ruleId: 'rule-a',
        ruleVersion: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        confidenceBasis: 'none',
        state: 'operator_confirmed',
        correctionHistory: [],
        permittedFeatureUses: ['briefing'],
        provenance: {
          ruleId: 'different-rule',
          ruleVersion: '1.0.0',
          evidenceTypes: [],
          generatedAt: new Date().toISOString(),
          dataSource: 'local_vault',
        },
      }],
    }
    const migrated = migrateToLatest(fixture as never)
    expect(migrated.operatorUnderstandings).toEqual([])
  })

  it('clears permissions from structurally invalid revoked consent', () => {
    const fixture = {
      ...compatibilityVaults['build012'],
      cognitionConsent: {
        status: 'revoked',
        version: '1.0.0',
        purpose: 'revoked',
        updatedAt: new Date().toISOString(),
        revokedAt: new Date().toISOString(),
        permittedDataCategories: ['priorities'],
        permittedFeatureSurfaces: ['briefing'],
        auditHistory: [],
      },
    }
    const migrated = migrateToLatest(fixture as never)
    expect(migrated.cognitionConsent!.status).toBe('off')
    expect(migrated.cognitionConsent!.permittedDataCategories).toEqual([])
    expect(migrated.cognitionConsent!.permittedFeatureSurfaces).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Phase 3 migration — Build 014 cognitive signal fields
// ---------------------------------------------------------------------------

describe('Phase 3 migration — Build 014 cognitive signal fields', () => {
  it('hydrates cognitiveSignals as empty array when absent in pre-014 vault', () => {
    const migrated = migrateToLatest(compatibilityVaults['build013_no_phase3'])
    expect(Array.isArray(migrated.cognitiveSignals)).toBe(true)
    expect(migrated.cognitiveSignals).toHaveLength(0)
  })

  it('hydrates cognitiveSignals as empty array when absent in Build 012 vault', () => {
    const migrated = migrateToLatest(compatibilityVaults['build012'])
    expect(Array.isArray(migrated.cognitiveSignals)).toBe(true)
    expect(migrated.cognitiveSignals).toHaveLength(0)
  })

  it('preserves valid cognitiveSignals when present', () => {
    const migrated = migrateToLatest(compatibilityVaults['build014_with_signals'])
    expect(Array.isArray(migrated.cognitiveSignals)).toBe(true)
    expect(migrated.cognitiveSignals).toHaveLength(0) // empty array in fixture
  })

  it('discards malformed cognitive signals (fail closed)', () => {
    const migrated = migrateToLatest(compatibilityVaults['build014_corrupt_signals'])
    expect(Array.isArray(migrated.cognitiveSignals)).toBe(true)
    // All 3 entries are malformed — should be discarded
    expect(migrated.cognitiveSignals).toHaveLength(0)
  })

  it('cognitiveRuleRegistryVersion is preserved when valid string', () => {
    const migrated = migrateToLatest(compatibilityVaults['build014_with_signals'])
    expect(migrated.cognitiveRuleRegistryVersion).toBe('1.0.0')
  })

  it('cognitiveRuleRegistryVersion is undefined for pre-014 vaults', () => {
    const migrated = migrateToLatest(compatibilityVaults['build012'])
    expect(migrated.cognitiveRuleRegistryVersion).toBeUndefined()
  })

  it('migration is idempotent for Build 014 fields', () => {
    const once = migrateToLatest(compatibilityVaults['build014_with_signals'])
    const twice = migrateToLatest(once)
    expect(twice.cognitiveSignals).toHaveLength(once.cognitiveSignals!.length)
    expect(twice.cognitiveRuleRegistryVersion).toBe(once.cognitiveRuleRegistryVersion)
  })
})

// ---------------------------------------------------------------------------
// Phase 3 migration — Build 015 understanding review fields
// ---------------------------------------------------------------------------

describe('Phase 3 migration — Build 015 understanding review fields', () => {
  it('hydrates rejectedUnderstandingSignatures as empty when absent', () => {
    const migrated = migrateToLatest(compatibilityVaults['build014_with_signals'])
    expect(Array.isArray(migrated.rejectedUnderstandingSignatures)).toBe(true)
    expect(migrated.rejectedUnderstandingSignatures).toHaveLength(0)
  })

  it('hydrates understandingReviewAudit as empty when absent', () => {
    const migrated = migrateToLatest(compatibilityVaults['build014_with_signals'])
    expect(Array.isArray(migrated.understandingReviewAudit)).toBe(true)
    expect(migrated.understandingReviewAudit).toHaveLength(0)
  })

  it('preserves valid Build 015 review fields', () => {
    const migrated = migrateToLatest(compatibilityVaults['build015_understanding_review'])
    expect(Array.isArray(migrated.rejectedUnderstandingSignatures)).toBe(true)
    expect(Array.isArray(migrated.understandingReviewAudit)).toBe(true)
  })

  it('filters malformed review state entries fail-closed', () => {
    const migrated = migrateToLatest(compatibilityVaults['build015_corrupt_review_state'])
    expect(migrated.rejectedUnderstandingSignatures).toEqual(['123', 'null', 'ok-signature'])
    expect(migrated.understandingReviewAudit).toHaveLength(1)
  })

  it('migration is idempotent for Build 015 review fields', () => {
    const once = migrateToLatest(compatibilityVaults['build015_understanding_review'])
    const twice = migrateToLatest(once)
    expect(twice.rejectedUnderstandingSignatures).toEqual(once.rejectedUnderstandingSignatures)
    expect(twice.understandingReviewAudit).toHaveLength(once.understandingReviewAudit!.length)
  })
})

describe('Phase 3 migration — Build 016 adaptive presentation fields', () => {
  it('hydrates adaptive presentation fields when absent', () => {
    const migrated = migrateToLatest(compatibilityVaults['build015_understanding_review'])
    expect(migrated.presentationPersonalizationEnabled).toBe(false)
    expect(migrated.presentationProfile).toBeDefined()
    expect(Array.isArray(migrated.presentationOverrides)).toBe(true)
    expect(Array.isArray(migrated.presentationAdaptationAudit)).toBe(true)
  })

  it('preserves valid adaptive presentation state', () => {
    const migrated = migrateToLatest(compatibilityVaults['build016_adaptive_presentation'])
    expect(migrated.presentationPersonalizationEnabled).toBe(true)
    expect(migrated.presentationMappingRegistryVersion).toBe('2026.07.11')
    expect(migrated.presentationProfile?.validationState).toBe('neutral')
  })

  it('fails closed for malformed adaptive presentation state', () => {
    const migrated = migrateToLatest({
      ...compatibilityVaults['build015_understanding_review'],
      presentationPersonalizationEnabled: 'yes',
      presentationProfile: { malformed: true },
      presentationOverrides: [{ bad: true }],
      presentationAdaptationAudit: [{ bad: true }],
    } as never)
    expect(migrated.presentationPersonalizationEnabled).toBe(false)
    expect(migrated.presentationProfile?.profileVersion).toBe('v1')
    expect(migrated.presentationOverrides).toEqual([])
    expect(migrated.presentationAdaptationAudit).toEqual([])
  })
})
