import { describe, it, expect } from 'vitest'
import {
  isCognitionEnabled,
  isCognitionRevoked,
  isDataCategoryPermitted,
  isFeatureSurfacePermitted,
  enableCognition,
  disableCognition,
  revokeCognition,
  resetCognition,
  updateCognitionPermissions,
  validateConsent,
  normalizeCognitionConsent,
} from '../../src/services/CognitionConsentService'
import { createDefaultCognitionConsent } from '../../src/localData'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOffConsent() {
  return createDefaultCognitionConsent()
}

function makeOnConsent() {
  return enableCognition(
    createDefaultCognitionConsent(),
    ['priorities', 'commitments'],
    ['briefing', 'review'],
  )
}

// ---------------------------------------------------------------------------
// Default consent
// ---------------------------------------------------------------------------

describe('createDefaultCognitionConsent', () => {
  it('defaults to off', () => {
    const c = createDefaultCognitionConsent()
    expect(c.status).toBe('off')
  })

  it('has no permitted data categories', () => {
    expect(createDefaultCognitionConsent().permittedDataCategories).toHaveLength(0)
  })

  it('has no permitted feature surfaces', () => {
    expect(createDefaultCognitionConsent().permittedFeatureSurfaces).toHaveLength(0)
  })

  it('has empty audit history', () => {
    expect(createDefaultCognitionConsent().auditHistory).toHaveLength(0)
  })

  it('has a non-empty purpose statement', () => {
    expect(createDefaultCognitionConsent().purpose.length).toBeGreaterThan(10)
  })
})

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

describe('isCognitionEnabled', () => {
  it('returns false for off consent', () => {
    expect(isCognitionEnabled(makeOffConsent())).toBe(false)
  })

  it('returns true for enabled consent', () => {
    expect(isCognitionEnabled(makeOnConsent())).toBe(true)
  })

  it('returns false for revoked consent', () => {
    expect(isCognitionEnabled(revokeCognition(makeOnConsent()))).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isCognitionEnabled(undefined)).toBe(false)
  })
})

describe('isCognitionRevoked', () => {
  it('returns true for revoked consent', () => {
    expect(isCognitionRevoked(revokeCognition(makeOnConsent()))).toBe(true)
  })

  it('returns false for off consent', () => {
    expect(isCognitionRevoked(makeOffConsent())).toBe(false)
  })
})

describe('isDataCategoryPermitted', () => {
  it('returns false when cognition is off', () => {
    const c = makeOffConsent()
    expect(isDataCategoryPermitted(c, 'priorities')).toBe(false)
  })

  it('returns true for a permitted category when on', () => {
    const c = makeOnConsent()
    expect(isDataCategoryPermitted(c, 'priorities')).toBe(true)
  })

  it('returns false for a non-permitted category when on', () => {
    const c = makeOnConsent()
    expect(isDataCategoryPermitted(c, 'missions')).toBe(false)
  })

  it('returns false when cognition is revoked even if categories were set', () => {
    const c = revokeCognition(makeOnConsent())
    expect(isDataCategoryPermitted(c, 'priorities')).toBe(false)
  })
})

describe('isFeatureSurfacePermitted', () => {
  it('returns false when cognition is off', () => {
    expect(isFeatureSurfacePermitted(makeOffConsent(), 'briefing')).toBe(false)
  })

  it('returns true for permitted surface when on', () => {
    expect(isFeatureSurfacePermitted(makeOnConsent(), 'briefing')).toBe(true)
  })

  it('returns false for non-permitted surface when on', () => {
    expect(isFeatureSurfacePermitted(makeOnConsent(), 'missions')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Enable
// ---------------------------------------------------------------------------

describe('enableCognition', () => {
  it('sets status to on', () => {
    const c = enableCognition(makeOffConsent(), ['priorities'], ['briefing'])
    expect(c.status).toBe('on')
  })

  it('sets permitted categories', () => {
    const c = enableCognition(makeOffConsent(), ['priorities', 'decisions'], ['briefing'])
    expect(c.permittedDataCategories).toContain('priorities')
    expect(c.permittedDataCategories).toContain('decisions')
  })

  it('adds an enabled audit event', () => {
    const c = enableCognition(makeOffConsent(), ['priorities'], ['briefing'])
    expect(c.auditHistory.at(-1)?.action).toBe('enabled')
  })

  it('sets grantedAt on first enable', () => {
    const c = enableCognition(makeOffConsent(), [], [])
    expect(c.grantedAt).toBeTruthy()
  })

  it('fails closed on revoked consent — does not re-enable', () => {
    const revoked = revokeCognition(makeOnConsent())
    const attempted = enableCognition(revoked, ['priorities'], ['briefing'])
    expect(attempted.status).toBe('revoked')
  })
})

// ---------------------------------------------------------------------------
// Disable
// ---------------------------------------------------------------------------

describe('disableCognition', () => {
  it('sets status to off', () => {
    const c = disableCognition(makeOnConsent())
    expect(c.status).toBe('off')
  })

  it('adds a disabled audit event', () => {
    const c = disableCognition(makeOnConsent())
    expect(c.auditHistory.at(-1)?.action).toBe('disabled')
  })

  it('is idempotent on already-off consent', () => {
    const off = makeOffConsent()
    const result = disableCognition(off)
    expect(result).toBe(off) // same reference — no change
  })
})

// ---------------------------------------------------------------------------
// Revoke
// ---------------------------------------------------------------------------

describe('revokeCognition', () => {
  it('sets status to revoked', () => {
    const c = revokeCognition(makeOnConsent())
    expect(c.status).toBe('revoked')
  })

  it('sets revokedAt', () => {
    const c = revokeCognition(makeOnConsent())
    expect(c.revokedAt).toBeTruthy()
  })

  it('clears permitted categories', () => {
    const c = revokeCognition(makeOnConsent())
    expect(c.permittedDataCategories).toHaveLength(0)
  })

  it('adds a revoked audit event', () => {
    const c = revokeCognition(makeOnConsent())
    expect(c.auditHistory.at(-1)?.action).toBe('revoked')
  })
})

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

describe('resetCognition', () => {
  it('returns status off', () => {
    const c = resetCognition(revokeCognition(makeOnConsent()))
    expect(c.status).toBe('off')
  })

  it('preserves prior audit history', () => {
    const on = makeOnConsent()
    const revoked = revokeCognition(on)
    const reset = resetCognition(revoked)
    expect(reset.auditHistory.length).toBeGreaterThan(1)
  })

  it('adds a reset audit event', () => {
    const c = resetCognition(makeOnConsent())
    expect(c.auditHistory.at(-1)?.action).toBe('reset')
  })

  it('clears permitted categories', () => {
    const c = resetCognition(makeOnConsent())
    expect(c.permittedDataCategories).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Update permissions
// ---------------------------------------------------------------------------

describe('updateCognitionPermissions', () => {
  it('updates categories without changing status', () => {
    const on = makeOnConsent()
    const updated = updateCognitionPermissions(on, ['decisions'], ['review'])
    expect(updated.status).toBe('on')
    expect(updated.permittedDataCategories).toEqual(['decisions'])
    expect(updated.permittedFeatureSurfaces).toEqual(['review'])
  })

  it('adds an updated audit event', () => {
    const updated = updateCognitionPermissions(makeOnConsent(), [], [])
    expect(updated.auditHistory.at(-1)?.action).toBe('updated')
  })
})

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('validateConsent', () => {
  it('accepts a valid off consent', () => {
    expect(validateConsent(makeOffConsent())).toEqual({ valid: true })
  })

  it('accepts a valid on consent', () => {
    expect(validateConsent(makeOnConsent())).toEqual({ valid: true })
  })

  it('rejects null', () => {
    const r = validateConsent(null)
    expect(r.valid).toBe(false)
  })

  it('rejects invalid status', () => {
    const c = { ...makeOffConsent(), status: 'unknown' }
    expect(validateConsent(c).valid).toBe(false)
  })

  it('rejects missing version', () => {
    const c = { ...makeOffConsent(), version: '' }
    expect(validateConsent(c).valid).toBe(false)
  })

  it('rejects revoked without revokedAt', () => {
    const c = { ...makeOffConsent(), status: 'revoked' }
    expect(validateConsent(c).valid).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Normalization — fail closed
// ---------------------------------------------------------------------------

describe('normalizeCognitionConsent', () => {
  it('returns safe default for null input', () => {
    const n = normalizeCognitionConsent(null)
    expect(n.status).toBe('off')
    expect(n.permittedDataCategories).toHaveLength(0)
  })

  it('preserves valid consent', () => {
    const original = makeOnConsent()
    const n = normalizeCognitionConsent(original)
    expect(n.status).toBe('on')
    expect(n.permittedDataCategories).toContain('priorities')
  })

  it('fails closed on corrupt data — returns safe default', () => {
    const corrupt = { status: 'on', version: '', purpose: '', updatedAt: '', permittedDataCategories: [], permittedFeatureSurfaces: [], auditHistory: [] }
    const n = normalizeCognitionConsent(corrupt)
    expect(n.status).toBe('off')
  })
})

// ---------------------------------------------------------------------------
// Security boundary: no capture before consent
// ---------------------------------------------------------------------------

describe('no capture before consent', () => {
  it('default consent permits no data categories', () => {
    const c = createDefaultCognitionConsent()
    const categories = ['priorities', 'commitments', 'decisions', 'reflections',
      'review_history', 'understanding_history', 'missions', 'recommendation_outcomes', 'preferences'] as const
    categories.forEach((cat) => {
      expect(isDataCategoryPermitted(c, cat)).toBe(false)
    })
  })

  it('default consent permits no feature surfaces', () => {
    const c = createDefaultCognitionConsent()
    const surfaces = ['briefing', 'review', 'missions', 'recommendations', 'understanding_dashboard'] as const
    surfaces.forEach((surf) => {
      expect(isFeatureSurfacePermitted(c, surf)).toBe(false)
    })
  })
})
