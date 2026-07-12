import type { DeviceIdentifier } from './deviceIdentity'
import type { EncryptedObjectId, ObjectVersion, SyncNamespace, SyncQuarantineRecord } from './sync'
import type { SyncKeyHierarchyId } from './syncKeys'
import type {
  ConvergenceQuarantineReason,
  ConvergenceReviewReason,
  RemoteObjectDescriptor,
  SyncObjectLedgerEntry,
} from './syncConvergence'

export type SyncReviewSchemaVersion = '1.0.0'
export const SYNC_REVIEW_SCHEMA_VERSION: SyncReviewSchemaVersion = '1.0.0'

/** The kind of item requiring operator review. */
export type SyncReviewItemKind =
  | 'divergent_history'
  | 'tombstone_conflict'
  | 'quarantine_record'

/** Lifecycle state of a single review item. */
export type SyncReviewItemStatus =
  | 'pending'
  | 'in_progress'
  | 'resolved'
  | 'failed'
  | 'unresolved'

/** All explicit operator actions. */
export type OperatorDecisionAction =
  | 'keep_local'
  | 'accept_remote'
  | 'preserve_both'
  | 'reject_remote'
  | 'discard_quarantine'
  | 'leave_unresolved'

/** Actions that require an explicit confirmation dialog before execution. */
export const CONFIRMATION_REQUIRED_ACTIONS = new Set<OperatorDecisionAction>([
  'keep_local',
  'accept_remote',
  'preserve_both',
  'reject_remote',
  'discard_quarantine',
])

/**
 * A pending item surfaced to the operator for review.
 * Contains only the minimum information needed for a safe decision.
 * Never exposes raw encryption keys, recovery secrets, or credentials.
 */
export type SyncReviewItem = {
  readonly schemaVersion: SyncReviewSchemaVersion
  readonly id: string
  readonly kind: SyncReviewItemKind
  readonly status: SyncReviewItemStatus
  readonly namespace: SyncNamespace
  readonly objectId: EncryptedObjectId
  /** For conflict items: local accepted version. */
  readonly localVersion?: ObjectVersion
  /** For conflict items: remote version that diverged. */
  readonly remoteVersion?: ObjectVersion
  /** For conflict items: convergence review reason. */
  readonly reviewReason?: ConvergenceReviewReason
  /** For quarantine items: quarantine record (no plaintext). */
  readonly quarantineRecord?: SyncQuarantineRecord
  /** For conflict items: remote descriptor (resolved by caller — no key material). */
  readonly remoteDescriptor?: RemoteObjectDescriptor
  /** For conflict items: prior local ledger entry. */
  readonly priorLedgerEntry?: SyncObjectLedgerEntry
  readonly createdAt: string
  readonly updatedAt: string
  readonly failureReason?: string
  readonly resolvedAction?: OperatorDecisionAction
  readonly resolvedAt?: string
}

/** A completed operator decision with full audit metadata. */
export type OperatorDecisionRecord = {
  readonly schemaVersion: SyncReviewSchemaVersion
  readonly id: string
  readonly reviewItemId: string
  readonly action: OperatorDecisionAction
  readonly namespace: SyncNamespace
  readonly objectId: EncryptedObjectId
  /** Device identifier of the operator's device (for audit). */
  readonly operatorDeviceId: DeviceIdentifier
  readonly priorLocalVersion: ObjectVersion | null
  readonly remoteVersion: ObjectVersion | null
  readonly hierarchyId: SyncKeyHierarchyId | null
  readonly signerDeviceId: DeviceIdentifier | null
  readonly outcome: 'success' | 'failed' | 'pending'
  readonly failureReason?: string
  readonly decidedAt: string
  readonly completedAt?: string
}

export type OperatorDecisionAuditAction =
  | 'operator_decision_submitted'
  | 'operator_decision_confirmed'
  | 'operator_decision_applied'
  | 'operator_decision_failed'
  | 'operator_decision_idempotent'
  | 'operator_quarantine_discarded'

/** Structured audit event for an operator decision. Contains no plaintext. */
export type OperatorDecisionAuditEvent = {
  readonly id: string
  readonly action: OperatorDecisionAuditAction
  readonly reviewItemId: string
  readonly decisionAction: OperatorDecisionAction
  readonly namespace: SyncNamespace
  readonly objectId: EncryptedObjectId
  readonly outcome: 'success' | 'failed' | 'pending'
  readonly reason?: string
  readonly createdAt: string
}

/** Validation result from security pre-checks before executing a decision. */
export type DecisionValidationResult =
  | { valid: true }
  | {
      valid: false
      reason:
        | 'item_not_found'
        | 'item_already_resolved'
        | 'action_not_allowed_for_kind'
        | 'missing_remote_descriptor'
        | 'signer_not_active'
        | 'signer_revoked'
        | 'signer_suspended'
        | 'key_hierarchy_mismatch'
        | 'signature_not_verified'
        | 'conflict_requires_explicit_action'
        | 'quarantine_requires_explicit_action'
        | 'quarantine_reason_mismatch'
        | 'convergence_verdict_mismatch'
        | 'recovery_coordinator_required'
    }

/** Overall summary of the review queue. */
export type SyncReviewQueueSummary = {
  readonly pending: number
  readonly inProgress: number
  readonly resolved: number
  readonly failed: number
  readonly unresolved: number
  readonly total: number
  readonly hasUnresolvedConflicts: boolean
  readonly hasQuarantineRecords: boolean
}

/** Reason for a quarantine-reason mismatch in the convergence engine. */
export type ConvergenceQuarantineReasonExt = ConvergenceQuarantineReason | 'unknown'
