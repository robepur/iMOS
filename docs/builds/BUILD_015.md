# BUILD 015 — Operator Understanding Review and Correction Center

## Purpose

Build 015 adds the operator-facing review layer between proposed cognitive signals and any future personalization eligibility.

Rosie proposes. The operator decides.

## Operator value

- Clear review queue of proposed understandings
- Explicit confirm/correct/reject/expire actions
- Explainable provenance and evidence surfaces
- Deterministic prevention of duplicate and unchanged reappearance

## Architecture

- `src/services/UnderstandingReviewService.ts`
  - Consent + permission enforcement (`validateSourceSignal`)
  - Signal-to-understanding conversion (`createProposedUnderstanding`)
  - Lifecycle transitions (`confirmUnderstanding`, `correctUnderstanding`, `rejectUnderstanding`, `expireUnderstanding`)
  - Material evidence checks (`hasMateriallyNewEvidence`)
  - Signature deduplication and reappearance blocking
  - Explainability output (`explainUnderstanding`)
- `src/features/cognition/UnderstandingReviewCenter.tsx`
  - Pending/confirmed/corrected/rejected/expired/all views
  - Action controls with terminal-action confirmations
  - Progressive disclosure for evidence/provenance/history
- `src/App.tsx`
  - Deterministic conversion pass from proposed signals to proposed understandings
  - `UNDERSTANDINGS` topbar control and review center mount
- `src/hooks/useVault.ts`
  - Persistence mutations for understanding review state

## Consent enforcement

Every conversion validates:

- Consent exists and is structurally valid
- Consent status is `on`
- `understanding_dashboard` feature surface is permitted
- Data category permission allows the source signal category
- Signal is proposed and complete
- Rule ID and rule version are recognized
- Evidence count meets deterministic threshold
- Provenance is complete

On failure, operation is denied (fail-closed).

## Signal conversion

Proposed signals are converted only when all validation passes.

Each understanding is persisted with:

- Source signal id + signal type + source signal status
- Evidence ids + evidence count
- Rule id + rule version
- Confidence basis
- Provenance
- Material evidence signature
- Review history (append-only)
- Personalization eligibility flag (false by default)

## Understanding model

`OperatorUnderstanding` was extended additively with:

- `sourceSignalId`
- `signalType`
- `evidenceCount`
- `sourceSignalStatus`
- `reviewHistory`
- `materialEvidenceSignature`
- `personalizationEligible`

## Lifecycle

Enforced transitions:

- `observed -> proposed`
- `proposed -> operator_confirmed | operator_corrected | operator_rejected | expired`
- `operator_corrected -> operator_confirmed | operator_rejected`
- `operator_confirmed -> operator_corrected | operator_rejected | expired`
- `expired -> proposed` only when materially new evidence exists
- `operator_rejected` is terminal

Invalid transitions preserve prior state.

## Materially new evidence

A re-proposal is considered materially new if at least one is true:

- A new evidence id exists
- Rule version changed
- Observation context adds qualifying evidence

Not materially new:

- Reordered identical evidence
- Timestamp-only change
- Regenerated unchanged signal

## Confirmation

Confirmation is explicit only. It:

- Sets state to `operator_confirmed`
- Appends review event
- Preserves source provenance/evidence link
- Marks `personalizationEligible = true`

## Correction

Correction:

- Requires replacement statement
- Appends correction history with original + corrected statements
- Appends review event
- Sets state `operator_corrected`
- Keeps eligibility false until separate confirm action

## Rejection

Rejection:

- Requires explicit terminal action
- Sets state `operator_rejected`
- Appends review event
- Stores material evidence signature in `rejectedUnderstandingSignatures`
- Blocks unchanged silent reappearance

## Suppression

Signal suppression remains separate from understanding rejection:

- Suppression hides source signal from active review flow
- Rejection records operator disagreement with the understanding

## Expiration

Expiration is deterministic and stateful:

- Sets state `expired`
- Records `expiredAt`
- Appends review event

Expired records do not become personalization-eligible.

## Duplicate prevention

Stable `materialEvidenceSignature` prevents duplicate understandings from unchanged evidence.

Review history remains append-only.

## Evidence inspection

Review center exposes:

- What Rosie noticed
- Why she noticed it
- Evidence count
- Rule + version
- Source signal status
- Provenance summary
- Review/correction history counts

No secret vault values are exposed.

## User interface

- New cognition-integrated review center panel
- Status-based filtering and progressive detail expansion
- Explicit terminal-action confirmations (reject/expire)
- Responsive card-based layout aligned with existing iMOS visual system

## Persistence

Additive `PersonalData` fields:

- `rejectedUnderstandingSignatures: string[]`
- `understandingReviewAudit: UnderstandingReviewEvent[]`

Safe defaults hydrate to empty arrays.

## Migration

Builds 003–014 remain compatible.

Migration behavior:

- Additive
- Deterministic
- Idempotent
- Fail-closed for malformed review audit entries

## Recovery

Understanding review state persists in encrypted vault backups via normal vault persistence path.

## Security boundaries

Build 015 keeps all Zero Trust limits:

- No external services
- No network primitives
- No telemetry
- No plaintext persistence
- No secret extraction
- No autonomous authority expansion
- No behavior personalization in this build

## Tests

New:

- `tests/cognition/review.test.ts` (Build 015 service behavior)

Expanded:

- `tests/migration/compatibility.test.ts` (Build 015 fields)
- `tests/fixtures/compatibilityVaults.ts` (Build 015 fixtures)

Validation results:

- `pnpm install` ✅
- `pnpm run build` ✅
- `pnpm test` ✅ (262/262)
- `pnpm run test:migration` ✅ (44/44)
- `pnpm run test:missions` ✅ (14/14)
- `pnpm run test:recovery` ✅ (7/7)
- `pnpm run test:security-boundaries` ✅
- `pnpm run test:performance` ✅ (1/1)

## Known limitations

- Build 015 marks confirmed understandings as future-eligible only; no consumption path is active.
- Source-signal evidence inspection currently shows safe metadata and summary context, not deep record rendering.
- No cross-device/cloud understanding sync in this build.

## Build 016 handoff

Build 016 can consume only `operator_confirmed` + `personalizationEligible` understandings under a separate approval gate. Build 015 intentionally does not modify briefing, mission, recommendation, review ordering, or UI density behavior.

