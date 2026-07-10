import type { PersonalData } from './localData'

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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations = ITERATIONS): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
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

  return {
    version: 1,
    algorithm: 'AES-GCM',
    kdf: 'PBKDF2-SHA-256',
    iterations: ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    updatedAt: new Date().toISOString()
  }
}

export async function saveVault(data: PersonalData, passphrase: string): Promise<void> {
  const envelope = await encryptVault(data, passphrase)
  localStorage.setItem(VAULT_KEY, JSON.stringify(envelope))
  localStorage.removeItem(LEGACY_KEY)
}

export async function unlockVault(passphrase: string): Promise<PersonalData> {
  const raw = localStorage.getItem(VAULT_KEY)
  if (!raw) throw new Error('Encrypted vault not found.')

  try {
    const envelope = JSON.parse(raw) as VaultEnvelope
    const salt = base64ToBytes(envelope.salt)
    const iv = base64ToBytes(envelope.iv)
    const ciphertext = base64ToBytes(envelope.ciphertext)
    const key = await deriveKey(passphrase, salt, envelope.iterations)
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    return JSON.parse(new TextDecoder().decode(decrypted)) as PersonalData
  } catch {
    throw new Error('Unable to unlock the vault. Verify the passphrase and try again.')
  }
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

export function exportEncryptedVault(): void {
  const raw = localStorage.getItem(VAULT_KEY)
  if (!raw) throw new Error('No encrypted vault is available to export.')
  const blob = new Blob([raw], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `imos-encrypted-vault-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
