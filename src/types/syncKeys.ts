import type { DeviceIdentifier } from './deviceIdentity'
import type { EncryptedObjectId, SyncNamespace } from './sync'

export type SyncKeyArchitectureVersion = '1.0.0'
export type SyncKeyHierarchyId = `sync-key-hierarchy:${string}`
export type SyncKeyId = `sync-key:${string}`

export type SyncKeyHierarchyDescriptor = {
  architectureVersion: SyncKeyArchitectureVersion
  hierarchyId: SyncKeyHierarchyId
  derivationSuite: 'PBKDF2_SHA256_HKDF_SHA256'
  wrappingSuite: 'AES_256_GCM'
  recoverySalt: string
  recoveryIterations: 310000
  createdAt: string
}

export type WrappedSyncObjectKey = {
  architectureVersion: SyncKeyArchitectureVersion
  hierarchyId: SyncKeyHierarchyId
  namespace: SyncNamespace
  objectId: EncryptedObjectId
  objectKeyId: SyncKeyId
  wrappingKeyId: SyncKeyId
  wrappedKey: string
  iv: string
  createdAt: string
}

export type SyncDeviceKeyGrant = {
  architectureVersion: SyncKeyArchitectureVersion
  hierarchyId: SyncKeyHierarchyId
  issuerDeviceId: DeviceIdentifier
  recipientDeviceId: DeviceIdentifier
  issuedAt: string
  expiresAt: string
  nonce: string
  purpose: 'authorize_sync_key_derivation'
  signature: string
}

export type SyncKeyValidationResult =
  | { valid: true }
  | {
      valid: false
      reason:
        | 'invalid_grant'
        | 'grant_expired'
        | 'grant_from_future'
        | 'hierarchy_mismatch'
        | 'issuer_not_trusted'
        | 'recipient_not_trusted'
        | 'issuer_identity_missing'
        | 'signature_invalid'
    }
