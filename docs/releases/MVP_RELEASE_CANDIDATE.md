# iMOS MVP Release Candidate

**Version:** 0.1.0-rc.1  
**Build:** 024  
**Status:** Release Candidate  
**Date:** 2026-07-12

---

## What This Is

iMOS 0.1.0-rc.1 is the first formal release candidate of the Individual Mission Operating System. It packages all features from Builds 003–024 into a stable, tested artifact suitable for controlled operator pilot use.

---

## Release Criteria — All Satisfied

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Application identifies itself as iMOS MVP RC | ✅ `APP_VERSION = '0.1.0-rc.1'` |
| 2 | Build constant advances to `024` | ✅ `BUILD = '024'` |
| 3 | Version consistent across metadata and docs | ✅ `package.json` + `constants.ts` |
| 4 | No test fixtures, dev credentials, or debug secrets in production | ✅ |
| 5 | Local-only mode is default | ✅ `syncEnabled = false` |
| 6 | Synchronisation disabled by default | ✅ |
| 7 | No hosted provider integration | ✅ |
| 8 | No outbound action capability | ✅ |
| 9 | Existing vaults remain compatible | ✅ Builds 003–023 fixtures pass |
| 10 | Recovery remains deterministic | ✅ Build 022 recovery tests pass |
| 11 | Failed upgrades preserve previous valid vault | ✅ Migration fallback tested |

---

## Included Capabilities

### Core Vault (Builds 003–016)
- AES-256-GCM encrypted local vault
- Priorities, commitments, decisions, reflections
- Secrets manager (encrypted credentials)
- Rosie daily briefing and recommendations
- Mission planner
- Knowledge graph
- Recovery console with backup/restore
- Passphrase rotation

### Phase 4 Sync Foundation (Builds 017–023)
- Deny-by-default connectivity policy (Build 017)
- Device identity and trust registry (Build 018)
- Encrypted sync transport foundation (Build 019)
- Sync key architecture (Build 020)
- Deterministic conflict engine (Build 021)
- Recovery-safe synchronization (Build 022)
- Operator sync review interface (Build 023)

### MVP Release Gate (Build 024)
- Operator onboarding flow (12-step, pausable, resumable)
- Recovery backup required before onboarding completes
- Pilot feedback capture (private, local, deletable)
- Pilot measurements (private, never transmitted, non-ranking)

---

## What Is Not In This Release

| Deferred | Rationale |
|----------|-----------|
| Production sync provider | Provider selection criteria not yet met |
| Cloud account management | Requires hosted sync provider |
| OAuth / identity provider | Phase 5 item |
| Financial data connectors | API availability not confirmed |
| Multi-device production sync | Foundations proven; hosted transport deferred |
| Plugin/module platform | Premature without connector authority |

---

## Security Posture

- Zero critical findings
- Zero high findings
- No plaintext secrets in logs
- No private key export path
- No provider credentials in codebase
- No production endpoint
- Default deny networking enforced
- Operator decisions require explicit confirmation
- Pilot feedback is private and deletable

---

## Tagging

The release candidate tag `v0.1.0-rc.1` must be created **after** post-merge CI passes on `main`. Do not tag draft or pre-merge state.
