import {
  SYNC_CONFLICT_PENDING_SCHEMA_VERSION,
} from '../types/sync'
import type {
  ConflictResolutionPolicy,
  ConflictResolutionResult,
  SyncConflictAuditAction,
  SyncConflictAuditEvent,
  SyncConflictPendingRecord,
  SyncConflictResolution,
  SyncConflictResponse,
  ObjectVersion,
} from '../types/sync'

// ---------------------------------------------------------------------------
// Namespace policy table
//
// Namespaces are matched by prefix after "sync:". Unknown prefixes default to
// "deny" (fail closed) so new record classes are always explicitly opted in.
// ---------------------------------------------------------------------------

const NAMESPACE_POLICIES: ReadonlyArray<{ prefix: string; policy: ConflictResolutionPolicy }> = [
  // Append-only streams: safe to keep both copies without operator action.
  { prefix: 'sync:audit', policy: 'auto_merge_append' },
  { prefix: 'sync:quarantine', policy: 'auto_merge_append' },
  // Critical records: operator must choose a resolution explicitly.
  { prefix: 'sync:priority', policy: 'operator_review' },
  { prefix: 'sync:commitment', policy: 'operator_review' },
  { prefix: 'sync:decision', policy: 'operator_review' },
  { prefix: 'sync:mission', policy: 'operator_review' },
  { prefix: 'sync:consent', policy: 'operator_review' },
  { prefix: 'sync:cognitive', policy: 'operator_review' },
  { prefix: 'sync:identity', policy: 'operator_review' },
  { prefix: 'sync:operator', policy: 'operator_review' },
  { prefix: 'sync:recovery', policy: 'operator_review' },
  { prefix: 'sync:reflection', policy: 'operator_review' },
  { prefix: 'sync:understanding', policy: 'operator_review' },
]

function resolvePolicy(namespace: string): ConflictResolutionPolicy {
  for (const entry of NAMESPACE_POLICIES) {
    // Only exact match or colon-separated child paths are valid policy descendants.
    // Hyphen-separated variants (e.g. sync:audit-evil) are NOT children of sync:audit
    // and must reach the default deny branch to avoid prefix confusion.
    if (namespace === entry.prefix || namespace.startsWith(entry.prefix + ':')) {
      return entry.policy
    }
  }
  return 'deny'
}

// ---------------------------------------------------------------------------
// SyncConflictResolver
// ---------------------------------------------------------------------------

export class SyncConflictResolver {
  private readonly pending: SyncConflictPendingRecord[]
  private readonly audit: SyncConflictAuditEvent[]

  constructor(initialPending: SyncConflictPendingRecord[] = []) {
    this.pending = [...initialPending]
    this.audit = []
  }

  /**
   * Resolves a conflict according to the namespace policy.
   *
   * - auto_merge_append namespaces: returns auto_resolved immediately.
   * - operator_review namespaces: queues a pending record and returns
   *   queued_for_review.
   * - Tombstone conflicts always escalate to operator_review regardless of
   *   namespace policy.
   * - Unknown namespaces: returns denied (fail closed).
   */
  resolve(input: {
    conflict: SyncConflictResponse
    localObjectVersion: ObjectVersion
    now?: Date
  }): ConflictResolutionResult {
    const now = input.now ?? new Date()
    const { conflict } = input

    // Tombstone conflicts are always escalated — the operator must confirm
    // whether a deleted record should be restored or the deletion accepted.
    const alwaysEscalate = conflict.reason === 'tombstone_conflict'

    let policy = resolvePolicy(conflict.namespace)
    if (alwaysEscalate && policy === 'auto_merge_append') {
      policy = 'operator_review'
    }

    if (policy === 'deny') {
      const reason = `Conflict denied: unknown namespace "${conflict.namespace}" has no resolution policy.`
      this.pushAudit({
        action: 'conflict_denied',
        namespace: conflict.namespace,
        objectId: conflict.objectId,
        reason,
        now,
      })
      return { kind: 'denied', reason }
    }

    if (policy === 'auto_merge_append') {
      const resolvedAt = now.toISOString()
      this.pushAudit({
        action: 'conflict_auto_resolved',
        namespace: conflict.namespace,
        objectId: conflict.objectId,
        reason: `Auto-resolved append-only conflict for namespace "${conflict.namespace}".`,
        now,
      })
      return { kind: 'auto_resolved', strategy: 'auto_merge_append', resolvedAt }
    }

    // operator_review: queue a pending record
    const record: SyncConflictPendingRecord = {
      schemaVersion: SYNC_CONFLICT_PENDING_SCHEMA_VERSION,
      id: `sync-conflict:${crypto.randomUUID()}`,
      namespace: conflict.namespace,
      objectId: conflict.objectId,
      conflictReason: conflict.reason,
      localObjectVersion: input.localObjectVersion,
      remoteObjectVersion: conflict.actualParentVersion,
      createdAt: now.toISOString(),
    }
    this.pending.unshift(record)
    if (this.pending.length > 200) this.pending.length = 200

    this.pushAudit({
      action: 'conflict_queued_for_review',
      recordId: record.id,
      namespace: conflict.namespace,
      objectId: conflict.objectId,
      reason: `Conflict queued for operator review: ${conflict.reason}.`,
      now,
    })

    return { kind: 'queued_for_review', recordId: record.id, createdAt: record.createdAt }
  }

  /** Returns a copy of all pending (unresolved) conflict records. */
  listPending(): SyncConflictPendingRecord[] {
    return this.pending
      .filter(record => !record.resolvedAt)
      .map(record => ({ ...record }))
  }

  /** Returns a copy of all conflict records including resolved ones. */
  listAll(): SyncConflictPendingRecord[] {
    return this.pending.map(record => ({ ...record }))
  }

  /**
   * Resolves a pending conflict by accepting the local version.
   * Returns false if the record is not found or already resolved.
   */
  acceptLocal(id: string, now?: Date): boolean {
    return this.applyResolution(id, 'accepted_local', 'conflict_accepted_local', now)
  }

  /**
   * Resolves a pending conflict by accepting the remote version.
   * Returns false if the record is not found or already resolved.
   */
  acceptRemote(id: string, now?: Date): boolean {
    return this.applyResolution(id, 'accepted_remote', 'conflict_accepted_remote', now)
  }

  /**
   * Discards a pending conflict record without selecting either version.
   * Returns false if the record is not found or already resolved.
   */
  discard(id: string, now?: Date): boolean {
    return this.applyResolution(id, 'discarded', 'conflict_discarded', now)
  }

  /** Returns a copy of all conflict audit events, newest first. */
  getAuditEvents(): SyncConflictAuditEvent[] {
    return this.audit.map(event => ({ ...event }))
  }

  private applyResolution(
    id: string,
    resolution: SyncConflictResolution,
    auditAction: SyncConflictAuditAction,
    now?: Date,
  ): boolean {
    const record = this.pending.find(r => r.id === id)
    if (!record || record.resolvedAt) return false
    const resolvedAt = (now ?? new Date()).toISOString()
    record.resolvedAt = resolvedAt
    record.resolution = resolution
    this.pushAudit({
      action: auditAction,
      recordId: id,
      namespace: record.namespace,
      objectId: record.objectId,
      reason: `Conflict record ${id} resolved: ${resolution}.`,
      now: now ?? new Date(),
    })
    return true
  }

  private pushAudit(event: Omit<SyncConflictAuditEvent, 'id' | 'createdAt'> & { now: Date }): void {
    const { now, ...rest } = event
    this.audit.unshift({
      id: `sync-conflict-audit:${crypto.randomUUID()}`,
      createdAt: now.toISOString(),
      ...rest,
    })
    if (this.audit.length > 500) this.audit.length = 500
  }
}

export function createSyncConflictResolver(
  initialPending: SyncConflictPendingRecord[] = [],
): SyncConflictResolver {
  return new SyncConflictResolver(initialPending)
}
