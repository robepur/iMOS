import type { DevicePublicIdentity } from '../types/deviceIdentity'
import type { DeviceTrustRegistry } from './DeviceTrustRegistry'
import { canonicalizeUtf8, signDevicePayload, verifyDevicePayloadSignature } from './DeviceIdentityService'
import type { LocalDevicePrivateHandle, DevicePrivateKeyStore } from './DeviceIdentityService'
import { ReplayProtectionRegistry } from './ReplayProtectionRegistry'
import type {
  EncryptedSyncEnvelope,
  SignedSyncRequest,
  SyncProtocolError,
  SyncVisibleRoutingMetadata,
} from '../types/sync'

const MAX_ALLOWED_FUTURE_SKEW_MS = 60_000
const MAX_REQUEST_TTL_MS = 5 * 60_000
const MAX_CIPHERTEXT_BYTES = 1024 * 1024

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function isIso(value: string): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function fail(code: SyncProtocolError['code'], message: string, requestId?: string): SyncProtocolError {
  return { code, message, requestId }
}

function ensureVersion(value: string, expected: string): boolean {
  return value === expected
}

function nowMs(now = new Date()): number {
  return now.getTime()
}

function utf8ByteLength(input: string): number {
  return new TextEncoder().encode(input).byteLength
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

async function sha256Base64Bytes(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', value)
  return bytesToBase64(new Uint8Array(digest))
}

function canonicalSyncPayload(input: {
  protocolVersion: string
  method: string
  namespace: string
  objectId: string
  objectVersion?: string
  parentVersion?: string
  signerDeviceId: string
  requestId: string
  replayId: string
  ciphertextDigest?: string
  createdAt: string
  expiresAt: string
}): unknown {
  const payload: Record<string, unknown> = {
    domain: 'sync_request',
    protocolVersion: input.protocolVersion,
    method: input.method,
    namespace: input.namespace,
    objectId: input.objectId,
    signerDeviceId: input.signerDeviceId,
    requestId: input.requestId,
    replayId: input.replayId,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
  }
  if (input.objectVersion !== undefined) payload.objectVersion = input.objectVersion
  if (input.parentVersion !== undefined) payload.parentVersion = input.parentVersion
  if (input.ciphertextDigest !== undefined) payload.ciphertextDigest = input.ciphertextDigest
  return payload
}

export class SyncProtocolService {
  constructor(private readonly replayGuard = new ReplayProtectionRegistry(4096)) {}

  validateMetadata(
    metadata: SyncVisibleRoutingMetadata,
    now = new Date(),
    consumeReplay = true,
  ): { ok: true } | { ok: false; error: SyncProtocolError } {
    if (!ensureVersion(metadata.protocolVersion, '1.0.0')) {
      return { ok: false, error: fail('unsupported_protocol', 'Unsupported sync protocol version.') }
    }
    if (!ensureVersion(metadata.envelopeVersion, '1.0.0')) {
      return { ok: false, error: fail('unsupported_envelope_version', 'Unsupported envelope version.') }
    }
    if (!ensureVersion(metadata.schemaVersion, '1.0.0')) {
      return { ok: false, error: fail('validation_failed', 'Unsupported schema version.') }
    }
    if (!ensureVersion(metadata.cryptoSuiteVersion, '1.0.0')) {
      return { ok: false, error: fail('unsupported_crypto_suite', 'Unsupported crypto suite version.') }
    }
    if (metadata.ciphertextByteLength <= 0 || metadata.ciphertextByteLength > MAX_CIPHERTEXT_BYTES) {
      return { ok: false, error: fail('payload_too_large', 'Ciphertext exceeds size bounds.') }
    }
    if (!isIso(metadata.createdAt) || !isIso(metadata.expiresAt)) {
      return { ok: false, error: fail('validation_failed', 'Invalid metadata timestamps.') }
    }
    const issuedAtMs = Date.parse(metadata.createdAt)
    const expiresAtMs = Date.parse(metadata.expiresAt)
    const currentMs = nowMs(now)
    if (issuedAtMs > currentMs + MAX_ALLOWED_FUTURE_SKEW_MS) {
      return { ok: false, error: fail('request_from_future', 'Request appears to be created in the future.', metadata.requestId) }
    }
    if (expiresAtMs <= issuedAtMs || expiresAtMs - issuedAtMs > MAX_REQUEST_TTL_MS) {
      return { ok: false, error: fail('validation_failed', 'Metadata expiry window is invalid.', metadata.requestId) }
    }
    if (expiresAtMs <= currentMs) {
      return { ok: false, error: fail('request_expired', 'Sync metadata has expired.', metadata.requestId) }
    }
    if (consumeReplay && !this.replayGuard.consumeOnce(`sync:${metadata.replayId}`, metadata.expiresAt, now)) {
      return { ok: false, error: fail('replay_detected', 'Replay identifier already consumed.', metadata.requestId) }
    }
    return { ok: true }
  }

  createSignedRequest = async (input: {
    method: SignedSyncRequest['method']
    namespace: SignedSyncRequest['namespace']
    objectId: SignedSyncRequest['objectId']
    objectVersion?: SignedSyncRequest['objectVersion']
    parentVersion?: SignedSyncRequest['parentVersion']
    signerDeviceId: SignedSyncRequest['signerDeviceId']
    requestId: SignedSyncRequest['requestId']
    replayId: SignedSyncRequest['replayId']
    ciphertextDigest?: SignedSyncRequest['ciphertextDigest']
    createdAt: SignedSyncRequest['createdAt']
    expiresAt: SignedSyncRequest['expiresAt']
    privateHandle: LocalDevicePrivateHandle
    store?: DevicePrivateKeyStore
  }): Promise<SignedSyncRequest> => {
    const unsigned: Omit<SignedSyncRequest, 'signature'> = {
      protocolVersion: '1.0.0',
      method: input.method,
      namespace: input.namespace,
      objectId: input.objectId,
      objectVersion: input.objectVersion,
      parentVersion: input.parentVersion,
      signerDeviceId: input.signerDeviceId,
      requestId: input.requestId,
      replayId: input.replayId,
      ciphertextDigest: input.ciphertextDigest,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
    }
    const signature = await signDevicePayload(
      input.privateHandle,
      canonicalSyncPayload(unsigned),
      { store: input.store },
    )
    return { ...unsigned, signature }
  }

  verifySignedRequest = async (input: {
    request: SignedSyncRequest
    signerIdentity: DevicePublicIdentity
    trustRegistry?: DeviceTrustRegistry
    now?: Date
    consumeReplay?: boolean
  }): Promise<{ ok: true } | { ok: false; error: SyncProtocolError }> => {
    const now = input.now ?? new Date()
    const { request, signerIdentity, trustRegistry } = input
    if (!ensureVersion(request.protocolVersion, '1.0.0')) {
      return { ok: false, error: fail('unsupported_protocol', 'Unsupported sync protocol version.', request.requestId) }
    }
    if (!isIso(request.createdAt) || !isIso(request.expiresAt)) {
      return { ok: false, error: fail('validation_failed', 'Signed request timestamps are invalid.', request.requestId) }
    }
    const createdAtMs = Date.parse(request.createdAt)
    const expiresAtMs = Date.parse(request.expiresAt)
    const currentMs = nowMs(now)
    if (createdAtMs > currentMs + MAX_ALLOWED_FUTURE_SKEW_MS) {
      return { ok: false, error: fail('request_from_future', 'Signed request appears to be created in the future.', request.requestId) }
    }
    if (expiresAtMs <= createdAtMs || expiresAtMs - createdAtMs > MAX_REQUEST_TTL_MS) {
      return { ok: false, error: fail('validation_failed', 'Signed request expiry is invalid.', request.requestId) }
    }
    if (expiresAtMs <= currentMs) {
      return { ok: false, error: fail('request_expired', 'Signed request has expired.', request.requestId) }
    }
    if (request.signerDeviceId !== signerIdentity.deviceId) {
      return { ok: false, error: fail('validation_failed', 'Signer identity mismatch.', request.requestId) }
    }
    if (trustRegistry && !trustRegistry.canAuthorize(request.signerDeviceId)) {
      return { ok: false, error: fail('validation_failed', 'Signer is not trusted and active.', request.requestId) }
    }
    const verification = await verifyDevicePayloadSignature(
      signerIdentity,
      canonicalSyncPayload(request),
      request.signature,
    )
    if (!verification.valid) {
      return { ok: false, error: fail('validation_failed', 'Signed request signature failed verification.', request.requestId) }
    }
    if (input.consumeReplay !== false && !this.replayGuard.consumeOnce(`signed:${request.replayId}`, request.expiresAt, now)) {
      return { ok: false, error: fail('replay_detected', 'Signed request replay detected.', request.requestId) }
    }
    return { ok: true }
  }

  validateEnvelope(
    envelope: EncryptedSyncEnvelope,
    now = new Date(),
    consumeReplay = true,
  ): Promise<{ ok: true } | { ok: false; error: SyncProtocolError }> {
    return this.validateEnvelopeAsync(envelope, now, consumeReplay)
  }

  private async validateEnvelopeAsync(
    envelope: EncryptedSyncEnvelope,
    now: Date,
    consumeReplay: boolean,
  ): Promise<{ ok: true } | { ok: false; error: SyncProtocolError }> {
    const ciphertextBytes = base64ToBytes(envelope.encryptedPayload)
    const computedDigest = await sha256Base64Bytes(ciphertextBytes)
    const metadata: SyncVisibleRoutingMetadata = {
      namespace: envelope.namespace,
      objectId: envelope.objectId,
      objectVersion: envelope.objectVersion,
      parentVersion: envelope.parentVersion,
      protocolVersion: envelope.protocolVersion,
      envelopeVersion: envelope.envelopeVersion,
      schemaVersion: envelope.schemaVersion,
      cryptoSuiteVersion: envelope.cryptoSuiteVersion,
      ciphertextByteLength: ciphertextBytes.byteLength,
      ciphertextDigest: envelope.ciphertextDigest,
      requestId: envelope.requestId,
      replayId: envelope.replayId,
      createdAt: envelope.createdAt,
      expiresAt: envelope.expiresAt,
      tombstone: envelope.tombstone,
    }
    if (envelope.ciphertextDigest !== computedDigest) {
      return { ok: false, error: fail('validation_failed', 'Ciphertext digest mismatch.', envelope.requestId) }
    }
    if (metadata.ciphertextByteLength <= 0 || metadata.ciphertextByteLength > MAX_CIPHERTEXT_BYTES) {
      return { ok: false, error: fail('payload_too_large', 'Ciphertext exceeds size bounds.', envelope.requestId) }
    }
    if (utf8ByteLength(envelope.encryptedMetadata) <= 0) {
      return { ok: false, error: fail('validation_failed', 'Encrypted metadata binding is missing.', envelope.requestId) }
    }
    return this.validateMetadata(metadata, now, consumeReplay)
  }

  envelopeDigest(envelope: EncryptedSyncEnvelope): string {
    const payload: Record<string, unknown> = {
      namespace: envelope.namespace,
      objectId: envelope.objectId,
      objectVersion: envelope.objectVersion,
      encryptedPayload: envelope.encryptedPayload,
      iv: envelope.iv,
      encryptedMetadata: envelope.encryptedMetadata,
      authTag: envelope.authTag,
      createdAt: envelope.createdAt,
      expiresAt: envelope.expiresAt,
      signerDeviceId: envelope.signerDeviceId,
      signature: envelope.signature,
      tombstone: envelope.tombstone,
    }
    if (envelope.parentVersion !== undefined) payload.parentVersion = envelope.parentVersion
    const digestBytes = canonicalizeUtf8(payload)
    return btoa(String.fromCharCode(...digestBytes))
  }
}

export function createSyncProtocolService(replayGuard?: ReplayProtectionRegistry): SyncProtocolService {
  return new SyncProtocolService(replayGuard)
}
