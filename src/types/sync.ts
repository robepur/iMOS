import type { DeviceIdentifier } from './deviceIdentity'

export type SyncNamespace = `sync:${string}`
export type EncryptedObjectId = `obj:${string}`
export type ObjectVersion = `${number}`
export type ProtocolVersion = '1.0.0'
export type EnvelopeVersion = '1.0.0'
export type SyncSchemaVersion = '1.0.0'
export type SyncCryptoSuiteVersion = '1.0.0'
export type SyncStateSchemaVersion = '1.0.0'
export type SyncQuarantineDisposition = 'pending_review' | 'discarded'

export const SYNC_OPERATOR_CONTROL_STATE_SCHEMA_VERSION: SyncStateSchemaVersion = '1.0.0'
export const SYNC_QUARANTINE_RECORD_SCHEMA_VERSION: SyncStateSchemaVersion = '1.0.0'

export type SyncVisibleRoutingMetadata = {
  namespace: SyncNamespace
  objectId: EncryptedObjectId
  objectVersion: ObjectVersion
  parentVersion?: ObjectVersion
  protocolVersion: ProtocolVersion
  envelopeVersion: EnvelopeVersion
  schemaVersion: SyncSchemaVersion
  cryptoSuiteVersion: SyncCryptoSuiteVersion
  ciphertextByteLength: number
  ciphertextDigest: string
  requestId: string
  replayId: string
  createdAt: string
  expiresAt: string
  tombstone: boolean
}

export type EncryptedSyncEnvelope = {
  protocolVersion: ProtocolVersion
  envelopeVersion: EnvelopeVersion
  schemaVersion: SyncSchemaVersion
  cryptoSuiteVersion: SyncCryptoSuiteVersion
  namespace: SyncNamespace
  objectId: EncryptedObjectId
  objectVersion: ObjectVersion
  parentVersion?: ObjectVersion
  encryptedPayload: string
  iv: string
  encryptedMetadata: string
  authTag: string
  ciphertextDigest: string
  signerDeviceId: DeviceIdentifier
  signature: string
  requestId: string
  replayId: string
  createdAt: string
  expiresAt: string
  tombstone: boolean
}

export type SyncUploadAcknowledgment = {
  protocolVersion: ProtocolVersion
  requestId: string
  accepted: boolean
  namespace: SyncNamespace
  objectId: EncryptedObjectId
  objectVersion: ObjectVersion
  storedAt: string
}

export type SyncConflictResponse = {
  protocolVersion: ProtocolVersion
  requestId: string
  namespace: SyncNamespace
  objectId: EncryptedObjectId
  expectedParentVersion?: ObjectVersion
  actualParentVersion?: ObjectVersion
  reason: 'parent_version_mismatch' | 'stale_version' | 'tombstone_conflict'
}

export type SyncDownloadResult =
  | {
    kind: 'found'
    protocolVersion: ProtocolVersion
    requestId: string
    envelope: EncryptedSyncEnvelope
  }
  | {
    kind: 'not_found'
    protocolVersion: ProtocolVersion
    requestId: string
    namespace: SyncNamespace
    objectId: EncryptedObjectId
  }
  | {
    kind: 'conflict'
    protocolVersion: ProtocolVersion
    requestId: string
    conflict: SyncConflictResponse
  }

export type SyncQuarantineReason =
  | 'malformed_response'
  | 'unsupported_version'
  | 'bad_signature'
  | 'digest_mismatch'
  | 'authentication_failure'
  | 'decryption_failure'
  | 'replay'
  | 'rollback'
  | 'parent_version_mismatch'
  | 'schema_mismatch'
  | 'namespace_mismatch'
  | 'unknown_device'
  | 'revoked_or_suspended_signer'
  | 'oversized_payload'
  | 'invalid_tombstone'
  | 'unexpected_content_type'

export type SyncQuarantineRecord = {
  schemaVersion: SyncStateSchemaVersion
  id: string
  reason: SyncQuarantineReason
  disposition: SyncQuarantineDisposition
  requestId: string
  namespace: SyncNamespace
  objectId: EncryptedObjectId
  createdAt: string
  detail: string
  ciphertextDigest?: string
  diagnosticCode?: string
}

export type SyncProtocolErrorCode =
  | 'validation_failed'
  | 'unsupported_protocol'
  | 'unsupported_envelope_version'
  | 'unsupported_crypto_suite'
  | 'request_expired'
  | 'request_from_future'
  | 'replay_detected'
  | 'transport_denied'
  | 'payload_too_large'
  | 'unexpected_response'

export type SyncProtocolError = {
  code: SyncProtocolErrorCode
  message: string
  requestId?: string
}

export type SignedSyncRequest = {
  protocolVersion: ProtocolVersion
  method: 'upload' | 'download' | 'delete'
  namespace: SyncNamespace
  objectId: EncryptedObjectId
  objectVersion?: ObjectVersion
  parentVersion?: ObjectVersion
  signerDeviceId: DeviceIdentifier
  requestId: string
  replayId: string
  ciphertextDigest?: string
  createdAt: string
  expiresAt: string
  signature: string
}

export type SyncTransportAuditAction =
  | 'sync_capability_enabled'
  | 'sync_capability_disabled'
  | 'sync_upload_authorized'
  | 'sync_upload_denied'
  | 'sync_upload_acknowledged'
  | 'sync_upload_failed'
  | 'sync_download_authorized'
  | 'sync_download_denied'
  | 'sync_validation_failed'
  | 'sync_replay_or_rollback_detected'
  | 'sync_quarantined'
  | 'sync_conflict_detected'
  | 'sync_local_endpoint_configured'
  | 'sync_local_endpoint_cleared'

export type SyncTransportAuditEvent = {
  id: string
  action: SyncTransportAuditAction
  requestId?: string
  namespace?: SyncNamespace
  objectId?: EncryptedObjectId
  reason: string
  createdAt: string
}

export type SyncOperatorControlState = {
  schemaVersion: SyncStateSchemaVersion
  enabled: boolean
  localEndpointConfigured: boolean
  localReferenceEndpoint?: string
  configuredAt?: string
}
