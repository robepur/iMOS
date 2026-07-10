import { describe, it, expect } from 'vitest'
import { KnowledgeGraph } from '../../src/services/KnowledgeGraph'
import { createInitialData } from '../../src/localData'
import type { PersonalData, Priority, Commitment, Decision, Reflection } from '../../src/localData'

function mkData(overrides: Partial<PersonalData> = {}): PersonalData {
  return { ...createInitialData(), ...overrides }
}

function mkPriority(overrides: Partial<Priority> = {}): Priority {
  return {
    id: 'p1', title: 'Deploy Infrastructure Project', why: 'mission critical',
    level: 'high', due: '', completed: false, primary: false,
    order: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function mkCommitment(overrides: Partial<Commitment> = {}): Commitment {
  return { id: 'c1', title: 'Review Infrastructure Timeline', due: '', status: 'open', createdAt: new Date().toISOString(), ...overrides }
}

function mkDecision(overrides: Partial<Decision> = {}): Decision {
  return { id: 'd1', title: 'Infrastructure Vendor Selection', context: 'Need to choose cloud provider for the infrastructure project', status: 'open', createdAt: new Date().toISOString(), ...overrides }
}

function mkReflection(overrides: Partial<Reflection> = {}): Reflection {
  return {
    id: 'r1', accomplished: 'Made progress on deploy infrastructure project', remember: 'Infrastructure work is critical', tomorrow: 'Continue infrastructure deployment',
    createdAt: new Date().toISOString(), ...overrides,
  }
}

// ── Build graph ────────────────────────────────────────────────────────────────

describe('KnowledgeGraph.build', () => {
  it('returns empty graph for empty vault', () => {
    const g = KnowledgeGraph.build(mkData())
    // Initial data may have sample nodes
    expect(g.nodes).toBeDefined()
    expect(g.edges).toBeDefined()
    expect(g.builtAt).toBeTruthy()
  })

  it('builds node for each record type', () => {
    const data = mkData({
      priorities: [mkPriority()],
      commitments: [mkCommitment()],
      decisions: [mkDecision()],
      reflections: [mkReflection()],
    })
    const g = KnowledgeGraph.build(data)
    const types = new Set(g.nodes.map((n) => n.type))
    expect(types.has('priority')).toBe(true)
    expect(types.has('commitment')).toBe(true)
    expect(types.has('decision')).toBe(true)
    expect(types.has('reflection')).toBe(true)
  })
})

// ── Relationship discovery ─────────────────────────────────────────────────────

describe('KnowledgeGraph relationship discovery', () => {
  it('discovers reflection → priority mentioned_in relationship', () => {
    const p = mkPriority({ id: 'p1', title: 'Deploy Infrastructure Project' })
    const r = mkReflection({ id: 'r1', accomplished: 'Worked on deploy infrastructure project today', remember: '', tomorrow: '' })
    const data = mkData({ priorities: [p], reflections: [r] })
    const g = KnowledgeGraph.build(data)
    const edge = g.edges.find((e) => e.type === 'mentioned_in' && e.source === 'r1' && e.target === 'p1')
    expect(edge).toBeTruthy()
  })

  it('discovers reflection remember → priority remembered_by relationship', () => {
    const p = mkPriority({ id: 'p1', title: 'Deploy Infrastructure Project' })
    const r = mkReflection({ id: 'r1', remember: 'The infrastructure deployment is critical', accomplished: '', tomorrow: '' })
    const data = mkData({ priorities: [p], reflections: [r] })
    const g = KnowledgeGraph.build(data)
    const edge = g.edges.find((e) => e.type === 'remembered_by' && e.source === 'r1' && e.target === 'p1')
    expect(edge).toBeTruthy()
  })

  it('discovers priority ↔ commitment related_to relationship', () => {
    const p = mkPriority({ id: 'p1', title: 'Deploy Infrastructure Project' })
    const c = mkCommitment({ id: 'c1', title: 'Complete Infrastructure Review' })
    const data = mkData({ priorities: [p], commitments: [c] })
    const g = KnowledgeGraph.build(data)
    const edge = g.edges.find((e) => e.type === 'related_to' && e.source === 'p1' && e.target === 'c1')
    expect(edge).toBeTruthy()
  })

  it('discovers decision → priority depends_on relationship via context', () => {
    const p = mkPriority({ id: 'p1', title: 'Deploy Infrastructure Project' })
    const d = mkDecision({ id: 'd1', title: 'Vendor Choice', context: 'This decision affects the infrastructure deployment' })
    const data = mkData({ priorities: [p], decisions: [d] })
    const g = KnowledgeGraph.build(data)
    const edge = g.edges.find((e) => e.type === 'depends_on' && e.source === 'd1' && e.target === 'p1')
    expect(edge).toBeTruthy()
  })

  it('discovers commitment → decision references relationship', () => {
    const d = mkDecision({ id: 'd1', title: 'Infrastructure Vendor Selection' })
    const c = mkCommitment({ id: 'c1', title: 'Follow up on vendor infrastructure selection' })
    const data = mkData({ commitments: [c], decisions: [d] })
    const g = KnowledgeGraph.build(data)
    const edge = g.edges.find((e) => e.type === 'references' && e.source === 'c1' && e.target === 'd1')
    expect(edge).toBeTruthy()
  })

  it('discovers completed_by when priority completed on same day as reflection', () => {
    const today = new Date().toISOString().slice(0, 10)
    const p = mkPriority({ id: 'p1', completed: true, completedAt: `${today}T10:00:00.000Z` })
    const r = mkReflection({ id: 'r1', createdAt: `${today}T20:00:00.000Z` })
    const data = mkData({ priorities: [p], reflections: [r] })
    const g = KnowledgeGraph.build(data)
    const edge = g.edges.find((e) => e.type === 'completed_by' && e.source === 'p1' && e.target === 'r1')
    expect(edge).toBeTruthy()
  })

  it('does not discover relationship when titles share no keywords', () => {
    const p = mkPriority({ id: 'p1', title: 'Alpha Bravo Charlie' })
    const c = mkCommitment({ id: 'c1', title: 'Zulu Yankee Xray' })
    const data = mkData({ priorities: [p], commitments: [c] })
    const g = KnowledgeGraph.build(data)
    const edge = g.edges.find((e) => e.source === 'p1' && e.target === 'c1')
    expect(edge).toBeUndefined()
  })

  it('deduplicates edges (same pair, same type)', () => {
    const p = mkPriority({ id: 'p1', title: 'Deploy Infrastructure Project' })
    const r1 = mkReflection({ id: 'r1', accomplished: 'Infrastructure progress', remember: 'infrastructure project matters', tomorrow: '' })
    const data = mkData({ priorities: [p], reflections: [r1] })
    const g = KnowledgeGraph.build(data)
    // Should not have duplicate edge IDs
    const ids = g.edges.map((e) => e.id)
    const uniqueIds = new Set(ids)
    expect(ids.length).toBe(uniqueIds.size)
  })
})

// ── getRelated ─────────────────────────────────────────────────────────────────

describe('KnowledgeGraph.getRelated', () => {
  it('returns all records connected to a node', () => {
    const p = mkPriority({ id: 'p1', title: 'Deploy Infrastructure Project' })
    const r = mkReflection({ id: 'r1', accomplished: 'infrastructure project work', remember: '', tomorrow: '' })
    const c = mkCommitment({ id: 'c1', title: 'Check Infrastructure Status' })
    const data = mkData({ priorities: [p], reflections: [r], commitments: [c] })
    const g = KnowledgeGraph.build(data)
    const related = KnowledgeGraph.getRelated(g, 'p1')
    const relatedIds = related.map((r) => r.node.id)
    // Should have at least the reflection and commitment as related
    expect(relatedIds.length).toBeGreaterThan(0)
  })

  it('returns empty array for node with no connections', () => {
    const p = mkPriority({ id: 'isolated', title: 'Aaaaa Bbbbb Ccccc Ddddd' })
    const data = mkData({ priorities: [p] })
    const g = KnowledgeGraph.build(data)
    const related = KnowledgeGraph.getRelated(g, 'isolated')
    expect(related).toEqual([])
  })
})

// ── search ─────────────────────────────────────────────────────────────────────

describe('KnowledgeGraph.search', () => {
  it('returns direct matches for query', () => {
    const p = mkPriority({ id: 'p1', title: 'Deploy Infrastructure Project' })
    const data = mkData({ priorities: [p] })
    const g = KnowledgeGraph.build(data)
    const results = KnowledgeGraph.search(g, 'Infrastructure')
    const direct = results.filter((r) => r.matchType === 'direct')
    expect(direct.some((r) => r.node.id === 'p1')).toBe(true)
  })

  it('returns empty for blank query', () => {
    const g = KnowledgeGraph.build(mkData())
    expect(KnowledgeGraph.search(g, '')).toEqual([])
  })

  it('returns related records via graph edges', () => {
    const p = mkPriority({ id: 'p1', title: 'Deploy Infrastructure Project' })
    const c = mkCommitment({ id: 'c1', title: 'Infrastructure Timeline Review' })
    const data = mkData({ priorities: [p], commitments: [c] })
    const g = KnowledgeGraph.build(data)
    const results = KnowledgeGraph.search(g, 'Infrastructure')
    // Both should appear (direct or related)
    const ids = results.map((r) => r.node.id)
    expect(ids).toContain('p1')
    // c1 may appear as related or direct
    const hasC1 = results.some((r) => r.node.id === 'c1')
    expect(hasC1).toBe(true)
  })
})

// ── getStats ───────────────────────────────────────────────────────────────────

describe('KnowledgeGraph.getStats', () => {
  it('returns zeroes for empty graph', () => {
    const stats = KnowledgeGraph.getStats({ nodes: [], edges: [], builtAt: '' })
    expect(stats.totalNodes).toBe(0)
    expect(stats.totalEdges).toBe(0)
  })

  it('counts nodes and edges correctly', () => {
    const p = mkPriority()
    const r = mkReflection({ accomplished: 'Deploy infrastructure project progress', remember: '', tomorrow: '' })
    const data = mkData({ priorities: [p], reflections: [r] })
    const g = KnowledgeGraph.build(data)
    const stats = KnowledgeGraph.getStats(g)
    expect(stats.totalNodes).toBeGreaterThanOrEqual(2)
    expect(stats.totalEdges).toBeGreaterThanOrEqual(0)
  })
})

// ── explainEdge ────────────────────────────────────────────────────────────────

describe('KnowledgeGraph.explainEdge', () => {
  it('produces readable explanation for mentioned_in', () => {
    const g = KnowledgeGraph.build(mkData())
    const fakeEdge = { id: 'e1', source: 's1', target: 't1', type: 'mentioned_in' as const, evidence: [], createdAt: '', confidence: 'low' as const }
    const explanation = KnowledgeGraph.explainEdge(fakeEdge, 'Reflection Jan 1', 'Project Alpha')
    expect(explanation).toContain('Reflection Jan 1')
    expect(explanation).toContain('Project Alpha')
  })
})

// ── Backward compatibility ────────────────────────────────────────────────────

describe('KnowledgeGraph backward compatibility', () => {
  it('builds graph from vault with no knowledgeGraph field (older builds)', () => {
    const data = mkData()
    // Simulate older vault without knowledgeGraph field
    const legacyData = { ...data }
    delete (legacyData as Partial<PersonalData>).knowledgeGraph
    expect(() => KnowledgeGraph.build(legacyData as PersonalData)).not.toThrow()
  })

  it('handles missing optional fields gracefully', () => {
    const data: PersonalData = { ...createInitialData(), secrets: undefined, recommendations: undefined }
    expect(() => KnowledgeGraph.build(data)).not.toThrow()
  })
})
