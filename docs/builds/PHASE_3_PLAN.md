# Phase 3 Planning Foundation

## Status

Ready for architecture review. No Phase 3 application code is authorized by this document.

## Purpose

Phase 3 extends iMOS from deterministic mission execution support into a disciplined cognitive efficiency platform. Rosie will help the operator think, review, decide, and adapt with greater clarity while preserving the local-only Zero Trust architecture established in Phases 1 and 2.

## Operator Value

Phase 3 must reduce cognitive friction, improve follow-through, surface useful patterns earlier, and strengthen operator confidence without reducing operator authority.

Phase 3 must answer four questions:

1. What is consuming the operator's attention?
2. How does the operator prefer to understand and decide?
3. Where is execution friction recurring?
4. What support would improve clarity without taking control?

## Rosie Relationship Objective

Rosie must become a trusted cognitive partner. Trust is relational, earned, and reversible. It must result from transparent behavior, explicit operator control, explainable recommendations, correction handling, predictable outputs, privacy preservation, and dependable restraint.

Rosie must never represent confidence, trust, understanding, or agreement that is not supported by inspectable evidence.

## Cognitive Efficiency Objective

Rosie may learn how the operator thinks only through operator-authored local records, explicit operator preferences, and deterministic interaction outcomes.

Permitted learning dimensions are:

- information density preference
- summary versus detail preference
- decision framing preference
- planning sequence preference
- review timing preference
- recurring cognitive friction
- correction history
- recommendation response history
- preferred evidence depth
- operator-defined working patterns

Phase 3 must not infer sensitive identity, health, emotion, intent, personality diagnosis, political belief, protected status, or psychological condition.

## Cognitive Contract

Every persisted operator understanding must contain:

- a plain-language statement
- the evidence records used
- the deterministic rule used
- creation and update timestamps
- confidence derived only from evidence quantity and consistency
- the operator's confirmation state
- correction history
- the feature surfaces allowed to use it
- the schema and rule version that produced it

No understanding may be treated as fact merely because Rosie generated it.

Understanding states are:

- observed
- proposed
- operator confirmed
- operator corrected
- operator rejected
- expired

Only operator-confirmed understandings may materially personalize planning or briefing behavior. Proposed understandings may be displayed for review but must not silently change system behavior.

## Authority Boundaries

- Rosie may observe and summarize permitted encrypted local records after vault unlock.
- Rosie may generate deterministic recommendations, reviews, and planning support.
- Rosie may ask the operator to confirm or correct a proposed understanding.
- Rosie may not expand its own authority.
- Rosie may not activate missions, execute actions, change secrets, or modify critical records without explicit operator approval.
- Rosie may not use trust as a reason to bypass approval.
- Operator decisions remain final and override all Rosie suggestions.

## Zero Trust Requirements

- local browser-only execution
- encrypted vault persistence only
- AES-256-GCM protected vault data
- PBKDF2-SHA256 key derivation
- passphrase held in memory only
- explicit verification before every protected mutation
- least privilege between cognition, mission, vault, recovery, and secret capabilities
- fail closed on invalid, missing, stale, or tampered state
- no backend, cloud, telemetry, external AI, or third-party services
- no hidden background synchronization or outbound network capability
- auditable local provenance for every persisted understanding and correction

## Data Boundaries

Phase 3 may use:

- priorities
- commitments
- decisions
- reflections
- review history
- understanding history
- mission records
- deterministic recommendation outcomes
- explicit operator preferences
- explicit corrections and confirmations

Phase 3 must not use:

- secret values
- usernames or passwords from secret records
- passphrases
- recovery material
- raw credential contents
- clipboard contents
- unrelated browser activity
- device surveillance
- external data

Derived Phase 3 data must remain encrypted inside the vault. It must be reconstructable or safely discardable unless operator corrections must be preserved for safety and continuity.

## Privacy Protections

- no plaintext persistence of operator data
- no export without explicit operator action
- no hidden data collection
- no silent enrichment from external sources
- no cross-device sharing
- no dark patterns encouraging consent
- no reduction in core functionality when optional learning is disabled
- no use of relationship or trust language to pressure the operator

## Operator Consent Requirements

- Phase 3 learning is off until the operator receives a clear explanation and enables it
- consent must be specific, informed, reversible, and recorded locally
- learning surfaces must remain visible and operator discoverable
- persisted learning and feedback state must be explained before creation
- the operator must be able to inspect, confirm, correct, reject, reset, export, or disable learning
- disabling learning must stop new signal capture immediately
- reset must require explicit confirmation and produce a local audit event
- no behavioral capture beyond permitted local application interactions and operator-authored vault content

## Explainability Requirements

Every Rosie cognition output must answer:

1. What did Rosie notice?
2. What evidence was used?
3. What deterministic rule was applied?
4. How confident is the result and why?
5. What can the operator do about it?
6. Where can the operator correct or disable it?

No hidden inference score may affect operator-facing behavior.

## Trust Safeguards

- trust is not a numeric score assigned to the operator
- the operator must never be ranked, graded, diagnosed, or manipulated
- Rosie must acknowledge uncertainty
- repeated disagreement must reduce reliance on the affected rule
- correction must change future behavior predictably
- rejected understandings must not silently reappear without materially new evidence
- stale understandings must expire or return to proposed state
- trust-related records must never unlock authority

## Fail Closed Behavior

- invalid Phase 3 state must not partially apply
- migration gaps must default to safe empty structures
- corrupted cognitive records must not unlock personalization or authority
- missing provenance invalidates an understanding
- unknown rule versions must not be executed
- any validation failure must preserve the last known valid vault state

## Measurable Outcomes

Phase 3 success will be evaluated locally through operator-controlled measures:

- fewer corrections required over time
- lower recommendation dismissal caused by irrelevance
- improved completion of operator-approved mission steps
- reduced repeated decision reopening
- reduced overdue commitment recurrence
- operator-confirmed usefulness of briefings and reviews
- stable or reduced time required to reach an operator decision

Metrics must never become operator performance scores. They are diagnostic signals for Rosie quality only.

## Phase 3 Build Sequence

1. Build 013: Cognitive Contract, Consent, and Schema Foundation
2. Build 014: Deterministic Cognitive Signal Engine
3. Build 015: Operator Understanding Review and Correction Center
4. Build 016: Adaptive Briefing and Planning Presentation
5. Build 017: Trust, Usefulness, and Drift Review
6. Build 018: Phase 3 Integrity, Migration, Recovery, and Release Gate

Each build requires its own branch, tests, documentation, pull request, and approval gate.

## Build 013 Definition

Build 013 establishes the safety and data foundation only.

Authorized scope:

- additive Phase 3 schema types
- compatibility normalization
- cognition consent state
- understanding lifecycle states
- evidence and rule provenance
- correction and rejection history
- allowed-use declarations
- validation services
- deterministic migration fixtures
- security and authority tests
- operator-facing consent and inspection surfaces

Not authorized:

- adaptive behavior
- automated personalization
- mission modification
- autonomous execution
- external AI
- network services
- hidden observation
- trust scoring
- psychological or sensitive inference

Build 013 acceptance gate:

- consent defaults off
- no Phase 3 signal capture before consent
- every persisted understanding validates provenance
- operator can inspect, correct, reject, reset, and disable
- unknown or corrupt state fails closed
- Builds 003 through 012 remain compatible
- backup and recovery preserve valid Phase 3 state
- secrets remain excluded
- Phase 2 regression suite remains green
- no network primitive is introduced
- manual responsive validation shows no overlap or unintended wrapping

## General Acceptance Criteria

- Rosie support measurably improves operator review and planning clarity using deterministic local-only logic
- every Phase 3 surface is explainable, reversible, and operator controlled
- every behavioral adaptation requires an operator-confirmed understanding
- no secret value or recovery data enters cognition outputs
- Builds 003 through 012 vaults remain compatible
- Phase 2 capabilities remain intact
- learning-disabled mode remains fully functional
- operator correction produces a predictable and testable change

## Security Test Requirements

- boundary scan confirms no new network primitives
- vault encryption and passphrase handling remain unchanged
- secret exclusion tests cover recommendations, graphs, evidence, logs, timelines, and cognition
- tamper, invalid-state, stale-rule, and downgrade handling fail closed
- authority tests confirm Rosie cannot self-authorize actions
- consent tests confirm no capture or persistence before enablement
- reset and disable tests confirm immediate enforcement
- provenance tests reject unsupported understandings

## Migration Requirements

- additive schema changes only unless a proven safe migration path exists
- normalization must preserve operator data from Builds 003 through 012
- missing Phase 3 fields hydrate deterministically with safe defaults
- no migration may discard review, understanding, mission, correction, or feedback history
- migrations must be idempotent
- downgrade behavior must preserve pre-Phase 3 records and fail safely on unsupported Phase 3 structures

## Rollback Requirements

- Phase 3 features must be disableable without corrupting vault state
- persisted Phase 3 structures must degrade safely when absent
- rollback must preserve all pre-Phase 3 operator records
- rollback must not reactivate rejected understandings
- a pre-implementation backup and tested recovery path are required before each schema release

## Definition of Done

Phase 3 implementation is complete only when Rosie improves operator cognitive efficiency through deterministic, explainable, consent-based local behavior while preserving Zero Trust security, backward compatibility, operator authority, correction, privacy, and full reversibility.

Phase 3 planning is approved only after this document is reviewed and accepted. Build 013 application work must not begin before that approval.
