import { describe, expect, it } from 'vitest'
import { SyncConflictResolver, createSyncConflictResolver } from '../../src/services/SyncConflictResolver'
import { createInitialData, normalizePersonalData } from '../../src/localData'
import type { SyncConflictPendingRecord, SyncConflictResponse } from '../../src/types/sync'
import { SYNC_CONFLICT_PENDING_SCHEMA_VERSION } from '../../src/types/sync'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConflict(overrides: Partial<SyncConflictResponse> = {}): SyncConflictResponse {
  return {
    protocolVersion: '1.0.0',
    requestId: `request:${crypto.randomUUID()}`,
    namespace: 'sync:operator' as `sync:${string}`,
    objectId: 'obj:test-1' as `obj:${string}`,
    conflictReason: undefined,
    expectedParentVersion: undefined,
    actualParentVersion: undefined,
    reason: 'parent_version_mismatch',
    ...overrides,
  } as SyncConflictResponse
}

const NOW = new Date('2026-01-01T00:00:00.000Z')

// ---------------------------------------------------------------------------
// Conflict resolution policy tests
// ---------------------------------------------------------------------------

describe('Build 020 conflict resolution', () => {
  describe('namespace policy: auto_merge_append', () => {
    it('auto-resolves conflicts in sync:audit namespace', () => {
      const resolver = createSyncConflictResolver()
      const result = resolver.resolve({
        conflict: makeConflict({ namespace: 'sync:audit' as `sync:${string}` }),
        localObjectVersion: '3',
        now: NOW,
      })
      expect(result.kind).toBe('auto_resolved')
      if (result.kind === 'auto_resolved') {
        expect(result.strategy).toBe('auto_merge_append')
        expect(result.resolvedAt).toBe(NOW.toISOString())
      }
      expect(resolver.listPending()).toHaveLength(0)
    })

    it('auto-resolves conflicts in sync:quarantine namespace', () => {
      const resolver = createSyncConflictResolver()
      const result = resolver.resolve({
        conflict: makeConflict({ namespace: 'sync:quarantine' as `sync:${string}`, reason: 'stale_version' }),
        localObjectVersion: '2',
        now: NOW,
      })
      expect(result.kind).toBe('auto_resolved')
      expect(resolver.listPending()).toHaveLength(0)
    })

    it('auto-resolves conflicts in namespaced sub-paths of audit', () => {
      const resolver = createSyncConflictResolver()
      const result = resolver.resolve({
        conflict: makeConflict({ namespace: 'sync:audit:transport' as `sync:${string}` }),
        localObjectVersion: '1',
        now: NOW,
      })
      expect(result.kind).toBe('auto_resolved')
    })
  })

  describe('namespace policy: operator_review', () => {
    const criticalNamespaces = [
      'sync:priority',
      'sync:commitment',
      'sync:decision',
      'sync:mission',
      'sync:consent',
      'sync:cognitive',
      'sync:identity',
      'sync:operator',
      'sync:recovery',
      'sync:reflection',
      'sync:understanding',
    ] as const

    for (const ns of criticalNamespaces) {
      it(`queues operator review for ${ns}`, () => {
        const resolver = createSyncConflictResolver()
        const result = resolver.resolve({
          conflict: makeConflict({ namespace: ns as `sync:${string}` }),
          localObjectVersion: '5',
          now: NOW,
        })
        expect(result.kind).toBe('queued_for_review')
        if (result.kind === 'queued_for_review') {
          expect(result.recordId).toMatch(/^sync-conflict:/)
          expect(result.createdAt).toBe(NOW.toISOString())
        }
        expect(resolver.listPending()).toHaveLength(1)
      })
    }

    it('queued record carries correct metadata', () => {
      const resolver = createSyncConflictResolver()
      const conflict = makeConflict({
        namespace: 'sync:priority' as `sync:${string}`,
        objectId: 'obj:priority-abc' as `obj:${string}`,
        reason: 'parent_version_mismatch',
        actualParentVersion: '4',
      })
      const result = resolver.resolve({ conflict, localObjectVersion: '5', now: NOW })
      expect(result.kind).toBe('queued_for_review')
      const pending = resolver.listPending()
      expect(pending).toHaveLength(1)
      const record = pending[0]
      expect(record.namespace).toBe('sync:priority')
      expect(record.objectId).toBe('obj:priority-abc')
      expect(record.conflictReason).toBe('parent_version_mismatch')
      expect(record.localObjectVersion).toBe('5')
      expect(record.remoteObjectVersion).toBe('4')
      expect(record.resolvedAt).toBeUndefined()
      expect(record.resolution).toBeUndefined()
    })
  })

  describe('namespace policy: deny (fail closed)', () => {
    it('denies conflicts from completely unknown namespaces', () => {
      const resolver = createSyncConflictResolver()
      const result = resolver.resolve({
        conflict: makeConflict({ namespace: 'sync:custom-unknown-xyz' as `sync:${string}` }),
        localObjectVersion: '1',
        now: NOW,
      })
      expect(result.kind).toBe('denied')
      if (result.kind === 'denied') {
        expect(result.reason).toContain('no resolution policy')
      }
      expect(resolver.listPending()).toHaveLength(0)
    })

    it('does not create pending records for denied namespaces', () => {
      const resolver = createSyncConflictResolver()
      resolver.resolve({
        conflict: makeConflict({ namespace: 'sync:unrecognized' as `sync:${string}` }),
        localObjectVersion: '1',
        now: NOW,
      })
      expect(resolver.listAll()).toHaveLength(0)
    })

    // Prefix confusion: hyphen-separated variants of known namespaces must be denied
    it('denies sync:audit-evil (hyphen sibling of auto_merge_append namespace)', () => {
      const resolver = createSyncConflictResolver()
      const result = resolver.resolve({
        conflict: makeConflict({ namespace: 'sync:audit-evil' as `sync:${string}` }),
        localObjectVersion: '1',
        now: NOW,
      })
      expect(result.kind).toBe('denied')
      expect(resolver.listPending()).toHaveLength(0)
    })

    it('denies sync:quarantine-bypass (hyphen sibling of auto_merge_append namespace)', () => {
      const resolver = createSyncConflictResolver()
      const result = resolver.resolve({
        conflict: makeConflict({ namespace: 'sync:quarantine-bypass' as `sync:${string}` }),
        localObjectVersion: '1',
        now: NOW,
      })
      expect(result.kind).toBe('denied')
      expect(resolver.listPending()).toHaveLength(0)
    })

    it('denies sync:priority-high (hyphen sibling of operator_review namespace)', () => {
      const resolver = createSyncConflictResolver()
      const result = resolver.resolve({
        conflict: makeConflict({ namespace: 'sync:priority-high' as `sync:${string}` }),
        localObjectVersion: '1',
        now: NOW,
      })
      expect(result.kind).toBe('denied')
    })

    it('allows colon-separated sub-paths of auto_merge_append namespaces', () => {
      const resolver = createSyncConflictResolver()
      const result = resolver.resolve({
        conflict: makeConflict({ namespace: 'sync:audit:transport' as `sync:${string}` }),
        localObjectVersion: '1',
        now: NOW,
      })
      expect(result.kind).toBe('auto_resolved')
    })

    it('allows colon-separated sub-paths of operator_review namespaces', () => {
      const resolver = createSyncConflictResolver()
      const result = resolver.resolve({
        conflict: makeConflict({ namespace: 'sync:identity:device' as `sync:${string}` }),
        localObjectVersion: '1',
        now: NOW,
      })
      expect(result.kind).toBe('queued_for_review')
    })
  })

  describe('tombstone conflict escalation', () => {
    it('escalates tombstone conflicts in auto_merge_append namespaces to operator review', () => {
      const resolver = createSyncConflictResolver()
      const result = resolver.resolve({
        conflict: makeConflict({
          namespace: 'sync:audit' as `sync:${string}`,
          reason: 'tombstone_conflict',
        }),
        localObjectVersion: '2',
        now: NOW,
      })
      // tombstone conflicts must not be silently auto-merged
      expect(result.kind).toBe('queued_for_review')
      expect(resolver.listPending()).toHaveLength(1)
      expect(resolver.listPending()[0].conflictReason).toBe('tombstone_conflict')
    })

    it('queues tombstone conflicts in operator_review namespaces normally', () => {
      const resolver = createSyncConflictResolver()
      const result = resolver.resolve({
        conflict: makeConflict({
          namespace: 'sync:decision' as `sync:${string}`,
          reason: 'tombstone_conflict',
        }),
        localObjectVersion: '3',
        now: NOW,
      })
      expect(result.kind).toBe('queued_for_review')
    })
  })

  describe('conflict resolution lifecycle', () => {
    it('acceptLocal marks record resolved and removes from pending list', () => {
      const resolver = createSyncConflictResolver()
      const result = resolver.resolve({
        conflict: makeConflict({ namespace: 'sync:decision' as `sync:${string}` }),
        localObjectVersion: '2',
        now: NOW,
      })
      expect(result.kind).toBe('queued_for_review')
      const recordId = (result as { kind: 'queued_for_review'; recordId: string }).recordId
      const accepted = resolver.acceptLocal(recordId, new Date('2026-01-02T00:00:00.000Z'))
      expect(accepted).toBe(true)
      expect(resolver.listPending()).toHaveLength(0)
      const all = resolver.listAll()
      expect(all).toHaveLength(1)
      expect(all[0].resolution).toBe('accepted_local')
      expect(all[0].resolvedAt).toBe('2026-01-02T00:00:00.000Z')
    })

    it('acceptRemote marks record resolved', () => {
      const resolver = createSyncConflictResolver()
      const result = resolver.resolve({
        conflict: makeConflict({ namespace: 'sync:priority' as `sync:${string}` }),
        localObjectVersion: '1',
        now: NOW,
      })
      const recordId = (result as { kind: 'queued_for_review'; recordId: string }).recordId
      expect(resolver.acceptRemote(recordId)).toBe(true)
      expect(resolver.listAll()[0].resolution).toBe('accepted_remote')
    })

    it('discard marks record discarded', () => {
      const resolver = createSyncConflictResolver()
      const result = resolver.resolve({
        conflict: makeConflict({ namespace: 'sync:commitment' as `sync:${string}` }),
        localObjectVersion: '7',
        now: NOW,
      })
      const recordId = (result as { kind: 'queued_for_review'; recordId: string }).recordId
      expect(resolver.discard(recordId)).toBe(true)
      expect(resolver.listAll()[0].resolution).toBe('discarded')
      expect(resolver.listPending()).toHaveLength(0)
    })

    it('returns false when resolving an already-resolved record', () => {
      const resolver = createSyncConflictResolver()
      const result = resolver.resolve({
        conflict: makeConflict({ namespace: 'sync:mission' as `sync:${string}` }),
        localObjectVersion: '1',
        now: NOW,
      })
      const recordId = (result as { kind: 'queued_for_review'; recordId: string }).recordId
      resolver.acceptLocal(recordId)
      // Second call must fail
      expect(resolver.acceptLocal(recordId)).toBe(false)
      expect(resolver.acceptRemote(recordId)).toBe(false)
      expect(resolver.discard(recordId)).toBe(false)
    })

    it('returns false for unknown record id', () => {
      const resolver = createSyncConflictResolver()
      expect(resolver.acceptLocal('sync-conflict:does-not-exist')).toBe(false)
      expect(resolver.acceptRemote('sync-conflict:does-not-exist')).toBe(false)
      expect(resolver.discard('sync-conflict:does-not-exist')).toBe(false)
    })
  })

  describe('audit event trail', () => {
    it('records an audit event for each resolution action', () => {
      const resolver = createSyncConflictResolver()

      resolver.resolve({
        conflict: makeConflict({ namespace: 'sync:quarantine' as `sync:${string}` }),
        localObjectVersion: '1',
        now: NOW,
      })
      resolver.resolve({
        conflict: makeConflict({ namespace: 'sync:unrecognized' as `sync:${string}` }),
        localObjectVersion: '1',
        now: NOW,
      })
      const qResult = resolver.resolve({
        conflict: makeConflict({ namespace: 'sync:decision' as `sync:${string}` }),
        localObjectVersion: '3',
        now: NOW,
      })
      const recordId = (qResult as { kind: 'queued_for_review'; recordId: string }).recordId
      resolver.acceptLocal(recordId)

      const audit = resolver.getAuditEvents()
      const actions = audit.map(e => e.action)
      expect(actions).toContain('conflict_auto_resolved')
      expect(actions).toContain('conflict_denied')
      expect(actions).toContain('conflict_queued_for_review')
      expect(actions).toContain('conflict_accepted_local')
    })

    it('getAuditEvents returns copies not internal references', () => {
      const resolver = createSyncConflictResolver()
      resolver.resolve({
        conflict: makeConflict({ namespace: 'sync:audit' as `sync:${string}` }),
        localObjectVersion: '1',
        now: NOW,
      })
      const first = resolver.getAuditEvents()
      const second = resolver.getAuditEvents()
      expect(first).not.toBe(second)
    })
  })

  describe('initial pending records', () => {
    it('accepts pre-loaded pending records from persistence', () => {
      const existing: SyncConflictPendingRecord = {
        schemaVersion: SYNC_CONFLICT_PENDING_SCHEMA_VERSION,
        id: 'sync-conflict:preloaded-1',
        namespace: 'sync:priority' as `sync:${string}`,
        objectId: 'obj:priority-x' as `obj:${string}`,
        conflictReason: 'stale_version',
        localObjectVersion: '2',
        createdAt: NOW.toISOString(),
      }
      const resolver = createSyncConflictResolver([existing])
      expect(resolver.listPending()).toHaveLength(1)
      expect(resolver.listPending()[0].id).toBe('sync-conflict:preloaded-1')
    })

    it('can resolve a pre-loaded record', () => {
      const existing: SyncConflictPendingRecord = {
        schemaVersion: SYNC_CONFLICT_PENDING_SCHEMA_VERSION,
        id: 'sync-conflict:preloaded-2',
        namespace: 'sync:commitment' as `sync:${string}`,
        objectId: 'obj:commitment-y' as `obj:${string}`,
        conflictReason: 'parent_version_mismatch',
        localObjectVersion: '5',
        createdAt: NOW.toISOString(),
      }
      const resolver = createSyncConflictResolver([existing])
      expect(resolver.discard('sync-conflict:preloaded-2')).toBe(true)
      expect(resolver.listPending()).toHaveLength(0)
    })
  })

  describe('secret exclusion', () => {
    it('does not store secret values in pending conflict records', () => {
      const resolver = createSyncConflictResolver()
      resolver.resolve({
        conflict: makeConflict({ namespace: 'sync:priority' as `sync:${string}` }),
        localObjectVersion: '1',
        now: NOW,
      })
      const pending = resolver.listPending()
      const serialized = JSON.stringify(pending)
      const forbidden = ['passphrase', 'encryptedPayload', 'privateKey', 'password', 'token', 'credential']
      for (const term of forbidden) {
        expect(serialized.toLowerCase()).not.toContain(term.toLowerCase())
      }
    })

    it('audit events do not contain sensitive values', () => {
      const resolver = createSyncConflictResolver()
      resolver.resolve({
        conflict: makeConflict({ namespace: 'sync:decision' as `sync:${string}` }),
        localObjectVersion: '2',
        now: NOW,
      })
      const audit = resolver.getAuditEvents()
      const serialized = JSON.stringify(audit)
      const forbidden = ['passphrase', 'encryptedPayload', 'privateKey', 'password']
      for (const term of forbidden) {
        expect(serialized.toLowerCase()).not.toContain(term.toLowerCase())
      }
    })
  })

  describe('persistence and migration compatibility', () => {
    it('createInitialData includes empty syncPendingConflicts', () => {
      const data = createInitialData()
      expect(data.syncPendingConflicts).toEqual([])
    })

    it('normalizePersonalData preserves valid pending conflict records', () => {
      const record: SyncConflictPendingRecord = {
        schemaVersion: SYNC_CONFLICT_PENDING_SCHEMA_VERSION,
        id: 'sync-conflict:test-a',
        namespace: 'sync:decision' as `sync:${string}`,
        objectId: 'obj:decision-1' as `obj:${string}`,
        conflictReason: 'parent_version_mismatch',
        localObjectVersion: '3',
        remoteObjectVersion: '2',
        createdAt: NOW.toISOString(),
      }
      const initial = createInitialData()
      const normalized = normalizePersonalData({ ...initial, syncPendingConflicts: [record] })
      expect(normalized.syncPendingConflicts).toHaveLength(1)
      expect(normalized.syncPendingConflicts?.[0].id).toBe('sync-conflict:test-a')
    })

    it('normalizePersonalData preserves resolved conflict records', () => {
      const record: SyncConflictPendingRecord = {
        schemaVersion: SYNC_CONFLICT_PENDING_SCHEMA_VERSION,
        id: 'sync-conflict:resolved-b',
        namespace: 'sync:priority' as `sync:${string}`,
        objectId: 'obj:priority-2' as `obj:${string}`,
        conflictReason: 'stale_version',
        localObjectVersion: '8',
        createdAt: NOW.toISOString(),
        resolvedAt: new Date('2026-01-02T00:00:00.000Z').toISOString(),
        resolution: 'accepted_local',
      }
      const initial = createInitialData()
      const normalized = normalizePersonalData({ ...initial, syncPendingConflicts: [record] })
      expect(normalized.syncPendingConflicts).toHaveLength(1)
      expect(normalized.syncPendingConflicts?.[0].resolution).toBe('accepted_local')
    })

    it('normalizePersonalData discards malformed conflict records', () => {
      const initial = createInitialData()
      const normalized = normalizePersonalData({
        ...initial,
        syncPendingConflicts: [
          { id: 'bad', namespace: 'sync:priority', objectId: 'not-an-obj', conflictReason: 'UNKNOWN' },
          null,
          'string',
        ] as unknown as SyncConflictPendingRecord[],
      })
      expect(normalized.syncPendingConflicts).toEqual([])
    })

    it('normalizePersonalData defaults to empty array when field is absent', () => {
      const initial = createInitialData()
      const { syncPendingConflicts: _omit, ...withoutField } = initial
      const normalized = normalizePersonalData(withoutField as typeof initial)
      expect(normalized.syncPendingConflicts).toEqual([])
    })

    it('normalizePersonalData rejects records with mismatched resolvedAt and resolution', () => {
      const initial = createInitialData()
      // resolvedAt present but resolution absent — invalid
      const bad = normalizePersonalData({
        ...initial,
        syncPendingConflicts: [{
          schemaVersion: SYNC_CONFLICT_PENDING_SCHEMA_VERSION,
          id: 'sync-conflict:bad-c',
          namespace: 'sync:decision',
          objectId: 'obj:d-1',
          conflictReason: 'stale_version',
          localObjectVersion: '1',
          createdAt: NOW.toISOString(),
          resolvedAt: NOW.toISOString(),
          // resolution is absent
        }] as unknown as SyncConflictPendingRecord[],
      })
      expect(bad.syncPendingConflicts).toEqual([])
    })

    it('normalizePersonalData rejects records with forbidden security fields', () => {
      const initial = createInitialData()
      const normalized = normalizePersonalData({
        ...initial,
        syncPendingConflicts: [{
          schemaVersion: SYNC_CONFLICT_PENDING_SCHEMA_VERSION,
          id: 'sync-conflict:bad-d',
          namespace: 'sync:decision',
          objectId: 'obj:d-2',
          conflictReason: 'stale_version',
          localObjectVersion: '1',
          createdAt: NOW.toISOString(),
          passphrase: 'should-not-be-here',
        }] as unknown as SyncConflictPendingRecord[],
      })
      expect(normalized.syncPendingConflicts).toEqual([])
    })

    it('existing Build 019 persistence fields remain unchanged after adding Build 020 fields', () => {
      const initial = createInitialData()
      const normalized = normalizePersonalData({ ...initial, syncPendingConflicts: [] })
      expect(normalized.syncOperatorControlState?.enabled).toBe(false)
      expect(normalized.syncQuarantine).toEqual([])
      expect(normalized.syncPendingConflicts).toEqual([])
    })

    it('normalizePersonalData rejects records with uppercase namespace (case-sensitive validation)', () => {
      const initial = createInitialData()
      const normalized = normalizePersonalData({
        ...initial,
        syncPendingConflicts: [{
          schemaVersion: SYNC_CONFLICT_PENDING_SCHEMA_VERSION,
          id: 'sync-conflict:bad-e',
          namespace: 'SYNC:DECISION',
          objectId: 'obj:d-3',
          conflictReason: 'stale_version',
          localObjectVersion: '1',
          createdAt: NOW.toISOString(),
        }] as unknown as SyncConflictPendingRecord[],
      })
      expect(normalized.syncPendingConflicts).toEqual([])
    })

    it('normalizePersonalData rejects records with excessively long namespace', () => {
      const initial = createInitialData()
      const longNs = `sync:${'a'.repeat(200)}`
      const normalized = normalizePersonalData({
        ...initial,
        syncPendingConflicts: [{
          schemaVersion: SYNC_CONFLICT_PENDING_SCHEMA_VERSION,
          id: 'sync-conflict:bad-f',
          namespace: longNs,
          objectId: 'obj:d-4',
          conflictReason: 'stale_version',
          localObjectVersion: '1',
          createdAt: NOW.toISOString(),
        }] as unknown as SyncConflictPendingRecord[],
      })
      expect(normalized.syncPendingConflicts).toEqual([])
    })

    it('normalizePersonalData rejects records with control characters in namespace', () => {
      const initial = createInitialData()
      const normalized = normalizePersonalData({
        ...initial,
        syncPendingConflicts: [{
          schemaVersion: SYNC_CONFLICT_PENDING_SCHEMA_VERSION,
          id: 'sync-conflict:bad-g',
          namespace: 'sync:audit\x00evil',
          objectId: 'obj:d-5',
          conflictReason: 'stale_version',
          localObjectVersion: '1',
          createdAt: NOW.toISOString(),
        }] as unknown as SyncConflictPendingRecord[],
      })
      expect(normalized.syncPendingConflicts).toEqual([])
    })

    it('normalizePersonalData rejects records with encoded separators in namespace', () => {
      const initial = createInitialData()
      const normalized = normalizePersonalData({
        ...initial,
        syncPendingConflicts: [{
          schemaVersion: SYNC_CONFLICT_PENDING_SCHEMA_VERSION,
          id: 'sync-conflict:bad-h',
          namespace: 'sync:audit%3Aevil',
          objectId: 'obj:d-6',
          conflictReason: 'stale_version',
          localObjectVersion: '1',
          createdAt: NOW.toISOString(),
        }] as unknown as SyncConflictPendingRecord[],
      })
      expect(normalized.syncPendingConflicts).toEqual([])
    })
  })

  describe('listPending only returns unresolved records', () => {
    it('hides resolved records from listPending but shows them in listAll', () => {
      const resolver = createSyncConflictResolver()
      const r1 = resolver.resolve({
        conflict: makeConflict({ namespace: 'sync:priority' as `sync:${string}`, objectId: 'obj:a' as `obj:${string}` }),
        localObjectVersion: '1',
        now: NOW,
      })
      const r2 = resolver.resolve({
        conflict: makeConflict({ namespace: 'sync:decision' as `sync:${string}`, objectId: 'obj:b' as `obj:${string}` }),
        localObjectVersion: '2',
        now: NOW,
      })
      const id1 = (r1 as { kind: 'queued_for_review'; recordId: string }).recordId
      resolver.acceptLocal(id1)
      expect(resolver.listPending()).toHaveLength(1)
      expect(resolver.listAll()).toHaveLength(2)
      void r2
    })
  })

  describe('SyncConflictResolver factory', () => {
    it('createSyncConflictResolver returns a new instance', () => {
      const a = createSyncConflictResolver()
      const b = createSyncConflictResolver()
      expect(a).not.toBe(b)
    })

    it('instances are independent', () => {
      const a = createSyncConflictResolver()
      const b = createSyncConflictResolver()
      a.resolve({
        conflict: makeConflict({ namespace: 'sync:decision' as `sync:${string}` }),
        localObjectVersion: '1',
        now: NOW,
      })
      expect(a.listPending()).toHaveLength(1)
      expect(b.listPending()).toHaveLength(0)
    })
  })

  describe('SyncConflictResolver class direct construction', () => {
    it('works with empty constructor', () => {
      const resolver = new SyncConflictResolver()
      expect(resolver.listPending()).toEqual([])
      expect(resolver.listAll()).toEqual([])
      expect(resolver.getAuditEvents()).toEqual([])
    })
  })
})
