import { describe, expect, it } from 'vitest'
import type { CognitiveSignal, CognitionConsent, OperatorUnderstanding } from '../../src/types/cognitive'
import { createDefaultCognitionConsent } from '../../src/localData'
import {
  validateSourceSignal,
  createProposedUnderstanding,
  confirmUnderstanding,
  correctUnderstanding,
  rejectUnderstanding,
  expireUnderstanding,
  hasMateriallyNewEvidence,
  suppressSourceSignal,
} from '../../src/services/UnderstandingReviewService'

function consentOn(): CognitionConsent {
  const base = createDefaultCognitionConsent()
  return {
    ...base,
    status: 'on',
    grantedAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
    permittedDataCategories: ['commitments', 'decisions', 'recommendation_outcomes', 'missions', 'review_history'],
    permittedFeatureSurfaces: ['understanding_dashboard', 'review_center', 'rosie_recommendations'],
  }
}

function signalFixture(partial?: Partial<CognitiveSignal>): CognitiveSignal {
  return {
    id: 'sig-1',
    signalType: 'overdue_commitment_recurrence',
    plainLanguageStatement: 'Commitments are repeatedly overdue.',
    dataCategory: 'commitments',
    evidenceIds: ['c1', 'c2', 'c3'],
    evidenceCount: 3,
    deterministicRuleId: 'overdue_commitment_recurrence',
    deterministicRuleVersion: '1.0.0',
    confidenceBasis: '3 overdue commitments in 90 days',
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
    observationWindowStart: '2026-04-10T00:00:00.000Z',
    observationWindowEnd: '2026-07-10T00:00:00.000Z',
    permittedFeatureUses: ['understanding_dashboard'],
    provenance: {
      deterministicRuleId: 'overdue_commitment_recurrence',
      ruleVersion: '1.0.0',
      evidenceIds: ['c1', 'c2', 'c3'],
      analysisTimestamp: '2026-07-10T00:00:00.000Z',
      observationWindowStart: '2026-04-10T00:00:00.000Z',
      observationWindowEnd: '2026-07-10T00:00:00.000Z',
    },
    status: 'proposed',
    signature: 'sig-signature',
    auditHistory: [],
    ...partial,
  }
}

function understandingFixture(): OperatorUnderstanding {
  return {
    id: 'u-1',
    statement: 'Commitments are repeatedly overdue.',
    sourceSignalId: 'sig-1',
    signalType: 'overdue_commitment_recurrence',
    sourceSignalStatus: 'proposed',
    evidenceIds: ['c1', 'c2', 'c3'],
    evidenceCount: 3,
    ruleId: 'overdue_commitment_recurrence',
    ruleVersion: '1.0.0',
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
    confidenceBasis: '3 overdue commitments in 90 days',
    state: 'proposed',
    correctionHistory: [],
    reviewHistory: [],
    materialEvidenceSignature: 'sig',
    personalizationEligible: false,
    permittedFeatureUses: ['understanding_dashboard'],
    provenance: {
      ruleId: 'overdue_commitment_recurrence',
      ruleVersion: '1.0.0',
      evidenceTypes: ['commitments'],
      generatedAt: '2026-07-10T00:00:00.000Z',
      dataSource: 'local_vault',
    },
  }
}

describe('UnderstandingReviewService consent and source validation', () => {
  it('blocks conversion when consent is off', () => {
    const result = validateSourceSignal(signalFixture(), createDefaultCognitionConsent())
    expect(result.valid).toBe(false)
  })

  it('blocks conversion when consent is revoked', () => {
    const revoked = { ...createDefaultCognitionConsent(), status: 'revoked' as const, revokedAt: '2026-07-10T00:00:00.000Z' }
    const result = validateSourceSignal(signalFixture(), revoked)
    expect(result.valid).toBe(false)
  })

  it('blocks conversion when understanding dashboard surface is not permitted', () => {
    const consent = { ...consentOn(), permittedFeatureSurfaces: ['review_center'] as CognitionConsent['permittedFeatureSurfaces'] }
    const result = validateSourceSignal(signalFixture(), consent)
    expect(result.valid).toBe(false)
  })

  it('blocks unknown deterministic rule versions', () => {
    const result = validateSourceSignal(signalFixture({ deterministicRuleVersion: '9.9.9' }), consentOn())
    expect(result.valid).toBe(false)
  })

  it('accepts a valid proposed signal with consent on', () => {
    const result = validateSourceSignal(signalFixture(), consentOn())
    expect(result.valid).toBe(true)
  })
})

describe('UnderstandingReviewService conversion and deduplication', () => {
  it('creates one proposed understanding from a valid signal', () => {
    const created = createProposedUnderstanding({
      signal: signalFixture(),
      consent: consentOn(),
      existingUnderstandings: [],
      rejectedSignatures: [],
      reviewAudit: [],
      now: new Date('2026-07-10T00:00:00.000Z'),
    })
    expect(created.understandings).toHaveLength(1)
    expect(created.understandings[0].state).toBe('proposed')
  })

  it('does not create duplicates on unchanged repeated signal', () => {
    const first = createProposedUnderstanding({
      signal: signalFixture(),
      consent: consentOn(),
      existingUnderstandings: [],
      rejectedSignatures: [],
      reviewAudit: [],
      now: new Date('2026-07-10T00:00:00.000Z'),
    })
    const second = createProposedUnderstanding({
      signal: signalFixture(),
      consent: consentOn(),
      existingUnderstandings: first.understandings,
      rejectedSignatures: first.rejectedSignatures,
      reviewAudit: first.reviewAudit,
      now: new Date('2026-07-10T01:00:00.000Z'),
    })
    expect(second.understandings).toHaveLength(1)
  })

  it('rejected signatures block unchanged reappearance', () => {
    const created = createProposedUnderstanding({
      signal: signalFixture(),
      consent: consentOn(),
      existingUnderstandings: [],
      rejectedSignatures: ['overdue_commitment_recurrence|1.0.0|overdue_commitment_recurrence|c1,c2,c3|2026-04-10T00:00:00.000Z|2026-07-10T00:00:00.000Z|commitments are repeatedly overdue.'],
      reviewAudit: [],
      now: new Date('2026-07-10T00:00:00.000Z'),
    })
    expect(created.understandings).toHaveLength(0)
  })
})

describe('UnderstandingReviewService lifecycle', () => {
  it('confirmation requires explicit action and sets personalization eligible', () => {
    const confirmed = confirmUnderstanding([understandingFixture()], 'u-1', new Date('2026-07-10T00:00:00.000Z'), consentOn())
    expect(confirmed[0].state).toBe('operator_confirmed')
    expect(confirmed[0].personalizationEligible).toBe(true)
  })

  it('correction preserves original statement in correction history', () => {
    const corrected = correctUnderstanding([understandingFixture()], 'u-1', 'Corrected statement', 'operator adjustment', new Date('2026-07-10T00:00:00.000Z'), consentOn())
    expect(corrected[0].state).toBe('operator_corrected')
    expect(corrected[0].correctionHistory[0].originalStatement).toBe('Commitments are repeatedly overdue.')
    expect(corrected[0].statement).toBe('Corrected statement')
  })

  it('rejection is terminal and records signature blocklist', () => {
    const rejected = rejectUnderstanding([understandingFixture()], 'u-1', [], 'not correct', new Date('2026-07-10T00:00:00.000Z'), consentOn())
    expect(rejected.understandings[0].state).toBe('operator_rejected')
    expect(rejected.rejectedSignatures).toContain('sig')
  })

  it('expired understanding is set deterministically', () => {
    const expired = expireUnderstanding([understandingFixture()], 'u-1', new Date('2026-07-10T00:00:00.000Z'), consentOn())
    expect(expired[0].state).toBe('expired')
    expect(expired[0].expiredAt).toBe('2026-07-10T00:00:00.000Z')
  })
})

describe('UnderstandingReviewService materially new evidence', () => {
  it('returns false for reordered identical evidence', () => {
    const prev = understandingFixture()
    const nextSignal = signalFixture({ evidenceIds: ['c3', 'c2', 'c1'] })
    expect(hasMateriallyNewEvidence(prev, nextSignal)).toBe(false)
  })

  it('returns true when new evidence id is present', () => {
    const prev = understandingFixture()
    const nextSignal = signalFixture({ evidenceIds: ['c1', 'c2', 'c3', 'c4'], evidenceCount: 4 })
    expect(hasMateriallyNewEvidence(prev, nextSignal)).toBe(true)
  })
})

describe('UnderstandingReviewService suppression separation', () => {
  it('suppression updates source signal independently of understanding rejection', () => {
    const suppressed = suppressSourceSignal([signalFixture()], 'sig-1', new Date('2026-07-10T00:00:00.000Z'), consentOn())
    expect(suppressed[0].status).toBe('suppressed')
  })
})



describe('UnderstandingReviewService release gate hardening', () => {
  it('blocks lifecycle mutation when consent is off', () => {
    const original = understandingFixture()
    const result = confirmUnderstanding(
      [original],
      original.id,
      new Date('2026-07-10T00:00:00.000Z'),
      createDefaultCognitionConsent(),
    )
    expect(result[0].state).toBe('proposed')
    expect(result[0].personalizationEligible).toBe(false)
  })

  it('rejects signal provenance that does not match the rule', () => {
    const signal = signalFixture({
      provenance: {
        ...signalFixture().provenance,
        deterministicRuleId: 'repeated_decision_reopening',
      },
    })
    expect(validateSourceSignal(signal, consentOn()).valid).toBe(false)
  })

  it('rejects inconsistent evidence provenance', () => {
    const signal = signalFixture({
      provenance: {
        ...signalFixture().provenance,
        evidenceIds: ['c1', 'c2'],
      },
    })
    expect(validateSourceSignal(signal, consentOn()).valid).toBe(false)
  })

  it('blocks unchanged rejected evidence after observation timestamps and wording change', () => {
    const first = createProposedUnderstanding({
      signal: signalFixture(),
      consent: consentOn(),
      existingUnderstandings: [],
      rejectedSignatures: [],
      reviewAudit: [],
      now: new Date('2026-07-10T00:00:00.000Z'),
    })
    const rejected = rejectUnderstanding(
      first.understandings,
      first.understandings[0].id,
      [],
      'incorrect',
      new Date('2026-07-10T00:01:00.000Z'),
      consentOn(),
    )
    const regenerated = signalFixture({
      id: 'sig-2',
      plainLanguageStatement: 'A newly worded statement using the same evidence.',
      observationWindowStart: '2026-04-11T00:00:00.000Z',
      observationWindowEnd: '2026-07-11T00:00:00.000Z',
      provenance: {
        ...signalFixture().provenance,
        analysisTimestamp: '2026-07-11T00:00:00.000Z',
        observationWindowStart: '2026-04-11T00:00:00.000Z',
        observationWindowEnd: '2026-07-11T00:00:00.000Z',
      },
    })
    const result = createProposedUnderstanding({
      signal: regenerated,
      consent: consentOn(),
      existingUnderstandings: rejected.understandings,
      rejectedSignatures: rejected.rejectedSignatures,
      reviewAudit: [],
      now: new Date('2026-07-11T00:00:00.000Z'),
    })
    expect(result.understandings).toHaveLength(1)
    expect(result.understandings[0].state).toBe('operator_rejected')
  })
})
