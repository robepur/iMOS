import type { SyncConvergenceOutcome } from '../types/syncConvergence'
import type { RemoteObjectDescriptor, SyncObjectLedgerEntry } from '../types/syncConvergence'
import type {
  SyncRecoveryAuditEvent,
  SyncRecoveryCheckpoint,
  SyncRecoveryQuarantineReason,
  SyncRecoveryState,
  SyncRecoveryTransaction,
} from '../types/syncRecovery'
import { SYNC_RECOVERY_SCHEMA_VERSION } from '../types/syncRecovery'
import type { SyncCheckpointStoreContract } from './SyncCheckpointStore'
import type { SyncStateLedger } from './SyncStateLedger'

const MAX_AUDIT_EVENTS = 500

/** Canonical fields hashed into the checkpoint digest (excludes the digest itself). */
type CheckpointBindingFields = {
  readonly transactionId: string
  readonly namespace: string
  readonly objectId: string
  readonly priorAcceptedVersion: string
  readonly priorAcceptedParentVersion: string
  readonly priorContentDigest: string
  readonly priorSignerDeviceId: string
  readonly priorHierarchyId: string
  readonly priorTombstone: string
  readonly priorAcceptedAt: string
}

async function computeCheckpointDigest(fields: CheckpointBindingFields): Promise<string> {
  const canonical = [
    fields.transactionId,
    fields.namespace,
    fields.objectId,
    fields.priorAcceptedVersion,
    fields.priorAcceptedParentVersion,
    fields.priorContentDigest,
    fields.priorSignerDeviceId,
    fields.priorHierarchyId,
    fields.priorTombstone,
    fields.priorAcceptedAt,
  ].join('\u0000')
  const encoded = new TextEncoder().encode(canonical)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function checkpointBindingFields(checkpoint: SyncRecoveryCheckpoint): CheckpointBindingFields {
  return {
    transactionId: checkpoint.transactionId,
    namespace: checkpoint.namespace,
    objectId: checkpoint.objectId,
    priorAcceptedVersion: checkpoint.priorAcceptedVersion ?? 'null',
    priorAcceptedParentVersion: checkpoint.priorAcceptedParentVersion ?? 'null',
    priorContentDigest: checkpoint.priorContentDigest ?? 'null',
    priorSignerDeviceId: checkpoint.priorSignerDeviceId ?? 'null',
    priorHierarchyId: checkpoint.priorHierarchyId ?? 'null',
    priorTombstone: String(checkpoint.priorTombstone),
    priorAcceptedAt: checkpoint.priorAcceptedAt ?? 'null',
  }
}

/**
 * Maps a convergence quarantine reason to a recovery quarantine reason.
 * Returns null if the convergence outcome is not a security quarantine that
 * maps directly to a coordinator reason.
 */
function mapConvergenceQuarantineReason(
  outcome: Extract<SyncConvergenceOutcome, { verdict: 'quarantine_required' }>,
): SyncRecoveryQuarantineReason {
  switch (outcome.reason) {
    case 'bad_signature': return 'wrong_signer'
    case 'revoked_or_suspended_signer': return 'revoked_signer'
    case 'unknown_device': return 'unknown_signer'
    case 'wrong_key_hierarchy': return 'wrong_key_hierarchy'
    case 'tampered_parent_version': return 'wrong_parent_version'
    case 'tampered_digest': return 'wrong_digest'
    case 'replay_attempt': return 'replay_attempt'
    case 'rollback_attempt': return 'rollback_below_floor'
  }
}

function makeAuditEvent(
  action: SyncRecoveryAuditEvent['action'],
  tx: SyncRecoveryTransaction,
  reason?: string,
  now = new Date(),
): SyncRecoveryAuditEvent {
  return {
    id: `sync-recovery-audit:${crypto.randomUUID()}`,
    action,
    transactionId: tx.transactionId,
    namespace: tx.namespace,
    objectId: tx.objectId,
    state: tx.state,
    reason,
    createdAt: now.toISOString(),
  }
}

function transition(
  tx: SyncRecoveryTransaction,
  newState: SyncRecoveryState,
  extra?: Partial<Pick<SyncRecoveryTransaction, 'failureReason' | 'quarantineReason'>>,
  now = new Date(),
): SyncRecoveryTransaction {
  return { ...tx, state: newState, updatedAt: now.toISOString(), ...extra }
}

/**
 * Transactional synchronization recovery coordinator.
 *
 * Manages the full lifecycle of a synchronization mutation:
 *   prepare → stage → validate → commit → confirmed
 *                         ↓
 *                   rollback → recovered
 *                         ↓
 *                    quarantine
 *
 * Rules:
 * - `prepare` creates a checkpoint of the prior confirmed state BEFORE mutation.
 * - `commitToLedger` is the only step that advances the convergence ledger.
 * - `rollback` never moves behind the last operator-confirmed state.
 * - No plaintext is written to checkpoints, audit events, or quarantine records.
 * - Every transition is recorded as a structured audit event.
 * - No networking, no side effects beyond updating the checkpoint store.
 */
export class SyncRecoveryCoordinator {
  private readonly audits: SyncRecoveryAuditEvent[] = []

  constructor(private readonly store: SyncCheckpointStoreContract) {}

  /**
   * Begin a new synchronization transaction.
   *
   * Records a checkpoint of the last operator-confirmed state and transitions
   * the transaction to 'preparing'. The checkpoint digest is a SHA-256 hash
   * of all binding fields — any field mutation is detectable during validate.
   *
   * Must be called before any vault mutation. Returns the created transaction.
   */
  async prepare(
    remote: RemoteObjectDescriptor,
    priorLedgerEntry: SyncObjectLedgerEntry | null,
    now = new Date(),
  ): Promise<SyncRecoveryTransaction> {
    const transactionId = `sync-recovery-tx:${crypto.randomUUID()}`
    const checkpointCreatedAt = now.toISOString()

    let checkpoint: SyncRecoveryCheckpoint | null = null
    if (priorLedgerEntry !== null) {
      const bindingFields: CheckpointBindingFields = {
        transactionId,
        namespace: priorLedgerEntry.namespace,
        objectId: priorLedgerEntry.objectId,
        priorAcceptedVersion: priorLedgerEntry.acceptedVersion,
        priorAcceptedParentVersion: priorLedgerEntry.acceptedParentVersion ?? 'null',
        priorContentDigest: priorLedgerEntry.contentDigest,
        priorSignerDeviceId: priorLedgerEntry.signerDeviceId,
        priorHierarchyId: priorLedgerEntry.hierarchyId,
        priorTombstone: String(priorLedgerEntry.tombstone),
        priorAcceptedAt: priorLedgerEntry.acceptedAt,
      }
      const checkpointDigest = await computeCheckpointDigest(bindingFields)
      checkpoint = {
        schemaVersion: SYNC_RECOVERY_SCHEMA_VERSION,
        transactionId,
        namespace: priorLedgerEntry.namespace,
        objectId: priorLedgerEntry.objectId,
        priorAcceptedVersion: priorLedgerEntry.acceptedVersion,
        priorAcceptedParentVersion: priorLedgerEntry.acceptedParentVersion ?? null,
        priorContentDigest: priorLedgerEntry.contentDigest,
        priorSignerDeviceId: priorLedgerEntry.signerDeviceId,
        priorHierarchyId: priorLedgerEntry.hierarchyId,
        priorTombstone: priorLedgerEntry.tombstone,
        priorAcceptedAt: priorLedgerEntry.acceptedAt,
        checkpointCreatedAt,
        checkpointDigest,
      }
    }

    const tx: SyncRecoveryTransaction = {
      schemaVersion: SYNC_RECOVERY_SCHEMA_VERSION,
      transactionId,
      namespace: remote.namespace,
      objectId: remote.objectId,
      state: 'preparing',
      checkpoint,
      remoteObjectVersion: remote.objectVersion,
      remoteParentVersion: remote.parentVersion,
      remoteContentDigest: remote.contentDigest,
      remoteSignerDeviceId: remote.signerDeviceId,
      remoteHierarchyId: remote.hierarchyId,
      remoteTombstone: remote.tombstone,
      startedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }

    this.store.save(tx)
    this.appendAudit(makeAuditEvent('recovery_transaction_started', tx, undefined, now))
    return tx
  }

  /**
   * Advance a transaction from 'preparing' to 'staged'.
   * The staged state indicates the remote change is held and ready for validation.
   */
  stage(transactionId: string, now = new Date()): SyncRecoveryTransaction {
    const tx = this.requireTransaction(transactionId, ['preparing'])
    const updated = transition(tx, 'staged', undefined, now)
    this.store.save(updated)
    this.appendAudit(makeAuditEvent('recovery_staged', updated, undefined, now))
    return updated
  }

  /**
   * Validate checkpoint integrity and the convergence outcome before committing.
   *
   * Checks:
   * 1. Namespace binding — remote must match the staged transaction namespace.
   * 2. Object identifier binding — remote must match the staged transaction objectId.
   * 3. Checkpoint digest — recomputed SHA-256 must match the stored digest.
   * 4. Convergence outcome — maps quarantine reasons to recovery quarantine reasons.
   *
   * Returns the updated transaction. On quarantine or failure the transaction is
   * immediately moved to the terminal state — do not call rollback separately.
   *
   * If the outcome is `accept_remote`, the transaction advances to 'validating'.
   * If the outcome is `already_synchronized`, the transaction advances directly to 'confirmed'.
   * If the outcome is `accept_local` (stale remote), the transaction is rolled back.
   * If the outcome is `operator_review_required`, the transaction is rolled back.
   */
  async validate(
    transactionId: string,
    remote: RemoteObjectDescriptor,
    convergenceOutcome: SyncConvergenceOutcome,
    now = new Date(),
  ): Promise<SyncRecoveryTransaction> {
    const tx = this.requireTransaction(transactionId, ['staged', 'validating'])

    // 1. Namespace binding check
    if (remote.namespace !== tx.namespace) {
      return this.failClosed(transactionId, 'wrong_namespace', now)
    }

    // 2. Object identifier binding check
    if (remote.objectId !== tx.objectId) {
      return this.failClosed(transactionId, 'wrong_object_id', now)
    }

    // 3. Checkpoint digest validation (if a prior entry existed)
    if (tx.checkpoint !== null) {
      const recomputed = await computeCheckpointDigest(checkpointBindingFields(tx.checkpoint))
      if (recomputed !== tx.checkpoint.checkpointDigest) {
        return this.doQuarantine(transactionId, 'tampered_checkpoint', 'checkpoint digest mismatch', now)
      }
    }

    // 4. Map convergence outcome to recovery state
    switch (convergenceOutcome.verdict) {
      case 'quarantine_required': {
        const reason = mapConvergenceQuarantineReason(convergenceOutcome)
        return this.doQuarantine(transactionId, reason, `convergence: ${convergenceOutcome.reason}`, now)
      }

      case 'operator_review_required':
        // Cannot auto-commit; roll back and surface the review requirement.
        return this.doRollback(transactionId, `operator_review_required: ${convergenceOutcome.reason}`, now)

      case 'accept_local':
        // Remote is stale; no mutation needed.
        return this.doRollback(transactionId, 'accept_local: remote was stale', now)

      case 'already_synchronized': {
        // No mutation needed; directly confirm.
        const confirmed = transition(tx, 'confirmed', undefined, now)
        this.store.remove(transactionId)
        this.appendAudit(makeAuditEvent('recovery_confirmed', confirmed, 'already_synchronized', now))
        return confirmed
      }

      case 'accept_remote': {
        const updated = transition(tx, 'validating', undefined, now)
        this.store.save(updated)
        this.appendAudit(makeAuditEvent('recovery_validation_passed', updated, undefined, now))
        return updated
      }
    }
  }

  /**
   * Commit the staged remote state to the convergence ledger.
   *
   * Must only be called with a transaction in 'validating' state and an
   * `accept_remote` outcome. Transitions committing → confirmed and removes
   * the checkpoint from the store.
   *
   * Callers must not invoke this unless the vault has been prepared to receive
   * the remote change. If an exception is thrown during the vault write, call
   * rollback() immediately.
   */
  commitToLedger(
    transactionId: string,
    remote: RemoteObjectDescriptor,
    outcome: Extract<SyncConvergenceOutcome, { verdict: 'accept_remote' }>,
    ledger: SyncStateLedger,
    now = new Date(),
  ): SyncRecoveryTransaction {
    const tx = this.requireTransaction(transactionId, ['validating'])

    const committing = transition(tx, 'committing', undefined, now)
    this.store.save(committing)
    this.appendAudit(makeAuditEvent('recovery_committing', committing, undefined, now))

    ledger.commit(remote, outcome, now)

    const confirmed = transition(committing, 'confirmed', undefined, now)
    this.store.remove(transactionId)
    this.appendAudit(makeAuditEvent('recovery_confirmed', confirmed, undefined, now))
    return confirmed
  }

  /**
   * Roll back a transaction to the last confirmed local state.
   *
   * The returned transaction includes the checkpoint so the caller can inspect
   * what the prior state was. Rolling back does NOT mutate the convergence ledger
   * because the ledger was never advanced by incomplete transactions.
   */
  rollback(transactionId: string, reason: string, now = new Date()): SyncRecoveryTransaction {
    const tx = this.requireTransaction(transactionId, [
      'preparing', 'staged', 'validating', 'committing', 'rolling_back',
    ])
    return this.doRollback(transactionId, reason, now, tx)
  }

  /**
   * Quarantine a transaction due to a security or structural violation.
   * The transaction record is preserved in the store for operator review.
   */
  quarantine(
    transactionId: string,
    reason: SyncRecoveryQuarantineReason,
    detail?: string,
    now = new Date(),
  ): SyncRecoveryTransaction {
    return this.doQuarantine(transactionId, reason, detail, now)
  }

  /**
   * Mark a transaction as failed_closed due to an irrecoverable binding violation.
   * Used when namespace or objectId mismatches indicate a programming error or attack.
   */
  failClosed(transactionId: string, reason: string, now = new Date()): SyncRecoveryTransaction {
    const tx = this.store.get(transactionId)
    if (!tx) {
      throw new Error(`SyncRecoveryCoordinator: transaction not found: ${transactionId}`)
    }
    const updated = transition(tx, 'failed_closed', { failureReason: reason }, now)
    this.store.save(updated)
    this.appendAudit(makeAuditEvent('recovery_failed_closed', updated, reason, now))
    return updated
  }

  /** All recovery audit events, most-recent first. No plaintext or key material. */
  getAuditEvents(): SyncRecoveryAuditEvent[] {
    return this.audits.map(e => ({ ...e }))
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private requireTransaction(
    transactionId: string,
    allowedStates: SyncRecoveryState[],
  ): SyncRecoveryTransaction {
    const tx = this.store.get(transactionId)
    if (!tx) {
      throw new Error(`SyncRecoveryCoordinator: transaction not found: ${transactionId}`)
    }
    if (!allowedStates.includes(tx.state)) {
      throw new Error(
        `SyncRecoveryCoordinator: unexpected state '${tx.state}' for transaction ${transactionId}. ` +
        `Expected one of: ${allowedStates.join(', ')}`,
      )
    }
    return tx
  }

  private doRollback(
    transactionId: string,
    reason: string,
    now: Date,
    existingTx?: SyncRecoveryTransaction,
  ): SyncRecoveryTransaction {
    const tx = existingTx ?? this.store.get(transactionId)
    if (!tx) {
      throw new Error(`SyncRecoveryCoordinator: transaction not found: ${transactionId}`)
    }
    const rollingBack = transition(tx, 'rolling_back', { failureReason: reason }, now)
    this.store.save(rollingBack)
    this.appendAudit(makeAuditEvent('recovery_rolling_back', rollingBack, reason, now))

    const recovered = transition(rollingBack, 'recovered', undefined, now)
    this.store.save(recovered)
    this.appendAudit(makeAuditEvent('recovery_recovered', recovered, reason, now))
    return recovered
  }

  private doQuarantine(
    transactionId: string,
    reason: SyncRecoveryQuarantineReason,
    detail: string | undefined,
    now: Date,
  ): SyncRecoveryTransaction {
    const tx = this.store.get(transactionId)
    if (!tx) {
      throw new Error(`SyncRecoveryCoordinator: transaction not found: ${transactionId}`)
    }
    const updated = transition(tx, 'quarantined', { quarantineReason: reason, failureReason: detail }, now)
    this.store.save(updated)
    this.appendAudit(makeAuditEvent('recovery_quarantined', updated, detail, now))
    return updated
  }

  private appendAudit(event: SyncRecoveryAuditEvent): void {
    this.audits.unshift(event)
    if (this.audits.length > MAX_AUDIT_EVENTS) {
      this.audits.length = MAX_AUDIT_EVENTS
    }
  }
}

export function createSyncRecoveryCoordinator(
  store: SyncCheckpointStoreContract,
): SyncRecoveryCoordinator {
  return new SyncRecoveryCoordinator(store)
}
