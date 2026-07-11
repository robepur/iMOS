/**
 * tests/rosie/orchestration.test.ts
 * Tests for RosieOrchestrationService determinism.
 */
import { describe, it, expect } from 'vitest'
import { runRosieOrchestration } from '../../src/services/RosieOrchestrationService'
import { createInitialData, normalizePersonalData, createDefaultCognitionConsent } from '../../src/localData'
import type { CognitionConsent } from '../../src/types/cognitive'

function makeEnabledConsent(): CognitionConsent {
  const base = createDefaultCognitionConsent()
  return {
    ...base,
    status: 'on',
    grantedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    permittedDataCategories: [
      'priorities', 'commitments', 'decisions', 'reflections',
      'review_history', 'understanding_history', 'missions',
      'recommendation_outcomes', 'preferences',
    ],
    permittedFeatureSurfaces: [
      'rosie_recommendations', 'morning_brief', 'evening_summary',
      'review_center', 'understanding_dashboard', 'mission_planning',
    ],
  }
}

describe('RosieOrchestrationService', () => {
  const now = new Date('2025-06-01T12:00:00Z')

  it('returns blocked when consent is off', () => {
    const data = normalizePersonalData(createInitialData())
    const result = runRosieOrchestration({ data, now })
    expect(result.blocked).toBe(true)
    expect(result.changed).toBe(false)
  })

  it('same input produces same output (idempotent on second call)', () => {
    const data = normalizePersonalData({ ...createInitialData(), cognitionConsent: makeEnabledConsent() })
    const result1 = runRosieOrchestration({ data, now })
    const data2 = result1.data
    const result2 = runRosieOrchestration({ data: data2, now })
    expect(result2.changed).toBe(false)
  })

  it('changed is false when nothing changes', () => {
    const data = normalizePersonalData({ ...createInitialData(), cognitionConsent: makeEnabledConsent() })
    const result = runRosieOrchestration({ data, now })
    const result2 = runRosieOrchestration({ data: result.data, now })
    expect(result2.changed).toBe(false)
  })
})


it('restores neutral presentation and disables personalization when cognition consent is off', () => {
  const base = normalizePersonalData(createInitialData())
  const data = {
    ...base,
    presentationPersonalizationEnabled: true,
    presentationProfile: {
      ...base.presentationProfile!,
      validationState: 'adaptive' as const,
      activeAdaptations: [{
        adaptationId: 'a1',
        mappingId: 'm1',
        mappingVersion: '1',
        sourceUnderstandingId: 'u1',
        sourceRuleId: 'summary_vs_detail_preference',
        sourceRuleVersion: '1.0.0',
        targetSurface: 'briefing' as const,
        setting: 'summaryDetailMode' as const,
        value: 'detail_first',
        reason: 'test',
        activatedAt: now.toISOString(),
      }],
    },
  }
  const result = runRosieOrchestration({ data, now })
  expect(result.blocked).toBe(true)
  expect(result.changed).toBe(true)
  expect(result.data.presentationPersonalizationEnabled).toBe(false)
  expect(result.data.presentationProfile?.validationState).toBe('neutral')
  expect(result.data.presentationProfile?.activeAdaptations).toHaveLength(0)
})
