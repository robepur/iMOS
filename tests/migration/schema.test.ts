import { describe, it, expect, vi } from 'vitest'
import { migrateToLatest } from '../../src/SchemaVersion'
import { compatibilityVaults } from '../fixtures/compatibilityVaults'

describe('migrateToLatest', () => {
  it('handles null/undefined input', () => {
    const result = migrateToLatest(null)
    expect(result.priorities).toEqual([])
    expect(result.commitments).toEqual([])
    expect(result.secrets).toEqual([])
  })

  it('handles empty object', () => {
    const result = migrateToLatest({})
    expect(result.version).toBe(1)
  })

  it('preserves existing priorities', () => {
    const input = {
      version: 1,
      priorities: [{ id: 'p1', title: 'Test', why: '', level: 'high', due: '', completed: false, primary: true, order: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      commitments: [], decisions: [], timeline: [], reflections: [], secrets: [],
    }
    const result = migrateToLatest(input)
    expect(result.priorities).toHaveLength(1)
    expect(result.priorities[0].title).toBe('Test')
  })

  it('adds missing secrets array for Build 003 vaults', () => {
    const input = {
      version: 1,
      priorities: [], commitments: [], decisions: [], timeline: [], reflections: [],
      // secrets field missing (Build 003 format)
    }
    const result = migrateToLatest(input)
    expect(result.secrets).toEqual([])
  })

  it('normalizes priority with missing optional fields', () => {
    const input = {
      version: 1,
      priorities: [{ id: 'p1', title: 'Missing fields', why: '', completed: false }],
      commitments: [], decisions: [], timeline: [], reflections: [], secrets: [],
    }
    const result = migrateToLatest(input)
    const p = result.priorities[0]
    expect(p.level).toBe('normal')
    expect(p.primary).toBe(true)
    expect(typeof p.order).toBe('number')
  })

  it('adds missing mission fields for legacy vaults', () => {
    const input = {
      version: 1,
      priorities: [], commitments: [], decisions: [], timeline: [], reflections: [], secrets: [],
    }
    const result = migrateToLatest(input)
    expect(result.missionPlans).toEqual([])
    expect(result.missionSteps).toEqual([])
  })

  it('hydrates Build 019 sync defaults as disabled', () => {
    const result = migrateToLatest(compatibilityVaults['build012'])
    expect(result.syncOperatorControlState?.schemaVersion).toBe('1.0.0')
    expect(result.syncOperatorControlState?.enabled).toBe(false)
    expect(result.syncOperatorControlState?.localEndpointConfigured).toBe(false)
    expect(result.syncQuarantine).toEqual([])
  })

  it('fails closed for malformed Build 019 sync persistence state', () => {
    const result = migrateToLatest({
      ...compatibilityVaults['build016_adaptive_presentation'],
      syncOperatorControlState: {
        schemaVersion: '1.0.0',
        enabled: true,
        localEndpointConfigured: true,
        localReferenceEndpoint: 'http://example.com:8787',
        configuredAt: 'not-a-timestamp',
      },
      syncQuarantine: [{
        schemaVersion: '1.0.0',
        id: 'sync-quarantine:secret',
        reason: 'malformed_response',
        disposition: 'pending_review',
        requestId: 'request-1',
        namespace: 'sync:operator',
        objectId: 'obj:1',
        createdAt: '2026-07-11T00:00:00.000Z',
        detail: 'Authorization: Bearer abcdefghijklmnop',
      }],
    } as never)
    expect(result.syncOperatorControlState?.enabled).toBe(false)
    expect(result.syncQuarantine).toEqual([])
  })

  it('migration path performs no network requests', () => {
    const originalFetch = globalThis.fetch
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    try {
      migrateToLatest(compatibilityVaults['build012'])
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
