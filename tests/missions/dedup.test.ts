import { describe, expect, it } from 'vitest'
import { KnowledgeGraph } from '../../src/services/KnowledgeGraph'
import { createMatureVaultFixture } from '../fixtures/matureVaultFixture'

describe('Mission deduplication behavior', () => {
  it('keeps graph node and edge counts stable across repeated builds', () => {
    const data = createMatureVaultFixture()
    const first = KnowledgeGraph.build(data)
    const second = KnowledgeGraph.build(data)

    expect(second.nodes.length).toBe(first.nodes.length)
    expect(second.edges.length).toBe(first.edges.length)
    expect(new Set(second.nodes.map((node) => node.id)).size).toBe(second.nodes.length)
    expect(new Set(second.edges.map((edge) => edge.id)).size).toBe(second.edges.length)
  })
})
