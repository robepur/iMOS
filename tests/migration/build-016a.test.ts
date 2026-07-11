/**
 * tests/migration/build-016a.test.ts
 * Tests for Build 016A migration: recoveryAudit field and signal identity.
 */
import { describe, it, expect } from 'vitest'
import { normalizePersonalData, createInitialData } from '../../src/localData'
import { createSignal } from '../../src/services/CognitiveSignalEngine'

describe('Build 016A migration', () => {
  it('normalizePersonalData adds recoveryAudit field', () => {
    const data = normalizePersonalData(createInitialData())
    expect(Array.isArray(data.recoveryAudit)).toBe(true)
  })

  it('normalizePersonalData preserves valid recoveryAudit events', () => {
    const raw = {
      ...createInitialData(),
      recoveryAudit: [
        { id: 'e1', type: 'backup-created', createdAt: '2025-01-01T00:00:00Z', detail: 'test' }
      ]
    }
    const data = normalizePersonalData(raw as ReturnType<typeof createInitialData>)
    expect(data.recoveryAudit).toHaveLength(1)
    expect(data.recoveryAudit![0].id).toBe('e1')
  })

  it('signal identity is stable across different window times', () => {
    const base = {
      signalType: 'overdue_commitment_recurrence' as const,
      plainLanguageStatement: 'test',
      dataCategory: 'commitments' as const,
      evidenceIds: ['c-1', 'c-2'],
      evidenceCount: 2,
      deterministicRuleId: 'overdue_commitment_recurrence',
      deterministicRuleVersion: '1.0.0',
      confidenceBasis: 'test',
      permittedFeatureUses: [] as string[],
      provenance: {
        deterministicRuleId: 'overdue_commitment_recurrence',
        ruleVersion: '1.0.0',
        evidenceIds: ['c-1', 'c-2'],
        analysisTimestamp: '2025-01-01T00:00:00Z',
        observationWindowStart: '2025-01-01T00:00:00Z',
        observationWindowEnd: '2025-02-01T00:00:00Z',
      },
      status: 'proposed' as const,
    }
    const s1 = createSignal({ ...base, observationWindowStart: '2025-01-01T00:00:00Z', observationWindowEnd: '2025-02-01T00:00:00Z' }, new Date('2025-02-01'))
    const s2 = createSignal({ ...base, observationWindowStart: '2025-01-10T00:00:00Z', observationWindowEnd: '2025-02-10T00:00:00Z' }, new Date('2025-02-10'))
    expect(s1.signature).toBe(s2.signature)
  })
})
