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
