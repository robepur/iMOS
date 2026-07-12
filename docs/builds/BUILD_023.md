# BUILD 023: MVP Operator Validation and Release Gate

**Status:** Complete  
**Branch:** `phase-4/build-023-mvp-validation`  
**Depends on:** Build 022 (Recovery-Safe Synchronization and Migration Validation)  
**Build constant:** `'023'`

---

## Purpose

Complete the minimum operator workflow for secure synchronization and determine whether
iMOS qualifies for MVP release. Build 023 is the final MVP validation gate.

---

## Scope

### Deliverables

| File | Role |
|------|------|
| `src/types/syncReview.ts` | Operator sync review types, decision types, audit contracts |
| `src/services/OperatorDecisionService.ts` | Decision routing through convergence engine + recovery coordinator |
| `src/features/sync/SyncReviewPanel.tsx` | Minimal operator sync review React interface |
| `src/features/sync/index.ts` | Feature exports |
| `tests/sync/build-023-mvp-validation.test.tsx` | 44-test MVP validation suite |
| `docs/builds/BUILD_023.md` | Build architecture documentation |
| `docs/releases/MVP_READINESS.md` | MVP readiness report |
| `src/constants.ts` | `BUILD` advanced to `'023'` |
| `src/types/index.ts` | Review type re-exports |

---

## Architecture

### Operator Decision Service

The `OperatorDecisionService` manages the sync review queue:

1. `addConflictItem(remote, priorEntry, reason)` — add divergent history or tombstone conflict
2. `addQuarantineItem(record)` — add quarantine record
3. `validateDecision(itemId, action)` — security pre-check before confirmation dialog
4. `executeDecision(itemId, action)` — route confirmed decision through convergence + coordinator
5. `getAuditEvents()` — structured audit trail (no plaintext)

### Decision Routing

```
Operator confirms → OperatorDecisionService.executeDecision()
                         ↓
                   Security pre-check (signer, signature, key hierarchy)
                         ↓
                   Recovery coordinator.prepare() → stage() → validate()
                         ↓ convergence engine re-evaluates
                  accept_remote: coordinator.commitToLedger()  → ledger advanced
                  keep_local / reject_remote / preserve_both:  → ledger unchanged
                  discard_quarantine:                          → item resolved
                  leave_unresolved:                            → item remains pending
```

### Sync Review Panel

The React interface (`SyncReviewPanel`) surfaces:
- **Divergent history items** — two devices evolved from same ancestor differently
- **Tombstone conflict items** — remote deletion of a live object
- **Quarantine records** — objects that failed security validation

Every state-changing action requires an explicit confirmation dialog.
Technical detail is behind an optional disclosure ("Show detail").
Error messages never expose implementation secrets.

### Security Invariants

- No default action accepts remote data
- Every confirmation-required action shows a dialog before calling `onDecision`
- `leave_unresolved` requires no confirmation (it changes no state)
- Resolved items cannot be silently changed (idempotency)
- Revoked, suspended, replaced, and unknown signers fail validation before the dialog appears
- No plaintext, key material, or credentials in audit events, decision records, or UI

---

## Required Operator Actions

| Action | Confirmation | Ledger effect | Available for |
|--------|-------------|---------------|---------------|
| `keep_local` | Required | None | Conflict items |
| `accept_remote` | Required | Advances ledger via coordinator | Conflict items |
| `preserve_both` | Required | None | Conflict items |
| `reject_remote` | Required | None | Conflict items |
| `discard_quarantine` | Required | None | Quarantine items |
| `leave_unresolved` | Not required | None | All items |

---

## Security Validation

All 18 required security properties are enforced:

1. Zero critical security findings
2. Zero high security findings
3. Default deny networking — `OperatorDecisionService` is synchronous; no fetch calls
4. Only approved sync adapter uses network primitive
5. No plaintext in quarantine records
6. No plaintext in recovery records
7. No plaintext in audit records
8. No private device key export path
9. Recovery secrets and root material are never persisted
10. Revoked devices cannot advance synchronized state
11. Suspended devices cannot advance synchronized state
12. Replaced devices cannot advance synchronized state
13. Unknown devices cannot advance synchronized state
14. Replay attempts are quarantined (convergence engine + coordinator)
15. Rollback attempts are quarantined (convergence engine + coordinator)
16. Divergent histories require operator review (never auto-resolved)
17. Tombstone conflicts require operator review (never auto-resolved)
18. Every failure path preserves confirmed local data

---

## MVP Validation Checklist

| Item | Status |
|------|--------|
| Local vault creation | Covered by existing vault tests |
| Local persistence | Covered by existing migration tests |
| Recovery backup | Covered by existing recovery tests |
| Device identity | Covered by Build 018 + 020 tests |
| Key hierarchy | Covered by Build 020 tests |
| Sync transport | Covered by Build 019 tests |
| Conflict detection | Covered by Build 021 tests |
| Conflict resolution | Covered by Build 023 MVP test |
| Interrupted commit recovery | Covered by Build 022 tests |
| Legacy fixture migration | Builds 016–022 all covered |
| Local-only mode | Confirmed — sync disabled by default |
| Security boundary scan | Passes |

---

## Excluded Scope

- No production network endpoints
- No cloud synchronization provider
- No operator account or hosted service
- No OAuth flows or token persistence
- No Microsoft Graph, Robinhood, or any external provider
- No outbound actions
- No telemetry
- No automatic acceptance of divergent histories
- No destructive migration

---

## Completion Gate

| Check | Requirement |
|-------|-------------|
| TypeScript | Zero errors |
| Full test suite | All tests pass |
| Security boundary scan | No violations |
| Production build | Succeeds |
| Pre-merge CI | All checks green |
| Post-merge `main` CI | Both workflows green |
