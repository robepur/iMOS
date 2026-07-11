/**
 * VaultService — single point of access for all cryptographic operations.
 * App.tsx and hooks never call vault.ts directly; they go through VaultService.
 */

import type { PersonalData } from '../localData'
import {
  saveVault,
  unlockVault,
  restoreBackup,
  rotatePassphrase,
  exportEncryptedVault,
  verifyBackupPackage,
  testRecovery,
  encryptVault,
  decryptEnvelope,
  getRecoveryAudit,
  migrateLegacyRecoveryAudit,
} from '../vault'
import { StorageService } from './StorageService'
import { migrateToLatest } from '../SchemaVersion'

export const VaultService = {
  /** Save the current in-memory PersonalData to LocalStorage, encrypted. */
  async save(data: PersonalData, passphrase: string): Promise<void> {
    await saveVault(data, passphrase)
  },

  /** Decrypt and return the active vault. Applies schema migration. */
  async unlock(passphrase: string): Promise<PersonalData> {
    const raw = await unlockVault(passphrase)
    return migrateToLatest(migrateLegacyRecoveryAudit(raw))
  },

  /** Create a new vault from initial data. */
  async create(data: PersonalData, passphrase: string): Promise<void> {
    await saveVault(data, passphrase)
  },

  /** Restore from a backup package, returns migrated data. */
  async restore(backup: unknown, passphrase: string): Promise<PersonalData> {
    const raw = await restoreBackup(backup, passphrase)
    return migrateToLatest(raw)
  },

  /** Rotate passphrase — re-encrypts existing vault data under new key. */
  async rotatePassphrase(data: PersonalData, current: string, next: string): Promise<void> {
    await rotatePassphrase(data, current, next)
  },

  /** Export encrypted backup file to disk. */
  async exportBackup(): Promise<void> {
    await exportEncryptedVault()
  },

  /** Verify a backup package integrity without decrypting data. */
  async verifyBackup(value: unknown) {
    return verifyBackupPackage(value)
  },

  /** Test decryption in memory without touching the active vault. */
  async testRecovery(value: unknown, passphrase: string) {
    return testRecovery(value, passphrase)
  },

  getRecoveryAudit,

  exists: () => StorageService.vaultExists(),

  /** Raw encrypt/decrypt — available for tests. */
  _encryptVault: encryptVault,
  _decryptEnvelope: decryptEnvelope,
}
