import { describe, expect, it } from 'vitest'
import { performance } from 'node:perf_hooks'
import { MissionPlanningEngine } from '../../src/services/MissionPlanningEngine'
import { KnowledgeGraph } from '../../src/services/KnowledgeGraph'
import { UnderstandingEngine } from '../../src/services/UnderstandingEngine'
import { createMatureVaultFixture } from '../fixtures/matureVaultFixture'
import { createBackupPackage, saveVault, testRecovery, unlockVault, verifyBackupPackage } from '../../src/vault'

function measure<T>(fn: () => T): { durationMs: number; value: T } {
  const start = performance.now()
  const value = fn()
  return { durationMs: performance.now() - start, value }
}

async function measureAsync<T>(fn: () => Promise<T>): Promise<{ durationMs: number; value: T }> {
  const start = performance.now()
  const value = await fn()
  return { durationMs: performance.now() - start, value }
}

describe('Synthetic performance baseline', () => {
  it('records baseline durations for core deterministic engines', async () => {
    const data = createMatureVaultFixture()
    const passphrase = 'phase-two-performance-passphrase'

    const graph = measure(() => KnowledgeGraph.build(data))
    const understanding = measure(() => UnderstandingEngine.analyze(data))
    const mission = measure(() => MissionPlanningEngine.generateMission(data))
    const save = await measureAsync(() => saveVault(data, passphrase))
    const unlock = await measureAsync(() => unlockVault(passphrase))
    const backupCreate = await measureAsync(() => createBackupPackage())
    const backupVerify = await measureAsync(() => verifyBackupPackage(backupCreate.value))
    const recovery = await measureAsync(() => testRecovery(backupCreate.value, passphrase))

    const sample = {
      unlockMs: Number(unlock.durationMs.toFixed(2)),
      saveMs: Number(save.durationMs.toFixed(2)),
      backupCreateMs: Number(backupCreate.durationMs.toFixed(2)),
      backupVerifyMs: Number(backupVerify.durationMs.toFixed(2)),
      recoveryTestMs: Number(recovery.durationMs.toFixed(2)),
      graphMs: Number(graph.durationMs.toFixed(2)),
      understandingMs: Number(understanding.durationMs.toFixed(2)),
      missionMs: Number(mission.durationMs.toFixed(2)),
    }

    console.info('Synthetic baseline sample:', JSON.stringify(sample))

    expect(graph.durationMs).toBeLessThan(200)
    expect(understanding.durationMs).toBeLessThan(200)
    expect(mission.durationMs).toBeLessThan(200)
    expect(save.durationMs).toBeLessThan(1500)
    expect(unlock.durationMs).toBeLessThan(1500)
    expect(backupCreate.durationMs).toBeLessThan(600)
    expect(backupVerify.durationMs).toBeLessThan(600)
    expect(recovery.durationMs).toBeLessThan(1600)
    expect(graph.value.nodes.length).toBeGreaterThan(0)
    expect(understanding.value.summary.length).toBeGreaterThanOrEqual(0)
    expect(mission.value.steps.length).toBeGreaterThan(0)
    expect(unlock.value.missionPlans?.length).toBeGreaterThan(0)
    expect(recovery.value.records).toBeGreaterThan(0)
  })
})
