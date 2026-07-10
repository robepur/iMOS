import { describe, it, expect } from 'vitest'
import { RosieEngine } from '../../src/services/RosieEngine'
import { createInitialData } from '../../src/localData'
import type { PersonalData, Priority } from '../../src/localData'

function mkData(overrides: Partial<PersonalData> = {}): PersonalData {
  return { ...createInitialData(), ...overrides }
}

function mkPriority(overrides: Partial<Priority> = {}): Priority {
  return {
    id: 'p1', title: 'Test Priority', why: 'Because', level: 'normal',
    completed: false, primary: false, createdAt: new Date().toISOString(),
    ...overrides,
  }
}

const pastDate = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10)

describe('RosieEngine.generateRecommendations', () => {
  it('returns only security/reflection recs for fresh empty vault', () => {
    const data = mkData()
    const recs = RosieEngine.generateRecommendations(data)
    // For empty vault, only structural/housekeeping recs should appear
    const validCategories = new Set(['security', 'reflection', 'priority'])
    expect(recs.every((r) => validCategories.has(r.category))).toBe(true)
  })

  it('generates no-primary-priority rec when active priorities exist but none is primary', () => {
    const data = mkData({ priorities: [mkPriority({ primary: false })] })
    const recs = RosieEngine.generateRecommendations(data)
    const noPrimary = recs.find((r) => r.id.includes('no-primary'))
    expect(noPrimary).toBeTruthy()
    expect(noPrimary?.severity).toBe('high')
  })

  it('does NOT generate no-primary rec when a primary priority is set', () => {
    const data = mkData({ priorities: [mkPriority({ primary: true })] })
    const recs = RosieEngine.generateRecommendations(data)
    expect(recs.find((r) => r.id.includes('no-primary'))).toBeUndefined()
  })

  it('generates critical-overdue rec for critical past-due priority', () => {
    const data = mkData({
      priorities: [mkPriority({ level: 'critical', due: pastDate(3), primary: true })],
    })
    const recs = RosieEngine.generateRecommendations(data)
    const crit = recs.find((r) => r.id.includes('critical-overdue'))
    expect(crit).toBeTruthy()
    expect(crit?.severity).toBe('critical')
  })

  it('does NOT generate critical-overdue for completed priority', () => {
    const data = mkData({
      priorities: [mkPriority({ level: 'critical', due: pastDate(3), completed: true, primary: false })],
    })
    const recs = RosieEngine.generateRecommendations(data)
    expect(recs.find((r) => r.id.includes('critical-overdue'))).toBeUndefined()
  })

  it('skips dismissed recommendation by id', () => {
    const data = mkData()
    const firstRecs = RosieEngine.generateRecommendations(data)
    if (firstRecs.length === 0) return // nothing to dismiss

    const toSkip = firstRecs[0]
    const withDismissed: PersonalData = {
      ...data,
      recommendations: [{ ...toSkip, dismissed: true }],
    }
    const recs2 = RosieEngine.generateRecommendations(withDismissed)
    expect(recs2.find((r) => r.id === toSkip.id)).toBeUndefined()
  })

  it('returns at most MAX_RECOMMENDATIONS (5) recommendations', () => {
    // Create worst-case data
    const priorities = Array.from({ length: 8 }, (_, i) =>
      mkPriority({ id: `p${i}`, title: `Priority ${i}`, level: 'critical', due: pastDate(i + 1), primary: i === 0 })
    )
    const data = mkData({ priorities })
    const recs = RosieEngine.generateRecommendations(data)
    expect(recs.length).toBeLessThanOrEqual(5)
  })

  it('sorts critical before high before normal', () => {
    const priorities = [
      mkPriority({ id: 'p1', level: 'critical', due: pastDate(2), primary: true }),
      mkPriority({ id: 'p2', level: 'critical', due: pastDate(1), primary: false }),
    ]
    const data = mkData({ priorities })
    const recs = RosieEngine.generateRecommendations(data)
    const sevOrder = recs.map((r) => r.severity)
    const sorted = [...sevOrder].sort((a, b) => {
      const order: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 }
      return (order[a] ?? 4) - (order[b] ?? 4)
    })
    expect(sevOrder).toEqual(sorted)
  })
})

describe('RosieEngine.detectPatterns', () => {
  it('returns empty array for clean state', () => {
    expect(RosieEngine.detectPatterns(mkData())).toEqual([])
  })

  it('detects multiple overdue commitments pattern', () => {
    const commitments = Array.from({ length: 4 }, (_, i) => ({
      id: `c${i}`, title: `Commitment ${i}`, status: 'open' as const,
      due: pastDate(i + 1), createdAt: new Date().toISOString(),
    }))
    const data = mkData({ commitments })
    const patterns = RosieEngine.detectPatterns(data)
    expect(patterns.some((p) => p.includes('overdue'))).toBe(true)
  })
})

describe('RosieEngine.getMorningBrief', () => {
  it('returns active priorities and open decisions', () => {
    const priority = mkPriority({ level: 'critical', primary: true })
    const decision = { id: 'd1', title: 'Dec1', context: '', status: 'open' as const, createdAt: new Date().toISOString() }
    const data = mkData({ priorities: [priority], decisions: [decision] })
    const brief = RosieEngine.getMorningBrief(data)
    expect(brief.priorities.some((p) => p.id === 'p1')).toBe(true)
    expect(brief.openDecisions.some((d) => d.id === 'd1')).toBe(true)
  })
})

describe('RosieEngine.getHealthSignals', () => {
  it('returns non-red for commitment and decision load on clean state', () => {
    const data = mkData()
    const signals = RosieEngine.getHealthSignals(data)
    expect(signals.commitmentLoad).toBe('green')
    expect(signals.decisionLoad).toBe('green')
  })

  it('returns red for recoveryHealth when no recovery test recorded', () => {
    const signals = RosieEngine.getHealthSignals(mkData())
    expect(signals.recoveryHealth).toBe('red')
  })
})
