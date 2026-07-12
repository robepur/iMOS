# Pilot Success Criteria

**iMOS 0.1.0-rc.1**

---

## Technical Gates (Must Pass Before Pilot Begins)

| # | Criterion | Pass Condition |
|---|-----------|---------------|
| 1 | Recovery backup created | Onboarding completion confirms backup |
| 2 | All CI checks green | Post-merge `main` workflows pass |
| 3 | Zero critical security findings | Security boundary scan passes |
| 4 | Zero high security findings | Security boundary scan passes |
| 5 | Full test suite passes | All 500+ tests pass |
| 6 | Production build succeeds | `pnpm run build` passes |
| 7 | Existing vault fixtures migrate | Builds 003–023 migration passes |

---

## Operator Readiness Gates (Must Be Met Before Pilot Begins)

| # | Criterion | Pass Condition |
|---|-----------|---------------|
| 8 | Onboarding completed | `onboardingState.status === 'completed'` |
| 9 | Recovery backup confirmed | `onboardingState.recoveryBackupConfirmed === true` |
| 10 | Operator understands passphrase responsibility | Confirmed in onboarding step 4 |
| 11 | Operator can find Recovery Console | Demonstrated in onboarding step 6 |

---

## Daily Workflow Criteria (Measured Over Pilot Period)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Daily briefing usefulness | Average ≥ 3.0 / 5 | Pilot feedback: briefing entries |
| Recommendation usefulness | Average ≥ 3.0 / 5 | Pilot feedback: recommendation entries |
| Average cognitive effort | ≤ 3.5 / 5 | Pilot feedback: all entries |
| Daily workflow completion | ≥ 70% of active days | Reflection entries / active days |
| Backup created at start | Yes | `recoveryBackupConfirmed` |
| Backup refreshed during pilot | At least once | New export after week 1 |

---

## Trust and Accuracy Criteria

| Metric | Threshold | Action if Exceeded |
|--------|-----------|-------------------|
| Incorrect assumption reports | ≤ 20% of feedback entries | Review understanding correction log |
| Missing context reports | ≤ 30% of feedback entries | Review data coverage |
| Trust concern reports | ≤ 10% of feedback entries | Pause pilot, review Rosie engine |

---

## What Does Not Affect Success Criteria

- Number of corrections made (corrections are a feature, not a failure)
- Number of rejected recommendations (rejection is operator control working correctly)
- Feedback volume (recording is optional; absence does not mean failure)
- Operator is never scored, ranked, or graded

---

## Pilot Outcome Verdicts

| Verdict | Condition |
|---------|-----------|
| **Proceed to production** | All technical gates pass, daily workflow ≥ 70%, trust concerns ≤ 10% |
| **Extend pilot** | Technical gates pass, daily workflow 50–70%, or trust concerns 10–20% |
| **Pause and review** | Trust concerns > 20%, or critical CI finding discovered |
| **Rebuild required** | Security finding of severity critical or high, or vault data loss |

---

## Post-Pilot Actions

1. Review all pilot measurements in FEEDBACK panel
2. Review correction log in ROSIE panel
3. Create a fresh recovery backup
4. Document notable observations in a decision record
5. Determine proceed/extend/pause verdict
6. If proceeding: plan for Phase 5 provider selection
