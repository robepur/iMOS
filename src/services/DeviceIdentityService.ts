import type {
  DeviceIdentityValidationResult,
  DeviceIdentifier,
  DevicePublicIdentity,
  EnrollmentPackage,
  ProofChallenge,
  ProofOfPossession,
} from '../types/deviceIdentity'

const SEMVER = /^\d+\.\d+\.\d+$/
const IDENTITY_SUITE = 'ECDSA_P256_SHA256'
const KEY_VERSION = '1.0.0'
const SUITE_VERSION = '1.0.0'
const SCHEMA_VERSION = '1.0.0'
const POLICY_VERSION = '1.0.0'

const MAX_CANONICAL_DEPTH = 32
const MAX_LABEL_LENGTH = 120
const MAX_NONCE_LENGTH = 128
const MAX_PUBLIC_KEY_BASE64_LENGTH = 8192
const MAX_PACKAGE_TTL_MS = 10 * 60_000
const MAX_CHALLENGE_TTL_MS = 2 * 60_000
const MAX_ALLOWED_FUTURE_SKEW_MS = 60_000

type CanonicalValue = null | boolean | number | string | CanonicalValue[] | { [k: string]: CanonicalValue }

export type LocalDevicePrivateHandle = {
  handleVersion: '1.0.0'
  deviceId: DeviceIdentifier
  keyRef: string
}

export type LocalDeviceIdentity = {
  publicIdentity: DevicePublicIdentity
  privateHandle: LocalDevicePrivateHandle
}

export interface ReplayGuard {
  consumeOnce(key: string, expiresAt: string, now?: Date): boolean
}

export type DevicePrivateKeyRecord = {
  keyRef: string
  deviceId: DeviceIdentifier
  keyVersion: string
  cryptoSuiteVersion: string
  publicSigningKeySpki: string
  privateKey: CryptoKey
  createdAt: string
}

export interface DevicePrivateKeyStore {
  save(record: DevicePrivateKeyRecord): Promise<void>
  load(keyRef: string): Promise<DevicePrivateKeyRecord | null>
  remove(keyRef: string): Promise<void>
}

type GenerateOptions = {
  now?: Date
  store?: DevicePrivateKeyStore
  allowEphemeral?: boolean
}

const volatilePrivateKeys = new Map<string, DevicePrivateKeyRecord>()

class IndexedDbDevicePrivateKeyStore implements DevicePrivateKeyStore {
  constructor(private readonly dbName = 'imos-device-identity', private readonly storeName = 'private-keys') {}

  private async open(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is unavailable.')
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'keyRef' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed.'))
    })
  }

  async save(record: DevicePrivateKeyRecord): Promise<void> {
    const db = await this.open()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite')
      tx.objectStore(this.storeName).put(record)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed.'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted.'))
    })
    db.close()
  }

  async load(keyRef: string): Promise<DevicePrivateKeyRecord | null> {
    const db = await this.open()
    const result = await new Promise<DevicePrivateKeyRecord | null>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly')
      const request = tx.objectStore(this.storeName).get(keyRef)
      request.onsuccess = () => resolve((request.result as DevicePrivateKeyRecord | undefined) ?? null)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed.'))
    })
    db.close()
    return result
  }

  async remove(keyRef: string): Promise<void> {
    const db = await this.open()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite')
      tx.objectStore(this.storeName).delete(keyRef)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed.'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB delete aborted.'))
    })
    db.close()
  }
}

export class InMemoryDevicePrivateKeyStore implements DevicePrivateKeyStore {
  private readonly records = new Map<string, DevicePrivateKeyRecord>()

  async save(record: DevicePrivateKeyRecord): Promise<void> {
    this.records.set(record.keyRef, { ...record })
  }

  async load(keyRef: string): Promise<DevicePrivateKeyRecord | null> {
    const found = this.records.get(keyRef)
    return found ? { ...found } : null
  }

  async remove(keyRef: string): Promise<void> {
    this.records.delete(keyRef)
  }
}

export function createDefaultDevicePrivateKeyStore(): DevicePrivateKeyStore | null {
  if (typeof indexedDB === 'undefined') return null
  return new IndexedDbDevicePrivateKeyStore()
}

export function clearVolatilePrivateKeyHandles(): void {
  volatilePrivateKeys.clear()
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

function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function sha256Bytes(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return new Uint8Array(digest)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function normalizeString(value: string): string {
  return value.normalize('NFC')
}

function canonicalizeValue(
  value: unknown,
  state: { depth: number; seen: WeakSet<object> },
): CanonicalValue {
  if (state.depth > MAX_CANONICAL_DEPTH) throw new Error('Canonical encoding depth limit exceeded.')
  if (value === null) return null
  if (typeof value === 'string') return normalizeString(value)
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite numbers are not supported in canonical encoding.')
    if (Object.is(value, -0)) throw new Error('Negative zero is not supported in canonical encoding.')
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeValue(item, { depth: state.depth + 1, seen: state.seen }))
  }
  if (typeof value === 'object') {
    if (!isPlainObject(value)) throw new Error('Only plain objects are supported in canonical encoding.')
    if (state.seen.has(value)) throw new Error('Cyclic object graphs are not supported in canonical encoding.')
    state.seen.add(value)
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b))
    const normalized: Record<string, CanonicalValue> = {}
    for (const key of keys) {
      const next = value[key]
      if (next === undefined) throw new Error('Undefined values are not supported in canonical encoding.')
      if (typeof next === 'function' || typeof next === 'symbol' || typeof next === 'bigint') {
        throw new Error('Unsupported value type in canonical encoding.')
      }
      normalized[normalizeString(key)] = canonicalizeValue(next, { depth: state.depth + 1, seen: state.seen })
    }
    state.seen.delete(value)
    return normalized
  }
  throw new Error('Unsupported canonical value.')
}

export function canonicalizeStableJson(value: unknown): string {
  return JSON.stringify(canonicalizeValue(value, { depth: 0, seen: new WeakSet<object>() }))
}

export function canonicalizeUtf8(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalizeStableJson(value))
}

function toFingerprint(bytes: Uint8Array): string {
  return [...bytes.slice(0, 16)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join(':')
}

async function deriveDeviceIdentifier(material: {
  publicSigningKeySpki: string
  keyVersion: string
  cryptoSuiteVersion: string
}): Promise<DeviceIdentifier> {
  const digest = await sha256Bytes(canonicalizeStableJson(material))
  const encoded = toBase64Url(bytesToBase64(digest)).slice(0, 32)
  return `device:${encoded}`
}

async function deriveFingerprint(publicSigningKeySpki: string): Promise<string> {
  return toFingerprint(await sha256Bytes(publicSigningKeySpki))
}

async function importPublicVerifyKey(spkiBase64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki',
    base64ToBytes(spkiBase64),
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['verify'],
  )
}

function validateIso(value: string): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function strictObjectKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const keys = Object.keys(value).sort()
  const expectedSorted = [...expected].sort()
  if (keys.length !== expectedSorted.length) return false
  return keys.every((key, index) => key === expectedSorted[index])
}

function isSafeLabel(value: string): boolean {
  if (typeof value !== 'string') return false
  if (value.length === 0 || value.length > MAX_LABEL_LENGTH) return false
  return !/[\u0000-\u001F\u007F]/.test(value)
}

function isSafeNonce(value: string): boolean {
  if (typeof value !== 'string') return false
  if (value.length < 16 || value.length > MAX_NONCE_LENGTH) return false
  return /^[A-Za-z0-9._:-]+$/.test(value)
}

function hasForbiddenSecrets(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.toLowerCase()
    if (
      normalized.includes('private')
      || normalized.includes('passphrase')
      || normalized.includes('vault')
      || normalized.includes('secret')
      || normalized.includes('token')
      || normalized.includes('credential')
    ) {
      return true
    }
    if (entry && typeof entry === 'object' && hasForbiddenSecrets(entry)) return true
  }
  return false
}

async function resolveHandleRecord(
  handle: LocalDevicePrivateHandle,
  store?: DevicePrivateKeyStore,
): Promise<DevicePrivateKeyRecord | null> {
  const volatile = volatilePrivateKeys.get(handle.keyRef)
  if (volatile) return volatile
  if (!store) return null
  const loaded = await store.load(handle.keyRef)
  if (!loaded) return null
  volatilePrivateKeys.set(loaded.keyRef, loaded)
  return loaded
}

export async function assertPrivateHandleBinding(input: {
  handle: LocalDevicePrivateHandle
  publicIdentity: DevicePublicIdentity
  store?: DevicePrivateKeyStore
}): Promise<DeviceIdentityValidationResult> {
  const record = await resolveHandleRecord(input.handle, input.store)
  if (!record) return { valid: false, reason: 'private_key_unavailable' }
  if (record.deviceId !== input.publicIdentity.deviceId) return { valid: false, reason: 'private_key_binding_mismatch' }
  if (record.publicSigningKeySpki !== input.publicIdentity.publicSigningKeySpki) {
    return { valid: false, reason: 'private_key_public_identity_mismatch' }
  }
  if (record.keyVersion !== input.publicIdentity.keyVersion || record.cryptoSuiteVersion !== input.publicIdentity.cryptoSuiteVersion) {
    return { valid: false, reason: 'private_key_version_mismatch' }
  }
  return { valid: true }
}

export async function generateLocalDeviceIdentity(
  displayLabel: string,
  now = new Date(),
  options?: GenerateOptions,
): Promise<LocalDeviceIdentity> {
  if (typeof displayLabel !== 'string' || !isSafeLabel(displayLabel.trim())) {
    throw new Error('Device display label is invalid.')
  }

  const store = options?.store ?? createDefaultDevicePrivateKeyStore()
  const allowEphemeral = options?.allowEphemeral === true
  if (!store && !allowEphemeral) {
    throw new Error('Durable private-key storage is unavailable. Identity generation aborted.')
  }

  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign', 'verify'],
  )
  const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey)
  const publicSigningKeySpki = bytesToBase64(new Uint8Array(spki))
  const keyFingerprint = await deriveFingerprint(publicSigningKeySpki)
  const deviceId = await deriveDeviceIdentifier({
    publicSigningKeySpki,
    keyVersion: KEY_VERSION,
    cryptoSuiteVersion: SUITE_VERSION,
  })

  const timestamp = now.toISOString()
  const publicIdentity: DevicePublicIdentity = {
    deviceId,
    displayLabel: normalizeString(displayLabel.trim()),
    keyVersion: KEY_VERSION,
    cryptoSuiteVersion: SUITE_VERSION,
    createdAt: timestamp,
    lastLocallyObservedAt: timestamp,
    publicSigningKeySpki,
    keyFingerprint,
    schemaVersion: SCHEMA_VERSION,
    policyVersion: POLICY_VERSION,
    issuerIdentity: 'local_operator',
  }

  const keyRef = crypto.randomUUID()
  const record: DevicePrivateKeyRecord = {
    keyRef,
    deviceId,
    keyVersion: KEY_VERSION,
    cryptoSuiteVersion: SUITE_VERSION,
    publicSigningKeySpki,
    privateKey: keyPair.privateKey,
    createdAt: timestamp,
  }

  if (store) await store.save(record)
  volatilePrivateKeys.set(keyRef, record)

  return {
    publicIdentity,
    privateHandle: {
      handleVersion: '1.0.0',
      deviceId,
      keyRef,
    },
  }
}

export async function validatePublicIdentityMaterial(
  identity: DevicePublicIdentity,
): Promise<DeviceIdentityValidationResult> {
  if (!identity || typeof identity !== 'object') return { valid: false, reason: 'identity_missing' }
  if (!identity.deviceId.startsWith('device:')) return { valid: false, reason: 'device_id_invalid' }
  if (!SEMVER.test(identity.keyVersion) || !SEMVER.test(identity.cryptoSuiteVersion)) {
    return { valid: false, reason: 'version_invalid' }
  }
  if (identity.cryptoSuiteVersion !== SUITE_VERSION) return { valid: false, reason: 'unsupported_suite_version' }
  if (!SEMVER.test(identity.schemaVersion) || !SEMVER.test(identity.policyVersion)) {
    return { valid: false, reason: 'schema_or_policy_version_invalid' }
  }
  if (!validateIso(identity.createdAt) || !validateIso(identity.lastLocallyObservedAt)) {
    return { valid: false, reason: 'timestamp_invalid' }
  }
  if (!isSafeLabel(identity.displayLabel)) return { valid: false, reason: 'display_label_invalid' }
  if (!identity.publicSigningKeySpki || typeof identity.publicSigningKeySpki !== 'string') {
    return { valid: false, reason: 'public_key_missing' }
  }
  if (identity.publicSigningKeySpki.length > MAX_PUBLIC_KEY_BASE64_LENGTH) {
    return { valid: false, reason: 'public_key_oversized' }
  }
  if (hasForbiddenSecrets(identity)) return { valid: false, reason: 'identity_contains_secret_fields' }

  try {
    await importPublicVerifyKey(identity.publicSigningKeySpki)
  } catch {
    return { valid: false, reason: 'public_key_invalid_or_unsupported' }
  }

  const expectedDeviceId = await deriveDeviceIdentifier({
    publicSigningKeySpki: identity.publicSigningKeySpki,
    keyVersion: identity.keyVersion,
    cryptoSuiteVersion: identity.cryptoSuiteVersion,
  })
  if (expectedDeviceId !== identity.deviceId) return { valid: false, reason: 'device_id_mismatch' }

  const expectedFingerprint = await deriveFingerprint(identity.publicSigningKeySpki)
  if (expectedFingerprint !== identity.keyFingerprint) return { valid: false, reason: 'fingerprint_mismatch' }

  return { valid: true }
}

export async function createEnrollmentPackage(
  identity: DevicePublicIdentity,
  options?: { now?: Date; ttlMs?: number; nonce?: string },
): Promise<EnrollmentPackage> {
  const now = options?.now ?? new Date()
  const ttlMs = options?.ttlMs ?? 5 * 60_000
  if (ttlMs <= 0 || ttlMs > MAX_PACKAGE_TTL_MS) throw new Error('Enrollment package ttl is out of bounds.')
  const nonce = options?.nonce ?? crypto.randomUUID().replace(/-/g, '')
  if (!isSafeNonce(nonce)) throw new Error('Enrollment package nonce is invalid.')
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString()
  return {
    packageVersion: '1.0.0',
    purpose: 'device_enrollment',
    schemaVersion: identity.schemaVersion,
    policyVersion: identity.policyVersion,
    deviceId: identity.deviceId,
    publicSigningKeySpki: identity.publicSigningKeySpki,
    cryptoSuiteVersion: identity.cryptoSuiteVersion,
    keyVersion: identity.keyVersion,
    keyFingerprint: identity.keyFingerprint,
    proposedDeviceLabel: identity.displayLabel,
    createdAt: now.toISOString(),
    expiresAt,
    enrollmentNonce: nonce,
    issuerIdentity: identity.issuerIdentity,
    proofOfPossessionRequired: true,
  }
}

export async function validateEnrollmentPackage(
  pkg: EnrollmentPackage,
  now = new Date(),
): Promise<DeviceIdentityValidationResult> {
  if (!pkg || typeof pkg !== 'object') return { valid: false, reason: 'package_missing' }
  const raw = pkg as unknown as Record<string, unknown>
  if (!strictObjectKeys(raw, [
    'packageVersion',
    'purpose',
    'schemaVersion',
    'policyVersion',
    'deviceId',
    'publicSigningKeySpki',
    'cryptoSuiteVersion',
    'keyVersion',
    'keyFingerprint',
    'proposedDeviceLabel',
    'createdAt',
    'expiresAt',
    'enrollmentNonce',
    'issuerIdentity',
    'proofOfPossessionRequired',
  ])) return { valid: false, reason: 'package_unexpected_fields' }

  if (pkg.packageVersion !== '1.0.0') return { valid: false, reason: 'unsupported_package_version' }
  if (pkg.purpose !== 'device_enrollment') return { valid: false, reason: 'package_purpose_invalid' }
  if (!validateIso(pkg.createdAt) || !validateIso(pkg.expiresAt)) return { valid: false, reason: 'package_timestamp_invalid' }
  const createdAtMs = Date.parse(pkg.createdAt)
  const expiresAtMs = Date.parse(pkg.expiresAt)
  if (createdAtMs > now.getTime() + MAX_ALLOWED_FUTURE_SKEW_MS) return { valid: false, reason: 'package_from_future' }
  if (expiresAtMs <= createdAtMs) return { valid: false, reason: 'package_expiration_invalid' }
  if (expiresAtMs - createdAtMs > MAX_PACKAGE_TTL_MS) return { valid: false, reason: 'package_ttl_exceeds_limit' }
  if (expiresAtMs <= now.getTime()) return { valid: false, reason: 'package_expired' }
  if (!isSafeNonce(pkg.enrollmentNonce)) return { valid: false, reason: 'nonce_invalid' }
  if (!isSafeLabel(pkg.proposedDeviceLabel)) return { valid: false, reason: 'display_label_invalid' }
  if (pkg.publicSigningKeySpki.length > MAX_PUBLIC_KEY_BASE64_LENGTH) return { valid: false, reason: 'public_key_oversized' }
  if (hasForbiddenSecrets(pkg)) return { valid: false, reason: 'package_contains_secret_fields' }

  const identityValidation = await validatePublicIdentityMaterial({
    deviceId: pkg.deviceId,
    displayLabel: pkg.proposedDeviceLabel,
    keyVersion: pkg.keyVersion,
    cryptoSuiteVersion: pkg.cryptoSuiteVersion,
    createdAt: pkg.createdAt,
    lastLocallyObservedAt: pkg.createdAt,
    publicSigningKeySpki: pkg.publicSigningKeySpki,
    keyFingerprint: pkg.keyFingerprint,
    schemaVersion: pkg.schemaVersion,
    policyVersion: pkg.policyVersion,
    issuerIdentity: pkg.issuerIdentity,
  })
  if (!identityValidation.valid) return identityValidation
  return { valid: true }
}

async function packageDigest(pkg: EnrollmentPackage): Promise<string> {
  const digest = await sha256Bytes(canonicalizeStableJson(pkg))
  return toBase64Url(bytesToBase64(digest))
}

export async function createProofChallenge(
  pkg: EnrollmentPackage,
  options?: { now?: Date; ttlMs?: number; challengeId?: string },
): Promise<ProofChallenge> {
  const now = options?.now ?? new Date()
  const ttlMs = options?.ttlMs ?? 60_000
  if (ttlMs <= 0 || ttlMs > MAX_CHALLENGE_TTL_MS) throw new Error('Challenge ttl is out of bounds.')
  const issuedAt = now.toISOString()
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString()
  return {
    challengeVersion: '1.0.0',
    purpose: 'proof_of_possession',
    challengeId: options?.challengeId ?? crypto.randomUUID(),
    expectedDeviceId: pkg.deviceId,
    expectedKeyFingerprint: pkg.keyFingerprint,
    packageDigest: await packageDigest(pkg),
    nonce: pkg.enrollmentNonce,
    issuedAt,
    expiresAt,
  }
}

function challengePayload(challenge: ProofChallenge): Uint8Array {
  return canonicalizeUtf8({
    domain: challenge.purpose,
    challengeVersion: challenge.challengeVersion,
    challengeId: challenge.challengeId,
    expectedDeviceId: challenge.expectedDeviceId,
    expectedKeyFingerprint: challenge.expectedKeyFingerprint,
    packageDigest: challenge.packageDigest,
    nonce: challenge.nonce,
    issuedAt: challenge.issuedAt,
    expiresAt: challenge.expiresAt,
  })
}

export async function signProofOfPossession(
  challenge: ProofChallenge,
  privateHandle: LocalDevicePrivateHandle,
  now = new Date(),
  options?: { store?: DevicePrivateKeyStore },
): Promise<ProofOfPossession> {
  if (privateHandle.deviceId !== challenge.expectedDeviceId) {
    throw new Error('Private handle does not match challenge device identifier.')
  }
  const record = await resolveHandleRecord(privateHandle, options?.store)
  if (!record) throw new Error('Private key handle could not be resolved.')
  if (record.deviceId !== privateHandle.deviceId) throw new Error('Private key binding mismatch.')

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    record.privateKey,
    challengePayload(challenge),
  )
  return {
    proofVersion: '1.0.0',
    challengeId: challenge.challengeId,
    claimedDeviceId: privateHandle.deviceId,
    algorithm: IDENTITY_SUITE,
    signedAt: now.toISOString(),
    signature: bytesToBase64(new Uint8Array(signature)),
  }
}

export async function verifyProofOfPossession(input: {
  challenge: ProofChallenge
  proof: ProofOfPossession
  pkg: EnrollmentPackage
  replayGuard: ReplayGuard
  now?: Date
}): Promise<DeviceIdentityValidationResult> {
  const now = input.now ?? new Date()
  const { challenge, proof, pkg, replayGuard } = input
  if (challenge.challengeVersion !== '1.0.0' || proof.proofVersion !== '1.0.0') {
    return { valid: false, reason: 'unsupported_proof_or_challenge_version' }
  }
  if (challenge.purpose !== 'proof_of_possession') return { valid: false, reason: 'challenge_purpose_invalid' }
  if (proof.algorithm !== IDENTITY_SUITE) return { valid: false, reason: 'unsupported_signature_suite' }
  if (!validateIso(challenge.issuedAt) || !validateIso(challenge.expiresAt) || !validateIso(proof.signedAt)) {
    return { valid: false, reason: 'proof_timestamp_invalid' }
  }

  const issuedAtMs = Date.parse(challenge.issuedAt)
  const expiresAtMs = Date.parse(challenge.expiresAt)
  if (issuedAtMs > now.getTime() + MAX_ALLOWED_FUTURE_SKEW_MS) return { valid: false, reason: 'challenge_from_future' }
  if (expiresAtMs <= issuedAtMs) return { valid: false, reason: 'challenge_expiration_invalid' }
  if (expiresAtMs - issuedAtMs > MAX_CHALLENGE_TTL_MS) return { valid: false, reason: 'challenge_ttl_exceeds_limit' }
  if (expiresAtMs <= now.getTime()) return { valid: false, reason: 'challenge_expired' }

  if (challenge.expectedDeviceId !== pkg.deviceId || proof.claimedDeviceId !== pkg.deviceId) {
    return { valid: false, reason: 'device_id_mismatch' }
  }
  if (challenge.expectedKeyFingerprint !== pkg.keyFingerprint) {
    return { valid: false, reason: 'fingerprint_mismatch' }
  }
  if (proof.challengeId !== challenge.challengeId) return { valid: false, reason: 'challenge_id_mismatch' }
  if (challenge.packageDigest !== await packageDigest(pkg)) return { valid: false, reason: 'package_digest_mismatch' }
  if (challenge.nonce !== pkg.enrollmentNonce) return { valid: false, reason: 'challenge_nonce_mismatch' }

  try {
    const verifyKey = await importPublicVerifyKey(pkg.publicSigningKeySpki)
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      verifyKey,
      base64ToBytes(proof.signature),
      challengePayload(challenge),
    )
    if (!ok) return { valid: false, reason: 'signature_invalid' }
  } catch {
    return { valid: false, reason: 'proof_verification_failed' }
  }

  if (!replayGuard.consumeOnce(`proof:${challenge.challengeId}`, challenge.expiresAt, now)) {
    return { valid: false, reason: 'replay_detected' }
  }
  return { valid: true }
}

