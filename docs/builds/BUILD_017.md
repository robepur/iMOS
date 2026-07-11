# BUILD 017 — Provider-Neutral Connectivity Policy Foundation

## Purpose

Build 017 introduces a deterministic, fail-closed, provider-neutral authorization foundation for future controlled networking without implementing transport, provider connectors, identity, synchronization, or outbound actions.

## Architecture

Build 017 adds three inert layers:

1. **Connectivity contracts** (`src/types/connectivity.ts`)
2. **Deterministic in-memory registry** (`src/services/ConnectivityPolicyRegistry.ts`)
3. **Pure policy evaluator + audit/cancellation contracts** (`src/services/ConnectivityPolicyEvaluator.ts`)

An inert transport interface is defined in `src/services/ConnectivityTransport.ts` with no runtime implementation.

## Trust boundaries

- Default deny for all requests.
- Core domain services remain network-independent.
- React/UI components remain prohibited from direct networking.
- No production endpoint configuration is shipped.
- Authorization requires registered adapter + enabled capability + rule match.
- Responses are treated as untrusted input contracts only; no execution path exists in this build.

## Included scope

- capability and adapter identifiers/versions
- request purpose and data-classification contracts
- origin/path/method policy contracts
- timeout and redirect policy contracts
- deterministic policy decisions with reason codes
- cancellation-state contracts
- privacy-preserving audit-event contracts
- fail-closed registry validation
- Build 017 security and policy test coverage

## Excluded scope

- real network transport or runtime request execution
- cloud sync implementation
- operator accounts/device enrollment
- identity provider/OAuth/token acquisition or persistence
- Microsoft Graph and provider integrations
- financial/media provider integrations
- outbound actions
- telemetry expansion
- connector UI/login/setup flows

## Data model

No `PersonalData` schema or migration changes were introduced in Build 017.

## Policy-decision lifecycle

1. Request descriptor submitted to evaluator.
2. Registry validation checked; invalid registry fails closed.
3. URL normalized and validated (absolute URL, protocol, hostname, port, path, credentials, fragments).
4. Adapter + capability existence and enabled state validated.
5. Rule matching for method, purpose, data classification, origin, path.
6. Timeout contract validated.
7. Structured allow/deny decision returned with deterministic reason code.
8. Optional redacted audit event emitted by contract helper.

## Registry behavior

- Starts empty.
- No adapter enabled by default.
- Duplicate registration rejected.
- Malformed declarations rejected.
- Capability declarations require known adapter.
- Deterministic sorted snapshot enumeration.
- Snapshot is frozen and cannot mutate internal registry state.

## URL normalization and validation rules

- Reject malformed URLs.
- Reject malformed percent encoding.
- Reject protocol-relative URLs.
- Reject embedded credentials.
- Reject URL fragments.
- Reject unsupported protocols.
- Reject control characters, leading/trailing whitespace, and backslash URL forms.
- Normalize protocol/host/port/path before matching.
- Canonicalize hostnames (case/trailing-dot normalization).
- Exact hostname matching prevents prefix/suffix confusion.
- Path traversal denied.
- Encoded path-bypass attempts denied.
- Local/private/link-local/loopback destinations are denied by default in Build 017.

## Redirect handling

- Redirect targets are evaluated as independent authorization decisions.
- Redirect policy supports deny or revalidate.
- Unsafe/undeclared redirect targets are denied.

## Cancellation and timeout semantics

Build 017 models deterministic cancellation outcomes for:

- operator cancellation
- capability revocation
- adapter disablement
- shutdown
- timeout

Capability revocation and adapter disablement immediately prevent new authorizations.

## Audit redaction

Audit contract excludes:

- credentials
- tokens
- payload content
- query values
- response content

Audit contract stores redacted URL form (origin + path), attribution, and reason code only.

## Security analysis

- Existing direct-networking security scan remains enforced (`scripts/security-boundary-check.mjs`).
- Build 017 adds contract-level tests proving fail-closed policy behavior and no production endpoint declarations.
- No provider SDKs, auth flows, token logic, telemetry, or transport libraries added.

## Migration analysis

- No migration required.
- Builds 003–016A compatibility preserved.
- No external side effects introduced during load or normalization.

## Rollback

Rollback is safe and data-compatible because Build 017 introduces only inert contracts/services/tests/docs and does not modify persisted data schema.

## Test coverage

`tests/connectivity/policy-foundation.test.ts` validates:

- default-deny behavior
- unknown adapter/capability handling
- enable/disable/revocation behavior
- origin/protocol/port/path/method/purpose/data-classification enforcement
- malformed/protocol-relative/credential URLs
- traversal and encoded bypass attempts
- adversarial hostname/IP/protocol/redirect input cases
- redirect revalidation behavior
- deterministic decisions and registry enumeration
- audit redaction
- no production endpoint declarations
- no real external request execution
- direct networking prohibition remains active

`tests/security/network-boundaries.test.ts` now also verifies Build 017 transport remains contract-only.

## Known limitations

- No transport implementation exists by design.
- No provider adapter implementations exist by design.
- No runtime policy inspection UI exists in this build.
- Request execution, identity, sync, and provider onboarding remain out of scope for later builds.

## Definition of done

Build 017 is complete when:

- policy evaluation is deterministic and fail-closed
- registry validation is deterministic and fail-closed
- networking remains denied by default
- redirect targets require independent authorization
- audit contracts redact sensitive information
- no real transport exists
- no production endpoint exists
- security boundaries remain intact
- local-only behavior remains unchanged
- required validation suite passes

## Release-gate checklist

- [x] deterministic policy evaluator
- [x] deny-by-default behavior
- [x] provider-neutral capability/adapter contracts
- [x] in-memory registry with validation and deterministic enumeration
- [x] redirect revalidation contract
- [x] cancellation/timeout contracts
- [x] redacted audit contracts
- [x] no persisted schema change
- [x] no real networking implementation
- [x] no production endpoints
- [x] security-boundary tests preserved
- [x] full required validation suite executed

## Confirmation

Build 017 contains no real networking transport, no real external request execution path, and no provider-specific integration runtime.
