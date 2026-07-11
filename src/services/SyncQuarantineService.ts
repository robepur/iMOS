import type { SyncQuarantineReason, SyncQuarantineRecord } from '../types/sync'

export class SyncQuarantineService {
  private readonly records: SyncQuarantineRecord[] = []

  quarantine(input: {
    reason: SyncQuarantineReason
    requestId: string
    namespace: string
    objectId: string
    detail: string
    now?: Date
  }): SyncQuarantineRecord {
    const record: SyncQuarantineRecord = {
      id: `sync-quarantine:${crypto.randomUUID()}`,
      reason: input.reason,
      requestId: input.requestId,
      namespace: input.namespace as SyncQuarantineRecord['namespace'],
      objectId: input.objectId as SyncQuarantineRecord['objectId'],
      createdAt: (input.now ?? new Date()).toISOString(),
      detail: input.detail,
    }
    this.records.unshift(record)
    if (this.records.length > 500) this.records.length = 500
    return { ...record }
  }

  list(): SyncQuarantineRecord[] {
    return this.records.map(entry => ({ ...entry }))
  }

  clear(id: string): boolean {
    const index = this.records.findIndex(record => record.id === id)
    if (index < 0) return false
    this.records.splice(index, 1)
    return true
  }
}

export function createSyncQuarantineService(): SyncQuarantineService {
  return new SyncQuarantineService()
}

