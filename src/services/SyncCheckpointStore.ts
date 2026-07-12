import type { SyncRecoveryTransaction } from '../types/syncRecovery'

/** Terminal states — transactions in these states need no further startup processing. */
const TERMINAL_STATES = new Set<SyncRecoveryTransaction['state']>([
  'confirmed',
  'recovered',
  'quarantined',
  'failed_closed',
])

/**
 * Contract for a durable synchronization checkpoint store.
 *
 * Implementations must persist transactions atomically so that
 * an incomplete transaction is always detectable on restart.
 */
export interface SyncCheckpointStoreContract {
  /** Persist a transaction. Overwrites any existing record for the same transactionId. */
  save(transaction: SyncRecoveryTransaction): void
  /** Retrieve a transaction by ID. Returns null if not found. */
  get(transactionId: string): SyncRecoveryTransaction | null
  /** Remove a confirmed transaction. No-op if not present. */
  remove(transactionId: string): void
  /**
   * All stored transactions not in a terminal state.
   * Used by startup recovery to detect interrupted transactions.
   */
  listIncomplete(): readonly SyncRecoveryTransaction[]
}

/**
 * In-memory reference implementation of SyncCheckpointStoreContract.
 *
 * Suitable for testing and development. Does not survive process restart.
 */
export class InMemorySyncCheckpointStore implements SyncCheckpointStoreContract {
  private readonly transactions = new Map<string, SyncRecoveryTransaction>()

  save(transaction: SyncRecoveryTransaction): void {
    this.transactions.set(transaction.transactionId, transaction)
  }

  get(transactionId: string): SyncRecoveryTransaction | null {
    return this.transactions.get(transactionId) ?? null
  }

  remove(transactionId: string): void {
    this.transactions.delete(transactionId)
  }

  listIncomplete(): readonly SyncRecoveryTransaction[] {
    const result: SyncRecoveryTransaction[] = []
    for (const tx of this.transactions.values()) {
      if (!TERMINAL_STATES.has(tx.state)) {
        result.push({ ...tx })
      }
    }
    return result
  }

  /** Total number of stored transactions (for tests and diagnostics). */
  size(): number {
    return this.transactions.size
  }
}

export function createInMemorySyncCheckpointStore(): InMemorySyncCheckpointStore {
  return new InMemorySyncCheckpointStore()
}
