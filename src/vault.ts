import { migrateToLatest } from './SchemaVersion'
import type { PersonalData } from './localData'
import type { RecoveryAuditEvent } from './types/recovery'

const VAULT_KEY = 'imos.vault.v1'
const LEGACY_KEY = 'imos.personal.v1'
const ITERATIONS = 310_000

export type VaultEnvelope = {
  version: 1
  algorithm: 'AES-GCM'
  kdf: 'PBKDF2-SHA-256'
  iterations: number
  salt: string
  iv: string
  ciphertext: string
  updatedAt: string
}

export type BackupPackage = {
  format: 'imos-backup'
  version: 1
  createdAt: string
  checksum: string
  vault: VaultEnvelope
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)) as Uint8Array<ArrayBuffer>
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToBase64(new Uint8Array(digest))
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations = ITERATIONS): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function assertEnvelope(value: unknown): asserts value is VaultEnvelope {
  if (!value || typeof value !== 'object') throw new Error('Backup vault envelope is missing.')
  const envelope = value as Partial<VaultEnvelope>
  if (envelope.version !== 1 || envelope.algorithm !== 'AES-GCM' || envelope.kdf !== 'PBKDF2-SHA-256') throw new Error('Unsupported vault format.')
  if (!Number.isInteger(envelope.iterations) || (envelope.iterations ?? 0) < ITERATIONS) throw new Error('Unsafe key derivation parameters.')
  for (const field of ['salt', 'iv', 'ciphertext', 'updatedAt'] as const) {
    if (typeof envelope[field] !== 'string' || !envelope[field]) throw new Error(`Vault ${field} is invalid.`)
  }
}

function audit(type: RecoveryAuditEvent['type'], detail: string): RecoveryAuditEvent {
  return { id: crypto.randomUUID(), type, detail, createdAt: new Date().toISOString() }
}

export function getRecoveryAudit(data: PersonalData): RecoveryAuditEvent[] {
  return data.recoveryAudit ?? []
}

export function addRecoveryAuditEvent(data: PersonalData, event: RecoveryAuditEvent): PersonalData {
  const existing = data.recoveryAudit ?? []
  return { ...data, recoveryAudit: [event, ...existing].slice(0, 100) }
}

export function hasLegacyRecoveryAudit(): boolean {
  return localStorage.getItem('imos.recovery.audit.v1') !== null
}

export function clearLegacyRecoveryAudit(): void {
  localStorage.removeItem('imos.recovery.audit.v1')
}

export function migrateLegacyRecoveryAudit(data: PersonalData): PersonalData {
  const LEGACY_AUDIT_KEY = 'imos.recovery.audit.v1'
  const raw = localStorage.getItem(LEGACY_AUDIT_KEY)
  if (!raw) return data
  try {
    const legacy = JSON.parse(raw) as unknown[]
    if (!Array.isArray(legacy)) throw new Error('Legacy recovery audit is malformed.')
    const valid = legacy.filter((e): e is RecoveryAuditEvent => Boolean(
      e
      && typeof e === 'object'
      && typeof (e as Record<string, unknown>).id === 'string'
      && typeof (e as Record<string, unknown>).type === 'string'
      && typeof (e as Record<string, unknown>).createdAt === 'string'
      && typeof (e as Record<string, unknown>).detail === 'string',
    ))
    if (valid.length !== legacy.length) throw new Error('Legacy recovery audit contains invalid records.')
    const existing = data.recoveryAudit ?? []
    return { ...data, recoveryAudit: [...existing, ...valid].slice(0, 100) }
  } catch (reason) {
    throw reason instanceof Error ? reason : new Error('Legacy recovery audit migration failed.')
  }
}

export function vaultExists(): boolean {
  return localStorage.getItem(VAULT_KEY) !== null
}

export function legacyDataExists(): boolean {
  return localStorage.getItem(LEGACY_KEY) !== null
}

export async function encryptVault(data: PersonalData, passphrase: string): Promise<VaultEnvelope> {
  if (passphrase.length < 12) throw new Error('Passphrase must contain at least 12 characters.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)
  const plaintext = new TextEncoder().encode(JSON.stringify(data))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  return { version: 1, algorithm: 'AES-GCM', kdf: 'PBKDF2-SHA-256', iterations: ITERATIONS, salt: bytesToBase64(salt), iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(encrypted)), updatedAt: new Date().toISOString() }
}

export async function decryptEnvelope(envelope: VaultEnvelope, passphrase: string): Promise<PersonalData> {
  assertEnvelope(envelope)
  try {
    const key = await deriveKey(passphrase, base64ToBytes(envelope.salt), envelope.iterations)
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(envelope.iv) }, key, base64ToBytes(envelope.ciphertext))
    return JSON.parse(new TextDecoder().decode(decrypted)) as PersonalData
  } catch {
    throw new Error('Backup authentication failed. Verify the passphrase and file integrity.')
  }
}

export async function saveVault(data: PersonalData, passphrase: string): Promise<void> {
  localStorage.setItem(VAULT_KEY, JSON.stringify(await encryptVault(data, passphrase)))
  localStorage.removeItem(LEGACY_KEY)
}

export async function unlockVault(passphrase: string): Promise<PersonalData> {
  const raw = localStorage.getItem(VAULT_KEY)
  if (!raw) throw new Error('Encrypted vault not found.')
  return decryptEnvelope(JSON.parse(raw) as VaultEnvelope, passphrase)
}

export async function createBackupPackage(): Promise<BackupPackage> {
  const raw = localStorage.getItem(VAULT_KEY)
  if (!raw) throw new Error('No encrypted vault is available to back up.')
  const vault = JSON.parse(raw) as VaultEnvelope
  assertEnvelope(vault)
  const backup: BackupPackage = { format: 'imos-backup', version: 1, createdAt: new Date().toISOString(), checksum: '', vault }
  backup.checksum = await sha256(JSON.stringify(backup.vault))
  return backup
}

export async function verifyBackupPackage(value: unknown): Promise<BackupPackage> {
  if (!value || typeof value !== 'object') throw new Error('Backup package is invalid.')
  const backup = value as Partial<BackupPackage>
  if (backup.format !== 'imos-backup' || backup.version !== 1 || typeof backup.createdAt !== 'string' || typeof backup.checksum !== 'string') throw new Error('Unsupported backup package.')
  assertEnvelope(backup.vault)
  const expected = await sha256(JSON.stringify(backup.vault))
  if (expected !== backup.checksum) throw new Error('Backup checksum verification failed.')
  return backup as BackupPackage
}

export async function testRecovery(value: unknown, passphrase: string): Promise<{ records: number; createdAt: string; auditEvent: RecoveryAuditEvent }> {
  try {
    const backup = await verifyBackupPackage(value)
    const recovered = await decryptEnvelope(backup.vault, passphrase)
    const records = Object.values(recovered).reduce((total, item) => total + (Array.isArray(item) ? item.length : 0), 0)
    const auditEvent = audit('recovery-tested', `Recovery test passed with ${records} records.`)
    return { records, createdAt: backup.createdAt, auditEvent }
  } catch (reason) {
    throw reason instanceof Error ? reason : new Error('Recovery test failed.')
  }
}

export async function restoreBackup(value: unknown, passphrase: string): Promise<PersonalData> {
  const backup = await verifyBackupPackage(value)
  const recovered = await decryptEnvelope(backup.vault, passphrase)
  const migrated = migrateToLatest(recovered)
  if (!migrated || migrated.version !== 1) throw new Error('Migrated vault is invalid.')
  const previous = localStorage.getItem(VAULT_KEY)
  const candidate = await encryptVault(migrated, passphrase)
  const verified = await decryptEnvelope(candidate, passphrase)
  if (!verified || verified.version !== 1) {
    if (previous !== null) localStorage.setItem(VAULT_KEY, previous)
    else localStorage.removeItem(VAULT_KEY)
    throw new Error('Vault candidate verification failed after restore.')
  }
  try {
    localStorage.setItem(VAULT_KEY, JSON.stringify(candidate))
  } catch {
    if (previous !== null) localStorage.setItem(VAULT_KEY, previous)
    else localStorage.removeItem(VAULT_KEY)
    throw new Error('Vault commit failed. Previous vault preserved.')
  }
  const event = audit('vault-restored', `Vault restored from backup created ${backup.createdAt}.`)
  return addRecoveryAuditEvent(migrated, event)
}

export async function rotatePassphrase(data: PersonalData, currentPassphrase: string, newPassphrase: string): Promise<void> {
  await unlockVault(currentPassphrase)
  const replacement = await encryptVault(data, newPassphrase)
  await decryptEnvelope(replacement, newPassphrase)
  localStorage.setItem(VAULT_KEY, JSON.stringify(replacement))
}

export function readLegacyData(): PersonalData | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    return raw ? JSON.parse(raw) as PersonalData : null
  } catch {
    return null
  }
}

export function clearVault(): void {
  localStorage.removeItem(VAULT_KEY)
  localStorage.removeItem(LEGACY_KEY)
}

export async function exportEncryptedVault(): Promise<void> {
  const backup = await createBackupPackage()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `imos-secure-backup-${new Date().toISOString().slice(0, 10)}.imos`
  anchor.click()
  URL.revokeObjectURL(url)
}
