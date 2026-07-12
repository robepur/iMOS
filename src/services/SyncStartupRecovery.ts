import type { SyncRecoveryAuditEvent, StartupRecoveryResult } from '../types/syncRecovery'
import type { SyncCheckpointStoreContract } from './SyncCheckpointStore'
import type { SyncRecoveryCoordinator } from './SyncRecoveryCoordinator'

/**
 * Evaluates incomplete synchronization transactions on process startup.
 *
 * Detects transactions that were interrupted between prepare and confirmed,
 * and resolves them conservatively:
 *
 *   preparing / staged / validating → roll back (never reached commit)
 *   committing                      → roll back (uncertain — prefer safety over re-apply)
 *   rolling_back                    → complete the rollback (idempotent)
 *   recovered / quarantined / failed_closed → no further action needed
 *
 * The coordinator and store are mutated in place. Callers should run this
 * once before processing any new synchronization transactions.
 *
 * No networking occurs. No vault mutation occurs. No plaintext is logged.
 */
export function evaluateStartupRecovery(
  store: SyncCheckpointStoreContract,
  coordinator: SyncRecoveryCoordinator,
  now = new Date(),
): StartupRecoveryResult {
  const incomplete = store.listIncomplete()
  const auditEvents: SyncRecoveryAuditEvent[] = []
  let recovered = 0
  let quarantined = 0
  let failedClosed = 0

  for (const tx of incomplete) {
    // Emit detection event
    auditEvents.push({
      id: `sync-recovery-startup:${crypto.randomUUID()}`,
      action: 'startup_incomplete_transaction_detected',
      transactionId: tx.transactionId,
      namespace: tx.namespace,
      objectId: tx.objectId,
      state: tx.state,
      reason: `detected_state: ${tx.state}`,
      createdAt: now.toISOString(),
    })

    switch (tx.state) {
      case 'preparing':
      case 'staged':
      case 'validating':
      case 'committing': {
        // Roll back to prior confirmed state. The ledger was never advanced
        // (for preparing/staged/validating) or the commit outcome is uncertain
        // (committing). Conservative path: roll back.
        try {
          coordinator.rollback(tx.transactionId, `startup_recovery: found in ${tx.state}`, now)
          recovered++
        } catch {
          // If rollback itself fails (e.g. state machine rejects the state),
          // fail closed to prevent unknown state.
          coordinator.failClosed(tx.transactionId, `startup_recovery: rollback failed in ${tx.state}`, now)
          failedClosed++
        }
        break
      }

      case 'rolling_back': {
        // Interrupted during rollback — complete it (idempotent).
        try {
          coordinator.rollback(tx.transactionId, 'startup_recovery: completing interrupted rollback', now)
          recovered++
        } catch {
          coordinator.failClosed(tx.transactionId, 'startup_recovery: could not complete interrupted rollback', now)
          failedClosed++
        }
        break
      }

      case 'quarantined':
      case 'failed_closed':
      case 'recovered':
        // Already in a terminal-enough state — no action needed.
        // (These should not appear in listIncomplete unless the store impl is inconsistent.)
        break

      default:
        // Unknown state — fail closed.
        try {
          coordinator.failClosed(tx.transactionId, `startup_recovery: unknown state ${tx.state}`, now)
        } catch {
          // Ignore — can't do anything useful.
        }
        failedClosed++
    }
  }

  // Collect all coordinator audit events generated during this startup pass
  const coordinatorAudits = coordinator.getAuditEvents()
  const startupActionAuditEvents = coordinatorAudits.filter(e =>
    e.action === 'recovery_rolling_back' ||
    e.action === 'recovery_recovered' ||
    e.action === 'recovery_failed_closed',
  )

  auditEvents.push({
    id: `sync-recovery-startup:${crypto.randomUUID()}`,
    action: 'startup_recovery_completed',
    transactionId: 'startup',
    namespace: 'sync:startup' as `sync:${string}`,
    objectId: 'obj:startup' as `obj:${string}`,
    state: 'idle',
    reason: `evaluated=${incomplete.length} recovered=${recovered} quarantined=${quarantined} failedClosed=${failedClosed}`,
    createdAt: now.toISOString(),
  })

  return {
    evaluated: incomplete.length,
    recovered,
    quarantined,
    failedClosed,
    auditEvents: [...auditEvents, ...startupActionAuditEvents],
  }
}
