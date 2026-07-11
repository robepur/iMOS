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

type CanonicalValue = null | boolean | number | string | CanonicalValue[] | { [k: string]: CanonicalValue }

export type LocalDevicePrivateHandle = {
  handleVersion: '1.0.0'
  deviceId: DeviceIdentifier
  privateKey: CryptoKey
}

export type LocalDeviceIdentity = {
  publicIdentity: DevicePublicIdentity
  privateHandle: LocalDevicePrivateHandle
}

export interface ReplayGuard {
  consumeOnce(key: string, expiresAt: string, now?: Date): boolean
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

function canonicalizeValue(value: unknown): CanonicalValue {
  if (value === null) return null
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite numbers are not supported in canonical encoding.')
    return value
  }
  if (Array.isArray(value)) return value.map(canonicalizeValue)
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b))
    const normalized: Record<string, CanonicalValue> = {}
    for (const key of keys) {
      const next = obj[key]
      if (next === undefined) throw new Error('Undefined values are not supported in canonical encoding.')
      if (typeof next === 'function' || typeof next === 'symbol' || typeof next === 'bigint') {
        throw new Error('Unsupported value type in canonical encoding.')
      }
      normalized[key] = canonicalizeValue(next)
    }
    return normalized
  }
  throw new Error('Unsupported canonical value.')
}

export function canonicalizeStableJson(value: unknown): string {
  return JSON.stringify(canonicalizeValue(value))
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

export async function generateLocalDeviceIdentity(
  displayLabel: string,
  now = new Date(),
): Promise<LocalDeviceIdentity> {
  if (typeof displayLabel !== 'string' || displayLabel.trim().length === 0) {
    throw new Error('Device display label is required.')
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
    displayLabel: displayLabel.trim(),
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

  return {
    publicIdentity,
    privateHandle: {
      handleVersion: '1.0.0',
      deviceId,
      privateKey: keyPair.privateKey,
    },
  }
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

export async function validatePublicIdentityMaterial(
  identity: DevicePublicIdentity,
): Promise<DeviceIdentityValidationResult> {
  if (!identity || typeof identity !== 'object') return { valid: false, reason: 'identity_missing' }
  if (!identity.deviceId.startsWith('device:')) return { valid: false, reason: 'device_id_invalid' }
  if (!SEMVER.test(identity.keyVersion) || !SEMVER.test(identity.cryptoSuiteVersion)) {
    return { valid: false, reason: 'version_invalid' }
  }
  if (!SEMVER.test(identity.schemaVersion) || !SEMVER.test(identity.policyVersion)) {
    return { valid: false, reason: 'schema_or_policy_version_invalid' }
  }
  if (!validateIso(identity.createdAt) || !validateIso(identity.lastLocallyObservedAt)) {
    return { valid: false, reason: 'timestamp_invalid' }
  }
  if (!identity.publicSigningKeySpki || typeof identity.publicSigningKeySpki !== 'string') {
    return { valid: false, reason: 'public_key_missing' }
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
  const nonce = options?.nonce ?? crypto.randomUUID()
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString()
  return {
    packageVersion: '1.0.0',
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
  if (pkg.packageVersion !== '1.0.0') return { valid: false, reason: 'unsupported_package_version' }
  if (!validateIso(pkg.createdAt) || !validateIso(pkg.expiresAt)) return { valid: false, reason: 'package_timestamp_invalid' }
  if (Date.parse(pkg.expiresAt) <= Date.parse(pkg.createdAt) || Date.parse(pkg.expiresAt) <= now.getTime()) {
    return { valid: false, reason: 'package_expired' }
  }
  if (!pkg.enrollmentNonce || pkg.enrollmentNonce.length < 8) return { valid: false, reason: 'nonce_invalid' }
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
  const issuedAt = now.toISOString()
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString()
  return {
    challengeVersion: '1.0.0',
    challengeId: options?.challengeId ?? crypto.randomUUID(),
    expectedDeviceId: pkg.deviceId,
    packageDigest: await packageDigest(pkg),
    nonce: pkg.enrollmentNonce,
    issuedAt,
    expiresAt,
  }
}

function challengePayload(challenge: ProofChallenge): Uint8Array {
  return canonicalizeUtf8({
    challengeVersion: challenge.challengeVersion,
    challengeId: challenge.challengeId,
    expectedDeviceId: challenge.expectedDeviceId,
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
): Promise<ProofOfPossession> {
  if (privateHandle.deviceId !== challenge.expectedDeviceId) {
    throw new Error('Private handle does not match challenge device identifier.')
  }
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateHandle.privateKey,
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
  if (proof.algorithm !== IDENTITY_SUITE) return { valid: false, reason: 'unsupported_signature_suite' }
  if (!validateIso(challenge.issuedAt) || !validateIso(challenge.expiresAt) || !validateIso(proof.signedAt)) {
    return { valid: false, reason: 'proof_timestamp_invalid' }
  }
  if (Date.parse(challenge.expiresAt) <= now.getTime()) return { valid: false, reason: 'challenge_expired' }
  if (challenge.expectedDeviceId !== pkg.deviceId || proof.claimedDeviceId !== pkg.deviceId) {
    return { valid: false, reason: 'device_id_mismatch' }
  }
  if (proof.challengeId !== challenge.challengeId) return { valid: false, reason: 'challenge_id_mismatch' }
  if (challenge.packageDigest !== await packageDigest(pkg)) return { valid: false, reason: 'package_digest_mismatch' }
  if (challenge.nonce !== pkg.enrollmentNonce) return { valid: false, reason: 'challenge_nonce_mismatch' }
  if (!replayGuard.consumeOnce(`proof:${challenge.challengeId}`, challenge.expiresAt, now)) {
    return { valid: false, reason: 'replay_detected' }
  }

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
  return { valid: true }
}

