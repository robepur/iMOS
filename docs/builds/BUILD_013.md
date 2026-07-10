# Build 013: Cognitive Contract, Consent, Identity, and Authority Foundation

## Purpose

Build 013 establishes the safety and data foundation required for Phase 3
cognitive personalization. It defines the consent model, understanding lifecycle
contract, authority schema, and operator-facing consent management surfaces
without implementing adaptive behavior, cloud synchronization, or external
connectors.

## Architecture

```
src/
  types/
    cognitive.ts                     # Phase 3 type definitions
  services/
    CognitionConsentService.ts       # Consent lifecycle management
    CognitionContractService.ts      # Understanding provenance and validation
  features/
    cognition/
      CognitionConsentPanel.tsx      # Operator consent management UI
      index.ts
  localData.ts                       # PersonalData extended with Phase 3 fields
  constants.ts                       # BUILD='013', consent/understanding labels
  hooks/
    useVault.ts                      # updateCognitionConsent added
  App.tsx                            # COGNITION topbar button wired
tests/
  cognition/
    consent.test.ts                  # Consent lifecycle and security tests
    contract.test.ts                 # Understanding contract and provenance tests
  migration/
    compatibility.test.ts            # Phase 3 migration tests added
  fixtures/
    compatibilityVaults.ts           # Build 013 migration fixtures added
docs/builds/
  BUILD_013.md                       # This file
```

## Consent Model

Cognition consent defaults to `status: 'off'`. No Phase 3 cognitive signal
capture, analysis, or persistence occurs before the operator explicitly enables
consent.

The operator may:

- Review the current consent status, version, and purpose
- Enable cognition, selecting permitted data categories and feature surfaces
- Disable cognition, stopping new capture immediately
- Update permitted categories and surfaces independently
- Revoke consent, permanently stopping capture until reset
- Reset consent to the safe default, preserving audit history
- Export the full audit history

Every state change produces an immutable audit event. Revoked consent cannot
be re-enabled without a reset (fail closed).

### CognitionConsent fields

| Field | Description |
|---|---|
| status | `'off'`, `'on'`, or `'revoked'` |
| version | Schema version string |
| purpose | Plain-language operator explanation |
| grantedAt | ISO timestamp of most recent enable |
| updatedAt | ISO timestamp of most recent state change |
| revokedAt | ISO timestamp when revoked (required when revoked) |
| permittedDataCategories | Operator-selected data sources |
| permittedFeatureSurfaces | Operator-selected application surfaces |
| auditHistory | Append-only audit events |

## Understanding Contract

Every persisted OperatorUnderstanding must carry full provenance. Missing or
invalid provenance fails closed and prevents persistence.

### Lifecycle states

```
observed -> proposed -> operator_confirmed
                     -> operator_corrected -> operator_confirmed
                     -> operator_rejected  (terminal)
                     -> expired -> proposed
operator_confirmed  -> operator_corrected
                    -> operator_rejected
                    -> expired -> proposed
```

`operator_rejected` is terminal. Rejected understandings cannot return to
`operator_confirmed` without materially new evidence and a fresh observation.

Only `operator_confirmed` understandings may personalize system behavior.
`proposed` understandings may be displayed but must not silently change behavior.

### OperatorUnderstanding fields

| Field | Description |
|---|---|
| id | Unique identifier |
| statement | Plain-language description |
| evidenceIds | IDs of vault records used as evidence |
| ruleId | Deterministic rule identifier |
| ruleVersion | Rule semver at generation time |
| createdAt / updatedAt | ISO timestamps |
| confidenceBasis | Plain-language confidence explanation |
| state | Current lifecycle state |
| correctionHistory | Append-only operator corrections |
| permittedFeatureUses | Surfaces permitted to use this understanding |
| expiresAt / expiredAt | Expiry timestamps |
| provenance | Full UnderstandingProvenance record |

### UnderstandingProvenance (required)

| Field | Description |
|---|---|
| ruleId | Rule identifier (must match understanding.ruleId) |
| ruleVersion | Rule version at generation time |
| evidenceTypes | Human-readable evidence category labels |
| generatedAt | ISO generation timestamp |
| dataSource | Must be `'local_vault'` |

## Authority Boundaries

Build 013 defines schemas only. It does not implement:

- cloud synchronization
- external connectors
- adaptive behavior changes
- automated personalization
- mission modification
- autonomous execution
- external AI inference
- hidden observation
- trust scoring
- psychological or sensitive inference
- financial actions

Rosie may not expand its own authority. Operator decisions override all
Rosie suggestions. Trust never grants access.

## Security

- AES-256-GCM vault encryption preserved
- PBKDF2-SHA256 key derivation preserved
- No network primitives introduced (security-boundary-check passes)
- No plaintext persistence of Phase 3 data
- No secret values in cognition, understandings, graphs, or timelines
- Cognition consent defaults off — no capture without explicit enablement
- Revoked consent cannot re-enable without explicit reset
- Invalid or corrupt consent normalizes to safe default (fail closed)
- Invalid provenance prevents understanding creation (fail closed)
- `operator_rejected` understandings are terminal

## Migration

Build 013 adds Phase 3 fields to `PersonalData` additively.
`normalizePersonalData` hydrates safe defaults for all new fields when absent:

- `cognitionConsent` → `CognitionConsent` with `status: 'off'`
- `operatorUnderstandings` → `[]`
- `cloudSyncConsentDeclaration` → `CloudSyncConsentDeclaration` with `status: 'not_offered'`
- `connectorConsentDeclarations` → `[]`

Migration is idempotent. Builds 003 through 012 vaults open correctly and
receive safe Phase 3 defaults without any operator data being discarded.

## Compatibility

- Builds 003 through 012 vaults: compatible, Phase 3 defaults hydrated
- All Phase 2 capabilities remain intact
- Existing security, recovery, backup, and mission features unaffected

## Acceptance Criteria

- [x] Cognition consent defaults off
- [x] Cloud sync and connector consent declarations default off/not_offered
- [x] No cognitive signal capture before cognition consent is on
- [x] No network activity introduced
- [x] Every persisted understanding validates provenance
- [x] Operator can inspect, enable, disable, revoke, and reset consent
- [x] Invalid and corrupt consent/understanding state fails closed
- [x] Builds 003 through 012 remain compatible after migration
- [x] `operator_rejected` understandings are terminal
- [x] Only `operator_confirmed` understandings qualify for personalization
- [x] Full consent audit history preserved through reset
- [x] Migration idempotent
- [x] Phase 2 regression suite remains green

## Known Limitations

- `CognitionConsentPanel` does not yet surface `operatorUnderstandings` review — that is Build 015 scope.
- Cloud sync and connector consent declaration types are defined but have no
  associated UI or service logic — that is Phase 4 / Build 5 scope.
- The `updateCognitionConsent` vault hook does not yet validate consent before
  save — full pipeline validation is Build 015 scope.

## Next Build

Build 014: Deterministic Cognitive Signal Engine
