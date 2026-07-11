# Build 016A — Phase 3 Integrity and Rosie Simplification

## Overview

Build 016A refines the Rosie cognitive layer, introduces transactional vault restore, fixes signal identity stability, and consolidates the Rosie UI into a single center panel.

## Changes

### Dependencies
- Pinned all package.json dependencies to exact versions for reproducibility.

### src/types/recovery.ts (new)
- Extracted `RecoveryAuditEvent` type to a shared location to avoid circular dependencies between `vault.ts` and `localData.ts`.

### src/vault.ts
- `RecoveryAuditEvent` now imported from `./types/recovery` (no longer defined locally).
- Recovery audit events are now stored in `PersonalData.recoveryAudit` (vault data), not in a separate `localStorage` key.
- `audit()` helper now returns a `RecoveryAuditEvent` value instead of writing to `localStorage`.
- `getRecoveryAudit(data)` and `addRecoveryAuditEvent(data, event)` operate on vault data.
- `migrateLegacyRecoveryAudit(data)` migrates audit events from the old `localStorage` key on first unlock.
- `restoreBackup()` is now fully transactional: validates, decrypts, migrates, verifies candidate, then commits. Previous vault is preserved on any failure.
- `testRecovery()` returns `{ records, createdAt, auditEvent }`.

### src/localData.ts
- `PersonalData` now includes `recoveryAudit?: RecoveryAuditEvent[]`.
- `normalizePersonalData()` validates and normalizes the `recoveryAudit` field.

### src/services/CognitiveSignalEngine.ts
- `buildSignature()` no longer includes `observationWindowStart`/`observationWindowEnd`. Signal identity is now based on rule ID, version, signal type, and evidence IDs only.
- `validateSignal()` is now version-tolerant for backwards compatibility with signals created under old rule versions.
- `analyze()` uses the latest version of each rule when multiple versions exist in the registry.

### src/services/CognitiveSignalRuleRegistry.ts
- `REGISTRY_VERSION` updated to `1.1.0`.
- Added v1.1.0 versions of `repeated_decision_reopening`, `overdue_commitment_recurrence`, `mission_completion_sequence`, and `review_timing_preference` with corrected language (no inferred patterns or behavior claims).
- v1.0.0 rules retained for backwards compatibility.

### src/services/RosieOrchestrationService.ts (new)
- Single deterministic orchestration entry point for Rosie cognitive processing.
- Consolidates signal analysis, understanding conversion, and presentation resolution.

### src/features/rosie/RosieCenter.tsx (new)
- Unified Rosie center with tabbed interface: Overview, What Rosie Notices, What Rosie Understands, Personalization, Privacy and Control.
- Replaces separate ROSIE, UNDERSTAND, COGNITION, SIGNALS, UNDERSTANDINGS, PERSONALIZATION buttons.

### src/App.tsx
- Replaced 6 separate Rosie/cognition buttons with one ROSIE button.
- Replaced 3 separate useEffect orchestration hooks with a single call to `runRosieOrchestration`.
- Added `RosieCenter` for unified Rosie management.

### src/hooks/useVault.ts
- Added `saveOrchestrationResult(data)` to apply orchestration results to vault state.

### scripts/security-boundary-check.mjs
- Expanded blocked network patterns to include `navigator.sendBeacon`, `RTCPeerConnection`, `WebTransport`, external Worker URLs, `SharedWorker`, `serviceWorker.register`, external script injection, and dynamic remote imports.

### index.html
- Added Content Security Policy meta tag: `default-src 'none'; connect-src 'none'` and related directives.

## Test Coverage Added
- `tests/recovery/transactional-restore.test.ts` — transactional restore correctness
- `tests/cognition/signal-identity.test.ts` — signal signature stability
- `tests/cognition/rule-language.test.ts` — corrected rule language in v1.1.0
- `tests/security/csp.test.ts` — CSP meta tag presence
- `tests/security/network-boundaries.test.ts` — security boundary scan
- `tests/migration/build-016a.test.ts` — recoveryAudit field migration
- `tests/rosie/orchestration.test.ts` — orchestration determinism
