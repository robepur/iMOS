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
    for (const [build, fixture] of Object.entries(compatibilityVaults)) {
      if (build === 'build013_consent_off') continue
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
