import type { PersonalData } from './localData'

const VAULT_KEY = 'imos.vault.v1'
const LEGACY_KEY = 'imos.personal.v1'
const RECOVERY_AUDIT_KEY = 'imos.recovery.audit.v1'
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

export type RecoveryAuditEvent = {
  id: string
  type: 'backup-created' | 'backup-verified' | 'recovery-tested' | 'vault-restored' | 'passphrase-rotated' | 'recovery-failed'
  createdAt: string
  detail: string
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToBase64(new Uint8Array(digest))
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations = ITERATIONS): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
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

function audit(type: RecoveryAuditEvent['type'], detail: string): void {
  const current = getRecoveryAudit()
  const event: RecoveryAuditEvent = { id: crypto.randomUUID(), type, detail, createdAt: new Date().toISOString() }
  localStorage.setItem(RECOVERY_AUDIT_KEY, JSON.stringify([event, ...current].slice(0, 100)))
}

export function getRecoveryAudit(): RecoveryAuditEvent[] {
  try {
    return JSON.parse(localStorage.getItem(RECOVERY_AUDIT_KEY) ?? '[]') as RecoveryAuditEvent[]
  } catch {
    return []
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
  audit('backup-created', 'Encrypted backup package created.')
  return backup
}

export async function verifyBackupPackage(value: unknown): Promise<BackupPackage> {
  if (!value || typeof value !== 'object') throw new Error('Backup package is invalid.')
  const backup = value as Partial<BackupPackage>
  if (backup.format !== 'imos-backup' || backup.version !== 1 || typeof backup.createdAt !== 'string' || typeof backup.checksum !== 'string') throw new Error('Unsupported backup package.')
  assertEnvelope(backup.vault)
  const expected = await sha256(JSON.stringify(backup.vault))
  if (expected !== backup.checksum) throw new Error('Backup checksum verification failed.')
  audit('backup-verified', 'Backup structure and checksum verified.')
  return backup as BackupPackage
}

export async function testRecovery(value: unknown, passphrase: string): Promise<{ records: number; createdAt: string }> {
  try {
    const backup = await verifyBackupPackage(value)
    const recovered = await decryptEnvelope(backup.vault, passphrase)
    const records = Object.values(recovered).reduce((total, item) => total + (Array.isArray(item) ? item.length : 0), 0)
    audit('recovery-tested', `Recovery test passed with ${records} records.`)
    return { records, createdAt: backup.createdAt }
  } catch (reason) {
    audit('recovery-failed', reason instanceof Error ? reason.message : 'Recovery test failed.')
    throw reason
  }
}

export async function restoreBackup(value: unknown, passphrase: string): Promise<PersonalData> {
  const backup = await verifyBackupPackage(value)
  const recovered = await decryptEnvelope(backup.vault, passphrase)
  localStorage.setItem(VAULT_KEY, JSON.stringify(backup.vault))
  audit('vault-restored', `Vault restored from backup created ${backup.createdAt}.`)
  return recovered
}

export async function rotatePassphrase(data: PersonalData, currentPassphrase: string, newPassphrase: string): Promise<void> {
  await unlockVault(currentPassphrase)
  const replacement = await encryptVault(data, newPassphrase)
  await decryptEnvelope(replacement, newPassphrase)
  localStorage.setItem(VAULT_KEY, JSON.stringify(replacement))
  audit('passphrase-rotated', 'Vault re encrypted and verified with new passphrase material.')
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
