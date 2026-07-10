import { describe, it, expect } from 'vitest'
import { normalizePersonalData } from '../../src/localData'
import type { PersonalData } from '../../src/localData'

const BASE: PersonalData = {
  version: 1, priorities: [], commitments: [], decisions: [], timeline: [], reflections: [], secrets: [],
}

describe('normalizePersonalData', () => {
  it('assigns primary to first incomplete priority when none set', () => {
    const data = normalizePersonalData({
      ...BASE,
      priorities: [
        { id: 'a', title: 'A', why: '', level: 'high', due: '', completed: false, primary: false, order: 0, createdAt: '', updatedAt: '' },
        { id: 'b', title: 'B', why: '', level: 'high', due: '', completed: false, primary: false, order: 1, createdAt: '', updatedAt: '' },
      ],
    })
    expect(data.priorities[0].primary).toBe(true)
    expect(data.priorities[1].primary).toBe(false)
  })

  it('preserves existing primary assignment', () => {
    const data = normalizePersonalData({
      ...BASE,
      priorities: [
        { id: 'a', title: 'A', why: '', level: 'high', due: '', completed: false, primary: false, order: 0, createdAt: '', updatedAt: '' },
        { id: 'b', title: 'B', why: '', level: 'high', due: '', completed: false, primary: true, order: 1, createdAt: '', updatedAt: '' },
      ],
    })
    expect(data.priorities[1].primary).toBe(true)
  })

  it('normalizes unknown priority level to "normal"', () => {
    const data = normalizePersonalData({
      ...BASE,
      priorities: [{ id: 'x', title: 'X', why: '', level: 'unknown-level' as never, due: '', completed: false, primary: false, order: 0, createdAt: '', updatedAt: '' }],
    })
    expect(data.priorities[0].level).toBe('normal')
  })

  it('adds missing secrets array', () => {
    const raw = { ...BASE } as Partial<PersonalData>
    delete (raw as Record<string, unknown>)['secrets']
    const data = normalizePersonalData(raw as PersonalData)
    expect(data.secrets).toEqual([])
  })
})
