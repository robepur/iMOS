/**
 * StorageService — isolated LocalStorage access layer.
 * All raw storage reads and writes go through this service.
 * Swapping to a different persistence provider only requires changing this file.
 */

import { STORAGE_KEYS } from '../constants'
import type { PersonalData } from '../localData'
import type { RecoveryAuditEvent } from '../types/recovery'

export const StorageService = {
  vaultExists(): boolean {
    return localStorage.getItem(STORAGE_KEYS.VAULT) !== null
  },

  readRawVault(): string | null {
    return localStorage.getItem(STORAGE_KEYS.VAULT)
  },

  writeRawVault(json: string): void {
    localStorage.setItem(STORAGE_KEYS.VAULT, json)
  },

  clearVault(): void {
    localStorage.removeItem(STORAGE_KEYS.VAULT)
    localStorage.removeItem(STORAGE_KEYS.LEGACY)
  },

  legacyDataExists(): boolean {
    return localStorage.getItem(STORAGE_KEYS.LEGACY) !== null
  },

  readLegacyData(): PersonalData | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LEGACY)
      return raw ? (JSON.parse(raw) as PersonalData) : null
    } catch {
      return null
    }
  },

  removeLegacyData(): void {
    localStorage.removeItem(STORAGE_KEYS.LEGACY)
  },

  readRecoveryAudit(): RecoveryAuditEvent[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.RECOVERY_AUDIT) ?? '[]') as RecoveryAuditEvent[]
    } catch {
      return []
    }
  },

  writeRecoveryAudit(events: RecoveryAuditEvent[]): void {
    localStorage.setItem(STORAGE_KEYS.RECOVERY_AUDIT, JSON.stringify(events))
  },
}
