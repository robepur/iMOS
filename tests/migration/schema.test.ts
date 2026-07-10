import { describe, it, expect } from 'vitest'
import { migrateToLatest } from '../../src/SchemaVersion'

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
})
