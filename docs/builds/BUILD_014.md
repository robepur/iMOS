# BUILD 014 — Deterministic Cognitive Signal Engine

## Purpose

Build 014 implements the first production capability of Rosie's cognitive personalization layer: deterministic, rule-based signal detection from operator records.

Signals are **proposed only**. They do not change any system behaviour in Build 014. No recommendation, mission, briefing, or review output is modified by signal state. Operator-confirmed understandings that personalize behaviour are a Build 015 capability.

## Architecture

### CognitiveSignalEngine (`src/services/CognitiveSignalEngine.ts`)

- `analyze(data, consent, now?)` — top-level analysis entry point
  - Blocks immediately if `isCognitionEnabled(consent) === false`
  - Validates registry before any rule executes
  - Time-injectable via optional `now` parameter (deterministic in tests)
  - Deduplicates against existing signals by stable signature
  - Expires stale signals before merging new ones
- `analyzeRule(ruleId, ruleVersion, data, consent, now)` — runs one rule
  - Returns `null` for unknown rule IDs or versions (fail closed)
  - Verifies all required data categories are permitted by consent
- `deduplicateSignals(existing, incoming)` — prevents duplicate accumulation
- `expireSignals(signals, now)` — transitions expired signals to `expired` status
- `suppressSignal(signals, signalId, now)` — operator-driven suppression
- `getActiveSignals(signals)` — returns `proposed` and `observed` signals
- `explainSignal(signal)` — returns full plain-language provenance explanation
- `validateSignal(signal)` — structural validation (fail closed)
- `createSignal(partial, now)` — factory with automatic signature computation
- `updateSignal(signals, signalId, updates, now)` — audit-preserving update

### CognitiveSignalRuleRegistry (`src/services/CognitiveSignalRuleRegistry.ts`)

Versioned registry of 7 deterministic rules:

| Rule ID | Input Category | Min Evidence | Window |
|---|---|---|---|
| `overdue_commitment_recurrence` | commitments | 3 | 90 days |
| `recommendation_response_pattern` | recommendation_outcomes | 5 | 60 days |
| `repeated_decision_reopening` | decisions | 2 | 90 days |
| `mission_completion_sequence` | missions | 2 | 60 days |
| `review_timing_preference` | decisions + reflections + review_history | 5 | 60 days |
| `summary_vs_detail_preference` | preferences | 10 | 60 days |
| `preferred_evidence_depth` | preferences | 10 | 60 days |

Note: `summary_vs_detail_preference` and `preferred_evidence_depth` require an explicit preference capture mechanism not present in Build 014. They always return no signal.

Registry validates for:
- Duplicate rule ID + version pairs
- Missing required fields
- Invalid evidence counts and window sizes
- Missing prohibited inference notes

### CognitiveSignalsPanel (`src/features/cognition/CognitiveSignalsPanel.tsx`)

Operator UI for reviewing proposed signals:
- Status badge (proposed, suppressed, expired)
- Rule provenance and version
- Evidence count and observation window
- Full explanation via `explainSignal` (collapsible)
- Suppress button (proposed/observed signals only)
- Filter: active / all / suppressed

## Signal Lifecycle

```
initial analysis → proposed
proposed → (time passes, expiresAt reached) → expired
proposed → (operator action) → suppressed
suppressed / expired → terminal (no re-promotion in Build 014)
```

Signal promotion to `operator_confirmed` (which would allow personalization) is a **Build 015 capability**.

## Signal Signature

Stable deduplication key computed from:
```
{ruleId}|{ruleVersion}|{signalType}|{sortedEvidenceIds}|{windowStart}|{windowEnd}
```

If a signal with the same signature already exists (any status), the new signal is not added.

## Data Model Changes

`PersonalData` additions (both optional, backward-compatible):
- `cognitiveSignals?: CognitiveSignal[]` — proposed signals from local analysis
- `cognitiveRuleRegistryVersion?: string` — registry version active at last analysis

Normalization in `normalizePersonalData`:
- Malformed signals are discarded (fail closed via `isSafeCognitiveSignal`)
- Missing fields default to empty arrays
- `cognitiveRuleRegistryVersion` defaults to undefined (preserved when valid string)

## Security Boundaries

All Build 013 Zero Trust controls remain intact:

- Local-only operation — no network requests
- No external AI, cloud services, or telemetry
- AES-256-GCM encrypted vault storage
- Passphrase in memory only
- Signal evidence contains only vault record IDs — never raw field values
- Signal analysis blocked entirely when `cognitionConsent.status !== 'on'`
- Invalid or missing consent fails closed to default off state
- Registry validation failure blocks all signal generation
- Unknown rule IDs or versions return null (fail closed)

## Compatibility

All Phase 2 vault formats (Builds 003–012) migrate cleanly:
- `cognitiveSignals` hydrates to `[]`
- `cognitiveRuleRegistryVersion` hydrates to `undefined`
- No existing data fields are modified or removed
- Migration is idempotent

## Testing

Test files:
- `tests/cognition/signals.test.ts` — 20 tests covering consent gate, rule execution, deduplication, expiry, suppression, utilities, and security boundary
- `tests/cognition/rules.test.ts` — 12 tests covering registry validation, rule accessors, and prohibited inference requirements
- `tests/migration/compatibility.test.ts` — extended with 7 Build 014 migration assertions

All 238 tests pass. TypeScript clean. Production build clean. Security boundary scan passes.

## Acceptance Criteria

- [x] Analysis blocked when consent is off
- [x] All 7 rules registered and validated
- [x] Signals are proposed only — no system behaviour changes
- [x] Stable signatures prevent deduplication
- [x] Expiry transitions work correctly
- [x] Operator suppression works correctly
- [x] Evidence contains only IDs, not raw vault values
- [x] Unknown rules fail closed
- [x] `CognitiveSignalsPanel` wired to SIGNALS topbar button (visible only when consent enabled)
- [x] All Phase 2 vaults migrate cleanly
- [x] All tests pass
- [x] TypeScript clean
- [x] Build clean
- [x] Security boundary scan passes

## Known Limitations

- `summary_vs_detail_preference` and `preferred_evidence_depth` require explicit preference capture — always return no signal in Build 014
- `recommendation_response_pattern` uses `dismissed` field from `RosieRecommendation` — available when recommendations have been acted upon
- Signals cannot be promoted to `operator_confirmed` in Build 014 — that is Build 015
- No personalization of any kind occurs in Build 014

## Build 015 Readiness

Build 015 will add:
- Operator confirm/correct/reject workflows on proposed signals
- Promotion path: `proposed → operator_confirmed`
- Personalization of briefings, recommendations, and mission plans based on `operator_confirmed` understandings only
