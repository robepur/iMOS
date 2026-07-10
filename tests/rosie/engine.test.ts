import { describe, it, expect } from 'vitest'
import { RosieEngine } from '../../src/services/RosieEngine'
import type { PersonalData } from '../../src/localData'

const BASE: PersonalData = {
  version: 1, priorities: [], commitments: [], decisions: [], timeline: [], reflections: [], secrets: [],
}

describe('RosieEngine', () => {
  describe('getGreeting', () => {
    it('returns a non-empty string', () => {
      expect(RosieEngine.getGreeting().length).toBeGreaterThan(0)
    })
  })

  describe('getRecommendation', () => {
    it('returns no-priority message when undefined', () => {
      expect(RosieEngine.getRecommendation(undefined)).toContain('No primary priority')
    })

    it('includes priority title when provided', () => {
      const p = { id: 'p1', title: 'Deploy iMOS', why: 'Critical mission.', level: 'high' as const, due: '', completed: false, primary: true, order: 0, createdAt: '', updatedAt: '' }
      expect(RosieEngine.getRecommendation(p)).toContain('Deploy iMOS')
    })
  })

  describe('getMemory', () => {
    it('returns empty for no reflections', () => {
      expect(RosieEngine.getMemory(BASE)).toEqual([])
    })

    it('extracts remember fields from reflections', () => {
      const data = {
        ...BASE,
        reflections: [{ id: 'r1', accomplished: '', remember: 'Stay disciplined', tomorrow: '', createdAt: new Date().toISOString() }],
      }
      const items = RosieEngine.getMemory(data)
      expect(items).toHaveLength(1)
      expect(items[0].text).toBe('Stay disciplined')
    })

    it('ignores reflections with empty remember fields', () => {
      const data = {
        ...BASE,
        reflections: [{ id: 'r1', accomplished: 'Did something', remember: '', tomorrow: '', createdAt: new Date().toISOString() }],
      }
      expect(RosieEngine.getMemory(data)).toHaveLength(0)
    })
  })

  describe('getExecutiveSummary', () => {
    it('returns empty array when no activity', () => {
      expect(RosieEngine.getExecutiveSummary(BASE, 'all')).toEqual([])
    })

    it('counts completed commitments', () => {
      const data = {
        ...BASE,
        commitments: [{ id: 'c1', title: 'Do it', due: '', status: 'complete' as const, createdAt: new Date().toISOString() }],
      }
      const lines = RosieEngine.getExecutiveSummary(data, 'all')
      expect(lines.some(l => l.includes('Completed 1 commitment'))).toBe(true)
    })
  })
})
