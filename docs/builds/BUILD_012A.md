# Build 012A: Mission Integrity and Phase Two Consolidation

## Purpose

Build 012A finalizes Phase Two (Builds 006-012) by hardening mission lifecycle integrity, transactional vault updates, deterministic deduplication, compatibility validation, and security boundaries.

## Phase Two Completion Statement

Build 012A is a consolidation build. It does not introduce new platform classes; it enforces existing mission architecture and validates platform reliability before Phase Three.

## Repository and Branch Strategy

- Head branch: `agent/build-012a-phase-two-consolidation`
- Base branch: `agent/build-012-mission-planning`
- Stacked draft PR required; do not target `main` unless repository history proves full stack merge.

## Mission Integrity Architecture

`src/services/MissionIntegrityService.ts` is the mission invariants authority:

- mission status transition allow-list
- step status transition allow-list
- title/objective/step presence validation
- sequential unique step ordering
- dependency validation (self, duplicate, missing, circular)
- completion gating (completed mission requires completed required steps)

## Status Transition Model

### MissionPlan

- `draft -> approved|cancelled`
- `approved -> active|cancelled`
- `active -> paused|completed|cancelled`
- `paused -> active|cancelled`
- `completed` and `cancelled` terminal

### MissionStep

- `pending -> active|blocked`
- `active -> completed|blocked`
- `blocked -> pending`
- `completed` terminal (without explicit reopen behavior)

## Transactional Update Model

Mission mutations now construct a full candidate next state in `useVault` before replacement:

1. construct next mission/step payload
2. normalize deterministic order
3. run `MissionIntegrityService.validatePlan`
4. commit state only on valid result
5. preserve previous state on validation failure

## Plan Generation Controls

`MissionPlanningEngine` now applies deterministic controls:

- maximum mission step limit (`MISSION_LIMITS.MAX_STEPS`)
- evidence floor/ceiling per step
- duplicate step title suppression
- duplicate plan title suffixing
- active-source collision review flag (`requiresOperatorReview`)
- no auto-approval or auto-activation

## Operator Override Rules

Operator edits are preserved with metadata:

- `operatorModified`
- `operatorOverrideReason`
- `generatedByRosie`
- `lastModifiedBy`

Regeneration and edits preserve operator-origin metadata rather than silently replacing modified fields.

## Mission Deletion Behavior

Mission deletion removes:

- selected mission record
- mission steps owned by that mission

Mission deletion preserves:

- timeline history as sanitized mission events
- unrelated priorities/commitments/decisions/reflections
- recommendation history

## Duplicate Prevention

Timeline writes for mission/recommendation/understanding use stable event signatures (`type|title|detail`) and skip duplicates. Repeated recomputation does not add duplicate timeline entries.

Knowledge graph node/edge IDs remain deterministic and deduplicated by ID.

## Knowledge Graph Integrity

Mission graph integrity in Build 012A preserves:

- one deterministic node per mission and step ID
- deduplicated edge IDs
- safe evidence only (no secret value inclusion)
- stable regeneration counts across repeated builds

## Recovery and Backup Validation

Build 012A adds mission-aware recovery regression coverage:

- backup/restore preserves mission plans and steps
- blocked state and override reason retention
- recovery test coverage with mission data
- tampered backup rejection

## Backward Compatibility

Build 012A includes compatibility fixtures for Build 003 through Build 012 schemas and validates migration to latest schema defaults without manual export/import.

## Mature Vault Regression

A synthetic mature vault fixture now includes:

- active/completed priorities
- open/completed commitments and decisions
- reflections
- secrets metadata
- recommendations
- knowledge graph seed state
- understanding state
- mission plans, dependencies, blocked steps, and overrides
- timeline and recovery entries

## Performance Baseline

Synthetic baseline tests measure deterministic runtime for:

- knowledge graph generation
- understanding analysis
- mission generation

Thresholds are warning-oriented and local-only (no telemetry, no transmission).

## Security Review

Build 012A enforces local-only boundaries:

- no network clients introduced (`fetch`, `XMLHttpRequest`, `axios`, `WebSocket`, `EventSource`)
- no cloud/back-end integration
- encrypted vault persistence retained
- no secret values in graph evidence
- passphrase remains runtime-only

## CI Validation

CI now explicitly runs:

- TypeScript check
- build
- full tests
- mission tests
- migration tests
- recovery/crypto tests
- security boundary scan
- synthetic performance baseline

## Acceptance Criteria

- mission integrity invariants enforced in service layer
- mission transitions constrained to deterministic allow-lists
- transactional mission updates implemented
- operator overrides preserved
- duplicate timeline and graph behavior controlled
- recovery and migration coverage expanded
- mature fixture coverage added
- synthetic performance baseline documented and tested
- security boundaries validated
- build and tests passing

## Known Limitations

- step reorder UI currently offers minimal controls; ordering is still deterministic
- operator override reason is optional and currently shared per action input
- performance baseline is synthetic and not a full UX benchmark

## Phase Three Readiness Criteria

Phase Three may begin only when Build 012A draft PR is validated green with:

- passing build/tests
- mission invariants confirmed
- no security boundary violations
- stacked branch lineage intact
