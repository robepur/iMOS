/**
 * tests/recovery/transactional-restore.test.ts
 * Tests transactional vault restore behavior.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createBackupPackage, restoreBackup, saveVault } from '../../src/vault'
import { createInitialData, normalizePersonalData } from '../../src/localData'

describe('transactional restore', () => {
  const passphrase = 'test-passphrase-secure-123'

  beforeEach(() => {
    localStorage.clear()
  })

  it('restoreBackup with valid backup and passphrase succeeds', async () => {
    const data = normalizePersonalData(createInitialData())
    await saveVault(data, passphrase)
    const backup = await createBackupPackage()
    const restored = await restoreBackup(backup, passphrase)
    expect(restored).toBeDefined()
    expect(restored.version).toBe(1)
  })

  it('restoreBackup with invalid backup throws', async () => {
    await expect(restoreBackup({ invalid: true }, passphrase)).rejects.toThrow()
  })

  it('restoreBackup with wrong passphrase throws and preserves existing vault', async () => {
    const data = normalizePersonalData(createInitialData())
    await saveVault(data, passphrase)
    const backup = await createBackupPackage()
    const vaultBefore = localStorage.getItem('imos.vault.v1')
    await expect(restoreBackup(backup, 'wrong-passphrase-xyz')).rejects.toThrow()
    const vaultAfter = localStorage.getItem('imos.vault.v1')
    expect(vaultAfter).toBe(vaultBefore)
  })
})
