# Build 011: Rosie Understanding Engine

## Purpose

Build 011 adds deterministic operator understanding across behavior, patterns, trends, consistency, drift, and recommendation outcomes. It turns existing encrypted records into explainable observations without prediction, diagnosis, AI, or machine learning.

## Mission

Provide a practical operator understanding layer that remains local-first, encrypted, deterministic, and backward-compatible with prior vaults.

---

## Architecture

### New/Expanded Engines

| Module | Role |
|---|---|
| `BehaviorEngine` | Execution frequency, completion rate, churn, delay, decision aging |
| `PatternEngine` | Streaks, repeated dismissals, repeated successes/failures, reflection themes |
| `TrendEngine` | Directional trend analysis across key dimensions |
| `ConsistencyEngine` | Qualitative consistency ratings per operational dimension |
| `OperationalDriftEngine` | Multi-signal drift detection with severity and evidence |
| `UnderstandingEngine` | Orchestration, summaries, statistics, recommendation outcomes, brief observations |
| `useUnderstanding` | React integration hook |
| `UnderstandingDashboard` | UI for summary, behavior, patterns, trends, consistency, drift, outcomes/stats |

### App Integration

- UNDERSTAND control in topbar
- Morning observations integrated into Brief
- Evening observations integrated into Reflection
- Understanding transition timeline events recorded with duplicate-guard logic

---

## Understanding Engine

`UnderstandingEngine.analyze(data)` orchestrates all sub-engines and produces:

- behavior report
- pattern report
- trend report
- consistency report
- drift report
- deterministic summary lines
- statistics and recommendation outcomes

All outputs are derived from encrypted operator records already present in `PersonalData`.

---

## Behavior Engine

Deterministic measurements:

- priorities completed (7/30/all time)
- average completion time
- completion percentages
- overdue delays
- priority churn
- commitment churn
- decision aging

---

## Pattern Engine

Deterministic pattern detection:

- completion streak
- reflection streak
- repeated recommendation dismissals (`repeatedRecommendationDismissals`)
- recurring reflection themes
- repeated successes/failures

---

## Trend Engine

Direction-only trend output (`increasing`, `stable`, `decreasing`) for:

- priority load
- commitment load
- decision load
- reflection frequency
- recommendation volume
- completion rate

---

## Consistency Engine

Dimension ratings:

- Priority execution
- Commitment follow-through
- Decision resolution
- Reflection cadence
- Backup cadence
- Recovery verification

Overall rating is derived from dimension evidence.

---

## Operational Drift Engine

Deterministic drift signals:

- backlog growth
- repeated delays
- commitment overload
- completion decline
- recommendation accumulation
- reflection decline
- backup neglect
- recovery neglect
- decision aging

Signals include severity, evidence, and timestamp.

---

## Recommendation Outcomes

Tracked outcomes:

- completed
- dismissed
- snoozed
- active
- ignored (deterministic rule: stale active recs with subsequent operator activity)

Outcome metrics are surfaced in Understanding statistics and dashboard.

---

## Morning Brief Integration

Morning Brief now includes up to three deterministic understanding observations:

- what Rosie noticed
- why it matters
- evidence
- recommended action (when applicable)

---

## Evening Summary Integration

Reflection view now includes deterministic evening understanding observations and execution summary context:

- execution completed
- pattern change signal
- active drift signal status
- action guidance where available

---

## Knowledge Graph Integration

Build 011 adds safe `understanding` nodes to graph output for meaningful drift/trend/outcome observations. Relationships are generated with:

- source
- target
- relationship type
- evidence
- timestamp
- confidence from evidence count only

Secret values are never added to node titles or evidence.

---

## Timeline Integration

Understanding transition events are captured when state changes (new/resolved drift or pattern transitions, trend direction changes). Duplicate events are prevented by matching title/detail/type before insertion.

Additional explicit recommendation lifecycle events are recorded:

- Pattern dismissed
- Pattern snoozed
- Recommendation completed

---

## Data Model

### Added/extended

- `RosieRecommendation` outcome metadata (`completed`, `completedAt`, `dismissedAt`, `snoozedAt`)
- `NodeType` now includes `understanding`
- optional `understandingState` on `PersonalData` for transition tracking

### Derived vs persisted

- behavior/pattern/trend/consistency/drift/summary remain derived in memory
- only explicit operator state and transition tracking are persisted

---

## Migration and Compatibility

- `normalizePersonalData` safely defaults missing optional Build 011 fields
- existing vaults from prior builds continue to load via migration pipeline
- no export/reimport required
- no existing record families discarded

---

## Security Boundaries

- No AI, no machine learning, no prediction
- No backend, no cloud, no external APIs
- No telemetry/analytics
- No network requests added
- Vault crypto unchanged: AES-GCM + PBKDF2-SHA-256
- Passphrase remains memory-only
- Recovery remains fail-closed
- Secret/password values excluded from unsafe analysis paths

---

## Testing

Build 011 adds deterministic engine and integration coverage under `tests/understanding/` for:

- behavior metrics
- pattern detection
- trend/consistency/drift behavior
- understanding summary/statistics/outcomes
- dashboard property usage
- understanding graph safety checks

Existing suites remain part of full regression.

---

## Acceptance Criteria

- Understanding modules implemented and integrated
- UNDERSTAND control available in unlocked mode
- Morning and evening understanding observations integrated
- Recommendation outcomes surfaced
- Understanding graph nodes added safely
- Transition timeline events recorded without duplication
- Build and tests pass

---

## Known Limitations

- Understanding observations are capped and intentionally concise
- Timeline transition deduplication is title/detail/type based
- Understanding graph nodes represent active/high-signal observations, not full historical archives

---

## Future Extensions

- explicit operator acknowledgement workflow for observations
- richer trend baseline windows configurable by operator
- historical understanding snapshots in encrypted vault (opt-in)
