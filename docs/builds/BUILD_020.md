# BUILD 020 — Multi-Device Conflict Resolution and Recovery Operations

## Purpose

Build 020 introduces deterministic, per-type conflict resolution for multi-device synchronization. When two devices produce conflicting versions of a synchronized record, Build 020 classifies the conflict by namespace policy and either resolves it automatically or queues it for explicit operator review.

## Scope implemented

1. Conflict resolution type contracts (`src/types/sync.ts`)
2. `SyncConflictResolver` service with namespace policy table (`src/services/SyncConflictResolver.ts`)
3. Additive persistence defaults for operator conflict review queue (`src/localData.ts`)
4. Test suite covering all policy branches, lifecycle, audit, migration, and secret exclusion (`tests/sync/build-020-conflict-resolution.test.ts`)

## Conflict resolution policies

Policies are assigned by namespace prefix:

| Namespace prefix | Policy | Rationale |
|---|---|---|
| `sync:audit` | `auto_merge_append` | Append-only audit streams; safe to retain both copies |
| `sync:quarantine` | `auto_merge_append` | Append-only quarantine records; safe to retain both copies |
| `sync:priority` | `operator_review` | Critical operator record; must be explicitly resolved |
| `sync:commitment` | `operator_review` | Critical operator record; must be explicitly resolved |
| `sync:decision` | `operator_review` | Critical operator record; must be explicitly resolved |
| `sync:mission` | `operator_review` | Critical mission record; must be explicitly resolved |
| `sync:consent` | `operator_review` | Authority record; must be explicitly resolved |
| `sync:cognitive` | `operator_review` | Cognitive contract record; must be explicitly resolved |
| `sync:identity` | `operator_review` | Device/operator identity record; must be explicitly resolved |
| `sync:operator` | `operator_review` | Operator control state; must be explicitly resolved |
| `sync:recovery` | `operator_review` | Recovery material record; must be explicitly resolved |
| `sync:reflection` | `operator_review` | Personal reflection record; must be explicitly resolved |
| `sync:understanding` | `operator_review` | Understanding contract record; must be explicitly resolved |
| _unknown_ | `deny` | Fail closed; no resolution attempted |

### Tombstone escalation rule

Tombstone conflicts (`reason: 'tombstone_conflict'`) are always escalated to `operator_review` regardless of the namespace policy. A deletion decision must never be silently accepted or merged without operator confirmation.

## Conflict resolution lifecycle

```
resolve(conflict, localVersion)
   │
   ├─ deny namespace     → ConflictResolutionResult { kind: 'denied' }
   ├─ auto_merge_append  → ConflictResolutionResult { kind: 'auto_resolved' }
   │                       (unless tombstone_conflict: escalates to operator_review)
   └─ operator_review    → SyncConflictPendingRecord queued
                           ConflictResolutionResult { kind: 'queued_for_review' }
                           │
                           ├─ acceptLocal(id)   → resolution: 'accepted_local'
                           ├─ acceptRemote(id)  → resolution: 'accepted_remote'
                           └─ discard(id)       → resolution: 'discarded'
```

Resolution is final for a given record. Attempts to re-resolve an already-resolved record return false.

## Persistence changes

Build 020 adds one additive field to `PersonalData`:

```typescript
/** Phase 4 Build 020: conflict records pending operator review. */
syncPendingConflicts?: SyncConflictPendingRecord[]
```

Defaults to `[]`. Existing vaults load without operator action. Malformed or security-violating records are discarded during normalization (fail closed). The field is bounded to 200 records.

## Validation rules for `SyncConflictPendingRecord`

- `schemaVersion` must equal `SYNC_CONFLICT_PENDING_SCHEMA_VERSION` (`'1.0.0'`)
- `id` must start with `sync-conflict:` and have length ≤ 128
- `namespace` must match `sync:[a-z0-9][a-z0-9:_-]{0,127}`
- `objectId` must match `obj:[a-z0-9][a-z0-9:_-]{0,127}`
- `conflictReason` must be one of `'parent_version_mismatch'`, `'stale_version'`, `'tombstone_conflict'`
- `localObjectVersion` must be a numeric string (`^\d+$`)
- `remoteObjectVersion` if present must be a numeric string
- `resolvedAt` if present must be an ISO timestamp
- `resolution` if present must be one of `'accepted_local'`, `'accepted_remote'`, `'discarded'`
- `resolvedAt` and `resolution` must be present together or absent together
- Records with forbidden security fields are discarded

## Security model

- Conflict records store only namespace, objectId, conflict reason, and version numbers — no encrypted payloads, passphrases, or private key material.
- The `hasForbiddenSecurityField` check enforced during normalization prevents secret values from entering persisted conflict records.
- The resolver service produces no network activity.
- All resolution decisions are logged to an in-memory audit trail.
- Unrecognized namespaces are denied (fail closed). New record classes must be explicitly added to the policy table before they can be synced.

## Audit trail

Every resolver action generates a `SyncConflictAuditEvent`:

| Action | Trigger |
|---|---|
| `conflict_queued_for_review` | Conflict routed to operator review |
| `conflict_auto_resolved` | Conflict auto-resolved by append policy |
| `conflict_denied` | Conflict denied by unknown namespace |
| `conflict_accepted_local` | Operator accepted local version |
| `conflict_accepted_remote` | Operator accepted remote version |
| `conflict_discarded` | Operator discarded conflict record |

The in-memory audit trail is bounded to 500 entries.

## Key recovery policy gate

Per the Phase 4 decision register (Build 020 gate), the key recovery policy depth was deferred. The decision outcome for Build 020 is:

**Recovery policy: operator-only recovery using the existing encrypted backup and restore infrastructure from Build 004.**

Rationale:
- Escrow-assisted and split-trust recovery introduce hosted infrastructure dependencies not yet available.
- The existing backup/restore path (Build 004) provides a tested, operator-controlled recovery path independent of cloud availability.
- Recovery depth will be re-evaluated at the Build 026 consolidation gate when cloud infrastructure is available.

This decision unblocks Build 021 without introducing new recovery infrastructure.

## Build 020 boundaries

- No production sync endpoint is configured.
- No hosted synchronization is activated.
- No automatic vault mutation from conflict resolution (acceptRemote is a metadata decision only; vault content update is a caller responsibility).
- No UI for conflict review is implemented in Build 020.
- No cross-device replay or tombstone propagation is implemented.

## Migration and rollback

- Persistence changes are additive only (`syncPendingConflicts`).
- Default is an empty array; existing vaults load without operator action.
- Rollback is data-compatible; unknown additive fields are ignorable.
- No existing field is modified, removed, or reordered.

## Limitations

- Conflict review UI is deferred to a future UI build.
- `acceptRemote` records the operator decision but does not automatically re-fetch or apply the remote version — the caller is responsible for applying it using the existing `SyncService`.
- Cross-device conflict propagation requires hosted sync (future builds).
- Maximum 200 conflict records are retained; oldest are evicted when the limit is reached.

## Test coverage

`tests/sync/build-020-conflict-resolution.test.ts` covers:

- auto_merge_append policy for all append-only namespaces
- operator_review policy for all critical namespaces
- deny behavior for unknown namespaces
- tombstone escalation from auto_merge_append to operator_review
- full resolution lifecycle (acceptLocal, acceptRemote, discard)
- double-resolution rejection (idempotent guard)
- unknown record id rejection
- audit event generation for every action
- audit event immutability (copy safety)
- initial pending record loading from persistence
- resolving pre-loaded records
- secret exclusion in conflict records and audit events
- migration: createInitialData includes empty syncPendingConflicts
- migration: normalizePersonalData preserves valid pending records
- migration: normalizePersonalData preserves resolved records
- migration: normalizePersonalData discards malformed records
- migration: normalizePersonalData defaults to empty when field is absent
- migration: normalizePersonalData rejects records with mismatched resolvedAt/resolution
- migration: normalizePersonalData rejects records with forbidden security fields
- Build 019 persistence fields remain unchanged
- listPending hides resolved records while listAll returns all
- factory creates independent instances

## Release-gate checklist

- [x] per-namespace conflict resolution policies with explicit deny-by-default
- [x] tombstone conflicts always escalate to operator review
- [x] conflict resolution lifecycle (queue, accept, discard) with idempotency guard
- [x] in-memory audit trail for all resolution actions
- [x] additive persistence field with validation and secret exclusion
- [x] migration compatibility preserved for Builds 003–019
- [x] no network primitives introduced
- [x] security boundary check passes
- [x] key recovery policy gate resolved (operator-only, Build 004 infrastructure)
- [x] test suite: 42 tests, all passing
