import type { DeviceIdentifier } from './deviceIdentity'
import type { EncryptedObjectId, ObjectVersion, SyncNamespace } from './sync'
import type { SyncKeyHierarchyId } from './syncKeys'

export type SyncRecoverySchemaVersion = '1.0.0'
export const SYNC_RECOVERY_SCHEMA_VERSION: SyncRecoverySchemaVersion = '1.0.0'

/** All states a synchronization recovery transaction can occupy. */
export type SyncRecoveryState =
  | 'idle'
  | 'preparing'
  | 'staged'
  | 'validating'
  | 'committing'
  | 'confirmed'
  | 'rolling_back'
  | 'recovered'
  | 'quarantined'
  | 'failed_closed'

/** Reasons a recovery transaction is quarantined. */
export type SyncRecoveryQuarantineReason =
  | 'corrupted_checkpoint'
  | 'tampered_checkpoint'
  | 'wrong_namespace'
  | 'wrong_object_id'
  | 'wrong_parent_version'
  | 'wrong_digest'
  | 'wrong_signer'
  | 'wrong_key_hierarchy'
  | 'unknown_signer'
  | 'revoked_signer'
  | 'suspended_signer'
  | 'replaced_signer'
  | 'replay_attempt'
  | 'rollback_below_floor'

/**
 * Records the last operator-confirmed local state of an object before
 * a synchronization transaction begins.
 *
 * Contains no plaintext, no decrypted payload, no key material, and no credentials.
 * Null prior fields indicate the object did not exist locally before this transaction.
 */
export type SyncRecoveryCheckpoint = {
  readonly schemaVersion: SyncRecoverySchemaVersion
  readonly transactionId: string
  readonly namespace: SyncNamespace
  readonly objectId: EncryptedObjectId
  /** Null when this is the first time the object is seen locally. */
  readonly priorAcceptedVersion: ObjectVersion | null
  readonly priorAcceptedParentVersion: ObjectVersion | null
  readonly priorContentDigest: string | null
  readonly priorSignerDeviceId: DeviceIdentifier | null
  readonly priorHierarchyId: SyncKeyHierarchyId | null
  readonly priorTombstone: boolean | null
  readonly priorAcceptedAt: string | null
  readonly checkpointCreatedAt: string
  /**
   * SHA-256 hex digest of the canonical binding fields.
   * Computed over all other checkpoint fields in a defined order.
   * Mismatch on restore indicates corruption or tampering.
   */
  readonly checkpointDigest: string
}

/** Full lifecycle record for one synchronization recovery transaction. */
export type SyncRecoveryTransaction = {
  readonly schemaVersion: SyncRecoverySchemaVersion
  readonly transactionId: string
  readonly namespace: SyncNamespace
  readonly objectId: EncryptedObjectId
  readonly state: SyncRecoveryState
  /** Prior state checkpoint. Null only when the object is new (no prior ledger entry). */
  readonly checkpoint: SyncRecoveryCheckpoint | null
  readonly remoteObjectVersion: ObjectVersion
  readonly remoteParentVersion: ObjectVersion | undefined
  readonly remoteContentDigest: string
  readonly remoteSignerDeviceId: DeviceIdentifier
  readonly remoteHierarchyId: SyncKeyHierarchyId
  readonly remoteTombstone: boolean
  readonly startedAt: string
  readonly updatedAt: string
  readonly failureReason?: string
  readonly quarantineReason?: SyncRecoveryQuarantineReason
}

export type SyncRecoveryAuditAction =
  | 'recovery_transaction_started'
  | 'recovery_staged'
  | 'recovery_validation_passed'
  | 'recovery_validation_failed'
  | 'recovery_committing'
  | 'recovery_confirmed'
  | 'recovery_rolling_back'
  | 'recovery_recovered'
  | 'recovery_quarantined'
  | 'recovery_failed_closed'
  | 'startup_incomplete_transaction_detected'
  | 'startup_recovery_completed'

/** Structured audit record for a recovery transition. Contains no plaintext. */
export type SyncRecoveryAuditEvent = {
  readonly id: string
  readonly action: SyncRecoveryAuditAction
  readonly transactionId: string
  readonly namespace: SyncNamespace
  readonly objectId: EncryptedObjectId
  readonly state: SyncRecoveryState
  readonly reason?: string
  readonly createdAt: string
}

/** Result summary from startup incomplete-transaction evaluation. */
export type StartupRecoveryResult = {
  readonly evaluated: number
  readonly recovered: number
  readonly quarantined: number
  readonly failedClosed: number
  readonly auditEvents: readonly SyncRecoveryAuditEvent[]
}
