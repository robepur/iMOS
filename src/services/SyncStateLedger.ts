import type {
  RemoteObjectDescriptor,
  SyncConvergenceAuditEvent,
  SyncConvergenceOutcome,
  SyncObjectLedgerEntry,
} from '../types/syncConvergence'
import { SYNC_CONVERGENCE_SCHEMA_VERSION } from '../types/syncConvergence'
import type { EncryptedObjectId, ObjectVersion, SyncNamespace } from '../types/sync'
import { auditConvergenceOutcome, evaluateConvergence } from './SyncConflictEngine'

const MAX_AUDIT_EVENTS = 500
const MAX_VERSION_HISTORY = 64

type MutableEntry = {
  schemaVersion: typeof SYNC_CONVERGENCE_SCHEMA_VERSION
  namespace: SyncNamespace
  objectId: EncryptedObjectId
  acceptedVersion: ObjectVersion
  acceptedParentVersion?: ObjectVersion
  contentDigest: string
  signerDeviceId: string
  hierarchyId: string
  tombstone: boolean
  acceptedAt: string
  lastGoodAt: string
  acceptedVersionHistory: ObjectVersion[]
}

/**
 * In-memory synchronization state ledger.
 *
 * Tracks the last accepted version for each namespace/objectId pair
 * and the full version history for replay detection.
 *
 * The ledger is the authoritative source of "what has been accepted locally."
 * It does not make network requests and has no side effects beyond recording outcomes.
 *
 * Callers must call `commit()` only after successfully decrypting and applying
 * accepted content to the vault. Do not commit a quarantine or review outcome.
 */
export class SyncStateLedger {
  private readonly entries = new Map<string, MutableEntry>()
  private readonly audits: SyncConvergenceAuditEvent[] = []

  private entryKey(namespace: SyncNamespace, objectId: EncryptedObjectId): string {
    return `${namespace}\u0000${objectId}`
  }

  /**
   * Retrieve the current ledger entry for a given namespace/objectId pair.
   * Returns null if this object has not yet been accepted locally.
   */
  get(namespace: SyncNamespace, objectId: EncryptedObjectId): SyncObjectLedgerEntry | null {
    const entry = this.entries.get(this.entryKey(namespace, objectId))
    if (!entry) return null
    return {
      ...entry,
      acceptedVersionHistory: [...entry.acceptedVersionHistory] as readonly ObjectVersion[],
    }
  }

  /**
   * Evaluate the convergence outcome for a remote object descriptor.
   * Records a structured audit event regardless of outcome.
   * Does NOT modify the ledger — call `commit()` to advance state.
   */
  evaluate(remote: RemoteObjectDescriptor, now = new Date()): SyncConvergenceOutcome {
    const existing = this.get(remote.namespace, remote.objectId)
    const outcome = evaluateConvergence(existing, remote)
    const event = auditConvergenceOutcome(outcome, now)
    this.audits.unshift(event)
    if (this.audits.length > MAX_AUDIT_EVENTS) this.audits.length = MAX_AUDIT_EVENTS
    return outcome
  }

  /**
   * Advance the ledger to reflect a newly accepted remote state.
   * Must only be called with an `accept_remote` outcome that has been
   * successfully decrypted and applied to the vault.
   */
  commit(
    remote: RemoteObjectDescriptor,
    outcome: Extract<SyncConvergenceOutcome, { verdict: 'accept_remote' }>,
    now = new Date(),
  ): void {
    const k = this.entryKey(outcome.namespace, outcome.objectId)
    const existing = this.entries.get(k)
    const prevHistory: ObjectVersion[] = existing
      ? [...existing.acceptedVersionHistory]
      : []
    if (existing && !prevHistory.includes(existing.acceptedVersion)) {
      prevHistory.push(existing.acceptedVersion)
    }
    if (prevHistory.length > MAX_VERSION_HISTORY) {
      prevHistory.splice(0, prevHistory.length - MAX_VERSION_HISTORY)
    }
    const timestamp = now.toISOString()
    this.entries.set(k, {
      schemaVersion: SYNC_CONVERGENCE_SCHEMA_VERSION,
      namespace: outcome.namespace,
      objectId: outcome.objectId,
      acceptedVersion: outcome.objectVersion,
      acceptedParentVersion: outcome.parentVersion,
      contentDigest: outcome.contentDigest,
      signerDeviceId: remote.signerDeviceId,
      hierarchyId: remote.hierarchyId,
      tombstone: outcome.tombstone,
      acceptedAt: timestamp,
      lastGoodAt: timestamp,
      acceptedVersionHistory: prevHistory,
    })
  }

  /**
   * All convergence audit events, most-recent first.
   * Each event is a shallow copy and safe to hold onto.
   */
  getAuditEvents(): SyncConvergenceAuditEvent[] {
    return this.audits.map(event => ({ ...event }))
  }

  /** Number of distinct namespace/objectId pairs tracked in the ledger. */
  size(): number {
    return this.entries.size
  }
}

export function createSyncStateLedger(): SyncStateLedger {
  return new SyncStateLedger()
}
