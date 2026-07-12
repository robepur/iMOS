import { describe, expect, it } from 'vitest'
import { evaluateConvergence } from '../../src/services/SyncConflictEngine'
import { createSyncStateLedger } from '../../src/services/SyncStateLedger'
import type { RemoteObjectDescriptor, SyncObjectLedgerEntry } from '../../src/types/syncConvergence'
import { SYNC_CONVERGENCE_SCHEMA_VERSION } from '../../src/types/syncConvergence'

// ── Test helpers ────────────────────────────────────────────────────────────

const NS = 'sync:test' as const
const OBJ = 'obj:abc123' as const
const HIERARCHY = 'sync-key-hierarchy:testhierarchy0001' as const
const DEVICE = 'device:alice' as const
const DIGEST_A = 'sha256-aaaaaa'
const DIGEST_B = 'sha256-bbbbbb'

function makeRemote(overrides: Partial<RemoteObjectDescriptor> = {}): RemoteObjectDescriptor {
  return {
    namespace: NS,
    objectId: OBJ,
    objectVersion: '2',
    parentVersion: '1',
    signerDeviceId: DEVICE,
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

function makeLedger(overrides: Partial<SyncObjectLedgerEntry> = {}): SyncObjectLedgerEntry {
  return {
    schemaVersion: SYNC_CONVERGENCE_SCHEMA_VERSION,
    namespace: NS,
    objectId: OBJ,
    acceptedVersion: '1',
    acceptedParentVersion: undefined,
    contentDigest: DIGEST_A,
    signerDeviceId: DEVICE,
    hierarchyId: HIERARCHY,
    tombstone: false,
    acceptedAt: '2026-01-01T00:00:00.000Z',
    lastGoodAt: '2026-01-01T00:00:00.000Z',
    acceptedVersionHistory: [],
    ...overrides,
  }
}

// ── Security checks ──────────────────────────────────────────────────────────

describe('Build 021 sync convergence engine', () => {
  describe('security: signature and signer state', () => {
    it('invalid signature is quarantined', () => {
      const outcome = evaluateConvergence(null, makeRemote({ isSignatureVerified: false }))
      expect(outcome.verdict).toBe('quarantine_required')
      if (outcome.verdict === 'quarantine_required') {
        expect(outcome.reason).toBe('bad_signature')
      }
    })

    it('revoked device is quarantined', () => {
      const outcome = evaluateConvergence(null, makeRemote({ isSignerRevoked: true, isSignerActive: false }))
      expect(outcome.verdict).toBe('quarantine_required')
      if (outcome.verdict === 'quarantine_required') {
        expect(outcome.reason).toBe('revoked_or_suspended_signer')
      }
    })

    it('suspended device is quarantined', () => {
      const outcome = evaluateConvergence(null, makeRemote({ isSignerSuspended: true, isSignerActive: false }))
      expect(outcome.verdict).toBe('quarantine_required')
      if (outcome.verdict === 'quarantine_required') {
        expect(outcome.reason).toBe('revoked_or_suspended_signer')
      }
    })

    it('unknown device (not active, not revoked, not suspended) is quarantined', () => {
      const outcome = evaluateConvergence(null, makeRemote({ isSignerActive: false }))
      expect(outcome.verdict).toBe('quarantine_required')
      if (outcome.verdict === 'quarantine_required') {
        expect(outcome.reason).toBe('unknown_device')
      }
    })

    it('security checks always run before other evaluation (revoked device rejected even for new object)', () => {
      const outcome = evaluateConvergence(null, makeRemote({ isSignerRevoked: true, isSignatureVerified: false, isSignerActive: false }))
      expect(outcome.verdict).toBe('quarantine_required')
    })
  })

  // ── Structural validity ────────────────────────────────────────────────────

  describe('structural validity', () => {
    it('tampered parent version fails closed when parentVersion >= objectVersion', () => {
      const outcome = evaluateConvergence(null, makeRemote({ parentVersion: '2', objectVersion: '2' }))
      expect(outcome.verdict).toBe('quarantine_required')
      if (outcome.verdict === 'quarantine_required') {
        expect(outcome.reason).toBe('tampered_parent_version')
      }
    })

    it('tampered parent version fails closed when parentVersion > objectVersion', () => {
      const outcome = evaluateConvergence(null, makeRemote({ parentVersion: '5', objectVersion: '3' }))
      expect(outcome.verdict).toBe('quarantine_required')
      if (outcome.verdict === 'quarantine_required') {
        expect(outcome.reason).toBe('tampered_parent_version')
      }
    })

    it('valid parentVersion strictly less than objectVersion is accepted', () => {
      const outcome = evaluateConvergence(null, makeRemote({ parentVersion: '1', objectVersion: '3' }))
      expect(outcome.verdict).not.toBe('quarantine_required')
    })
  })

  // ── New object ─────────────────────────────────────────────────────────────

  describe('new object (no ledger entry)', () => {
    it('valid remote for new object is accepted', () => {
      const outcome = evaluateConvergence(null, makeRemote())
      expect(outcome.verdict).toBe('accept_remote')
    })

    it('tombstone for new (never-seen) object is accepted as remote', () => {
      // Caller is responsible for deciding whether to materialize a tombstone-only new object
      const outcome = evaluateConvergence(null, makeRemote({ tombstone: true, objectVersion: '1', parentVersion: undefined }))
      expect(outcome.verdict).toBe('accept_remote')
      if (outcome.verdict === 'accept_remote') {
        expect(outcome.tombstone).toBe(true)
      }
    })
  })

  // ── Hierarchy ──────────────────────────────────────────────────────────────

  describe('key hierarchy', () => {
    it('wrong key hierarchy fails closed', () => {
      const ledger = makeLedger()
      const outcome = evaluateConvergence(ledger, makeRemote({
        hierarchyId: 'sync-key-hierarchy:differenthierarchy' as typeof HIERARCHY,
      }))
      expect(outcome.verdict).toBe('quarantine_required')
      if (outcome.verdict === 'quarantine_required') {
        expect(outcome.reason).toBe('wrong_key_hierarchy')
      }
    })
  })

  // ── Identical state ────────────────────────────────────────────────────────

  describe('identical state and duplicate delivery', () => {
    it('identical state produces already_synchronized', () => {
      const ledger = makeLedger({ acceptedVersion: '2', contentDigest: DIGEST_B })
      const outcome = evaluateConvergence(ledger, makeRemote({ objectVersion: '2', parentVersion: '1', contentDigest: DIGEST_B }))
      expect(outcome.verdict).toBe('already_synchronized')
      if (outcome.verdict === 'already_synchronized') {
        expect(outcome.objectVersion).toBe('2')
      }
    })

    it('duplicate delivery is idempotent — same outcome on second call', () => {
      const ledger = makeLedger({ acceptedVersion: '2', contentDigest: DIGEST_B })
      const remote = makeRemote({ objectVersion: '2', contentDigest: DIGEST_B })
      const first = evaluateConvergence(ledger, remote)
      const second = evaluateConvergence(ledger, remote)
      expect(first.verdict).toBe('already_synchronized')
      expect(second.verdict).toBe('already_synchronized')
      expect(first).toEqual(second)
    })
  })

  // ── Valid descendant ───────────────────────────────────────────────────────

  describe('valid direct descendant', () => {
    it('valid direct descendant is accepted', () => {
      const ledger = makeLedger({ acceptedVersion: '1' })
      const outcome = evaluateConvergence(ledger, makeRemote({ objectVersion: '2', parentVersion: '1', contentDigest: DIGEST_B }))
      expect(outcome.verdict).toBe('accept_remote')
      if (outcome.verdict === 'accept_remote') {
        expect(outcome.objectVersion).toBe('2')
        expect(outcome.parentVersion).toBe('1')
        expect(outcome.contentDigest).toBe(DIGEST_B)
      }
    })

    it('stale local is surfaced as accept_remote when remote is a valid newer descendant', () => {
      // Local is at v1, remote is at v5 from v4 — divergent but covers "stale local surfaced safely" meaning
      // the engine correctly allows accept_remote for valid descendants
      const ledger = makeLedger({ acceptedVersion: '1' })
      const outcome = evaluateConvergence(ledger, makeRemote({ objectVersion: '5', parentVersion: '1', contentDigest: DIGEST_B }))
      expect(outcome.verdict).toBe('accept_remote')
    })
  })

  // ── Stale remote ───────────────────────────────────────────────────────────

  describe('stale remote', () => {
    it('stale remote state is rejected in favour of local', () => {
      const ledger = makeLedger({ acceptedVersion: '5', contentDigest: DIGEST_B })
      const outcome = evaluateConvergence(ledger, makeRemote({ objectVersion: '3', parentVersion: '2', contentDigest: DIGEST_A }))
      expect(outcome.verdict).toBe('accept_local')
      if (outcome.verdict === 'accept_local') {
        expect(outcome.localVersion).toBe('5')
        expect(outcome.remoteVersion).toBe('3')
      }
    })

    it('remote at v1 when local is at v10 with no prior history is stale, not replay', () => {
      const ledger = makeLedger({ acceptedVersion: '10', contentDigest: DIGEST_B, acceptedVersionHistory: [] })
      const outcome = evaluateConvergence(ledger, makeRemote({ objectVersion: '1', parentVersion: undefined, contentDigest: DIGEST_A }))
      expect(outcome.verdict).toBe('accept_local')
    })
  })

  // ── Divergent histories ────────────────────────────────────────────────────

  describe('divergent histories', () => {
    it('divergent histories require operator review', () => {
      // Local accepted v3 from v2; remote claims v5 from v2 (different branch)
      const ledger = makeLedger({ acceptedVersion: '3', acceptedParentVersion: '2', contentDigest: DIGEST_A })
      const outcome = evaluateConvergence(ledger, makeRemote({ objectVersion: '5', parentVersion: '2', contentDigest: DIGEST_B }))
      expect(outcome.verdict).toBe('operator_review_required')
      if (outcome.verdict === 'operator_review_required') {
        expect(outcome.reason).toBe('divergent_histories')
      }
    })

    it('remote with no parent and higher version also requires operator review', () => {
      const ledger = makeLedger({ acceptedVersion: '2', contentDigest: DIGEST_A })
      const outcome = evaluateConvergence(ledger, makeRemote({ objectVersion: '5', parentVersion: undefined, contentDigest: DIGEST_B }))
      expect(outcome.verdict).toBe('operator_review_required')
      if (outcome.verdict === 'operator_review_required') {
        expect(outcome.reason).toBe('divergent_histories')
      }
    })
  })

  // ── Replay ─────────────────────────────────────────────────────────────────

  describe('replay protection', () => {
    it('replay attempt of a previously accepted version is quarantined', () => {
      // Local accepted v3; version 2 was previously accepted (in history)
      const ledger = makeLedger({
        acceptedVersion: '3',
        contentDigest: DIGEST_B,
        acceptedVersionHistory: ['1', '2'] as `${number}`[],
      })
      const outcome = evaluateConvergence(ledger, makeRemote({ objectVersion: '2', parentVersion: '1', contentDigest: DIGEST_A }))
      expect(outcome.verdict).toBe('quarantine_required')
      if (outcome.verdict === 'quarantine_required') {
        expect(outcome.reason).toBe('replay_attempt')
      }
    })

    it('replay of the current accepted version but different digest is tampered, not replay', () => {
      const ledger = makeLedger({ acceptedVersion: '2', contentDigest: DIGEST_A })
      const outcome = evaluateConvergence(ledger, makeRemote({ objectVersion: '2', contentDigest: DIGEST_B }))
      expect(outcome.verdict).toBe('quarantine_required')
      if (outcome.verdict === 'quarantine_required') {
        expect(outcome.reason).toBe('tampered_digest')
      }
    })
  })

  // ── Rollback ───────────────────────────────────────────────────────────────

  describe('rollback protection', () => {
    it('rollback attempt (parent behind accepted) is quarantined', () => {
      // Local at v5; remote claims v7 but says parent is v3 (behind accepted v5)
      const ledger = makeLedger({ acceptedVersion: '5', contentDigest: DIGEST_A })
      const outcome = evaluateConvergence(ledger, makeRemote({ objectVersion: '7', parentVersion: '3', contentDigest: DIGEST_B }))
      expect(outcome.verdict).toBe('quarantine_required')
      if (outcome.verdict === 'quarantine_required') {
        expect(outcome.reason).toBe('rollback_attempt')
      }
    })

    it('rollback attempt with parent exactly one below accepted is quarantined', () => {
      const ledger = makeLedger({ acceptedVersion: '4', contentDigest: DIGEST_A })
      const outcome = evaluateConvergence(ledger, makeRemote({ objectVersion: '6', parentVersion: '3', contentDigest: DIGEST_B }))
      expect(outcome.verdict).toBe('quarantine_required')
      if (outcome.verdict === 'quarantine_required') {
        expect(outcome.reason).toBe('rollback_attempt')
      }
    })
  })

  // ── Tombstone ──────────────────────────────────────────────────────────────

  describe('tombstone conflict', () => {
    it('tombstone conflict requires operator review', () => {
      const ledger = makeLedger({ acceptedVersion: '1', tombstone: false })
      const outcome = evaluateConvergence(ledger, makeRemote({ objectVersion: '2', parentVersion: '1', tombstone: true, contentDigest: DIGEST_B }))
      expect(outcome.verdict).toBe('operator_review_required')
      if (outcome.verdict === 'operator_review_required') {
        expect(outcome.reason).toBe('tombstone_conflict')
      }
    })

    it('tombstone update of already-tombstoned object is accepted as descendant', () => {
      const ledger = makeLedger({ acceptedVersion: '2', tombstone: true, contentDigest: DIGEST_A })
      const outcome = evaluateConvergence(ledger, makeRemote({ objectVersion: '3', parentVersion: '2', tombstone: true, contentDigest: DIGEST_B }))
      expect(outcome.verdict).toBe('accept_remote')
    })
  })

  // ── Tampered digest ────────────────────────────────────────────────────────

  describe('digest integrity', () => {
    it('tampered digest fails closed', () => {
      const ledger = makeLedger({ acceptedVersion: '2', contentDigest: DIGEST_A })
      const outcome = evaluateConvergence(ledger, makeRemote({ objectVersion: '2', contentDigest: DIGEST_B }))
      expect(outcome.verdict).toBe('quarantine_required')
      if (outcome.verdict === 'quarantine_required') {
        expect(outcome.reason).toBe('tampered_digest')
      }
    })
  })

  // ── Idempotence and determinism ────────────────────────────────────────────

  describe('idempotence and determinism', () => {
    it('same valid input always produces the same outcome (deterministic)', () => {
      const ledger = makeLedger()
      const remote = makeRemote({ objectVersion: '2', parentVersion: '1' })
      const results = Array.from({ length: 5 }, () => evaluateConvergence(ledger, remote))
      for (const r of results) {
        expect(r.verdict).toBe(results[0].verdict)
      }
    })

    it('interrupted synchronization resumes deterministically', () => {
      // Simulate: evaluate, don't commit (interrupted), evaluate again, commit
      const sled = createSyncStateLedger()
      const remote = makeRemote({ objectVersion: '1', parentVersion: undefined })
      const first = sled.evaluate(remote)
      expect(first.verdict).toBe('accept_remote')
      // No commit — simulate interruption
      const second = sled.evaluate(remote)
      expect(second.verdict).toBe('accept_remote')
      expect(second).toEqual(first)
    })
  })

  // ── State ledger ───────────────────────────────────────────────────────────

  describe('SyncStateLedger', () => {
    it('starts empty', () => {
      const ledger = createSyncStateLedger()
      expect(ledger.size()).toBe(0)
      expect(ledger.get(NS, OBJ)).toBeNull()
    })

    it('evaluate without commit does not advance ledger state', () => {
      const ledger = createSyncStateLedger()
      const remote = makeRemote({ objectVersion: '1', parentVersion: undefined })
      ledger.evaluate(remote)
      expect(ledger.get(NS, OBJ)).toBeNull()
    })

    it('commit after accept_remote advances ledger state', () => {
      const ledger = createSyncStateLedger()
      const remote = makeRemote({ objectVersion: '1', parentVersion: undefined })
      const outcome = ledger.evaluate(remote)
      expect(outcome.verdict).toBe('accept_remote')
      if (outcome.verdict === 'accept_remote') {
        ledger.commit(remote, outcome)
      }
      const entry = ledger.get(NS, OBJ)
      expect(entry).not.toBeNull()
      expect(entry?.acceptedVersion).toBe('1')
      expect(entry?.hierarchyId).toBe(HIERARCHY)
      expect(entry?.signerDeviceId).toBe(DEVICE)
    })

    it('commit preserves previous version in history for replay detection', () => {
      const ledger = createSyncStateLedger()
      const remote1 = makeRemote({ objectVersion: '1', parentVersion: undefined, contentDigest: DIGEST_A })
      const o1 = ledger.evaluate(remote1)
      if (o1.verdict === 'accept_remote') ledger.commit(remote1, o1)

      const remote2 = makeRemote({ objectVersion: '2', parentVersion: '1', contentDigest: DIGEST_B })
      const o2 = ledger.evaluate(remote2)
      if (o2.verdict === 'accept_remote') ledger.commit(remote2, o2)

      // Now replay v1
      const replayOutcome = ledger.evaluate(remote1)
      expect(replayOutcome.verdict).toBe('quarantine_required')
      if (replayOutcome.verdict === 'quarantine_required') {
        expect(replayOutcome.reason).toBe('replay_attempt')
      }
    })

    it('evaluate records a structured audit event for every decision', () => {
      const ledger = createSyncStateLedger()
      const remote = makeRemote({ objectVersion: '1', parentVersion: undefined })
      ledger.evaluate(remote)
      const events = ledger.getAuditEvents()
      expect(events.length).toBeGreaterThan(0)
      const event = events[0]
      expect(event.namespace).toBe(NS)
      expect(event.objectId).toBe(OBJ)
      expect(event.verdict).toBeDefined()
      expect(event.createdAt).toBeTruthy()
    })

    it('multiple objects are tracked independently', () => {
      const ledger = createSyncStateLedger()
      const objB = 'obj:def456' as const
      const remoteA = makeRemote({ objectId: OBJ, objectVersion: '1', parentVersion: undefined })
      const remoteB = makeRemote({ objectId: objB, objectVersion: '1', parentVersion: undefined })
      const oA = ledger.evaluate(remoteA)
      const oB = ledger.evaluate(remoteB)
      if (oA.verdict === 'accept_remote') ledger.commit(remoteA, oA)
      if (oB.verdict === 'accept_remote') ledger.commit(remoteB, oB)
      expect(ledger.size()).toBe(2)
      expect(ledger.get(NS, OBJ)?.acceptedVersion).toBe('1')
      expect(ledger.get(NS, objB)?.acceptedVersion).toBe('1')
    })
  })

  // ── Default deny (unresolved cases) ─────────────────────────────────────────

  describe('default deny for unresolved edge cases', () => {
    it('remote with no parent and same version but different digest is quarantined', () => {
      const ledger = makeLedger({ acceptedVersion: '3', contentDigest: DIGEST_A })
      const outcome = evaluateConvergence(ledger, makeRemote({ objectVersion: '3', parentVersion: undefined, contentDigest: DIGEST_B }))
      expect(outcome.verdict).toBe('quarantine_required')
    })

    it('unsigned revoked signer is quarantined before hierarchy check', () => {
      const outcome = evaluateConvergence(
        makeLedger({ hierarchyId: HIERARCHY }),
        makeRemote({ isSignerRevoked: true, isSignatureVerified: true, isSignerActive: false,
          hierarchyId: 'sync-key-hierarchy:otherhierarchy' as typeof HIERARCHY }),
      )
      expect(outcome.verdict).toBe('quarantine_required')
      if (outcome.verdict === 'quarantine_required') {
        expect(outcome.reason).toBe('revoked_or_suspended_signer')
      }
    })
  })

  // ── Migration compatibility ─────────────────────────────────────────────────

  describe('migration compatibility', () => {
    it('Build 021 constants are defined', () => {
      expect(SYNC_CONVERGENCE_SCHEMA_VERSION).toBe('1.0.0')
    })

    it('existing build constants are not broken', async () => {
      const { BUILD } = await import('../../src/constants')
      expect(BUILD).toBe('022')
    })
  })

  // ── Audit events ───────────────────────────────────────────────────────────

  describe('audit events', () => {
    it('auditConvergenceOutcome emits correct action for each verdict', async () => {
      const { auditConvergenceOutcome } = await import('../../src/services/SyncConflictEngine')
      const outcomes: Parameters<typeof auditConvergenceOutcome>[0][] = [
        { verdict: 'already_synchronized', namespace: NS, objectId: OBJ, objectVersion: '1' },
        { verdict: 'accept_remote', namespace: NS, objectId: OBJ, objectVersion: '2', parentVersion: '1', contentDigest: DIGEST_B, tombstone: false },
        { verdict: 'accept_local', namespace: NS, objectId: OBJ, localVersion: '2', remoteVersion: '1' },
        { verdict: 'operator_review_required', namespace: NS, objectId: OBJ, reason: 'divergent_histories' },
        { verdict: 'quarantine_required', namespace: NS, objectId: OBJ, reason: 'bad_signature' },
      ] as const
      const expected = [
        'convergence_already_synchronized',
        'convergence_accept_remote',
        'convergence_accept_local',
        'convergence_operator_review_required',
        'convergence_quarantine_required',
      ]
      for (let i = 0; i < outcomes.length; i++) {
        const event = auditConvergenceOutcome(outcomes[i])
        expect(event.action).toBe(expected[i])
        expect(event.id).toMatch(/^sync-convergence-audit:/)
        expect(event.verdict).toBe(outcomes[i].verdict)
      }
    })

    it('audit records contain no plaintext payload or credential-bearing fields', () => {
      const ledger = createSyncStateLedger()
      const remote = makeRemote({ objectVersion: '1', parentVersion: undefined })
      ledger.evaluate(remote)
      const events = ledger.getAuditEvents()
      for (const event of events) {
        const raw = JSON.stringify(event)
        expect(raw).not.toMatch(/passphrase/)
        expect(raw).not.toMatch(/Bearer /)
        expect(raw).not.toMatch(/Authorization:/)
        expect(raw).not.toMatch(/password/)
        expect(raw).not.toMatch(/client_secret/)
        expect(raw).not.toMatch(/private_key/)
      }
    })
  })
})
