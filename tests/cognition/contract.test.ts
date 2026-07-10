import { describe, it, expect } from 'vitest'
import {
  validateProvenance,
  validateUnderstanding,
  isTransitionAllowed,
  transitionState,
  confirmUnderstanding,
  rejectUnderstanding,
  correctUnderstanding,
  expireUnderstanding,
  createUnderstanding,
  getConfirmedUnderstandings,
  getPendingReviewUnderstandings,
  applyExpirations,
  normalizeUnderstanding,
} from '../../src/services/CognitionContractService'
import type { OperatorUnderstanding, UnderstandingProvenance } from '../../src/types/cognitive'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProvenance(): UnderstandingProvenance {
  return {
    ruleId: 'rule:priority-overload',
    ruleVersion: '1.0.0',
    evidenceTypes: ['priority', 'timeline'],
    generatedAt: new Date().toISOString(),
    dataSource: 'local_vault',
  }
}

function makeUnderstanding(): OperatorUnderstanding {
  const u = createUnderstanding({
    statement: 'Priorities consistently exceed capacity.',
    evidenceIds: ['p1', 'p2', 'p3'],
    ruleId: 'rule:priority-overload',
    ruleVersion: '1.0.0',
    confidenceBasis: 'Based on 7 observations over 14 days.',
    provenance: makeProvenance(),
    permittedFeatureUses: ['briefing'],
  })
  if (!u) throw new Error('createUnderstanding returned null unexpectedly')
  return u
}

// ---------------------------------------------------------------------------
// Provenance validation
// ---------------------------------------------------------------------------

describe('validateProvenance', () => {
  it('accepts valid provenance', () => {
    expect(validateProvenance(makeProvenance())).toEqual({ valid: true })
  })

  it('rejects null provenance', () => {
    expect(validateProvenance(null).valid).toBe(false)
  })

  it('rejects missing ruleId', () => {
    expect(validateProvenance({ ...makeProvenance(), ruleId: '' }).valid).toBe(false)
  })

  it('rejects missing ruleVersion', () => {
    expect(validateProvenance({ ...makeProvenance(), ruleVersion: '' }).valid).toBe(false)
  })

  it('rejects wrong dataSource', () => {
    expect(validateProvenance({ ...makeProvenance(), dataSource: 'cloud' }).valid).toBe(false)
  })

  it('rejects missing evidenceTypes array', () => {
    const p = makeProvenance()
    const bad = { ...p, evidenceTypes: undefined }
    expect(validateProvenance(bad).valid).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Understanding validation
// ---------------------------------------------------------------------------

describe('validateUnderstanding', () => {
  it('accepts a valid understanding', () => {
    expect(validateUnderstanding(makeUnderstanding())).toEqual({ valid: true })
  })

  it('rejects null', () => {
    expect(validateUnderstanding(null).valid).toBe(false)
  })

  it('rejects empty statement', () => {
    const u = { ...makeUnderstanding(), statement: '' }
    expect(validateUnderstanding(u).valid).toBe(false)
  })

  it('rejects invalid state', () => {
    const u = { ...makeUnderstanding(), state: 'unknown' }
    expect(validateUnderstanding(u).valid).toBe(false)
  })

  it('rejects missing provenance', () => {
    const u = { ...makeUnderstanding(), provenance: null }
    expect(validateUnderstanding(u).valid).toBe(false)
  })

  it('rejects invalid provenance inside understanding', () => {
    const u = { ...makeUnderstanding(), provenance: { ...makeProvenance(), dataSource: 'cloud' } }
    expect(validateUnderstanding(u).valid).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Lifecycle transitions
// ---------------------------------------------------------------------------

describe('isTransitionAllowed', () => {
  it('allows observed -> proposed', () => {
    expect(isTransitionAllowed('observed', 'proposed')).toBe(true)
  })

  it('allows proposed -> operator_confirmed', () => {
    expect(isTransitionAllowed('proposed', 'operator_confirmed')).toBe(true)
  })

  it('allows proposed -> operator_rejected', () => {
    expect(isTransitionAllowed('proposed', 'operator_rejected')).toBe(true)
  })

  it('allows operator_confirmed -> expired', () => {
    expect(isTransitionAllowed('operator_confirmed', 'expired')).toBe(true)
  })

  it('does not allow operator_rejected -> operator_confirmed (terminal)', () => {
    expect(isTransitionAllowed('operator_rejected', 'operator_confirmed')).toBe(false)
  })

  it('does not allow expired -> operator_confirmed directly', () => {
    expect(isTransitionAllowed('expired', 'operator_confirmed')).toBe(false)
  })

  it('allows expired -> proposed (re-enter review)', () => {
    expect(isTransitionAllowed('expired', 'proposed')).toBe(true)
  })
})

describe('transitionState', () => {
  it('transitions to proposed', () => {
    const u = makeUnderstanding()
    const next = transitionState(u, 'proposed')
    expect(next.state).toBe('proposed')
  })

  it('fails closed on invalid transition — returns unchanged', () => {
    const u = makeUnderstanding()
    const rejected = rejectUnderstanding(transitionState(u, 'proposed'))
    const attempted = transitionState(rejected, 'operator_confirmed')
    expect(attempted.state).toBe('operator_rejected')
  })

  it('sets expiredAt when transitioning to expired', () => {
    const u = transitionState(makeUnderstanding(), 'proposed')
    const expired = expireUnderstanding(u)
    expect(expired.expiredAt).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Operator actions
// ---------------------------------------------------------------------------

describe('confirmUnderstanding', () => {
  it('confirms a proposed understanding', () => {
    const proposed = transitionState(makeUnderstanding(), 'proposed')
    const confirmed = confirmUnderstanding(proposed)
    expect(confirmed.state).toBe('operator_confirmed')
  })

  it('fails closed on observed (not proposed yet)', () => {
    const u = makeUnderstanding()
    // observed -> operator_confirmed is not allowed
    const attempted = confirmUnderstanding(u)
    expect(attempted.state).toBe('observed')
  })
})

describe('rejectUnderstanding', () => {
  it('rejects a proposed understanding', () => {
    const proposed = transitionState(makeUnderstanding(), 'proposed')
    const rejected = rejectUnderstanding(proposed)
    expect(rejected.state).toBe('operator_rejected')
  })

  it('rejected understanding is terminal — cannot confirm', () => {
    const proposed = transitionState(makeUnderstanding(), 'proposed')
    const rejected = rejectUnderstanding(proposed)
    const attempted = confirmUnderstanding(rejected)
    expect(attempted.state).toBe('operator_rejected')
  })
})

describe('correctUnderstanding', () => {
  it('applies correction and transitions to operator_corrected', () => {
    const proposed = transitionState(makeUnderstanding(), 'proposed')
    const corrected = correctUnderstanding(proposed, 'Updated statement from operator.')
    expect(corrected.state).toBe('operator_corrected')
    expect(corrected.statement).toBe('Updated statement from operator.')
  })

  it('adds correction to history', () => {
    const proposed = transitionState(makeUnderstanding(), 'proposed')
    const corrected = correctUnderstanding(proposed, 'New statement.')
    expect(corrected.correctionHistory).toHaveLength(1)
    expect(corrected.correctionHistory[0].originalStatement).toContain('Priorities')
  })

  it('preserves reason when provided', () => {
    const proposed = transitionState(makeUnderstanding(), 'proposed')
    const corrected = correctUnderstanding(proposed, 'New statement.', 'Context changed.')
    expect(corrected.correctionHistory[0].reason).toBe('Context changed.')
  })
})

describe('expireUnderstanding', () => {
  it('transitions to expired', () => {
    const proposed = transitionState(makeUnderstanding(), 'proposed')
    const expired = expireUnderstanding(proposed)
    expect(expired.state).toBe('expired')
    expect(expired.expiredAt).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

describe('createUnderstanding', () => {
  it('creates an observed understanding', () => {
    const u = makeUnderstanding()
    expect(u.state).toBe('observed')
  })

  it('returns null on invalid provenance', () => {
    const result = createUnderstanding({
      statement: 'Test.',
      evidenceIds: [],
      ruleId: 'rule:test',
      ruleVersion: '1.0.0',
      confidenceBasis: 'n/a',
      provenance: { ...makeProvenance(), dataSource: 'cloud' as never },
    })
    expect(result).toBeNull()
  })

  it('assigns unique ids', () => {
    const a = makeUnderstanding()
    const b = makeUnderstanding()
    expect(a.id).not.toBe(b.id)
  })
})

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

describe('getConfirmedUnderstandings', () => {
  it('returns only operator_confirmed understandings', () => {
    const proposed = transitionState(makeUnderstanding(), 'proposed')
    const confirmed = confirmUnderstanding(proposed)
    const rejected = rejectUnderstanding(transitionState(makeUnderstanding(), 'proposed'))
    const results = getConfirmedUnderstandings([proposed, confirmed, rejected])
    expect(results).toHaveLength(1)
    expect(results[0].state).toBe('operator_confirmed')
  })
})

describe('getPendingReviewUnderstandings', () => {
  it('returns observed and proposed understandings', () => {
    const observed = makeUnderstanding()
    const proposed = transitionState(makeUnderstanding(), 'proposed')
    const confirmed = confirmUnderstanding(transitionState(makeUnderstanding(), 'proposed'))
    const results = getPendingReviewUnderstandings([observed, proposed, confirmed])
    expect(results).toHaveLength(2)
  })
})

describe('applyExpirations', () => {
  it('expires understandings past their expiresAt', () => {
    const base = transitionState(makeUnderstanding(), 'proposed')
    const stale = { ...base, expiresAt: new Date(Date.now() - 10000).toISOString() }
    const results = applyExpirations([stale])
    expect(results[0].state).toBe('expired')
  })

  it('does not expire understandings with future expiresAt', () => {
    const base = transitionState(makeUnderstanding(), 'proposed')
    const future = { ...base, expiresAt: new Date(Date.now() + 86400000).toISOString() }
    const results = applyExpirations([future])
    expect(results[0].state).toBe('proposed')
  })

  it('does not alter already rejected understandings', () => {
    const base = transitionState(makeUnderstanding(), 'proposed')
    const rejected = { ...rejectUnderstanding(base), expiresAt: new Date(Date.now() - 10000).toISOString() }
    const results = applyExpirations([rejected])
    expect(results[0].state).toBe('operator_rejected')
  })
})

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

describe('normalizeUnderstanding', () => {
  it('returns null for invalid input', () => {
    expect(normalizeUnderstanding(null)).toBeNull()
    expect(normalizeUnderstanding({ id: '', statement: '', state: 'observed', ruleId: 'r', ruleVersion: '1', confidenceBasis: 'b', provenance: makeProvenance(), evidenceIds: [], correctionHistory: [], permittedFeatureUses: [] })).toBeNull()
  })

  it('normalizes a valid understanding', () => {
    const u = makeUnderstanding()
    const n = normalizeUnderstanding(u)
    expect(n).not.toBeNull()
    expect(n!.id).toBe(u.id)
    expect(n!.state).toBe('observed')
  })
})
