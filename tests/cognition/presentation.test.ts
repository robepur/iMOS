import { describe, expect, it } from 'vitest'
import {
  applyOperatorOverride,
  getNeutralPresentationProfile,
  removeOperatorOverride,
  resolvePresentationProfile,
} from '../../src/services/AdaptivePresentationEngine'
import type { CognitiveConsent, OperatorUnderstanding } from '../../src/types/cognitive'

const consentOn: CognitiveConsent = {
  status: 'on',
  version: '1.0.0',
  purpose: 'test',
  grantedAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  permittedDataCategories: ['understanding_history'],
  permittedFeatureSurfaces: ['briefing', 'review', 'missions'],
  auditHistory: [],
}

const confirmedUnderstanding: OperatorUnderstanding = {
  id: 'u-1',
  statement: 'Operator prefers detailed briefing',
  evidenceIds: ['e-1', 'e-2'],
  ruleId: 'summary_vs_detail_preference',
  ruleVersion: '1.0.0',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  confidenceBasis: 'deterministic',
  state: 'operator_confirmed',
  correctionHistory: [],
  permittedFeatureUses: ['briefing'],
  expirationState: 'active',
  personalizationEligible: true,
  provenance: {
    ruleId: 'summary_vs_detail_preference',
    ruleVersion: '1.0.0',
    evidenceTypes: ['commitment'],
    generatedAt: '2026-01-01T00:00:00.000Z',
    dataSource: 'local_vault',
  },
}

describe('AdaptivePresentationEngine', () => {
  it('returns neutral profile when personalization is disabled', () => {
    const result = resolvePresentationProfile({
      consent: consentOn,
      enabled: false,
      understandings: [confirmedUnderstanding],
      overrides: [],
    })
    expect(result.profile.validationState).toBe('neutral')
    expect(result.profile.activeAdaptations).toHaveLength(0)
  })

  it('fails closed when consent is not granted', () => {
    const result = resolvePresentationProfile({
      consent: { ...consentOn, status: 'off' },
      enabled: true,
      understandings: [confirmedUnderstanding],
      overrides: [],
    })
    expect(result.profile.validationState).toBe('blocked')
  })

  it('applies deterministic adaptation from confirmed eligible understanding', () => {
    const result = resolvePresentationProfile({
      consent: consentOn,
      enabled: true,
      understandings: [confirmedUnderstanding],
      overrides: [],
    })
    expect(result.profile.validationState).toBe('adaptive')
    expect(result.profile.summaryDetailMode).toBe('detail_first')
    expect(result.profile.activeAdaptations.length).toBeGreaterThan(0)
  })

  it('applies operator override with precedence', () => {
    const overrides = applyOperatorOverride([], {
      targetSurface: 'briefing',
      setting: 'summaryDetailMode',
      value: 'summary_first',
    })
    const result = resolvePresentationProfile({
      consent: consentOn,
      enabled: true,
      understandings: [confirmedUnderstanding],
      overrides,
    })
    expect(result.profile.summaryDetailMode).toBe('summary_first')
  })

  it('removes operator override cleanly', () => {
    const overrides = applyOperatorOverride([], {
      targetSurface: 'briefing',
      setting: 'summaryDetailMode',
      value: 'summary_first',
    })
    const removed = removeOperatorOverride(overrides, overrides[0].id)
    expect(removed).toHaveLength(0)
  })

  it('keeps neutral defaults stable', () => {
    const neutral = getNeutralPresentationProfile()
    expect(neutral.summaryDetailMode).toBe('balanced')
    expect(neutral.informationDensity).toBe('standard')
    expect(neutral.validationState).toBe('neutral')
  })
})

