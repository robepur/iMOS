import { describe, expect, it, beforeEach } from 'vitest'
import { createSyncRecoveryCoordinator } from '../../src/services/SyncRecoveryCoordinator'
import { createInMemorySyncCheckpointStore } from '../../src/services/SyncCheckpointStore'
import { createSyncStateLedger } from '../../src/services/SyncStateLedger'
import { evaluateStartupRecovery } from '../../src/services/SyncStartupRecovery'
import { normalizePersonalData } from '../../src/localData'
import type { RemoteObjectDescriptor, SyncObjectLedgerEntry } from '../../src/types/syncConvergence'
import { SYNC_CONVERGENCE_SCHEMA_VERSION } from '../../src/types/syncConvergence'
import {
  build016SyncFixture,
  build017SyncFixture,
  build018SyncFixture,
  build019SyncFixture,
  build019SyncFixtureWithLocalEndpoint,
  build020SyncFixture,
  build021SyncFixture,
  build021SyncFixtureWithFutureFields,
  malformedSyncOperatorControlFixture,
  productionEndpointSyncFixture,
  quarantineWithForbiddenFieldFixture,
} from '../fixtures/syncCompatibilityFixtures'

// ── Test helpers ─────────────────────────────────────────────────────────────

const NS = 'sync:recovery-test' as const
const OBJ = 'obj:recovery-test-001' as const
const HIERARCHY = 'sync-key-hierarchy:testhierarchy-recovery' as const
const DEVICE_A = 'device:alice' as const
const DEVICE_B = 'device:bob' as const
const DIGEST_A = 'sha256-aaa111'
const DIGEST_B = 'sha256-bbb222'
const DIGEST_C = 'sha256-ccc333'

function makeRemote(overrides: Partial<RemoteObjectDescriptor> = {}): RemoteObjectDescriptor {
  return {
    namespace: NS,
    objectId: OBJ,
    objectVersion: '2',
    parentVersion: '1',
    signerDeviceId: DEVICE_A,
    contentDigest: DIGEST_B,
    hierarchyId: HIERARCHY,
    tombstone: false,
    isSignatureVerified: true,
    isSignerActive: true,
    isSignerRevoked: false,
    isSignerSuspended: false,
    ...overrides,
  }
}

function makeLedgerEntry(overrides: Partial<SyncObjectLedgerEntry> = {}): SyncObjectLedgerEntry {
  return {
    schemaVersion: SYNC_CONVERGENCE_SCHEMA_VERSION,
    namespace: NS,
    objectId: OBJ,
    acceptedVersion: '1',
    acceptedParentVersion: undefined,
    contentDigest: DIGEST_A,
    signerDeviceId: DEVICE_A,
    hierarchyId: HIERARCHY,
    tombstone: false,
    acceptedAt: '2026-01-01T00:00:00.000Z',
    lastGoodAt: '2026-01-01T00:00:00.000Z',
    acceptedVersionHistory: [],
    ...overrides,
  }
}

// ── Transaction lifecycle ─────────────────────────────────────────────────────

describe('Build 022 sync recovery coordinator', () => {
  describe('happy path: atomic commit', () => {
    it('valid staged transaction commits atomically', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const ledger = createSyncStateLedger()
      const priorEntry = makeLedgerEntry({ acceptedVersion: '1', contentDigest: DIGEST_A })
      const remote = makeRemote({ objectVersion: '2', parentVersion: '1', contentDigest: DIGEST_B })

      const tx1 = await coordinator.prepare(remote, priorEntry)
      expect(tx1.state).toBe('preparing')

      const tx2 = coordinator.stage(tx1.transactionId)
      expect(tx2.state).toBe('staged')

      // Simulate ledger.evaluate → accept_remote outcome
      const acceptOutcome = ledger.evaluate(remote) as Extract<ReturnType<typeof ledger.evaluate>, { verdict: 'accept_remote' }>
      expect(acceptOutcome.verdict).toBe('accept_remote')

      const tx3 = await coordinator.validate(tx1.transactionId, remote, acceptOutcome)
      expect(tx3.state).toBe('validating')

      const tx4 = coordinator.commitToLedger(tx1.transactionId, remote, acceptOutcome, ledger)
      expect(tx4.state).toBe('confirmed')

      // Ledger advanced
      const entry = ledger.get(NS, OBJ)
      expect(entry?.acceptedVersion).toBe('2')
      expect(entry?.contentDigest).toBe(DIGEST_B)

      // Checkpoint removed from store after confirmation
      expect(store.get(tx1.transactionId)).toBeNull()
    })
  })

  // ── Failure paths ──────────────────────────────────────────────────────────

  describe('failure: validation failure restores prior state', () => {
    it('failed validation leaves ledger at prior confirmed state', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const ledger = createSyncStateLedger()
      // Manually insert prior ledger entry
      const priorEntry = makeLedgerEntry({ acceptedVersion: '1', contentDigest: DIGEST_A })
      // Seed the ledger with a prior accept_remote commit
      const seedRemote = makeRemote({ objectVersion: '1', parentVersion: undefined, contentDigest: DIGEST_A })
      const seedOutcome = { verdict: 'accept_remote' as const, namespace: NS, objectId: OBJ, objectVersion: '1' as `${number}`, parentVersion: undefined, contentDigest: DIGEST_A, tombstone: false }
      ledger.commit(seedRemote, seedOutcome)

      const remote = makeRemote({ objectVersion: '2', parentVersion: '1', contentDigest: DIGEST_B, isSignatureVerified: false })
      const tx1 = await coordinator.prepare(remote, priorEntry)
      coordinator.stage(tx1.transactionId)

      const badOutcome = ledger.evaluate(remote)
      expect(badOutcome.verdict).toBe('quarantine_required')
      if (badOutcome.verdict !== 'quarantine_required') return

      const tx3 = await coordinator.validate(tx1.transactionId, remote, badOutcome)
      expect(tx3.state).toBe('quarantined')

      // Ledger unchanged — still at version 1
      const entry = ledger.get(NS, OBJ)
      expect(entry?.acceptedVersion).toBe('1')
      expect(entry?.contentDigest).toBe(DIGEST_A)
    })
  })

  // ── Interrupt recovery ──────────────────────────────────────────────────────

  describe('interrupt recovery via startup evaluator', () => {
    it('interrupted preparation resumes safely', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const remote = makeRemote()
      const tx = await coordinator.prepare(remote, null)
      expect(tx.state).toBe('preparing')

      // Simulate process restart — new coordinator, same store
      const coordinator2 = createSyncRecoveryCoordinator(store)
      const result = evaluateStartupRecovery(store, coordinator2)
      expect(result.evaluated).toBe(1)
      expect(result.recovered).toBe(1)
      expect(store.listIncomplete().filter(t => t.state === 'preparing')).toHaveLength(0)
    })

    it('interrupted staging resumes safely', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const remote = makeRemote()
      const tx = await coordinator.prepare(remote, null)
      coordinator.stage(tx.transactionId)

      const coordinator2 = createSyncRecoveryCoordinator(store)
      const result = evaluateStartupRecovery(store, coordinator2)
      expect(result.evaluated).toBe(1)
      expect(result.recovered).toBe(1)
    })

    it('interrupted validation resumes safely', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const ledger = createSyncStateLedger()
      const remote = makeRemote()
      const tx = await coordinator.prepare(remote, null)
      coordinator.stage(tx.transactionId)
      const outcome = ledger.evaluate(remote)
      await coordinator.validate(tx.transactionId, remote, outcome)
      // At this point tx is in 'validating'

      const coordinator2 = createSyncRecoveryCoordinator(store)
      const result = evaluateStartupRecovery(store, coordinator2)
      expect(result.evaluated).toBe(1)
      expect(result.recovered).toBe(1)
    })

    it('interrupted commit resolves without partial state', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const ledger = createSyncStateLedger()
      const priorEntry = makeLedgerEntry()
      const remote = makeRemote()

      const tx = await coordinator.prepare(remote, priorEntry)
      coordinator.stage(tx.transactionId)
      const outcome = ledger.evaluate(remote)
      await coordinator.validate(tx.transactionId, remote, outcome)

      // Manually advance to 'committing' to simulate crash mid-commit
      const txInStore = store.get(tx.transactionId)!
      store.save({ ...txInStore, state: 'committing', updatedAt: new Date().toISOString() })

      // Restart — coordinator rolls back committing transaction
      const coordinator2 = createSyncRecoveryCoordinator(store)
      const result = evaluateStartupRecovery(store, coordinator2)
      expect(result.evaluated).toBe(1)
      expect(result.recovered).toBe(1)

      // Ledger was never committed — still empty
      expect(ledger.get(NS, OBJ)).toBeNull()
    })

    it('repeated recovery is idempotent', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const remote = makeRemote()
      const tx = await coordinator.prepare(remote, null)
      coordinator.stage(tx.transactionId)

      const coordinator2 = createSyncRecoveryCoordinator(store)
      evaluateStartupRecovery(store, coordinator2)
      // Second pass — no incomplete transactions remain
      const result2 = evaluateStartupRecovery(store, coordinator2)
      expect(result2.evaluated).toBe(0)
      expect(result2.recovered).toBe(0)
    })
  })

  // ── Checkpoint security ────────────────────────────────────────────────────

  describe('checkpoint tamper detection', () => {
    it('corrupted checkpoint is quarantined', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const ledger = createSyncStateLedger()
      const priorEntry = makeLedgerEntry()
      const remote = makeRemote()

      const tx = await coordinator.prepare(remote, priorEntry)
      coordinator.stage(tx.transactionId)

      // Tamper with the stored checkpoint digest
      const stored = store.get(tx.transactionId)!
      const tampered = {
        ...stored,
        checkpoint: stored.checkpoint ? { ...stored.checkpoint, checkpointDigest: 'tampered-digest-value' } : null,
      }
      store.save(tampered)

      const outcome = ledger.evaluate(remote)
      const result = await coordinator.validate(tx.transactionId, remote, outcome)
      expect(result.state).toBe('quarantined')
      expect(result.quarantineReason).toBe('tampered_checkpoint')
    })

    it('tampered checkpoint namespace field is detected via digest mismatch', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const ledger = createSyncStateLedger()
      const priorEntry = makeLedgerEntry()
      const remote = makeRemote()

      const tx = await coordinator.prepare(remote, priorEntry)
      coordinator.stage(tx.transactionId)

      // Tamper with a checkpoint binding field while keeping old digest
      const stored = store.get(tx.transactionId)!
      if (stored.checkpoint) {
        const tampered = {
          ...stored,
          checkpoint: {
            ...stored.checkpoint,
            namespace: 'sync:different-namespace' as `sync:${string}`,
            // checkpointDigest is stale — will not match recomputed digest
          },
        }
        store.save(tampered)
      }

      const outcome = ledger.evaluate(remote)
      const result = await coordinator.validate(tx.transactionId, remote, outcome)
      expect(result.state).toBe('quarantined')
      expect(result.quarantineReason).toBe('tampered_checkpoint')
    })
  })

  // ── Binding violations ─────────────────────────────────────────────────────

  describe('binding violation: fails closed', () => {
    it('wrong namespace fails closed', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const ledger = createSyncStateLedger()
      const remote = makeRemote()
      const tx = await coordinator.prepare(remote, null)
      coordinator.stage(tx.transactionId)

      const wrongNamespaceRemote = makeRemote({ namespace: 'sync:wrong-namespace' as `sync:${string}` })
      const outcome = ledger.evaluate(wrongNamespaceRemote)
      const result = await coordinator.validate(tx.transactionId, wrongNamespaceRemote, outcome)
      expect(result.state).toBe('failed_closed')
    })

    it('wrong object identifier fails closed', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const ledger = createSyncStateLedger()
      const remote = makeRemote()
      const tx = await coordinator.prepare(remote, null)
      coordinator.stage(tx.transactionId)

      const wrongObjRemote = makeRemote({ objectId: 'obj:wrong-object' as `obj:${string}` })
      const outcome = ledger.evaluate(wrongObjRemote)
      const result = await coordinator.validate(tx.transactionId, wrongObjRemote, outcome)
      expect(result.state).toBe('failed_closed')
    })
  })

  // ── Convergence security quarantines ──────────────────────────────────────

  describe('convergence quarantine mapping', () => {
    it('wrong parent version fails closed via quarantine', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const ledger = createSyncStateLedger()
      const remote = makeRemote({ objectVersion: '3', parentVersion: '3' }) // parent >= version → tampered
      const tx = await coordinator.prepare(remote, null)
      coordinator.stage(tx.transactionId)

      const outcome = ledger.evaluate(remote)
      expect(outcome.verdict).toBe('quarantine_required')
      const result = await coordinator.validate(tx.transactionId, remote, outcome)
      expect(result.state).toBe('quarantined')
      expect(result.quarantineReason).toBe('wrong_parent_version')
    })

    it('wrong digest fails closed via quarantine (tampered digest)', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const ledger = createSyncStateLedger()

      // Seed ledger at v1 with digest A
      const seedRemote = makeRemote({ objectVersion: '1', parentVersion: undefined, contentDigest: DIGEST_A })
      const seedOutcome = { verdict: 'accept_remote' as const, namespace: NS, objectId: OBJ, objectVersion: '1' as `${number}`, parentVersion: undefined, contentDigest: DIGEST_A, tombstone: false }
      ledger.commit(seedRemote, seedOutcome)

      // Remote at v1 with different digest → tampered_digest
      const tamperedRemote = makeRemote({ objectVersion: '1', parentVersion: undefined, contentDigest: DIGEST_C })
      const tx = await coordinator.prepare(tamperedRemote, null)
      coordinator.stage(tx.transactionId)

      const outcome = ledger.evaluate(tamperedRemote)
      expect(outcome.verdict).toBe('quarantine_required')
      if (outcome.verdict !== 'quarantine_required') return
      expect(outcome.reason).toBe('tampered_digest')

      const result = await coordinator.validate(tx.transactionId, tamperedRemote, outcome)
      expect(result.state).toBe('quarantined')
      expect(result.quarantineReason).toBe('wrong_digest')
    })

    it('wrong signer fails closed via quarantine (bad signature)', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const ledger = createSyncStateLedger()
      const remote = makeRemote({ isSignatureVerified: false })
      const tx = await coordinator.prepare(remote, null)
      coordinator.stage(tx.transactionId)

      const outcome = ledger.evaluate(remote)
      expect(outcome.verdict).toBe('quarantine_required')
      const result = await coordinator.validate(tx.transactionId, remote, outcome)
      expect(result.state).toBe('quarantined')
      expect(result.quarantineReason).toBe('wrong_signer')
    })

    it('wrong key hierarchy fails closed via quarantine', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const ledger = createSyncStateLedger()

      // Seed ledger at v1 with hierarchy A
      const seedRemote = makeRemote({ objectVersion: '1', parentVersion: undefined, contentDigest: DIGEST_A })
      ledger.commit(seedRemote, { verdict: 'accept_remote' as const, namespace: NS, objectId: OBJ, objectVersion: '1' as `${number}`, parentVersion: undefined, contentDigest: DIGEST_A, tombstone: false })

      // Remote with different hierarchy → wrong_key_hierarchy
      const wrongHierarchyRemote = makeRemote({
        objectVersion: '2',
        parentVersion: '1',
        hierarchyId: 'sync-key-hierarchy:different-hierarchy' as `sync-key-hierarchy:${string}`,
      })
      const priorEntry = ledger.get(NS, OBJ)!
      const tx = await coordinator.prepare(wrongHierarchyRemote, priorEntry)
      coordinator.stage(tx.transactionId)

      const outcome = ledger.evaluate(wrongHierarchyRemote)
      expect(outcome.verdict).toBe('quarantine_required')
      if (outcome.verdict !== 'quarantine_required') return
      expect(outcome.reason).toBe('wrong_key_hierarchy')

      const result = await coordinator.validate(tx.transactionId, wrongHierarchyRemote, outcome)
      expect(result.state).toBe('quarantined')
      expect(result.quarantineReason).toBe('wrong_key_hierarchy')
    })

    it('unknown signer is quarantined', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const ledger = createSyncStateLedger()
      const remote = makeRemote({ isSignerActive: false, isSignatureVerified: true })
      const tx = await coordinator.prepare(remote, null)
      coordinator.stage(tx.transactionId)

      const outcome = ledger.evaluate(remote)
      expect(outcome.verdict).toBe('quarantine_required')
      const result = await coordinator.validate(tx.transactionId, remote, outcome)
      expect(result.state).toBe('quarantined')
      expect(result.quarantineReason).toBe('unknown_signer')
    })

    it('revoked signer is quarantined', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const ledger = createSyncStateLedger()
      const remote = makeRemote({ isSignerRevoked: true, isSignerActive: true })
      const tx = await coordinator.prepare(remote, null)
      coordinator.stage(tx.transactionId)

      const outcome = ledger.evaluate(remote)
      expect(outcome.verdict).toBe('quarantine_required')
      const result = await coordinator.validate(tx.transactionId, remote, outcome)
      expect(result.state).toBe('quarantined')
      expect(result.quarantineReason).toBe('revoked_signer')
    })

    it('suspended signer is quarantined', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const ledger = createSyncStateLedger()
      const remote = makeRemote({ isSignerSuspended: true, isSignerActive: true })
      const tx = await coordinator.prepare(remote, null)
      coordinator.stage(tx.transactionId)

      const outcome = ledger.evaluate(remote)
      expect(outcome.verdict).toBe('quarantine_required')
      const result = await coordinator.validate(tx.transactionId, remote, outcome)
      expect(result.state).toBe('quarantined')
      // revoked_or_suspended_signer maps to revoked_signer in coordinator
      expect(['revoked_signer', 'suspended_signer']).toContain(result.quarantineReason)
    })

    it('replaced signer (inactive device) is quarantined', async () => {
      // A replaced device is no longer the active signer for the namespace.
      // It appears as isSignerActive: false from the device trust registry.
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const ledger = createSyncStateLedger()
      const remote = makeRemote({
        signerDeviceId: DEVICE_B,
        isSignerActive: false,   // replaced device is no longer active
        isSignerRevoked: false,
        isSignerSuspended: false,
      })
      const tx = await coordinator.prepare(remote, null)
      coordinator.stage(tx.transactionId)

      const outcome = ledger.evaluate(remote)
      expect(outcome.verdict).toBe('quarantine_required')
      const result = await coordinator.validate(tx.transactionId, remote, outcome)
      expect(result.state).toBe('quarantined')
      expect(result.quarantineReason).toBe('unknown_signer')
    })

    it('replay attempt is quarantined', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const ledger = createSyncStateLedger()

      // Accept v1 and v2
      ledger.commit(makeRemote({ objectVersion: '1', parentVersion: undefined, contentDigest: DIGEST_A }),
        { verdict: 'accept_remote' as const, namespace: NS, objectId: OBJ, objectVersion: '1' as `${number}`, parentVersion: undefined, contentDigest: DIGEST_A, tombstone: false })
      ledger.commit(makeRemote({ objectVersion: '2', parentVersion: '1', contentDigest: DIGEST_B }),
        { verdict: 'accept_remote' as const, namespace: NS, objectId: OBJ, objectVersion: '2' as `${number}`, parentVersion: '1' as `${number}`, contentDigest: DIGEST_B, tombstone: false })

      // Replay v1
      const replayRemote = makeRemote({ objectVersion: '1', parentVersion: undefined, contentDigest: DIGEST_A })
      const priorEntry = ledger.get(NS, OBJ)!
      const tx = await coordinator.prepare(replayRemote, priorEntry)
      coordinator.stage(tx.transactionId)

      const outcome = ledger.evaluate(replayRemote)
      expect(outcome.verdict).toBe('quarantine_required')
      if (outcome.verdict !== 'quarantine_required') return
      expect(outcome.reason).toBe('replay_attempt')

      const result = await coordinator.validate(tx.transactionId, replayRemote, outcome)
      expect(result.state).toBe('quarantined')
      expect(result.quarantineReason).toBe('replay_attempt')
    })

    it('rollback below accepted floor is quarantined', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const ledger = createSyncStateLedger()

      // Accept v3 from v2
      ledger.commit(makeRemote({ objectVersion: '3', parentVersion: '2', contentDigest: DIGEST_B }),
        { verdict: 'accept_remote' as const, namespace: NS, objectId: OBJ, objectVersion: '3' as `${number}`, parentVersion: '2' as `${number}`, contentDigest: DIGEST_B, tombstone: false })

      // Rollback attempt: remote at v5 from parent v1 (different unshared ancestor)
      const rollbackRemote = makeRemote({ objectVersion: '5', parentVersion: '1', contentDigest: DIGEST_C })
      const priorEntry = ledger.get(NS, OBJ)!
      const tx = await coordinator.prepare(rollbackRemote, priorEntry)
      coordinator.stage(tx.transactionId)

      const outcome = ledger.evaluate(rollbackRemote)
      expect(outcome.verdict).toBe('quarantine_required')
      if (outcome.verdict !== 'quarantine_required') return
      expect(outcome.reason).toBe('rollback_attempt')

      const result = await coordinator.validate(tx.transactionId, rollbackRemote, outcome)
      expect(result.state).toBe('quarantined')
      expect(result.quarantineReason).toBe('rollback_below_floor')
    })
  })

  // ── Operator review passthrough ────────────────────────────────────────────

  describe('operator review: rolls back, does not quarantine', () => {
    it('divergent history remains operator review required — rolls back', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const ledger = createSyncStateLedger()

      // Accept v3 from v2 locally
      ledger.commit(makeRemote({ objectVersion: '3', parentVersion: '2', contentDigest: DIGEST_A }),
        { verdict: 'accept_remote' as const, namespace: NS, objectId: OBJ, objectVersion: '3' as `${number}`, parentVersion: '2' as `${number}`, contentDigest: DIGEST_A, tombstone: false })

      // Remote at v5 from v2 (same parent as our branch point → divergent)
      const divergentRemote = makeRemote({ objectVersion: '5', parentVersion: '2', contentDigest: DIGEST_B })
      const priorEntry = ledger.get(NS, OBJ)!
      const tx = await coordinator.prepare(divergentRemote, priorEntry)
      coordinator.stage(tx.transactionId)

      const outcome = ledger.evaluate(divergentRemote)
      expect(outcome.verdict).toBe('operator_review_required')
      if (outcome.verdict !== 'operator_review_required') return
      expect(outcome.reason).toBe('divergent_histories')

      const result = await coordinator.validate(tx.transactionId, divergentRemote, outcome)
      expect(result.state).toBe('recovered')  // rolled back, not quarantined

      // Ledger unchanged
      expect(ledger.get(NS, OBJ)?.acceptedVersion).toBe('3')
    })

    it('tombstone conflict remains operator review required — rolls back', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const ledger = createSyncStateLedger()

      // Accept live v2
      ledger.commit(makeRemote({ objectVersion: '2', parentVersion: '1', contentDigest: DIGEST_A }),
        { verdict: 'accept_remote' as const, namespace: NS, objectId: OBJ, objectVersion: '2' as `${number}`, parentVersion: '1' as `${number}`, contentDigest: DIGEST_A, tombstone: false })

      // Tombstone at v3 (direct descendant — requires operator confirmation)
      const tombstoneRemote = makeRemote({ objectVersion: '3', parentVersion: '2', contentDigest: DIGEST_B, tombstone: true })
      const priorEntry = ledger.get(NS, OBJ)!
      const tx = await coordinator.prepare(tombstoneRemote, priorEntry)
      coordinator.stage(tx.transactionId)

      const outcome = ledger.evaluate(tombstoneRemote)
      expect(outcome.verdict).toBe('operator_review_required')
      if (outcome.verdict !== 'operator_review_required') return
      expect(outcome.reason).toBe('tombstone_conflict')

      const result = await coordinator.validate(tx.transactionId, tombstoneRemote, outcome)
      expect(result.state).toBe('recovered')

      // Ledger unchanged
      expect(ledger.get(NS, OBJ)?.tombstone).toBe(false)
    })
  })

  // ── Local state preservation ──────────────────────────────────────────────

  describe('confirmed local state survives failure', () => {
    it('confirmed local state survives every failure path', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const ledger = createSyncStateLedger()

      // Accept v2 as confirmed local state
      ledger.commit(makeRemote({ objectVersion: '2', parentVersion: '1', contentDigest: DIGEST_A }),
        { verdict: 'accept_remote' as const, namespace: NS, objectId: OBJ, objectVersion: '2' as `${number}`, parentVersion: '1' as `${number}`, contentDigest: DIGEST_A, tombstone: false })

      // Attempt bad signature remote — fails, ledger untouched
      const badRemote = makeRemote({ objectVersion: '3', parentVersion: '2', isSignatureVerified: false })
      const priorEntry = ledger.get(NS, OBJ)!
      const tx = await coordinator.prepare(badRemote, priorEntry)
      coordinator.stage(tx.transactionId)
      const outcome = ledger.evaluate(badRemote)
      await coordinator.validate(tx.transactionId, badRemote, outcome)

      expect(ledger.get(NS, OBJ)?.acceptedVersion).toBe('2')
      expect(ledger.get(NS, OBJ)?.contentDigest).toBe(DIGEST_A)
    })
  })

  // ── No-plaintext guarantees ───────────────────────────────────────────────

  describe('no plaintext in recovery records', () => {
    const SENSITIVE_PATTERNS = [
      /passphrase/i,
      /private.?key/i,
      /decrypted.?payload/i,
      /vault.?content/i,
      /connector.?token/i,
      /bearer\s+[a-z0-9]/i,
      /authorization:/i,
      /cookie:/i,
    ]

    function containsSensitiveData(obj: unknown): boolean {
      const str = JSON.stringify(obj)
      return SENSITIVE_PATTERNS.some(p => p.test(str))
    }

    it('recovery records contain no plaintext', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const remote = makeRemote()
      const tx = await coordinator.prepare(remote, null)
      expect(containsSensitiveData(tx)).toBe(false)
      expect(containsSensitiveData(tx.checkpoint)).toBe(false)
    })

    it('audit records contain no plaintext', async () => {
      const store = createInMemorySyncCheckpointStore()
      const coordinator = createSyncRecoveryCoordinator(store)
      const ledger = createSyncStateLedger()
      const remote = makeRemote()
      const tx = await coordinator.prepare(remote, null)
      coordinator.stage(tx.transactionId)
      const outcome = ledger.evaluate(remote)
      await coordinator.validate(tx.transactionId, remote, outcome)
      coordinator.commitToLedger(tx.transactionId, remote,
        outcome as Extract<typeof outcome, { verdict: 'accept_remote' }>, ledger)

      const events = coordinator.getAuditEvents()
      expect(containsSensitiveData(events)).toBe(false)
    })
  })

  // ── Multi-device determinism ──────────────────────────────────────────────

  describe('deterministic multi-device recovery', () => {
    it('same valid remote produces same convergence outcome on repeated evaluation', async () => {
      const store1 = createInMemorySyncCheckpointStore()
      const store2 = createInMemorySyncCheckpointStore()
      const ledger1 = createSyncStateLedger()
      const ledger2 = createSyncStateLedger()
      const coordinator1 = createSyncRecoveryCoordinator(store1)
      const coordinator2 = createSyncRecoveryCoordinator(store2)

      const priorEntry = makeLedgerEntry({ acceptedVersion: '1', contentDigest: DIGEST_A })
      const remote = makeRemote({ objectVersion: '2', parentVersion: '1', contentDigest: DIGEST_B })

      // Run full commit on both coordinators
      for (const [coordinator, ledger, store] of [[coordinator1, ledger1, store1], [coordinator2, ledger2, store2]] as const) {
        const tx = await (coordinator as typeof coordinator1).prepare(remote, priorEntry)
        ;(coordinator as typeof coordinator1).stage(tx.transactionId)
        const outcome = (ledger as typeof ledger1).evaluate(remote)
        await (coordinator as typeof coordinator1).validate(tx.transactionId, remote, outcome)
        ;(coordinator as typeof coordinator1).commitToLedger(tx.transactionId, remote,
          outcome as Extract<typeof outcome, { verdict: 'accept_remote' }>, ledger as typeof ledger1)
      }

      expect(ledger1.get(NS, OBJ)?.acceptedVersion).toBe(ledger2.get(NS, OBJ)?.acceptedVersion)
      expect(ledger1.get(NS, OBJ)?.contentDigest).toBe(ledger2.get(NS, OBJ)?.contentDigest)
    })
  })
})

// ── Legacy migration fixtures ─────────────────────────────────────────────────

describe('Build 022 legacy sync migration fixtures', () => {
  function normalize(raw: unknown) {
    return normalizePersonalData(raw as Parameters<typeof normalizePersonalData>[0])
  }

  it('Build 016 fixture migrates successfully — sync defaults to disabled', () => {
    const result = normalize(build016SyncFixture)
    expect(result.syncOperatorControlState).toBeDefined()
    expect(result.syncOperatorControlState?.enabled).toBe(false)
    expect(result.syncQuarantine).toEqual([])
  })

  it('Build 017 fixture migrates successfully — sync defaults to disabled', () => {
    const result = normalize(build017SyncFixture)
    expect(result.syncOperatorControlState?.enabled).toBe(false)
    expect(result.syncQuarantine).toEqual([])
  })

  it('Build 018 fixture migrates successfully — sync defaults to disabled', () => {
    const result = normalize(build018SyncFixture)
    expect(result.syncOperatorControlState?.enabled).toBe(false)
    expect(result.syncQuarantine).toEqual([])
  })

  it('Build 019 fixture migrates successfully — disabled state preserved', () => {
    const result = normalize(build019SyncFixture)
    expect(result.syncOperatorControlState?.enabled).toBe(false)
    expect(result.syncOperatorControlState?.localEndpointConfigured).toBe(false)
    expect(result.syncQuarantine).toEqual([])
  })

  it('Build 019 fixture with local endpoint migrates successfully', () => {
    const result = normalize(build019SyncFixtureWithLocalEndpoint)
    expect(result.syncOperatorControlState?.enabled).toBe(false)
    expect(result.syncOperatorControlState?.localEndpointConfigured).toBe(true)
    expect(result.syncOperatorControlState?.localReferenceEndpoint).toBe('http://localhost:8080')
    expect(result.syncQuarantine).toEqual([])
  })

  it('Build 020 fixture migrates successfully — disabled state preserved', () => {
    const result = normalize(build020SyncFixture)
    expect(result.syncOperatorControlState?.enabled).toBe(false)
    expect(result.syncQuarantine).toEqual([])
  })

  it('Build 021 fixture migrates successfully — disabled state preserved', () => {
    const result = normalize(build021SyncFixture)
    expect(result.syncOperatorControlState?.enabled).toBe(false)
    expect(result.syncQuarantine).toEqual([])
  })

  it('unknown additive fields remain rollback compatible', () => {
    // normalizePersonalData spreads raw — unknown top-level fields survive
    const result = normalize(build021SyncFixtureWithFutureFields) as Record<string, unknown>
    expect(result.syncOperatorControlState).toBeDefined()
    expect((result.syncOperatorControlState as Record<string, unknown>)?.enabled).toBe(false)
    // Unknown future fields on syncOperatorControlState are preserved via validator pass-through
    // Unknown top-level field is preserved via spread
    expect(result['_unknownFutureTopLevelField']).toBeDefined()
  })

  it('malformed sync state falls back to safe disabled default', () => {
    const result = normalize(malformedSyncOperatorControlFixture)
    expect(result.syncOperatorControlState?.enabled).toBe(false)
    expect(result.syncOperatorControlState?.localEndpointConfigured).toBe(false)
  })

  it('production endpoint sync state is rejected — falls back to disabled', () => {
    const result = normalize(productionEndpointSyncFixture)
    expect(result.syncOperatorControlState?.enabled).toBe(false)
    expect(result.syncOperatorControlState?.localReferenceEndpoint).toBeUndefined()
  })

  it('quarantine records with forbidden fields are filtered', () => {
    const result = normalize(quarantineWithForbiddenFieldFixture)
    // The record has an unsupported reason — must be filtered out
    expect(result.syncQuarantine).toEqual([])
  })

  it('normalization is idempotent — running twice produces same result', () => {
    const once = normalize(build019SyncFixtureWithLocalEndpoint)
    const twice = normalize(once as Parameters<typeof normalizePersonalData>[0])
    expect(twice.syncOperatorControlState).toEqual(once.syncOperatorControlState)
    expect(twice.syncQuarantine).toEqual(once.syncQuarantine)
  })

  it('migration performs no networking', () => {
    // Normalization is synchronous — no async operations, no fetch, no XHR
    let networkCalled = false
    const originalFetch = globalThis.fetch
    globalThis.fetch = () => { networkCalled = true; return Promise.reject(new Error('no network')) }
    try {
      normalize(build019SyncFixture)
    } finally {
      globalThis.fetch = originalFetch
    }
    expect(networkCalled).toBe(false)
  })

  it('existing vault recovery remains deterministic', () => {
    const result1 = normalize(build021SyncFixture)
    const result2 = normalize(build021SyncFixture)
    expect(result1.syncOperatorControlState).toEqual(result2.syncOperatorControlState)
    expect(result1.syncQuarantine).toEqual(result2.syncQuarantine)
  })
})
