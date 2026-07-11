/**
 * tests/cognition/signals.test.ts
 *
 * Tests for the CognitiveSignalEngine.
 *
 * Key invariants:
 * - Analysis is blocked when cognition consent is off (fail closed)
 * - Analysis produces proposed signals only (no behavior change)
 * - Signals carry full provenance
 * - Deduplication prevents duplicate signals
 * - Expiry and suppression work correctly
 * - Unknown rules fail closed
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  analyze,
  analyzeRule,
  deduplicateSignals,
  expireSignals,
  suppressSignal,
  getActiveSignals,
  explainSignal,
  validateSignal,
  createSignal,
} from '../../src/services/CognitiveSignalEngine'
import type { PersonalData } from '../../src/localData'
import type { CognitionConsent } from '../../src/types/cognitive'
import { createDefaultCognitionConsent } from '../../src/localData'
import { REGISTRY_VERSION } from '../../src/services/CognitiveSignalRuleRegistry'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeConsent(enabled: boolean): CognitionConsent {
  const base = createDefaultCognitionConsent()
  if (!enabled) return base
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

function makeBaseData(): PersonalData {
  return {
    version: 1,
    priorities: [],
    commitments: [],
    decisions: [],
    timeline: [],
    reflections: [],
  }
}

function makeOverdueCommitments(count: number, relativeToNow: Date): PersonalData['commitments'] {
  // Create commitments with due dates 55 days before the given reference time
  // so they fall within a 90-day observation window
  return Array.from({ length: count }, (_, i) => ({
    id: `c-${i + 1}`,
    title: `Commitment ${i + 1}`,
    due: new Date(relativeToNow.getTime() - 55 * 86400000).toISOString(),
    completed: false,
    status: 'open' as const,
    createdAt: new Date(relativeToNow.getTime() - 90 * 86400000).toISOString(),
    updatedAt: relativeToNow.toISOString(),
  }))
}

// ---------------------------------------------------------------------------
// Consent gate tests
// ---------------------------------------------------------------------------

describe('CognitiveSignalEngine consent gate', () => {
  it('blocks analysis when consent is off (default)', () => {
    const data = makeBaseData()
    const consent = makeConsent(false)
    const result = analyze(data, consent)
    expect(result.blocked).toBe(true)
    expect(result.signals).toHaveLength(0)
    expect(result.blockReason).toBeDefined()
  })

  it('blocks analysis when consent is undefined', () => {
    const data = makeBaseData()
    const result = analyze(data, undefined)
    expect(result.blocked).toBe(true)
    expect(result.signals).toHaveLength(0)
  })

  it('allows analysis when consent is on', () => {
    const data = makeBaseData()
    const consent = makeConsent(true)
    const result = analyze(data, consent)
    expect(result.blocked).toBe(false)
    expect(result.registryVersion).toBe(REGISTRY_VERSION)
  })

  it('produces no signals from empty vault even when consent is on', () => {
    const data = makeBaseData()
    const consent = makeConsent(true)
    const result = analyze(data, consent)
    expect(result.blocked).toBe(false)
    expect(result.signals).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Overdue commitment rule
// ---------------------------------------------------------------------------

describe('overdue_commitment_recurrence rule', () => {
  const FIXED_NOW = new Date('2025-06-01T12:00:00Z')

  it('produces no signal with fewer than minimum evidence items', () => {
    const data: PersonalData = { ...makeBaseData(), commitments: makeOverdueCommitments(2, FIXED_NOW) }
    const consent = makeConsent(true)
    const result = analyze(data, consent, FIXED_NOW)
    const signal = result.signals.find((s) => s.signalType === 'overdue_commitment_recurrence')
    expect(signal).toBeUndefined()
  })

  it('produces a proposed signal with sufficient overdue commitments', () => {
    const data: PersonalData = { ...makeBaseData(), commitments: makeOverdueCommitments(4, FIXED_NOW) }
    const consent = makeConsent(true)
    const result = analyze(data, consent, FIXED_NOW)
    const signal = result.signals.find((s) => s.signalType === 'overdue_commitment_recurrence')
    expect(signal).toBeDefined()
    expect(signal!.status).toBe('proposed')
    expect(signal!.evidenceCount).toBe(4)
  })

  it('signal carries full provenance', () => {
    const data: PersonalData = { ...makeBaseData(), commitments: makeOverdueCommitments(4, FIXED_NOW) }
    const consent = makeConsent(true)
    const result = analyze(data, consent, FIXED_NOW)
    const signal = result.signals.find((s) => s.signalType === 'overdue_commitment_recurrence')
    expect(signal!.provenance).toBeDefined()
    expect(signal!.provenance.deterministicRuleId).toBe('overdue_commitment_recurrence')
    expect(signal!.provenance.evidenceIds).toHaveLength(4)
  })

  it('signal has a stable signature', () => {
    const data: PersonalData = { ...makeBaseData(), commitments: makeOverdueCommitments(4, FIXED_NOW) }
    const consent = makeConsent(true)
    const result1 = analyze(data, consent, FIXED_NOW)
    const result2 = analyze(data, consent, FIXED_NOW)
    const sig1 = result1.signals.find((s) => s.signalType === 'overdue_commitment_recurrence')
    const sig2 = result2.signals.find((s) => s.signalType === 'overdue_commitment_recurrence')
    expect(sig1).toBeDefined()
    expect(sig1!.signature).toBe(sig2!.signature)
  })

  it('must not change any system behavior (proposed state only)', () => {
    const data: PersonalData = { ...makeBaseData(), commitments: makeOverdueCommitments(5, FIXED_NOW) }
    const consent = makeConsent(true)
    const result = analyze(data, consent, FIXED_NOW)
    for (const signal of result.signals) {
      expect(signal.status).toBe('proposed')
    }
  })
})

// ---------------------------------------------------------------------------
// Unknown rule fails closed
// ---------------------------------------------------------------------------

describe('unknown rule handling', () => {
  it('returns null for an unknown rule id', () => {
    const data = makeBaseData()
    const consent = makeConsent(true)
    const signal = analyzeRule('unknown_rule_that_does_not_exist', '1.0.0', data, consent, new Date())
    expect(signal).toBeNull()
  })

  it('returns null for a known rule with wrong version', () => {
    const data = makeBaseData()
    const consent = makeConsent(true)
    const signal = analyzeRule('overdue_commitment_recurrence', '99.0.0', data, consent, new Date())
    expect(signal).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

describe('signal deduplication', () => {
  it('does not add a duplicate signal with the same signature', () => {
    const now = new Date('2025-06-01T12:00:00Z')
    const data: PersonalData = { ...makeBaseData(), commitments: makeOverdueCommitments(4, now) }
    const consent = makeConsent(true)
    const result1 = analyze(data, consent, now)
    const dataWithSignals: PersonalData = { ...data, cognitiveSignals: result1.signals }
    const result2 = analyze(dataWithSignals, consent, now)
    const overdueSignals = result2.signals.filter((s) => s.signalType === 'overdue_commitment_recurrence')
    expect(overdueSignals.length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

describe('signal expiry', () => {
  it('expires a signal past its expiry date', () => {
    const now = new Date('2025-03-01T00:00:00Z')
    const signal = createSignal({
      signalType: 'overdue_commitment_recurrence',
      plainLanguageStatement: 'test',
      dataCategory: 'commitments',
      evidenceIds: ['c-1', 'c-2', 'c-3'],
      evidenceCount: 3,
      deterministicRuleId: 'overdue_commitment_recurrence',
      deterministicRuleVersion: '1.0.0',
      confidenceBasis: 'test',
      observationWindowStart: '2025-01-01T00:00:00Z',
      observationWindowEnd: '2025-02-01T00:00:00Z',
      permittedFeatureUses: ['rosie_recommendations'],
      provenance: {
        deterministicRuleId: 'overdue_commitment_recurrence',
        ruleVersion: '1.0.0',
        evidenceIds: ['c-1', 'c-2', 'c-3'],
        analysisTimestamp: '2025-02-01T00:00:00Z',
        observationWindowStart: '2025-01-01T00:00:00Z',
        observationWindowEnd: '2025-02-01T00:00:00Z',
      },
      status: 'proposed',
      expiresAt: '2025-02-15T00:00:00Z',
    }, new Date('2025-02-01T00:00:00Z'))

    const expired = expireSignals([signal], now)
    expect(expired[0].status).toBe('expired')
    expect(expired[0].expiredAt).toBeDefined()
  })

  it('does not expire a signal before its expiry date', () => {
    const now = new Date('2025-02-10T00:00:00Z')
    const signal = createSignal({
      signalType: 'overdue_commitment_recurrence',
      plainLanguageStatement: 'test',
      dataCategory: 'commitments',
      evidenceIds: ['c-1'],
      evidenceCount: 1,
      deterministicRuleId: 'overdue_commitment_recurrence',
      deterministicRuleVersion: '1.0.0',
      confidenceBasis: 'test',
      observationWindowStart: '2025-01-01T00:00:00Z',
      observationWindowEnd: '2025-02-01T00:00:00Z',
      permittedFeatureUses: [],
      provenance: {
        deterministicRuleId: 'overdue_commitment_recurrence',
        ruleVersion: '1.0.0',
        evidenceIds: ['c-1'],
        analysisTimestamp: '2025-02-01T00:00:00Z',
        observationWindowStart: '2025-01-01T00:00:00Z',
        observationWindowEnd: '2025-02-01T00:00:00Z',
      },
      status: 'proposed',
      expiresAt: '2025-02-15T00:00:00Z',
    }, new Date('2025-02-01T00:00:00Z'))

    const result = expireSignals([signal], now)
    expect(result[0].status).toBe('proposed')
  })
})

// ---------------------------------------------------------------------------
// Suppression
// ---------------------------------------------------------------------------

describe('signal suppression', () => {
  it('suppresses a signal by id', () => {
    const now = new Date()
    const signal = createSignal({
      signalType: 'overdue_commitment_recurrence',
      plainLanguageStatement: 'test',
      dataCategory: 'commitments',
      evidenceIds: ['c-1'],
      evidenceCount: 1,
      deterministicRuleId: 'overdue_commitment_recurrence',
      deterministicRuleVersion: '1.0.0',
      confidenceBasis: 'test',
      observationWindowStart: '2025-01-01T00:00:00Z',
      observationWindowEnd: '2025-02-01T00:00:00Z',
      permittedFeatureUses: [],
      provenance: {
        deterministicRuleId: 'overdue_commitment_recurrence',
        ruleVersion: '1.0.0',
        evidenceIds: ['c-1'],
        analysisTimestamp: '2025-02-01T00:00:00Z',
        observationWindowStart: '2025-01-01T00:00:00Z',
        observationWindowEnd: '2025-02-01T00:00:00Z',
      },
      status: 'proposed',
    }, now)

    const updated = suppressSignal([signal], signal.id, now)
    expect(updated[0].status).toBe('suppressed')
    expect(updated[0].suppressedAt).toBeDefined()
    expect(updated[0].auditHistory.at(-1)?.action).toBe('suppressed')
  })

  it('does not suppress an already-expired signal', () => {
    const now = new Date()
    const signal = createSignal({
      signalType: 'overdue_commitment_recurrence',
      plainLanguageStatement: 'test',
      dataCategory: 'commitments',
      evidenceIds: ['c-1'],
      evidenceCount: 1,
      deterministicRuleId: 'overdue_commitment_recurrence',
      deterministicRuleVersion: '1.0.0',
      confidenceBasis: 'test',
      observationWindowStart: '2025-01-01T00:00:00Z',
      observationWindowEnd: '2025-02-01T00:00:00Z',
      permittedFeatureUses: [],
      provenance: {
        deterministicRuleId: 'overdue_commitment_recurrence',
        ruleVersion: '1.0.0',
        evidenceIds: ['c-1'],
        analysisTimestamp: '2025-02-01T00:00:00Z',
        observationWindowStart: '2025-01-01T00:00:00Z',
        observationWindowEnd: '2025-02-01T00:00:00Z',
      },
      status: 'expired',
    }, now)

    const updated = suppressSignal([signal], signal.id, now)
    expect(updated[0].status).toBe('expired')
  })
})

// ---------------------------------------------------------------------------
// getActiveSignals / explainSignal / validateSignal
// ---------------------------------------------------------------------------

describe('signal utility functions', () => {
  it('getActiveSignals returns only proposed/observed', () => {
    const now = new Date()
    const proposed = createSignal({
      signalType: 'overdue_commitment_recurrence',
      plainLanguageStatement: 'test',
      dataCategory: 'commitments',
      evidenceIds: [],
      evidenceCount: 0,
      deterministicRuleId: 'overdue_commitment_recurrence',
      deterministicRuleVersion: '1.0.0',
      confidenceBasis: 'test',
      observationWindowStart: '2025-01-01T00:00:00Z',
      observationWindowEnd: '2025-02-01T00:00:00Z',
      permittedFeatureUses: [],
      provenance: { deterministicRuleId: 'overdue_commitment_recurrence', ruleVersion: '1.0.0', evidenceIds: [], analysisTimestamp: '2025-02-01T00:00:00Z', observationWindowStart: '2025-01-01T00:00:00Z', observationWindowEnd: '2025-02-01T00:00:00Z' },
      status: 'proposed',
    }, now)
    const suppressed = { ...proposed, id: 'x', signature: 'x', status: 'suppressed' as const }
    const active = getActiveSignals([proposed, suppressed])
    expect(active).toHaveLength(1)
    expect(active[0].status).toBe('proposed')
  })

  it('explainSignal returns a non-empty string', () => {
    const now = new Date()
    const signal = createSignal({
      signalType: 'overdue_commitment_recurrence',
      plainLanguageStatement: 'test',
      dataCategory: 'commitments',
      evidenceIds: ['c-1'],
      evidenceCount: 1,
      deterministicRuleId: 'overdue_commitment_recurrence',
      deterministicRuleVersion: '1.0.0',
      confidenceBasis: 'test basis',
      observationWindowStart: '2025-01-01T00:00:00Z',
      observationWindowEnd: '2025-02-01T00:00:00Z',
      permittedFeatureUses: [],
      provenance: { deterministicRuleId: 'overdue_commitment_recurrence', ruleVersion: '1.0.0', evidenceIds: ['c-1'], analysisTimestamp: '2025-02-01T00:00:00Z', observationWindowStart: '2025-01-01T00:00:00Z', observationWindowEnd: '2025-02-01T00:00:00Z' },
      status: 'proposed',
    }, now)
    const explanation = explainSignal(signal)
    expect(explanation.length).toBeGreaterThan(0)
    expect(explanation).toContain('overdue_commitment_recurrence')
  })

  it('validateSignal returns false for an incomplete signal', () => {
    const invalid = { id: '', signalType: 'overdue_commitment_recurrence', status: 'proposed', deterministicRuleId: '', deterministicRuleVersion: '', signature: '', evidenceIds: [], auditHistory: [], provenance: null }
    expect(validateSignal(invalid as never)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Security boundary: signals must never contain raw vault values
// ---------------------------------------------------------------------------

describe('security boundary: no raw values in signals', () => {
  it('evidence contains only IDs, not raw field values', () => {
    const now = new Date('2025-06-01T12:00:00Z')
    const data: PersonalData = {
      ...makeBaseData(),
      commitments: makeOverdueCommitments(4, now).map((c, i) => ({
        ...c,
        title: `SECRET_PASSWORD_${i}`,
      })),
    }
    const consent = makeConsent(true)
    const result = analyze(data, consent, now)
    const signalJson = JSON.stringify(result.signals)
    expect(signalJson).not.toContain('SECRET_PASSWORD')
  })
})
