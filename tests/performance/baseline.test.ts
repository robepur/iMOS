import { describe, expect, it } from 'vitest'
import { performance } from 'node:perf_hooks'
import { MissionPlanningEngine } from '../../src/services/MissionPlanningEngine'
import { KnowledgeGraph } from '../../src/services/KnowledgeGraph'
import { UnderstandingEngine } from '../../src/services/UnderstandingEngine'
import { createMatureVaultFixture } from '../fixtures/matureVaultFixture'

function measure<T>(fn: () => T): { durationMs: number; value: T } {
  const start = performance.now()
  const value = fn()
  return { durationMs: performance.now() - start, value }
}

describe('Synthetic performance baseline', () => {
  it('records baseline durations for core deterministic engines', () => {
    const data = createMatureVaultFixture()

    const graph = measure(() => KnowledgeGraph.build(data))
    const understanding = measure(() => UnderstandingEngine.analyze(data))
    const mission = measure(() => MissionPlanningEngine.generateMission(data))

    expect(graph.durationMs).toBeLessThan(200)
    expect(understanding.durationMs).toBeLessThan(200)
    expect(mission.durationMs).toBeLessThan(200)
    expect(graph.value.nodes.length).toBeGreaterThan(0)
    expect(understanding.value.summary.length).toBeGreaterThanOrEqual(0)
    expect(mission.value.steps.length).toBeGreaterThan(0)
  })
})
