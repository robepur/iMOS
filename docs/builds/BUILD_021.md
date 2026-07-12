# BUILD 021 — Deterministic Sync Conflict and Convergence Engine

## Purpose

Build 021 introduces a deterministic synchronization state machine that safely resolves multi-device object histories without data loss, silent overwrite, or automatic trust.

The convergence engine is a pure function: no network, no side effects, no async. All security-relevant fields are resolved by the caller (SyncService) before the engine is invoked.

## Scope

### Included

- Canonical convergence outcome types (`SyncConvergenceOutcome`)
- Remote object descriptor contract (`RemoteObjectDescriptor`)
- Convergence ledger entry contract (`SyncObjectLedgerEntry`)
- Deterministic conflict engine (`SyncConflictEngine.evaluateConvergence`)
- Structured audit event emission (`auditConvergenceOutcome`)
- In-memory synchronization state ledger (`SyncStateLedger`)
- Build 021 test suite (44 tests)
- `docs/builds/BUILD_021.md`
- Build constant advanced to `021`

### Excluded

- Production network endpoints
- Hosted synchronization
- Cloud SDK coupling
- OAuth flows
- Connector tokens
- Operator accounts
- Device enrollment
- Financial, media, or outbound integrations
- Build 020 key architecture changes

## Architecture

### Convergence Outcomes

| Verdict | Meaning |
|---|---|
| `already_synchronized` | Remote and local state are identical — idempotent |
| `accept_remote` | Remote is the valid next state — apply to vault |
| `accept_local` | Remote is stale — local is already ahead |
| `operator_review_required` | Histories diverged or tombstone conflict — human decision required |
| `quarantine_required` | Security violation — reject and record |

### Decision Order

1. **Security checks** — signature verification, signer active/revoked/suspended state. Always first. Always fail closed.
2. **Structural validity** — `parentVersion` must be strictly less than `objectVersion`.
3. **New object** — no ledger entry: accept unconditionally if secure.
4. **Key hierarchy binding** — hierarchy ID must match the established namespace chain.
5. **Version comparison and lineage** — same / older / newer version with parent chain resolution.

### Quarantine Reasons (Convergence)

| Reason | Trigger |
|---|---|
| `bad_signature` | Signature not verified |
| `unknown_device` | Signer not active in trust registry |
| `revoked_or_suspended_signer` | Signer status is revoked or suspended |
| `replay_attempt` | Remote version is in the accepted version history |
| `rollback_attempt` | Remote's declared parent is behind the currently accepted version |
| `wrong_key_hierarchy` | Hierarchy ID differs from the established ledger entry |
| `tampered_parent_version` | `parentVersion >= objectVersion` |
| `tampered_digest` | Same version number but different content digest |

### Review Reasons

| Reason | Trigger |
|---|---|
| `divergent_histories` | Remote is newer but not a direct descendant of the accepted version |
| `tombstone_conflict` | Remote tombstones an object that is locally live |

## Security Model

- Default deny: all unresolved cases fall to `quarantine_required` or `operator_review_required`
- Signatures validated before any version logic
- Hierarchy binding enforced before version comparison
- No last-write-wins: divergent histories require operator review
- Confirmed local state is never silently overwritten
- Replay detection via accepted version history (up to 64 prior versions)
- Rollback detection via parent version vs. accepted version comparison
- Revoked and suspended devices cannot advance object state
- Audit records contain no plaintext payload, credentials, or secret fields
- Transport remains disabled by default; ledger is transport-independent
- Local-only operation is fully preserved

## State Ledger Contract

- `evaluate(remote)` → returns deterministic outcome, records audit event, does **not** mutate ledger
- `commit(remote, outcome)` → advances ledger only for `accept_remote` outcomes, after vault application
- `get(namespace, objectId)` → returns current ledger entry or null
- `getAuditEvents()` → structured audit trail, most-recent first (bounded to 500 entries)

## Migration

- No persisted-data migration required
- Additive types only
- All Builds 003–020 vault data remains compatible
- `BUILD` constant advanced to `021`

## Acceptance Tests

All 44 tests in `tests/sync/build-021-sync-convergence.test.ts` must pass before merge.

Key coverage:
- Invalid signature → quarantine
- Revoked device → quarantine
- Suspended device → quarantine
- Unknown device → quarantine
- Tampered parent version → quarantine
- Tampered digest → quarantine
- Wrong hierarchy → quarantine
- Replay of previously accepted version → quarantine
- Rollback attempt via older parent → quarantine
- Identical state → already_synchronized
- Duplicate delivery → idempotent
- Valid direct descendant → accept_remote
- Stale remote → accept_local
- Divergent histories → operator_review_required
- Tombstone conflict → operator_review_required
- Determinism: same input always produces same output
- Interrupted synchronization resumes correctly
- Ledger tracks multiple objects independently
- Audit events contain no plaintext or credentials
- Build constants unchanged from prior builds
- Migration compatibility with Builds 003–020

## Limitations

- Version history is in-memory only (not persisted to vault in Build 021)
- Multi-device convergence with full chain validation is deferred to Build 022+
- Operator review workflow UI is out of scope for Build 021
