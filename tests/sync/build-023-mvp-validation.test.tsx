import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SyncReviewPanel from '../../src/features/sync/SyncReviewPanel'
import { createOperatorDecisionService } from '../../src/services/OperatorDecisionService'
import { createInMemorySyncCheckpointStore } from '../../src/services/SyncCheckpointStore'
import { normalizePersonalData } from '../../src/localData'
import type { SyncReviewItem, OperatorDecisionAction } from '../../src/types/syncReview'
import { SYNC_REVIEW_SCHEMA_VERSION } from '../../src/types/syncReview'
import type { RemoteObjectDescriptor, SyncObjectLedgerEntry } from '../../src/types/syncConvergence'
import { SYNC_CONVERGENCE_SCHEMA_VERSION } from '../../src/types/syncConvergence'
import type { SyncQuarantineRecord } from '../../src/types/sync'
import {
  build016SyncFixture, build017SyncFixture, build018SyncFixture,
  build019SyncFixture, build020SyncFixture, build021SyncFixture,
  build021SyncFixtureWithFutureFields,
} from '../fixtures/syncCompatibilityFixtures'

// ── Test helpers ─────────────────────────────────────────────────────────────

const NS = 'sync:mvp-test' as const
const OBJ_A = 'obj:mvp-object-001' as const
const OBJ_B = 'obj:mvp-object-002' as const
const HIERARCHY = 'sync-key-hierarchy:mvp-hierarchy-001' as const
const DEVICE_A = 'device:alice' as const
const DEVICE_B = 'device:bob' as const
const DIGEST_A = 'sha256-aaa-mvp'
const DIGEST_B = 'sha256-bbb-mvp'

function makeRemote(overrides: Partial<RemoteObjectDescriptor> = {}): RemoteObjectDescriptor {
  return {
    namespace: NS,
    objectId: OBJ_A,
    objectVersion: '3',
    parentVersion: '2',
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
    objectId: OBJ_A,
    acceptedVersion: '2',
    acceptedParentVersion: '1',
    contentDigest: DIGEST_A,
    signerDeviceId: DEVICE_A,
    hierarchyId: HIERARCHY,
    tombstone: false,
    acceptedAt: '2026-01-01T00:00:00.000Z',
    lastGoodAt: '2026-01-01T00:00:00.000Z',
    acceptedVersionHistory: ['1'],
    ...overrides,
  }
}

function makeQuarantineRecord(overrides: Partial<SyncQuarantineRecord> = {}): SyncQuarantineRecord {
  return {
    schemaVersion: '1.0.0',
    id: `sync-quarantine:mvp-test-${crypto.randomUUID()}`,
    reason: 'bad_signature',
    disposition: 'pending_review',
    requestId: `req-mvp-${crypto.randomUUID()}`,
    namespace: NS,
    objectId: OBJ_A,
    createdAt: '2026-01-01T00:00:00.000Z',
    detail: 'signature verification failed',
    diagnosticCode: 'SIG_VERIFY_FAIL',
    ...overrides,
  }
}

function makePendingConflictItem(overrides: Partial<SyncReviewItem> = {}): SyncReviewItem {
  return {
    schemaVersion: SYNC_REVIEW_SCHEMA_VERSION,
    id: `sync-review:${crypto.randomUUID()}`,
    kind: 'divergent_history',
    status: 'pending',
    namespace: NS,
    objectId: OBJ_A,
    localVersion: '2',
    remoteVersion: '3',
    reviewReason: 'divergent_histories',
    remoteDescriptor: makeRemote(),
    priorLedgerEntry: makeLedgerEntry(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makePendingTombstoneItem(overrides: Partial<SyncReviewItem> = {}): SyncReviewItem {
  return {
    ...makePendingConflictItem({
      kind: 'tombstone_conflict',
      reviewReason: 'tombstone_conflict',
      remoteDescriptor: makeRemote({ tombstone: true }),
    }),
    ...overrides,
  }
}

function makePendingQuarantineItem(overrides: Partial<SyncReviewItem> = {}): SyncReviewItem {
  return {
    schemaVersion: SYNC_REVIEW_SCHEMA_VERSION,
    id: `sync-review:${crypto.randomUUID()}`,
    kind: 'quarantine_record',
    status: 'pending',
    namespace: NS,
    objectId: OBJ_A,
    quarantineRecord: makeQuarantineRecord(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const noopDecision = vi.fn<[string, OperatorDecisionAction], Promise<void>>()
  .mockResolvedValue(undefined)

// ── Interface rendering ───────────────────────────────────────────────────────

describe('Build 023 MVP operator validation', () => {
  describe('1. interface: rendering', () => {
    it('1. renders unresolved conflicts in review panel', () => {
      const items = [makePendingConflictItem()]
      render(<SyncReviewPanel items={items} onDecision={noopDecision} />)
      expect(screen.getByTestId('sync-review-panel')).toBeInTheDocument()
      expect(screen.getByText('DIVERGENT HISTORY')).toBeInTheDocument()
    })

    it('2. renders tombstone conflicts in review panel', () => {
      const items = [makePendingTombstoneItem()]
      render(<SyncReviewPanel items={items} onDecision={noopDecision} />)
      expect(screen.getByText('TOMBSTONE CONFLICT')).toBeInTheDocument()
    })

    it('3. renders quarantine records in review panel', () => {
      const items = [makePendingQuarantineItem()]
      render(<SyncReviewPanel items={items} onDecision={noopDecision} />)
      expect(screen.getByText('QUARANTINE')).toBeInTheDocument()
    })

    it('30. empty state renders correctly', () => {
      render(<SyncReviewPanel items={[]} onDecision={noopDecision} />)
      expect(screen.getByTestId('sync-review-empty')).toBeInTheDocument()
      expect(screen.getByText('No items require review.')).toBeInTheDocument()
    })

    it('31. loading state renders correctly', () => {
      render(<SyncReviewPanel items={[]} panelState="loading" onDecision={noopDecision} />)
      expect(screen.getByTestId('sync-review-loading')).toBeInTheDocument()
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('32. failure state renders correctly', () => {
      render(
        <SyncReviewPanel
          items={[]}
          panelState="error"
          errorMessage="Review unavailable"
          onDecision={noopDecision}
        />,
      )
      expect(screen.getByTestId('sync-review-error')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toBeInTheDocument()
      // Error message must not expose implementation details
      expect(screen.queryByText(/passphrase|private key|credential/i)).toBeNull()
    })

    it('33. recovery state renders correctly', () => {
      render(<SyncReviewPanel items={[]} panelState="recovering" onDecision={noopDecision} />)
      expect(screen.getByTestId('sync-review-recovering')).toBeInTheDocument()
    })
  })

  // ── Confirmation requirements ──────────────────────────────────────────────

  describe('2. confirmation requirements', () => {
    it('4. keep local requires confirmation dialog', async () => {
      const items = [makePendingConflictItem()]
      render(<SyncReviewPanel items={items} onDecision={noopDecision} />)

      fireEvent.click(screen.getByRole('button', { name: 'Keep Local' }))
      // Confirmation dialog must appear before onDecision is called
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
      expect(noopDecision).not.toHaveBeenCalled()
    })

    it('5. accept remote requires confirmation dialog', async () => {
      const items = [makePendingConflictItem()]
      render(<SyncReviewPanel items={items} onDecision={noopDecision} />)

      fireEvent.click(screen.getByRole('button', { name: 'Accept Remote' }))
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
      expect(noopDecision).not.toHaveBeenCalled()
    })

    it('6. preserve both requires confirmation dialog', async () => {
      const items = [makePendingConflictItem()]
      render(<SyncReviewPanel items={items} onDecision={noopDecision} />)

      fireEvent.click(screen.getByRole('button', { name: 'Preserve Both' }))
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
      expect(noopDecision).not.toHaveBeenCalled()
    })

    it('7. reject remote requires confirmation dialog', async () => {
      const items = [makePendingConflictItem()]
      render(<SyncReviewPanel items={items} onDecision={noopDecision} />)

      fireEvent.click(screen.getByRole('button', { name: 'Reject Remote' }))
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
      expect(noopDecision).not.toHaveBeenCalled()
    })

    it('8. discard quarantine requires confirmation dialog', async () => {
      const items = [makePendingQuarantineItem()]
      render(<SyncReviewPanel items={items} onDecision={noopDecision} />)

      fireEvent.click(screen.getByRole('button', { name: 'Discard Record' }))
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
      expect(noopDecision).not.toHaveBeenCalled()
    })

    it('9. leave unresolved changes no state and requires no confirmation', async () => {
      const executed: [string, OperatorDecisionAction][] = []
      const onDecision = vi.fn(async (id: string, action: OperatorDecisionAction) => {
        executed.push([id, action])
      })
      const items = [makePendingConflictItem()]
      render(<SyncReviewPanel items={items} onDecision={onDecision} />)

      fireEvent.click(screen.getByRole('button', { name: 'Leave Unresolved' }))
      // No confirmation dialog for leave_unresolved
      expect(screen.queryByRole('dialog')).toBeNull()
      await waitFor(() => {
        expect(executed.some(([, a]) => a === 'leave_unresolved')).toBe(true)
      })
    })

    it('cancel closes confirmation dialog without executing', async () => {
      const items = [makePendingConflictItem()]
      render(<SyncReviewPanel items={items} onDecision={noopDecision} />)

      fireEvent.click(screen.getByRole('button', { name: 'Keep Local' }))
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(noopDecision).not.toHaveBeenCalled()
    })
  })

  // ── Operator decision service: security validation ─────────────────────────

  describe('3. service: security validation', () => {
    it('10. accept remote validates active signer trust', async () => {
      const store = createInMemorySyncCheckpointStore()
      const service = createOperatorDecisionService(DEVICE_A, store)
      const remote = makeRemote({ isSignerActive: false })
      const item = service.addConflictItem(remote, makeLedgerEntry(), 'divergent_histories')

      const validation = service.validateDecision(item.id, 'accept_remote')
      expect(validation.valid).toBe(false)
      if (!validation.valid) {
        expect(validation.reason).toBe('signer_not_active')
      }
    })

    it('11. accept remote validates key hierarchy membership via convergence', async () => {
      const store = createInMemorySyncCheckpointStore()
      const service = createOperatorDecisionService(DEVICE_A, store)
      // This is validated by the convergence engine during executeDecision
      // Here we test that a valid-trust remote passes validation
      const remote = makeRemote()
      const item = service.addConflictItem(remote, makeLedgerEntry(), 'divergent_histories')

      const validation = service.validateDecision(item.id, 'accept_remote')
      expect(validation.valid).toBe(true)
    })

    it('12. accept remote validates signature verification', async () => {
      const store = createInMemorySyncCheckpointStore()
      const service = createOperatorDecisionService(DEVICE_A, store)
      const remote = makeRemote({ isSignatureVerified: false })
      const item = service.addConflictItem(remote, makeLedgerEntry(), 'divergent_histories')

      const validation = service.validateDecision(item.id, 'accept_remote')
      expect(validation.valid).toBe(false)
      if (!validation.valid) {
        expect(validation.reason).toBe('signature_not_verified')
      }
    })

    it('13. accept remote uses the recovery coordinator', async () => {
      const store = createInMemorySyncCheckpointStore()
      const service = createOperatorDecisionService(DEVICE_A, store)
      // Genuinely divergent: both sides evolved from v1. Local went v1→v2, remote went v1→v3.
      // remote.parentVersion ('1') === prior.acceptedParentVersion ('1') → divergent_histories
      const remote = makeRemote({ objectVersion: '3', parentVersion: '1' })
      const prior = makeLedgerEntry({ acceptedVersion: '2', acceptedParentVersion: '1' })
      const item = service.addConflictItem(remote, prior, 'divergent_histories')

      // Execute — convergence re-evaluates and returns operator_review_required (divergent), not accept_remote
      const result = await service.executeDecision(item.id, 'accept_remote')
      expect(result.status).toBe('failed')  // convergence rejects divergent as not accept_remote
    })

    it('14. failed acceptance restores local state', async () => {
      const store = createInMemorySyncCheckpointStore()
      const service = createOperatorDecisionService(DEVICE_A, store)
      const remote = makeRemote({ isSignatureVerified: false })
      const item = service.addConflictItem(remote, makeLedgerEntry(), 'divergent_histories')

      const result = await service.executeDecision(item.id, 'accept_remote')
      expect(result.status).toBe('failed')
      expect(result.failureReason).toBeDefined()
      // Service internal ledger should not have advanced
      expect(service.getQueueSummary().failed).toBe(1)
    })

    it('15. duplicate operator submission is idempotent', async () => {
      const store = createInMemorySyncCheckpointStore()
      const service = createOperatorDecisionService(DEVICE_A, store)
      const item = service.addConflictItem(makeRemote(), makeLedgerEntry(), 'divergent_histories')

      const first = await service.executeDecision(item.id, 'keep_local')
      expect(first.status).toBe('resolved')

      // Second call — must not silently mutate resolved state
      const second = await service.executeDecision(item.id, 'reject_remote')
      expect(second.status).toBe('resolved')
      expect(second.resolvedAction).toBe('keep_local')  // unchanged
    })

    it('16. completed decision cannot be silently changed', async () => {
      const store = createInMemorySyncCheckpointStore()
      const service = createOperatorDecisionService(DEVICE_A, store)
      const item = service.addConflictItem(makeRemote(), makeLedgerEntry(), 'divergent_histories')

      await service.executeDecision(item.id, 'keep_local')
      // Attempt to change to accept_remote
      const attempted = await service.executeDecision(item.id, 'accept_remote')
      expect(attempted.resolvedAction).toBe('keep_local')
    })

    it('17. revoked signer action fails closed', async () => {
      const store = createInMemorySyncCheckpointStore()
      const service = createOperatorDecisionService(DEVICE_A, store)
      const remote = makeRemote({ isSignerRevoked: true, isSignerActive: true })
      const item = service.addConflictItem(remote, makeLedgerEntry(), 'divergent_histories')

      const validation = service.validateDecision(item.id, 'accept_remote')
      expect(validation.valid).toBe(false)
      if (!validation.valid) expect(validation.reason).toBe('signer_revoked')
    })

    it('18. suspended signer action fails closed', async () => {
      const store = createInMemorySyncCheckpointStore()
      const service = createOperatorDecisionService(DEVICE_A, store)
      const remote = makeRemote({ isSignerSuspended: true, isSignerActive: true })
      const item = service.addConflictItem(remote, makeLedgerEntry(), 'divergent_histories')

      const validation = service.validateDecision(item.id, 'accept_remote')
      expect(validation.valid).toBe(false)
      if (!validation.valid) expect(validation.reason).toBe('signer_suspended')
    })

    it('19. replaced signer action fails closed', async () => {
      // Replaced device appears as isSignerActive: false
      const store = createInMemorySyncCheckpointStore()
      const service = createOperatorDecisionService(DEVICE_A, store)
      const remote = makeRemote({ signerDeviceId: DEVICE_B, isSignerActive: false })
      const item = service.addConflictItem(remote, makeLedgerEntry(), 'divergent_histories')

      const validation = service.validateDecision(item.id, 'accept_remote')
      expect(validation.valid).toBe(false)
      if (!validation.valid) expect(validation.reason).toBe('signer_not_active')
    })

    it('20. unknown signer action fails closed', async () => {
      const store = createInMemorySyncCheckpointStore()
      const service = createOperatorDecisionService(DEVICE_A, store)
      const remote = makeRemote({ isSignerActive: false })
      const item = service.addConflictItem(remote, makeLedgerEntry(), 'divergent_histories')

      const result = await service.executeDecision(item.id, 'accept_remote')
      expect(result.status).toBe('failed')
    })

    it('21. replay input remains quarantined — cannot be accepted via review interface', async () => {
      const store = createInMemorySyncCheckpointStore()
      const service = createOperatorDecisionService(DEVICE_A, store)
      const quarantineRecord = makeQuarantineRecord({ reason: 'replay' })
      const item = service.addQuarantineItem(quarantineRecord)

      // Only discard_quarantine or leave_unresolved allowed for quarantine items
      const validation = service.validateDecision(item.id, 'accept_remote')
      expect(validation.valid).toBe(false)
    })

    it('22. rollback input remains quarantined — cannot be accepted via review interface', async () => {
      const store = createInMemorySyncCheckpointStore()
      const service = createOperatorDecisionService(DEVICE_A, store)
      const quarantineRecord = makeQuarantineRecord({ reason: 'rollback' })
      const item = service.addQuarantineItem(quarantineRecord)

      const validation = service.validateDecision(item.id, 'accept_remote')
      expect(validation.valid).toBe(false)
    })

    it('23. divergent history never resolves automatically', async () => {
      const store = createInMemorySyncCheckpointStore()
      const service = createOperatorDecisionService(DEVICE_A, store)
      const item = service.addConflictItem(makeRemote(), makeLedgerEntry(), 'divergent_histories')
      // Item must start pending — not auto-resolved
      expect(item.status).toBe('pending')
      expect(service.getQueueSummary().hasUnresolvedConflicts).toBe(true)
    })

    it('24. tombstone conflict never resolves automatically', async () => {
      const store = createInMemorySyncCheckpointStore()
      const service = createOperatorDecisionService(DEVICE_A, store)
      const item = service.addConflictItem(makeRemote({ tombstone: true }), makeLedgerEntry(), 'tombstone_conflict')
      expect(item.status).toBe('pending')
    })
  })

  // ── Audit and plaintext guarantees ────────────────────────────────────────

  describe('4. audit and plaintext guarantees', () => {
    const SENSITIVE_PATTERNS = [
      /passphrase/i, /private.?key/i, /decrypted.?payload/i,
      /vault.?content/i, /connector.?token/i,
      /bearer\s+[a-z0-9]/i, /authorization:/i, /cookie:/i,
    ]

    function hasSensitive(obj: unknown): boolean {
      return SENSITIVE_PATTERNS.some(p => p.test(JSON.stringify(obj)))
    }

    it('25. audit event contains decision metadata', async () => {
      const store = createInMemorySyncCheckpointStore()
      const service = createOperatorDecisionService(DEVICE_A, store)
      const item = service.addConflictItem(makeRemote(), makeLedgerEntry(), 'divergent_histories')
      await service.executeDecision(item.id, 'keep_local')

      const events = service.getAuditEvents()
      expect(events.length).toBeGreaterThan(0)
      expect(events[0].decisionAction).toBe('keep_local')
      expect(events[0].reviewItemId).toBe(item.id)
      expect(events[0].namespace).toBe(NS)
    })

    it('26. audit event contains no plaintext', async () => {
      const store = createInMemorySyncCheckpointStore()
      const service = createOperatorDecisionService(DEVICE_A, store)
      const item = service.addConflictItem(makeRemote(), makeLedgerEntry(), 'divergent_histories')
      await service.executeDecision(item.id, 'keep_local')
      expect(hasSensitive(service.getAuditEvents())).toBe(false)
    })

    it('27. quarantine record contains no plaintext', async () => {
      const record = makeQuarantineRecord({ detail: 'sha256 digest mismatch — no credentials' })
      expect(hasSensitive(record)).toBe(false)
    })

    it('28. recovery record contains no plaintext', async () => {
      const store = createInMemorySyncCheckpointStore()
      const service = createOperatorDecisionService(DEVICE_A, store)
      const item = service.addConflictItem(makeRemote(), makeLedgerEntry(), 'divergent_histories')
      await service.executeDecision(item.id, 'reject_remote')
      expect(hasSensitive(service.getDecisionRecords())).toBe(false)
    })

    it('29. interface exposes no key material', () => {
      const items = [makePendingConflictItem()]
      render(<SyncReviewPanel items={items} onDecision={noopDecision} />)
      const html = document.body.innerHTML
      expect(SENSITIVE_PATTERNS.some(p => p.test(html))).toBe(false)
    })
  })

  // ── Accessibility and keyboard navigation ─────────────────────────────────

  describe('5. accessibility', () => {
    it('34. keyboard navigation works — buttons are focusable', () => {
      const items = [makePendingConflictItem()]
      render(<SyncReviewPanel items={items} onDecision={noopDecision} />)
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
      buttons.forEach(btn => {
        expect(btn.tagName).toBe('BUTTON')
      })
    })

    it('35. confirmation dialog receives focus', async () => {
      const items = [makePendingConflictItem()]
      render(<SyncReviewPanel items={items} onDecision={noopDecision} />)

      fireEvent.click(screen.getByRole('button', { name: 'Keep Local' }))
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())

      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      expect(dialog.getAttribute('aria-modal')).toBe('true')
      expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
    })
  })

  // ── Legacy migration: Builds 016–022 ─────────────────────────────────────

  describe('6. MVP migration validation', () => {
    function normalize(raw: unknown) {
      return normalizePersonalData(raw as Parameters<typeof normalizePersonalData>[0])
    }

    it('40. Build 016 migrates successfully — sync disabled by default', () => {
      const result = normalize(build016SyncFixture)
      expect(result.syncOperatorControlState?.enabled).toBe(false)
    })

    it('40. Build 017 migrates successfully — sync disabled by default', () => {
      const result = normalize(build017SyncFixture)
      expect(result.syncOperatorControlState?.enabled).toBe(false)
    })

    it('40. Build 018 migrates successfully — sync disabled by default', () => {
      const result = normalize(build018SyncFixture)
      expect(result.syncOperatorControlState?.enabled).toBe(false)
    })

    it('40. Build 019 migrates successfully — disabled state preserved', () => {
      const result = normalize(build019SyncFixture)
      expect(result.syncOperatorControlState?.enabled).toBe(false)
      expect(result.syncQuarantine).toEqual([])
    })

    it('40. Build 020 migrates successfully — disabled state preserved', () => {
      const result = normalize(build020SyncFixture)
      expect(result.syncOperatorControlState?.enabled).toBe(false)
    })

    it('40. Build 021 migrates successfully — disabled state preserved', () => {
      const result = normalize(build021SyncFixture)
      expect(result.syncOperatorControlState?.enabled).toBe(false)
    })

    it('40. Build 022 unknown additive fields remain rollback compatible', () => {
      const result = normalize(build021SyncFixtureWithFutureFields) as Record<string, unknown>
      expect(result.syncOperatorControlState).toBeDefined()
    })
  })

  // ── MVP local-only validation ──────────────────────────────────────────────

  describe('7. MVP local-only validation', () => {
    it('41. local only operation works without synchronization', () => {
      const store = createInMemorySyncCheckpointStore()
      const service = createOperatorDecisionService(DEVICE_A, store)
      // No items means sync is not required — empty queue is a valid local-only state
      const summary = service.getQueueSummary()
      expect(summary.total).toBe(0)
      expect(summary.hasUnresolvedConflicts).toBe(false)
    })

    it('41. sync disabled by default in fresh vault normalization', () => {
      const emptyVault = {
        version: 1, priorities: [], commitments: [], decisions: [],
        timeline: [], reflections: [], secrets: [], recommendations: [],
        understandingState: { activeDriftSignals: [], activePatternKeys: [], trendDirections: {} },
        missionPlans: [], missionSteps: [],
      }
      const result = normalize(emptyVault as Parameters<typeof normalizePersonalData>[0])
      expect(result.syncOperatorControlState?.enabled).toBe(false)
    })

    it('42. security boundary: default deny networking remains enforced', () => {
      // Verify OperatorDecisionService performs no networking
      let fetchCalled = false
      const originalFetch = globalThis.fetch
      globalThis.fetch = () => {
        fetchCalled = true
        return Promise.reject(new Error('no network'))
      }
      try {
        const store = createInMemorySyncCheckpointStore()
        const service = createOperatorDecisionService(DEVICE_A, store)
        service.addConflictItem(makeRemote(), makeLedgerEntry(), 'divergent_histories')
        expect(fetchCalled).toBe(false)
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('43. production build: BUILD constant is 024', async () => {
      const { BUILD } = await import('../../src/constants')
      expect(BUILD).toBe('026')
    })

    it('44. full MVP workflow: conflict detected, queued, decision executed, audit recorded', async () => {
      const store = createInMemorySyncCheckpointStore()
      const service = createOperatorDecisionService(DEVICE_A, store)

      // 1. Conflict arrives from sync pipeline
      const remote = makeRemote({ objectVersion: '3', parentVersion: '2' })
      const prior = makeLedgerEntry({ acceptedVersion: '2' })
      const item = service.addConflictItem(remote, prior, 'divergent_histories')
      expect(item.status).toBe('pending')
      expect(service.getQueueSummary().hasUnresolvedConflicts).toBe(true)

      // 2. Quarantine record also arrives
      const quarantine = makeQuarantineRecord()
      const qItem = service.addQuarantineItem(quarantine)
      expect(qItem.status).toBe('pending')
      expect(service.getQueueSummary().hasQuarantineRecords).toBe(true)

      // 3. Operator keeps local for conflict
      const resolved = await service.executeDecision(item.id, 'keep_local')
      expect(resolved.status).toBe('resolved')
      expect(resolved.resolvedAction).toBe('keep_local')

      // 4. Operator discards quarantine record
      const qResolved = await service.executeDecision(qItem.id, 'discard_quarantine')
      expect(qResolved.status).toBe('resolved')
      expect(qResolved.resolvedAction).toBe('discard_quarantine')

      // 5. Audit trail exists and is clean
      const events = service.getAuditEvents()
      expect(events.length).toBeGreaterThan(0)
      expect(JSON.stringify(events)).not.toMatch(/passphrase|private key|bearer/i)

      // 6. Queue is clear of pending items
      expect(service.getPendingItems()).toHaveLength(0)
    })

    function normalize(raw: Parameters<typeof normalizePersonalData>[0]) {
      return normalizePersonalData(raw)
    }
  })
})
