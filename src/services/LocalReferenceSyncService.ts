import type {
  EncryptedSyncEnvelope,
  SyncConflictResponse,
  SyncDownloadResult,
  SyncUploadAcknowledgment,
} from '../types/sync'

type StoredEnvelope = {
  envelope: EncryptedSyncEnvelope
  storedAt: string
}

function conflict(input: {
  requestId: string
  namespace: string
  objectId: string
  expectedParentVersion?: string
  actualParentVersion?: string
  reason: SyncConflictResponse['reason']
}): SyncConflictResponse {
  return {
    protocolVersion: '1.0.0',
    requestId: input.requestId,
    namespace: input.namespace as SyncConflictResponse['namespace'],
    objectId: input.objectId as SyncConflictResponse['objectId'],
    expectedParentVersion: input.expectedParentVersion as SyncConflictResponse['expectedParentVersion'],
    actualParentVersion: input.actualParentVersion as SyncConflictResponse['actualParentVersion'],
    reason: input.reason,
  }
}

export class LocalReferenceSyncService {
  private readonly store = new Map<string, StoredEnvelope>()
  private readonly replayIds = new Set<string>()

  private key(namespace: string, objectId: string): string {
    return `${namespace}|${objectId}`
  }

  upload(envelope: EncryptedSyncEnvelope, now = new Date()):
    | { kind: 'ack'; ack: SyncUploadAcknowledgment }
    | { kind: 'conflict'; conflict: SyncConflictResponse } {
    const key = this.key(envelope.namespace, envelope.objectId)
    if (this.replayIds.has(envelope.replayId)) {
      return {
        kind: 'conflict',
        conflict: conflict({
          requestId: envelope.requestId,
          namespace: envelope.namespace,
          objectId: envelope.objectId,
          expectedParentVersion: envelope.parentVersion,
          reason: 'stale_version',
        }),
      }
    }
    const current = this.store.get(key)
    if (current) {
      if (envelope.parentVersion && envelope.parentVersion !== current.envelope.objectVersion) {
        return {
          kind: 'conflict',
          conflict: conflict({
            requestId: envelope.requestId,
            namespace: envelope.namespace,
            objectId: envelope.objectId,
            expectedParentVersion: envelope.parentVersion,
            actualParentVersion: current.envelope.objectVersion,
            reason: 'parent_version_mismatch',
          }),
        }
      }
      if (current.envelope.tombstone && !envelope.tombstone) {
        return {
          kind: 'conflict',
          conflict: conflict({
            requestId: envelope.requestId,
            namespace: envelope.namespace,
            objectId: envelope.objectId,
            reason: 'tombstone_conflict',
          }),
        }
      }
      if (Number(envelope.objectVersion) <= Number(current.envelope.objectVersion)) {
        return {
          kind: 'conflict',
          conflict: conflict({
            requestId: envelope.requestId,
            namespace: envelope.namespace,
            objectId: envelope.objectId,
            expectedParentVersion: envelope.parentVersion,
            actualParentVersion: current.envelope.objectVersion,
            reason: 'stale_version',
          }),
        }
      }
    }
    const storedAt = now.toISOString()
    this.store.set(key, {
      envelope: { ...envelope },
      storedAt,
    })
    this.replayIds.add(envelope.replayId)
    return {
      kind: 'ack',
      ack: {
        protocolVersion: '1.0.0',
        requestId: envelope.requestId,
        accepted: true,
        namespace: envelope.namespace,
        objectId: envelope.objectId,
        objectVersion: envelope.objectVersion,
        storedAt,
      },
    }
  }

  download(input: {
    requestId: string
    namespace: string
    objectId: string
  }): SyncDownloadResult {
    const key = this.key(input.namespace, input.objectId)
    const found = this.store.get(key)
    if (!found) {
      return {
        kind: 'not_found',
        protocolVersion: '1.0.0',
        requestId: input.requestId,
        namespace: input.namespace as `sync:${string}`,
        objectId: input.objectId as `obj:${string}`,
      }
    }
    return {
      kind: 'found',
      protocolVersion: '1.0.0',
      requestId: input.requestId,
      envelope: { ...found.envelope },
    }
  }
}

export function createLocalReferenceSyncService(): LocalReferenceSyncService {
  return new LocalReferenceSyncService()
}
