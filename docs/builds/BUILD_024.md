# Build 024 — MVP Release Candidate and Operator Pilot Preparation

**Branch:** `phase-4/build-024-mvp-release-candidate`  
**Build constant:** `024`  
**App version:** `0.1.0-rc.1`  
**Base:** Build 023 (merged at `34e983c`)

---

## Purpose

Promote iMOS from a development sequence to a formal release candidate. Provide a complete 12-step operator onboarding flow, a private local pilot feedback system, and all documentation required for a controlled operator pilot.

---

## Scope

### Version Advancement
- `BUILD` constant advanced from `'023'` to `'024'`
- `APP_VERSION = '0.1.0-rc.1'` added to `src/constants.ts`
- `package.json` version set to `'0.1.0-rc.1'`

### Operator Onboarding Flow
- 12-step onboarding in `src/types/onboarding.ts` and `src/features/onboarding/OnboardingFlow.tsx`
- Steps: welcome, daily_workflow, priorities, passphrase_responsibility, vault_security, recovery_backup, recovery_confirmed, rosie_introduction, decision_recording, first_priority, first_briefing, complete
- Pausable and resumable at any step
- Recovery backup creation required before completion
- `status: 'completed'` gates access to main application

### Pilot Feedback System
- Private, local, encrypted within vault (`src/types/pilotFeedback.ts`, `src/features/pilot/PilotFeedbackPanel.tsx`)
- Freeform comment (max 2,000 chars), ratings 1–5, 11 Rosie surface types
- Full CRUD with two-click delete confirmation
- Pilot measurements panel (usefulness trend, cognitive effort, correction rate)
- Never transmitted; no automatic adaptation from single entry; no ranking

### Data Layer
- `src/localData.ts`: `PersonalData` extended with `onboarding` and `pilotFeedback` fields
- Both fields normalised in `normalizePersonalData` — additive, rollback-safe
- `createDefaultPersonalData` provides safe defaults for both

### Application Integration
- `App.tsx`: onboarding guard renders `OnboardingFlow` before main app if not completed
- `App.tsx`: FEEDBACK button opens `PilotFeedbackPanel`
- `App.tsx`: OnboardingReview accessible after completion
- `useVault.ts`: `saveOnboardingState`, `addPilotFeedback`, `updatePilotFeedback`, `deletePilotFeedback` added

### Documentation
- `docs/releases/MVP_RELEASE_CANDIDATE.md`
- `docs/guides/OPERATOR_ONBOARDING.md`
- `docs/guides/BACKUP_AND_RECOVERY.md`
- `docs/pilot/OPERATOR_PILOT_PLAN.md`
- `docs/pilot/PILOT_SUCCESS_CRITERIA.md`
- `docs/builds/BUILD_024.md` (this file)

---

## Security Invariants Preserved

| Invariant | Status |
|-----------|--------|
| Pilot feedback stored only in encrypted vault | ✅ |
| Pilot feedback never transmitted | ✅ |
| Pilot measurements never leave device | ✅ |
| No auto-adaptation from single feedback entry | ✅ |
| No ranking or scoring of operator | ✅ |
| No provider credential or production endpoint added | ✅ |
| Sync disabled by default | ✅ |
| Local-only operation fully supported | ✅ |

---

## Test Suite

**File:** `tests/build-024-mvp-release.test.tsx`  
**Tests:** 40 across 7 describe blocks

| Describe block | Count |
|----------------|-------|
| App metadata | 3 |
| First launch onboarding | 6 |
| Onboarding types and validators | 8 |
| Vault normalization with onboarding | 5 |
| OnboardingFlow UI | 8 |
| Pilot feedback | 6 |
| Security invariants | 4 |

---

## Completion Gate

| # | Check | Required |
|---|-------|----------|
| 1 | TypeScript passes | ✅ Required |
| 2 | Full test suite passes | ✅ Required |
| 3 | Security boundary scan passes | ✅ Required |
| 4 | Production build passes | ✅ Required |
| 5 | All PR checks pass | ✅ Required |
| 6 | Zero critical security findings | ✅ Required |
| 7 | Zero high security findings | ✅ Required |
| 8 | Existing vault fixtures migrate | ✅ Required |
| 9 | Post-merge `main` workflows pass | ✅ Required |
| 10 | Release candidate tag `v0.1.0-rc.1` created | ✅ Required |

---

## Files Changed

| File | Change |
|------|--------|
| `src/constants.ts` | BUILD → `'024'`, APP_VERSION added |
| `package.json` | version → `'0.1.0-rc.1'` |
| `src/localData.ts` | onboarding + pilotFeedback fields |
| `src/types/index.ts` | onboarding + pilotFeedback re-exports |
| `src/hooks/useVault.ts` | 4 new vault callbacks |
| `src/App.tsx` | Onboarding guard, feedback panel, review |
| `src/types/onboarding.ts` | NEW — onboarding types |
| `src/types/pilotFeedback.ts` | NEW — pilot feedback types |
| `src/features/onboarding/OnboardingFlow.tsx` | NEW — 12-step UI |
| `src/features/onboarding/index.ts` | NEW — exports |
| `src/features/pilot/PilotFeedbackPanel.tsx` | NEW — feedback CRUD UI |
| `src/features/pilot/index.ts` | NEW — exports |
| `tests/build-024-mvp-release.test.tsx` | NEW — 40 tests |
| `tests/sync/build-021-sync-convergence.test.ts` | BUILD assertion → `'024'` |
| `docs/releases/MVP_RELEASE_CANDIDATE.md` | NEW |
| `docs/guides/OPERATOR_ONBOARDING.md` | NEW |
| `docs/guides/BACKUP_AND_RECOVERY.md` | NEW |
| `docs/pilot/OPERATOR_PILOT_PLAN.md` | NEW |
| `docs/pilot/PILOT_SUCCESS_CRITERIA.md` | NEW |

---

## Build 025 Readiness Criteria

Build 025 may begin when:

1. All Build 024 checks pass
2. Post-merge `main` CI is green
3. Release candidate tag `v0.1.0-rc.1` is created
4. Pilot is either underway or operator has declared readiness
5. Build 025 scope is defined based on pilot feedback
