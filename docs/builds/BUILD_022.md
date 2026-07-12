# BUILD 022: Recovery-Safe Synchronization and Migration Validation

**Status:** Complete  
**Branch:** `phase-4/build-022-sync-recovery`  
**Depends on:** Build 021 (Deterministic Sync Conflict and Convergence Engine)  
**Build constant:** `'022'`

---

## Purpose

Prove that encrypted synchronization can recover safely from interruption, corruption,
migration failure, ledger inconsistency, and invalid remote state without losing confirmed
local data.

---

## Architecture

### Recovery Transaction State Machine

```
idle
  ↓ prepare()
preparing ──────────────────────────────────────────────────→ rollback → recovered
  ↓ stage()
staged ──────────────────────────────────────────────────────→ rollback → recovered
  ↓ validate() [accept_remote]
validating ──────────────────────────────────────────────────→ rollback → recovered
  ↓ commitToLedger()
committing ──────────────────────────────────────────────────→ rollback → recovered
  ↓
confirmed (checkpoint removed)

Any state → quarantine() → quarantined
Any state → failClosed()  → failed_closed
```

Every transition is recorded as a structured audit event. No transition writes
plaintext, key material, credentials, or decrypted payloads.

### Checkpoint Digest

The `SyncRecoveryCheckpoint.checkpointDigest` is a SHA-256 hex digest of the ten
canonical binding fields (transactionId, namespace, objectId, priorAcceptedVersion,
priorAcceptedParentVersion, priorContentDigest, priorSignerDeviceId, priorHierarchyId,
priorTombstone, priorAcceptedAt) concatenated with NULL-byte separators.

Any field mutation produces a different digest. Mismatch during `validate()` results
in `quarantined(tampered_checkpoint)`.

### Startup Recovery

`evaluateStartupRecovery(store, coordinator)` detects transactions left in non-terminal
states by a previous process and resolves them conservatively:

| Detected state     | Action                              |
|--------------------|-------------------------------------|
| preparing          | roll back → recovered               |
| staged             | roll back → recovered               |
| validating         | roll back → recovered               |
| committing         | roll back → recovered (conservative)|
| rolling_back       | complete rollback → recovered       |
| quarantined        | no action                           |
| failed_closed      | no action                           |
| recovered          | no action                           |

The `committing` state is rolled back conservatively. The ledger never has partial state
because `commitToLedger()` only advances the ledger in an atomic call after all validation
has passed.

---

## Deliverables

| File | Role |
|------|------|
| `src/types/syncRecovery.ts` | Recovery types, states, checkpoint contract, audit events |
| `src/services/SyncCheckpointStore.ts` | Store contract + in-memory reference implementation |
| `src/services/SyncRecoveryCoordinator.ts` | Transactional recovery coordinator |
| `src/services/SyncStartupRecovery.ts` | Startup incomplete-transaction evaluator |
| `tests/fixtures/syncCompatibilityFixtures.ts` | Sync state fixtures for Builds 016–021 |
| `tests/sync/build-022-sync-recovery.test.ts` | Adversarial test suite |
| `src/constants.ts` | `BUILD` advanced to `'022'` |
| `src/types/index.ts` | Recovery type re-exports added |

---

## Security Properties

### Default deny
Every unresolved recovery state defaults to `failed_closed` or `quarantined`.
No recovery state produces an accepted outcome without a complete, validated
`accept_remote` convergence result.

### Checkpoint binding
The checkpoint digest binds all prior-state fields to the transaction identifier.
Tampering any field changes the SHA-256 digest and the coordinator quarantines
the transaction immediately.

### No partial state
The convergence ledger is advanced exactly once, atomically, in `commitToLedger()`.
If the coordinator rolls back, the ledger retains its prior confirmed state.
No partial write is possible in the in-memory implementation.

### Convergence verdict passthrough
The coordinator does not override or bypass Build 021 convergence verdicts.
`operator_review_required` (divergent_histories, tombstone_conflict) outcomes are
rolled back — not committed — and the prior ledger state is preserved.

### No plaintext
Checkpoints, transactions, and audit events contain no decrypted content,
no passphrase, no private key, no root key material, no object key,
no connector token, no authorization header, no cookie, and no vault content.

### Replay protection
Replay attempts detected by the convergence engine (`replay_attempt` quarantine reason)
are propagated as `replay_attempt` in the coordinator's quarantine reason.

### Rollback floor
The coordinator never rolls the convergence ledger below the last confirmed accepted version.
`rollback_attempt` convergence outcomes map to `rollback_below_floor` quarantine in the coordinator.

---

## Recovery States

| State         | Description |
|---------------|-------------|
| `idle`        | No active transaction |
| `preparing`   | Checkpoint being created; prior state not yet fully recorded |
| `staged`      | Remote change held; ready for validation |
| `validating`  | All binding checks passed; ready to commit |
| `committing`  | Ledger commit in progress |
| `confirmed`   | Commit complete; checkpoint removed from store |
| `rolling_back`| Restoring prior confirmed state |
| `recovered`   | Prior confirmed state fully restored |
| `quarantined` | Security or structural violation; preserved for operator review |
| `failed_closed`| Irrecoverable binding violation (namespace/objectId mismatch) |

---

## Migration Compatibility

Builds 016–018 vaults have no sync fields. `normalizePersonalData` hydrates
a safe disabled default (`enabled: false`, `localEndpointConfigured: false`).

Builds 019–021 vaults have `syncOperatorControlState` with `enabled: false`.
These fields are preserved through normalization unchanged.

Unknown additive fields on `syncOperatorControlState` survive normalization
(validator accepts objects with extra fields). Unknown top-level vault fields
are preserved via the spread in `normalizePersonalData`.

---

## Convergence-to-Recovery Quarantine Reason Mapping

| Convergence reason         | Coordinator quarantine reason |
|----------------------------|-------------------------------|
| `bad_signature`            | `wrong_signer`                |
| `revoked_or_suspended_signer` | `revoked_signer`           |
| `unknown_device`           | `unknown_signer`              |
| `wrong_key_hierarchy`      | `wrong_key_hierarchy`         |
| `tampered_parent_version`  | `wrong_parent_version`        |
| `tampered_digest`          | `wrong_digest`                |
| `replay_attempt`           | `replay_attempt`              |
| `rollback_attempt`         | `rollback_below_floor`        |

---

## Excluded Scope

- No production network endpoints
- No cloud synchronization provider
- No operator account or device enrollment
- No OAuth flows or token persistence
- No Microsoft Graph, Robinhood, or any external provider
- No media providers
- No outbound actions
- No telemetry
- No automatic acceptance of divergent histories
- No destructive migration
- No silent data repair
- No UI expansion beyond what operator recovery decisions require

---

## Acceptance Gate

| Check | Requirement |
|-------|-------------|
| TypeScript | Zero errors |
| Full test suite | All tests pass |
| Migration fixtures | Builds 016–021 all migrate successfully |
| Security boundary scan | No violations |
| Production build | Succeeds |
| PR checks | All green |
| Post-merge CI | Both workflows green on `main` |

---

## Build 023 Readiness

Build 023 may begin once PR for Build 022 is merged, post-merge CI is green,
and no Build 022-specific architecture blocker remains.

Suggested Build 023 focus: **Operator Sync Review Interface** — surface divergent
histories, tombstone conflicts, and quarantine records for operator decision,
with clear accept/reject/discard actions and no automatic resolution of review-required outcomes.
