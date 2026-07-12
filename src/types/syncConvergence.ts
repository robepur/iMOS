import type { DeviceIdentifier } from './deviceIdentity'
import type { EncryptedObjectId, ObjectVersion, SyncNamespace } from './sync'
import type { SyncKeyHierarchyId } from './syncKeys'

export type SyncConvergenceSchemaVersion = '1.0.0'
export const SYNC_CONVERGENCE_SCHEMA_VERSION: SyncConvergenceSchemaVersion = '1.0.0'

export type SyncConvergenceVerdict =
  | 'already_synchronized'
  | 'accept_remote'
  | 'accept_local'
  | 'operator_review_required'
  | 'quarantine_required'

export type ConvergenceReviewReason =
  | 'divergent_histories'
  | 'tombstone_conflict'

export type ConvergenceQuarantineReason =
  | 'bad_signature'
  | 'unknown_device'
  | 'revoked_or_suspended_signer'
  | 'replay_attempt'
  | 'rollback_attempt'
  | 'wrong_key_hierarchy'
  | 'tampered_parent_version'
  | 'tampered_digest'

export type SyncConvergenceOutcome =
  | {
      verdict: 'already_synchronized'
      namespace: SyncNamespace
      objectId: EncryptedObjectId
      objectVersion: ObjectVersion
    }
  | {
      verdict: 'accept_remote'
      namespace: SyncNamespace
      objectId: EncryptedObjectId
      objectVersion: ObjectVersion
      parentVersion?: ObjectVersion
      contentDigest: string
      tombstone: boolean
    }
  | {
      verdict: 'accept_local'
      namespace: SyncNamespace
      objectId: EncryptedObjectId
      localVersion: ObjectVersion
      remoteVersion: ObjectVersion
    }
  | {
      verdict: 'operator_review_required'
      namespace: SyncNamespace
      objectId: EncryptedObjectId
      reason: ConvergenceReviewReason
      localVersion?: ObjectVersion
      remoteVersion?: ObjectVersion
    }
  | {
      verdict: 'quarantine_required'
      namespace: SyncNamespace
      objectId: EncryptedObjectId
      reason: ConvergenceQuarantineReason
      remoteVersion?: ObjectVersion
    }

/**
 * Describes the relevant security and version state of a downloaded remote object,
 * after transport-level signature and protocol validation.
 * All security-relevant fields must be resolved by the caller before evaluation.
 */
export type RemoteObjectDescriptor = {
  namespace: SyncNamespace
  objectId: EncryptedObjectId
  objectVersion: ObjectVersion
  parentVersion?: ObjectVersion
  signerDeviceId: DeviceIdentifier
  contentDigest: string
  hierarchyId: SyncKeyHierarchyId
  tombstone: boolean
  isSignatureVerified: boolean
  isSignerActive: boolean
  isSignerRevoked: boolean
  isSignerSuspended: boolean
}

/**
 * The convergence ledger entry for a single encrypted object.
 * Tracks the last accepted version, its lineage, and previously
 * accepted version identifiers for replay detection.
 */
export type SyncObjectLedgerEntry = {
  schemaVersion: SyncConvergenceSchemaVersion
  namespace: SyncNamespace
  objectId: EncryptedObjectId
  acceptedVersion: ObjectVersion
  acceptedParentVersion?: ObjectVersion
  contentDigest: string
  signerDeviceId: DeviceIdentifier
  hierarchyId: SyncKeyHierarchyId
  tombstone: boolean
  acceptedAt: string
  lastGoodAt: string
  /**
   * Ordered list of all ObjectVersions previously accepted for this object.
   * Used for replay detection: a remote presenting a version in this list is
   * a replay of a superseded state.
   */
  readonly acceptedVersionHistory: readonly ObjectVersion[]
}

export type SyncConvergenceAuditAction =
  | 'convergence_already_synchronized'
  | 'convergence_accept_remote'
  | 'convergence_accept_local'
  | 'convergence_operator_review_required'
  | 'convergence_quarantine_required'

export type SyncConvergenceAuditEvent = {
  id: string
  action: SyncConvergenceAuditAction
  namespace: SyncNamespace
  objectId: EncryptedObjectId
  verdict: SyncConvergenceVerdict
  reason?: string
  createdAt: string
}
