import type { DeviceIdentifier } from '../types/deviceIdentity'
import type {
  EncryptedObjectId,
  EncryptedSyncEnvelope,
  ObjectVersion,
  SyncNamespace,
  SyncVisibleRoutingMetadata,
} from '../types/sync'

const ENCRYPTION_ALGORITHM = 'AES-GCM'
const IV_BYTES = 12

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function sha256Base64(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToBase64(new Uint8Array(digest))
}

function assertValidTimestamp(value: string): void {
  if (!value || !Number.isFinite(Date.parse(value))) {
    throw new Error('Invalid ISO timestamp.')
  }
}

export class SyncEnvelopeService {
  async createDataKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      { name: ENCRYPTION_ALGORITHM, length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )
  }

  private createAAD(metadata: SyncVisibleRoutingMetadata): Uint8Array {
    const payload = JSON.stringify({
      namespace: metadata.namespace,
      objectId: metadata.objectId,
      objectVersion: metadata.objectVersion,
      parentVersion: metadata.parentVersion,
      protocolVersion: metadata.protocolVersion,
      envelopeVersion: metadata.envelopeVersion,
      schemaVersion: metadata.schemaVersion,
      cryptoSuiteVersion: metadata.cryptoSuiteVersion,
      ciphertextDigest: metadata.ciphertextDigest,
      requestId: metadata.requestId,
      replayId: metadata.replayId,
      createdAt: metadata.createdAt,
      expiresAt: metadata.expiresAt,
      tombstone: metadata.tombstone,
    })
    return new TextEncoder().encode(payload)
  }

  async encryptEnvelope(input: {
    namespace: SyncNamespace
    objectId: EncryptedObjectId
    objectVersion: ObjectVersion
    parentVersion?: ObjectVersion
    signerDeviceId: DeviceIdentifier
    plaintext: string
    key: CryptoKey
    requestId: string
    replayId: string
    createdAt: string
    expiresAt: string
    tombstone?: boolean
  }): Promise<{ envelope: EncryptedSyncEnvelope; metadata: SyncVisibleRoutingMetadata }> {
    assertValidTimestamp(input.createdAt)
    assertValidTimestamp(input.expiresAt)
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
    const encryptedPayloadDigest = await sha256Base64(input.plaintext)
    const metadata: SyncVisibleRoutingMetadata = {
      namespace: input.namespace,
      objectId: input.objectId,
      objectVersion: input.objectVersion,
      parentVersion: input.parentVersion,
      protocolVersion: '1.0.0',
      envelopeVersion: '1.0.0',
      schemaVersion: '1.0.0',
      cryptoSuiteVersion: '1.0.0',
      ciphertextByteLength: new TextEncoder().encode(input.plaintext).byteLength,
      ciphertextDigest: encryptedPayloadDigest,
      requestId: input.requestId,
      replayId: input.replayId,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      tombstone: input.tombstone === true,
    }
    const plaintextBytes = new TextEncoder().encode(input.plaintext)
    const encrypted = await crypto.subtle.encrypt(
      { name: ENCRYPTION_ALGORITHM, iv, additionalData: this.createAAD(metadata) },
      input.key,
      plaintextBytes,
    )
    const encryptedBytes = new Uint8Array(encrypted)
    const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - 16)
    const authTag = encryptedBytes.slice(encryptedBytes.length - 16)
    const envelope: EncryptedSyncEnvelope = {
      protocolVersion: '1.0.0',
      envelopeVersion: '1.0.0',
      schemaVersion: '1.0.0',
      cryptoSuiteVersion: '1.0.0',
      namespace: input.namespace,
      objectId: input.objectId,
      objectVersion: input.objectVersion,
      parentVersion: input.parentVersion,
      encryptedPayload: bytesToBase64(ciphertext),
      iv: bytesToBase64(iv),
      encryptedMetadata: bytesToBase64(this.createAAD(metadata)),
      authTag: bytesToBase64(authTag),
      ciphertextDigest: encryptedPayloadDigest,
      signerDeviceId: input.signerDeviceId,
      signature: '',
      requestId: input.requestId,
      replayId: input.replayId,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      tombstone: input.tombstone === true,
    }
    return { envelope, metadata }
  }

  async decryptEnvelope(input: {
    envelope: EncryptedSyncEnvelope
    key: CryptoKey
  }): Promise<string> {
    assertValidTimestamp(input.envelope.createdAt)
    assertValidTimestamp(input.envelope.expiresAt)
    const metadata: SyncVisibleRoutingMetadata = {
      namespace: input.envelope.namespace,
      objectId: input.envelope.objectId,
      objectVersion: input.envelope.objectVersion,
      parentVersion: input.envelope.parentVersion,
      protocolVersion: input.envelope.protocolVersion,
      envelopeVersion: input.envelope.envelopeVersion,
      schemaVersion: input.envelope.schemaVersion,
      cryptoSuiteVersion: input.envelope.cryptoSuiteVersion,
      ciphertextByteLength: base64ToBytes(input.envelope.encryptedPayload).byteLength,
      ciphertextDigest: input.envelope.ciphertextDigest,
      requestId: input.envelope.requestId,
      replayId: input.envelope.replayId,
      createdAt: input.envelope.createdAt,
      expiresAt: input.envelope.expiresAt,
      tombstone: input.envelope.tombstone,
    }
    const iv = base64ToBytes(input.envelope.iv)
    const ciphertext = base64ToBytes(input.envelope.encryptedPayload)
    const authTag = base64ToBytes(input.envelope.authTag)
    const payload = new Uint8Array(ciphertext.byteLength + authTag.byteLength)
    payload.set(ciphertext, 0)
    payload.set(authTag, ciphertext.byteLength)
    const decrypted = await crypto.subtle.decrypt(
      { name: ENCRYPTION_ALGORITHM, iv, additionalData: this.createAAD(metadata) },
      input.key,
      payload,
    )
    return new TextDecoder().decode(decrypted)
  }
}

export function createSyncEnvelopeService(): SyncEnvelopeService {
  return new SyncEnvelopeService()
}

