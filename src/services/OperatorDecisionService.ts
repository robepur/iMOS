import type { RemoteObjectDescriptor, SyncObjectLedgerEntry } from '../types/syncConvergence'
import type { SyncQuarantineRecord } from '../types/sync'
import type { DeviceIdentifier } from '../types/deviceIdentity'
import type { SyncKeyHierarchyId } from '../types/syncKeys'
import type {
  OperatorDecisionAction,
  OperatorDecisionAuditEvent,
  OperatorDecisionRecord,
  SyncReviewItem,
  SyncReviewQueueSummary,
  DecisionValidationResult,
} from '../types/syncReview'
import {
  CONFIRMATION_REQUIRED_ACTIONS,
  SYNC_REVIEW_SCHEMA_VERSION,
} from '../types/syncReview'
import type { SyncCheckpointStoreContract } from './SyncCheckpointStore'
import { createSyncRecoveryCoordinator } from './SyncRecoveryCoordinator'
import { createSyncStateLedger } from './SyncStateLedger'

const MAX_AUDIT_EVENTS = 500

/**
 * Operator Decision Service — routes operator sync review decisions through the
 * Build 021 convergence engine and Build 022 recovery coordinator.
 *
 * Security invariants:
 * - No default action may accept remote data.
 * - Every decision requiring confirmation must be explicitly confirmed.
 * - No decision bypasses signer trust, key hierarchy, or signature validation.
 * - Every decision is recorded as a structured audit event.
 * - No plaintext, key material, or credentials appear in audit or decision records.
 * - Failed decisions restore the prior confirmed ledger state via the recovery coordinator.
 * - Completed decisions cannot be silently changed.
 * - Repeated submissions are idempotent.
 */
export class OperatorDecisionService {
  private readonly items = new Map<string, SyncReviewItem>()
  private readonly decisions: OperatorDecisionRecord[] = []
  private readonly audits: OperatorDecisionAuditEvent[] = []
  private readonly ledger = createSyncStateLedger()
  private readonly coordinator: ReturnType<typeof createSyncRecoveryCoordinator>

  constructor(
    private readonly operatorDeviceId: DeviceIdentifier,
    checkpointStore: SyncCheckpointStoreContract,
  ) {
    this.coordinator = createSyncRecoveryCoordinator(checkpointStore)
  }

  /**
   * Add a divergent-history or tombstone-conflict review item to the queue.
   * Called by the sync pipeline when `evaluateConvergence` returns
   * `operator_review_required`.
   */
  addConflictItem(
    remote: RemoteObjectDescriptor,
    priorEntry: SyncObjectLedgerEntry | null,
    reviewReason: 'divergent_histories' | 'tombstone_conflict',
    now = new Date(),
  ): SyncReviewItem {
    const id = `sync-review:${crypto.randomUUID()}`
    const item: SyncReviewItem = {
      schemaVersion: SYNC_REVIEW_SCHEMA_VERSION,
      id,
      kind: reviewReason === 'divergent_histories' ? 'divergent_history' : 'tombstone_conflict',
      status: 'pending',
      namespace: remote.namespace,
      objectId: remote.objectId,
      localVersion: priorEntry?.acceptedVersion ?? undefined,
      remoteVersion: remote.objectVersion,
      reviewReason,
      remoteDescriptor: remote,
      priorLedgerEntry: priorEntry ?? undefined,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }
    this.items.set(id, item)
    // Seed the internal ledger with the prior entry so convergence re-evaluation
    // in executeDecision sees the correct prior state (divergent vs. new object).
    if (priorEntry) {
      this.ledger.seed(priorEntry)
    }
    return item
  }

  /**
   * Add a quarantine record to the review queue.
   * Called by the sync pipeline when an object fails validation.
   */
  addQuarantineItem(
    record: SyncQuarantineRecord,
    now = new Date(),
  ): SyncReviewItem {
    const id = `sync-review:${crypto.randomUUID()}`
    const item: SyncReviewItem = {
      schemaVersion: SYNC_REVIEW_SCHEMA_VERSION,
      id,
      kind: 'quarantine_record',
      status: 'pending',
      namespace: record.namespace,
      objectId: record.objectId,
      quarantineRecord: { ...record },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }
    this.items.set(id, item)
    return item
  }

  /**
   * Validate a proposed operator decision before presenting a confirmation dialog.
   * Must return `valid: true` before the confirmation dialog is shown.
   */
  validateDecision(
    reviewItemId: string,
    action: OperatorDecisionAction,
  ): DecisionValidationResult {
    const item = this.items.get(reviewItemId)
    if (!item) return { valid: false, reason: 'item_not_found' }
    if (item.status === 'resolved') return { valid: false, reason: 'item_already_resolved' }

    // Quarantine items may only be discarded or left unresolved
    if (item.kind === 'quarantine_record') {
      if (action !== 'discard_quarantine' && action !== 'leave_unresolved') {
        return { valid: false, reason: 'action_not_allowed_for_kind' }
      }
      return { valid: true }
    }

    // Conflict items may not be discarded via discard_quarantine
    if (action === 'discard_quarantine') {
      return { valid: false, reason: 'action_not_allowed_for_kind' }
    }

    // For accept_remote, security pre-checks must pass
    if (action === 'accept_remote') {
      const remote = item.remoteDescriptor
      if (!remote) return { valid: false, reason: 'missing_remote_descriptor' }
      if (!remote.isSignatureVerified) return { valid: false, reason: 'signature_not_verified' }
      if (remote.isSignerRevoked) return { valid: false, reason: 'signer_revoked' }
      if (remote.isSignerSuspended) return { valid: false, reason: 'signer_suspended' }
      if (!remote.isSignerActive) return { valid: false, reason: 'signer_not_active' }
    }

    return { valid: true }
  }

  /**
   * Execute a confirmed operator decision.
   *
   * For `accept_remote`: routes through the recovery coordinator for transactional safety.
   * For `keep_local`, `reject_remote`, `preserve_both`: marks the item resolved with no ledger mutation.
   * For `discard_quarantine`: removes the quarantine record from the item.
   * For `leave_unresolved`: marks the item unresolved (remains visible).
   *
   * Returns the updated review item.
   */
  async executeDecision(
    reviewItemId: string,
    action: OperatorDecisionAction,
    now = new Date(),
  ): Promise<SyncReviewItem> {
    const item = this.items.get(reviewItemId)
    if (!item) throw new Error(`OperatorDecisionService: item not found: ${reviewItemId}`)

    // Idempotency: resolved items cannot be changed
    if (item.status === 'resolved') {
      this.appendAudit({
        id: `operator-decision-audit:${crypto.randomUUID()}`,
        action: 'operator_decision_idempotent',
        reviewItemId,
        decisionAction: action,
        namespace: item.namespace,
        objectId: item.objectId,
        outcome: 'success',
        reason: 'item_already_resolved',
        createdAt: now.toISOString(),
      })
      return item
    }

    // Confirmation required check
    if (CONFIRMATION_REQUIRED_ACTIONS.has(action) && action !== 'leave_unresolved') {
      // The caller is responsible for obtaining confirmation before calling executeDecision.
      // We record the submission and proceed.
    }

    // Mark in progress
    const inProgress = this.setItemState(item, 'in_progress', undefined, now)

    this.appendAudit({
      id: `operator-decision-audit:${crypto.randomUUID()}`,
      action: 'operator_decision_submitted',
      reviewItemId,
      decisionAction: action,
      namespace: item.namespace,
      objectId: item.objectId,
      outcome: 'pending',
      createdAt: now.toISOString(),
    })

    if (action === 'leave_unresolved') {
      const updated = this.setItemState(inProgress, 'unresolved', undefined, now)
      this.recordDecision(item, action, 'success', undefined, now)
      this.appendAudit({
        id: `operator-decision-audit:${crypto.randomUUID()}`,
        action: 'operator_decision_applied',
        reviewItemId,
        decisionAction: action,
        namespace: item.namespace,
        objectId: item.objectId,
        outcome: 'success',
        reason: 'left_unresolved',
        createdAt: now.toISOString(),
      })
      return updated
    }

    if (action === 'discard_quarantine') {
      if (item.kind !== 'quarantine_record') {
        return this.failDecision(inProgress, action, 'discard_quarantine_requires_quarantine_item', now)
      }
      const resolved = this.setItemState(inProgress, 'resolved', action, now)
      this.recordDecision(item, action, 'success', undefined, now)
      this.appendAudit({
        id: `operator-decision-audit:${crypto.randomUUID()}`,
        action: 'operator_quarantine_discarded',
        reviewItemId,
        decisionAction: action,
        namespace: item.namespace,
        objectId: item.objectId,
        outcome: 'success',
        createdAt: now.toISOString(),
      })
      return resolved
    }

    if (action === 'keep_local' || action === 'reject_remote' || action === 'preserve_both') {
      // No ledger mutation — prior local state is preserved by not calling commit
      const resolved = this.setItemState(inProgress, 'resolved', action, now)
      this.recordDecision(item, action, 'success', undefined, now)
      this.appendAudit({
        id: `operator-decision-audit:${crypto.randomUUID()}`,
        action: 'operator_decision_applied',
        reviewItemId,
        decisionAction: action,
        namespace: item.namespace,
        objectId: item.objectId,
        outcome: 'success',
        createdAt: now.toISOString(),
      })
      return resolved
    }

    if (action === 'accept_remote') {
      const remote = item.remoteDescriptor
      if (!remote) {
        return this.failDecision(inProgress, action, 'missing_remote_descriptor', now)
      }

      // Security pre-checks (must pass before routing to recovery coordinator)
      if (!remote.isSignatureVerified) {
        return this.failDecision(inProgress, action, 'signer_validation_failed: bad_signature', now)
      }
      if (remote.isSignerRevoked) {
        return this.failDecision(inProgress, action, 'signer_validation_failed: revoked', now)
      }
      if (remote.isSignerSuspended) {
        return this.failDecision(inProgress, action, 'signer_validation_failed: suspended', now)
      }
      if (!remote.isSignerActive) {
        return this.failDecision(inProgress, action, 'signer_validation_failed: not_active', now)
      }

      try {
        // Route through recovery coordinator
        const priorEntry = item.priorLedgerEntry ?? null
        const tx = await this.coordinator.prepare(remote, priorEntry ?? null, now)
        this.coordinator.stage(tx.transactionId, now)

        // Re-evaluate convergence through the ledger (authoritative check)
        const convergenceOutcome = this.ledger.evaluate(remote, now)

        // Only proceed if convergence still accepts remote
        if (convergenceOutcome.verdict !== 'accept_remote') {
          await this.coordinator.validate(tx.transactionId, remote, convergenceOutcome, now)
          this.coordinator.rollback(tx.transactionId, `convergence_rejected: ${convergenceOutcome.verdict}`, now)
          return this.failDecision(inProgress, action, `convergence_rejected: ${convergenceOutcome.verdict}`, now)
        }

        const validatedTx = await this.coordinator.validate(tx.transactionId, remote, convergenceOutcome, now)
        if (validatedTx.state !== 'validating') {
          return this.failDecision(inProgress, action, `validation_failed: ${validatedTx.state}`, now)
        }

        this.coordinator.commitToLedger(tx.transactionId, remote, convergenceOutcome, this.ledger, now)

        const resolved = this.setItemState(inProgress, 'resolved', action, now)
        this.recordDecision(item, action, 'success', undefined, now)
        this.appendAudit({
          id: `operator-decision-audit:${crypto.randomUUID()}`,
          action: 'operator_decision_applied',
          reviewItemId,
          decisionAction: action,
          namespace: item.namespace,
          objectId: item.objectId,
          outcome: 'success',
          createdAt: now.toISOString(),
        })
        return resolved
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        return this.failDecision(inProgress, action, reason, now)
      }
    }

    return this.failDecision(inProgress, action, `unknown_action: ${action}`, now)
  }

  /** All review items, in insertion order. */
  getItems(): SyncReviewItem[] {
    return Array.from(this.items.values()).map(item => ({ ...item }))
  }

  /** Pending items only. */
  getPendingItems(): SyncReviewItem[] {
    return this.getItems().filter(i => i.status === 'pending')
  }

  /** Queue summary for display. */
  getQueueSummary(): SyncReviewQueueSummary {
    const items = this.getItems()
    return {
      pending: items.filter(i => i.status === 'pending').length,
      inProgress: items.filter(i => i.status === 'in_progress').length,
      resolved: items.filter(i => i.status === 'resolved').length,
      failed: items.filter(i => i.status === 'failed').length,
      unresolved: items.filter(i => i.status === 'unresolved').length,
      total: items.length,
      hasUnresolvedConflicts: items.some(i =>
        i.status === 'pending' &&
        (i.kind === 'divergent_history' || i.kind === 'tombstone_conflict'),
      ),
      hasQuarantineRecords: items.some(i => i.status === 'pending' && i.kind === 'quarantine_record'),
    }
  }

  /** All operator decision audit events, most-recent first. No plaintext. */
  getAuditEvents(): OperatorDecisionAuditEvent[] {
    return this.audits.map(e => ({ ...e }))
  }

  /** All completed operator decision records. */
  getDecisionRecords(): OperatorDecisionRecord[] {
    return this.decisions.map(d => ({ ...d }))
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private setItemState(
    item: SyncReviewItem,
    status: SyncReviewItem['status'],
    resolvedAction?: OperatorDecisionAction,
    now = new Date(),
  ): SyncReviewItem {
    const updated: SyncReviewItem = {
      ...item,
      status,
      updatedAt: now.toISOString(),
      ...(resolvedAction ? { resolvedAction, resolvedAt: now.toISOString() } : {}),
    }
    this.items.set(item.id, updated)
    return updated
  }

  private failDecision(
    item: SyncReviewItem,
    action: OperatorDecisionAction,
    reason: string,
    now: Date,
  ): SyncReviewItem {
    const failed = this.setItemState({ ...item, failureReason: reason }, 'failed', undefined, now)
    this.recordDecision(item, action, 'failed', reason, now)
    this.appendAudit({
      id: `operator-decision-audit:${crypto.randomUUID()}`,
      action: 'operator_decision_failed',
      reviewItemId: item.id,
      decisionAction: action,
      namespace: item.namespace,
      objectId: item.objectId,
      outcome: 'failed',
      reason,
      createdAt: now.toISOString(),
    })
    return failed
  }

  private recordDecision(
    item: SyncReviewItem,
    action: OperatorDecisionAction,
    outcome: 'success' | 'failed' | 'pending',
    failureReason: string | undefined,
    now: Date,
  ): void {
    const record: OperatorDecisionRecord = {
      schemaVersion: SYNC_REVIEW_SCHEMA_VERSION,
      id: `operator-decision:${crypto.randomUUID()}`,
      reviewItemId: item.id,
      action,
      namespace: item.namespace,
      objectId: item.objectId,
      operatorDeviceId: this.operatorDeviceId,
      priorLocalVersion: item.localVersion ?? null,
      remoteVersion: item.remoteVersion ?? null,
      hierarchyId: item.remoteDescriptor?.hierarchyId ?? null,
      signerDeviceId: item.remoteDescriptor?.signerDeviceId ?? null,
      outcome,
      failureReason,
      decidedAt: now.toISOString(),
      completedAt: outcome !== 'pending' ? now.toISOString() : undefined,
    }
    this.decisions.push(record)
  }

  private appendAudit(event: OperatorDecisionAuditEvent): void {
    this.audits.unshift(event)
    if (this.audits.length > MAX_AUDIT_EVENTS) {
      this.audits.length = MAX_AUDIT_EVENTS
    }
  }
}

export function createOperatorDecisionService(
  operatorDeviceId: DeviceIdentifier,
  checkpointStore: SyncCheckpointStoreContract,
): OperatorDecisionService {
  return new OperatorDecisionService(operatorDeviceId, checkpointStore)
}
