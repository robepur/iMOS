import type { DevicePublicIdentity } from '../types/deviceIdentity'
import type {
  SyncDeviceKeyGrant,
  SyncKeyHierarchyDescriptor,
  SyncKeyHierarchyId,
  SyncKeyId,
  SyncKeyValidationResult,
  WrappedSyncObjectKey,
} from '../types/syncKeys'
import type { EncryptedObjectId, SyncNamespace } from '../types/sync'
import type { DeviceTrustRegistry } from './DeviceTrustRegistry'
import {
  assertPrivateHandleBinding,
  canonicalizeStableJson,
  signDevicePayload,
  verifyDevicePayloadSignature,
} from './DeviceIdentityService'
import type { DevicePrivateKeyStore, LocalDevicePrivateHandle } from './DeviceIdentityService'

const ARCHITECTURE_VERSION = '1.0.0' as const
const RECOVERY_ITERATIONS = 310_000 as const
const SALT_BYTES = 16
const IV_BYTES = 12
const MIN_RECOVERY_SECRET_LENGTH = 16
const MAX_GRANT_TTL_MS = 10 * 60_000
const MAX_FUTURE_SKEW_MS = 60_000

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

function toBase64Url(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function digestId(prefix: 'sync-key-hierarchy' | 'sync-key', bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return `${prefix}:${toBase64Url(bytesToBase64(new Uint8Array(digest))).slice(0, 32)}`
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0))
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.byteLength
  }
  return output
}

function namespaceContext(namespace: SyncNamespace): Uint8Array {
  return new TextEncoder().encode(canonicalizeStableJson({
    domain: 'imos_sync_namespace_key',
    architectureVersion: ARCHITECTURE_VERSION,
    namespace,
  }))
}

function wrappingAad(input: {
  hierarchyId: SyncKeyHierarchyId
  namespace: SyncNamespace
  objectId: EncryptedObjectId
  objectKeyId: SyncKeyId
  wrappingKeyId: SyncKeyId
  createdAt: string
}): Uint8Array {
  return new TextEncoder().encode(canonicalizeStableJson({
    domain: 'imos_sync_object_key_wrap',
    architectureVersion: ARCHITECTURE_VERSION,
    hierarchyId: input.hierarchyId,
    namespace: input.namespace,
    objectId: input.objectId,
    objectKeyId: input.objectKeyId,
    wrappingKeyId: input.wrappingKeyId,
    createdAt: input.createdAt,
  }))
}

function grantPayload(grant: Omit<SyncDeviceKeyGrant, 'signature'>): unknown {
  return {
    domain: 'imos_sync_device_key_grant',
    ...grant,
  }
}

async function deriveRootMaterial(recoverySecret: string, salt: Uint8Array): Promise<Uint8Array> {
  const normalized = recoverySecret.normalize('NFC')
  if (normalized.length < MIN_RECOVERY_SECRET_LENGTH) {
    throw new Error('Sync recovery secret must contain at least 16 characters.')
  }
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(normalized),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: RECOVERY_ITERATIONS },
    material,
    256,
  )
  return new Uint8Array(bits)
}

async function deriveNamespaceKey(rootMaterial: Uint8Array, namespace: SyncNamespace): Promise<CryptoKey> {
  const root = await crypto.subtle.importKey('raw', rootMaterial, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32),
      info: namespaceContext(namespace),
    },
    root,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export class SyncKeyArchitectureService {
  private constructor(
    private readonly rootMaterial: Uint8Array,
    private readonly keyDescriptor: SyncKeyHierarchyDescriptor,
  ) {}

  static async create(recoverySecret: string, now = new Date()): Promise<SyncKeyArchitectureService> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
    const rootMaterial = await deriveRootMaterial(recoverySecret, salt)
    const hierarchyId = await digestId(
      'sync-key-hierarchy',
      concat(rootMaterial, new TextEncoder().encode('imos-sync-root-v1')),
    ) as SyncKeyHierarchyId
    return new SyncKeyArchitectureService(rootMaterial, {
      architectureVersion: ARCHITECTURE_VERSION,
      hierarchyId,
      derivationSuite: 'PBKDF2_SHA256_HKDF_SHA256',
      wrappingSuite: 'AES_256_GCM',
      recoverySalt: bytesToBase64(salt),
      recoveryIterations: RECOVERY_ITERATIONS,
      createdAt: now.toISOString(),
    })
  }

  static async restore(
    recoverySecret: string,
    descriptor: SyncKeyHierarchyDescriptor,
  ): Promise<SyncKeyArchitectureService> {
    if (
      descriptor.architectureVersion !== ARCHITECTURE_VERSION
      || descriptor.derivationSuite !== 'PBKDF2_SHA256_HKDF_SHA256'
      || descriptor.wrappingSuite !== 'AES_256_GCM'
      || descriptor.recoveryIterations !== RECOVERY_ITERATIONS
      || !Number.isFinite(Date.parse(descriptor.createdAt))
    ) {
      throw new Error('Unsupported or malformed sync key hierarchy descriptor.')
    }
    const salt = base64ToBytes(descriptor.recoverySalt)
    if (salt.byteLength !== SALT_BYTES) throw new Error('Sync recovery salt is invalid.')
    const rootMaterial = await deriveRootMaterial(recoverySecret, salt)
    const hierarchyId = await digestId(
      'sync-key-hierarchy',
      concat(rootMaterial, new TextEncoder().encode('imos-sync-root-v1')),
    )
    if (hierarchyId !== descriptor.hierarchyId) throw new Error('Sync recovery secret does not match this key hierarchy.')
    return new SyncKeyArchitectureService(rootMaterial, { ...descriptor })
  }

  descriptor(): SyncKeyHierarchyDescriptor {
    return { ...this.keyDescriptor }
  }

  async createObjectKey(
    namespace: SyncNamespace,
    objectId: EncryptedObjectId,
    now = new Date(),
  ): Promise<{ key: CryptoKey; wrapped: WrappedSyncObjectKey }> {
    const namespaceKey = await deriveNamespaceKey(this.rootMaterial, namespace)
    const rawObjectKey = crypto.getRandomValues(new Uint8Array(32))
    const objectKeyId = await digestId('sync-key', rawObjectKey) as SyncKeyId
    const wrappingKeyId = await digestId('sync-key', namespaceContext(namespace)) as SyncKeyId
    const createdAt = now.toISOString()
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
    const aad = wrappingAad({
      hierarchyId: this.keyDescriptor.hierarchyId,
      namespace,
      objectId,
      objectKeyId,
      wrappingKeyId,
      createdAt,
    })
    const wrappedKey = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: aad },
      namespaceKey,
      rawObjectKey,
    )
    const key = await crypto.subtle.importKey(
      'raw',
      rawObjectKey.slice(),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )
    return {
      key,
      wrapped: {
        architectureVersion: ARCHITECTURE_VERSION,
        hierarchyId: this.keyDescriptor.hierarchyId,
        namespace,
        objectId,
        objectKeyId,
        wrappingKeyId,
        wrappedKey: bytesToBase64(new Uint8Array(wrappedKey)),
        iv: bytesToBase64(iv),
        createdAt,
      },
    }
  }

  async unwrapObjectKey(record: WrappedSyncObjectKey): Promise<CryptoKey> {
    if (
      record.architectureVersion !== ARCHITECTURE_VERSION
      || record.hierarchyId !== this.keyDescriptor.hierarchyId
      || !Number.isFinite(Date.parse(record.createdAt))
    ) {
      throw new Error('Wrapped sync object key does not belong to this hierarchy.')
    }
    const expectedWrappingKeyId = await digestId('sync-key', namespaceContext(record.namespace))
    if (record.wrappingKeyId !== expectedWrappingKeyId) throw new Error('Sync wrapping key identifier mismatch.')
    const namespaceKey = await deriveNamespaceKey(this.rootMaterial, record.namespace)
    const raw = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64ToBytes(record.iv),
        additionalData: wrappingAad(record),
      },
      namespaceKey,
      base64ToBytes(record.wrappedKey),
    )
    const rawBytes = new Uint8Array(raw)
    const expectedObjectKeyId = await digestId('sync-key', rawBytes)
    if (record.objectKeyId !== expectedObjectKeyId) {
      rawBytes.fill(0)
      throw new Error('Sync object key identifier mismatch.')
    }
    const key = await crypto.subtle.importKey(
      'raw',
      rawBytes.slice(),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )
    return key
  }

  async createDeviceGrant(input: {
    issuerIdentity: DevicePublicIdentity
    issuerHandle: LocalDevicePrivateHandle
    recipientDeviceId: DevicePublicIdentity['deviceId']
    trustRegistry: DeviceTrustRegistry
    store?: DevicePrivateKeyStore
    now?: Date
    ttlMs?: number
  }): Promise<SyncDeviceKeyGrant> {
    const now = input.now ?? new Date()
    const ttlMs = input.ttlMs ?? 5 * 60_000
    if (ttlMs <= 0 || ttlMs > MAX_GRANT_TTL_MS) throw new Error('Sync key grant ttl is out of bounds.')
    if (!input.trustRegistry.canAuthorize(input.issuerIdentity.deviceId)) throw new Error('Grant issuer is not active and trusted.')
    if (!input.trustRegistry.canAuthorize(input.recipientDeviceId)) throw new Error('Grant recipient is not active and trusted.')
    const binding = await assertPrivateHandleBinding({
      handle: input.issuerHandle,
      publicIdentity: input.issuerIdentity,
      store: input.store,
    })
    if (!binding.valid) throw new Error(`Grant issuer private handle failed binding validation: ${binding.reason}.`)
    const unsigned: Omit<SyncDeviceKeyGrant, 'signature'> = {
      architectureVersion: ARCHITECTURE_VERSION,
      hierarchyId: this.keyDescriptor.hierarchyId,
      issuerDeviceId: input.issuerIdentity.deviceId,
      recipientDeviceId: input.recipientDeviceId,
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      nonce: crypto.randomUUID(),
      purpose: 'authorize_sync_key_derivation',
    }
    const signature = await signDevicePayload(input.issuerHandle, grantPayload(unsigned), { store: input.store })
    return { ...unsigned, signature }
  }

  async validateDeviceGrant(input: {
    grant: SyncDeviceKeyGrant
    expectedRecipientDeviceId: DevicePublicIdentity['deviceId']
    trustRegistry: DeviceTrustRegistry
    now?: Date
  }): Promise<SyncKeyValidationResult> {
    const { grant, trustRegistry } = input
    const now = input.now ?? new Date()
    if (
      grant.architectureVersion !== ARCHITECTURE_VERSION
      || grant.purpose !== 'authorize_sync_key_derivation'
      || !grant.nonce
      || !grant.signature
      || !Number.isFinite(Date.parse(grant.issuedAt))
      || !Number.isFinite(Date.parse(grant.expiresAt))
      || grant.recipientDeviceId !== input.expectedRecipientDeviceId
    ) return { valid: false, reason: 'invalid_grant' }
    if (grant.hierarchyId !== this.keyDescriptor.hierarchyId) return { valid: false, reason: 'hierarchy_mismatch' }
    if (Date.parse(grant.issuedAt) > now.getTime() + MAX_FUTURE_SKEW_MS) return { valid: false, reason: 'grant_from_future' }
    if (
      Date.parse(grant.expiresAt) <= now.getTime()
      || Date.parse(grant.expiresAt) <= Date.parse(grant.issuedAt)
      || Date.parse(grant.expiresAt) - Date.parse(grant.issuedAt) > MAX_GRANT_TTL_MS
    ) return { valid: false, reason: 'grant_expired' }
    if (!trustRegistry.canAuthorize(grant.issuerDeviceId)) return { valid: false, reason: 'issuer_not_trusted' }
    if (!trustRegistry.canAuthorize(grant.recipientDeviceId)) return { valid: false, reason: 'recipient_not_trusted' }
    const issuerIdentity = trustRegistry.getPublicIdentity(grant.issuerDeviceId)
    if (!issuerIdentity) return { valid: false, reason: 'issuer_identity_missing' }
    const { signature, ...unsigned } = grant
    const verification = await verifyDevicePayloadSignature(issuerIdentity, grantPayload(unsigned), signature)
    return verification.valid ? { valid: true } : { valid: false, reason: 'signature_invalid' }
  }

  destroy(): void {
    this.rootMaterial.fill(0)
  }
}

export function createSyncKeyArchitecture(
  recoverySecret: string,
  now?: Date,
): Promise<SyncKeyArchitectureService> {
  return SyncKeyArchitectureService.create(recoverySecret, now)
}
