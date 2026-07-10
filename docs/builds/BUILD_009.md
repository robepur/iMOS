# Build 009: Rosie Cognitive Partner

## Purpose

Build 009 transforms Rosie from a passive memory service into an active, deterministic cognitive partner. Rosie observes the operator's encrypted vault data and surfaces observable recommendations, health signals, morning briefs, and evening summaries — all derived from operator-supplied records only.

---

## Architecture

### New Files

| File | Purpose |
|---|---|
| `src/hooks/useRecommendations.ts` | Derives active recommendations; provides dismiss/snooze helpers |
| `src/features/rosie/RecommendationCenter.tsx` | Operator-facing recommendation dashboard with health signals |
| `src/features/rosie/RecommendationHistory.tsx` | View dismissed and snoozed recommendations |
| `src/features/rosie/DailyBrief.tsx` | Morning/evening brief driven by time of day |
| `src/features/rosie/HealthSignals.tsx` | Six-signal operational health table |
| `src/features/vault/DataPanel.tsx` | Extracted from App.tsx (vault backup/recovery/erase panel) |
| `tests/rosie/recommendations.test.ts` | 13 tests covering recommendation rules and health signals |
| `docs/builds/BUILD_009.md` | This document |

### Modified Files

| File | Change |
|---|---|
| `src/localData.ts` | Added `RosieRecommendation` type; `recommendations?` on `PersonalData`; normalize updated |
| `src/types/index.ts` | Re-exports `RosieRecommendation` |
| `src/services/RosieEngine.ts` | Added 7 new methods: `generateRecommendations`, `detectPatterns`, `getMorningBrief`, `getEveningSummary`, `getHealthSignals`, plus exported types `MorningBriefData`, `EveningSummaryData`, `HealthSignalLevel`, `HealthSignals` |
| `src/hooks/useVault.ts` | Added `dismissRecommendation` and `snoozeRecommendation` mutations |
| `src/App.tsx` | Added ROSIE topbar button with alert state; wired `useRecommendations`; uses `DataPanel`; reduced to <100 lines |
| `src/features/rosie/index.ts` | Exports all new Rosie components |
| `src/features/vault/index.ts` | Exports `DataPanel` |
| `src/styles.css` | Appended recommendation, health signal, daily brief, and snooze menu styles |

---

## Review Center

Unchanged from Build 007. Accessible via REVIEW button.

---

## Recommendation Engine

### Rules (11 total)

| ID | Rule | Severity |
|---|---|---|
| no-primary | No primary priority when active priorities exist | high |
| critical-overdue | Critical priority past due date | critical |
| commitment-overdue | Commitment past due date | high |
| decision-stale | Decision open > 14 days | high |
| no-reflection | No reflection in > 7 days | normal |
| no-backup | No backup event in > 30 days | high |
| no-recovery-test | No recovery test in timeline | normal |
| priority-overload | ≥ 6 active priorities | normal |
| commitment-overload | ≥ 10 open commitments | normal |
| memory-priority-link | Reflection "remember" text cross-references incomplete priority | normal |

### Deterministic IDs

Recommendation IDs use pattern `rec-{ruleName}-{targetId}`. This ensures the same observable state always produces the same ID, enabling cross-session dismiss/snooze deduplication.

### Confidence

- 1 evidence item → Low
- 2 evidence items → Medium
- 3+ evidence items → High

### Dismiss and Snooze

Dismissed and snoozed state is persisted inside `data.recommendations[]` in the encrypted vault. A dismissed recommendation is permanently hidden. A snoozed recommendation is hidden until the snooze expiry date.

Snooze options: Tomorrow (1 day), 3 Days, 7 Days, 30 Days.

---

## Health Signals

Six observable signals, each with three states:

| Signal | Green | Amber | Red |
|---|---|---|---|
| Priority Load | 0 active | 1–5 active | 6+ active |
| Commitment Load | < 5 open | 5–9 open | 10+ open |
| Decision Load | 0 open | 1–4 open | 5+ open |
| Reflection Frequency | < 3 days since last | 3–6 days | 7+ days |
| Backup Health | < 7 days since backup | 7–29 days | 30+ days |
| Recovery Health | At least one test recorded | — | Never tested |

---

## Statistics

Provided by `OperatorStatistics.tsx` (Build 007, unchanged).

---

## Migration

Vaults from Builds 003–008 that do not contain a `recommendations` field are automatically normalized by `normalizePersonalData()` to include `recommendations: []`. No data is discarded.

---

## Security

- All recommendations are derived from existing encrypted operator records.
- Recommendations never reference secret values, passphrases, or vault internals.
- Dismissed/snoozed state is stored in the encrypted vault.
- No inference. No AI. No external services.
- Fail-closed error boundary wraps all lazy-loaded panels.

---

## Acceptance Criteria

- [x] Existing vaults (Builds 003–008) open without data loss
- [x] ROSIE topbar button visible, shows active recommendation count
- [x] Recommendation Center opens and displays active recommendations
- [x] Dismiss removes recommendation from active list
- [x] Snooze hides recommendation until selected future date
- [x] Health signals reflect current vault state
- [x] Morning brief shows active priorities, overdue commitments, open decisions
- [x] Evening summary shows today's completions and reflection reminder
- [x] RecommendationHistory shows snoozed and dismissed recs
- [x] 34 tests passing (21 existing + 13 new)
- [x] Production build succeeds
- [x] App.tsx under 100 lines
- [x] No network requests
- [x] No AI, no inference, no external services

---

## Known Limitations

- `detectPatterns()` declining-completion-rate detection requires at least 3 recent priorities to activate.
- Memory-priority-link rule uses word-based matching (words > 4 chars); short priority titles may not match.
- Health signal for backup relies on timeline events; if no backup event was recorded in earlier builds, the signal will show red until a backup is performed.
- Daily brief is time-gated by system clock hour only (before 17:00 = morning, after = evening).
