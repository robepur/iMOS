import { beforeEach, describe, expect, it } from 'vitest'
import { createBackupPackage, restoreBackup, saveVault, testRecovery, unlockVault, verifyBackupPackage } from '../../src/vault'
import { createMatureVaultFixture } from '../fixtures/matureVaultFixture'

const PASSPHRASE = 'phase-two-consolidation-passphrase'

describe('Mission backup and recovery', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('preserves mission records through backup and restore', async () => {
    const fixture = createMatureVaultFixture()
    await saveVault(fixture, PASSPHRASE)
    const backup = await createBackupPackage()
    const restored = await restoreBackup(backup, PASSPHRASE)

    expect(restored.missionPlans?.length).toBe(fixture.missionPlans?.length)
    expect(restored.missionSteps?.length).toBe(fixture.missionSteps?.length)
    expect(restored.missionSteps?.some((step) => step.status === 'blocked')).toBe(true)
    expect(restored.missionSteps?.some((step) => step.operatorOverrideReason)).toBe(true)
  })

  it('rejects tampered backup data fail-closed', async () => {
    const fixture = createMatureVaultFixture()
    await saveVault(fixture, PASSPHRASE)
    const backup = await createBackupPackage()
    const tampered = { ...backup, checksum: 'tampered-checksum' }
    await expect(verifyBackupPackage(tampered)).rejects.toThrow()
  })

  it('supports recovery test and unlock flow with mission data', async () => {
    const fixture = createMatureVaultFixture()
    await saveVault(fixture, PASSPHRASE)
    const backup = await createBackupPackage()
    const recovery = await testRecovery(backup, PASSPHRASE)
    expect(recovery.records).toBeGreaterThan(0)

    await restoreBackup(backup, PASSPHRASE)
    const unlocked = await unlockVault(PASSPHRASE)
    expect(unlocked.missionPlans?.[0]?.title).toBe('Mission Alpha')
  })
})
