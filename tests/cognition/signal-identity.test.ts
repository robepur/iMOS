/**
 * tests/cognition/signal-identity.test.ts
 * Tests that signal identity (signature) is stable and does not include window timestamps.
 */
import { describe, it, expect } from 'vitest'
import { createSignal } from '../../src/services/CognitiveSignalEngine'

const BASE_PARTIAL = {
  signalType: 'overdue_commitment_recurrence' as const,
  plainLanguageStatement: 'test',
  dataCategory: 'commitments' as const,
  evidenceCount: 2,
  deterministicRuleId: 'overdue_commitment_recurrence',
  deterministicRuleVersion: '1.0.0',
  confidenceBasis: 'test basis',
  observationWindowStart: '2025-01-01T00:00:00Z',
  observationWindowEnd: '2025-02-01T00:00:00Z',
  permittedFeatureUses: ['rosie_recommendations'] as string[],
  provenance: {
    deterministicRuleId: 'overdue_commitment_recurrence',
    ruleVersion: '1.0.0',
    evidenceIds: ['c-1', 'c-2'],
    analysisTimestamp: '2025-02-01T00:00:00Z',
    observationWindowStart: '2025-01-01T00:00:00Z',
    observationWindowEnd: '2025-02-01T00:00:00Z',
  },
  status: 'proposed' as const,
}

describe('signal identity', () => {
  it('same evidence in different order produces same signature', () => {
    const s1 = createSignal({ ...BASE_PARTIAL, evidenceIds: ['c-1', 'c-2'] }, new Date('2025-02-01T00:00:00Z'))
    const s2 = createSignal({ ...BASE_PARTIAL, evidenceIds: ['c-2', 'c-1'] }, new Date('2025-02-01T00:00:00Z'))
    expect(s1.signature).toBe(s2.signature)
  })

  it('same evidence at different times produces same signature', () => {
    const s1 = createSignal({
      ...BASE_PARTIAL,
      evidenceIds: ['c-1', 'c-2'],
      observationWindowStart: '2025-01-01T00:00:00Z',
      observationWindowEnd: '2025-02-01T00:00:00Z',
    }, new Date('2025-02-01T00:00:00Z'))
    const s2 = createSignal({
      ...BASE_PARTIAL,
      evidenceIds: ['c-1', 'c-2'],
      observationWindowStart: '2025-01-15T00:00:00Z',
      observationWindowEnd: '2025-02-15T00:00:00Z',
    }, new Date('2025-02-15T00:00:00Z'))
    expect(s1.signature).toBe(s2.signature)
  })

  it('different evidence produces different signature', () => {
    const s1 = createSignal({ ...BASE_PARTIAL, evidenceIds: ['c-1', 'c-2'] }, new Date('2025-02-01T00:00:00Z'))
    const s2 = createSignal({ ...BASE_PARTIAL, evidenceIds: ['c-1', 'c-3'] }, new Date('2025-02-01T00:00:00Z'))
    expect(s1.signature).not.toBe(s2.signature)
  })
})
