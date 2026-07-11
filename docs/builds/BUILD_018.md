# BUILD 018 — Local Device Identity and Enrollment Foundation

## Purpose

Build 018 establishes a provider-neutral, local-first cryptographic device identity foundation for operator-controlled enrollment, trust inspection, suspension, revocation, replacement, and signed-message validation.

## Architecture

Build 018 introduces local-only identity components:

1. **Identity contracts** (`src/types/deviceIdentity.ts`)
2. **Cryptographic identity service** (`src/services/DeviceIdentityService.ts`)
3. **Deterministic replay protection contract** (`src/services/ReplayProtectionRegistry.ts`)
4. **Deterministic trust registry + lifecycle state machine** (`src/services/DeviceTrustRegistry.ts`)
5. **Signed message validation contract** (`src/services/DeviceMessageValidator.ts`)

No transport, sync, provider SDK, account system, or network runtime is implemented.

## Identity separation

Build 018 keeps identities distinct:

- **Operator identity**: local authority only; no hosted account binding.
- **Device identity**: local cryptographic installation identity (key pair, derived identifier, fingerprint).
- **Connector identity**: out of scope.
- **Future hosted identity**: out of scope; provider-neutral only.

## Trust model

- Enrollment is always explicit and starts untrusted.
- Proof of possession is required but is not approval.
- Operator approval is separate and mandatory.
- Trusted state requires explicit lifecycle progression: `proposed -> proof_verified -> operator_approved -> active`.
- Revocation is terminal for a device identifier.
- Suspension is distinct from revocation.
- Signed message acceptance requires **all** of: valid signature, trusted active signer, expected purpose, freshness, nonce replay protection, and valid registry state.

## Cryptographic choices

- **Algorithm**: ECDSA P-256 with SHA-256 (`ECDSA_P256_SHA256`).
- **Why suitable**: browser-supported Web Crypto asymmetric signing with non-extractable private keys.
- **Key usages**: private `sign`, public `verify`.
- **Public-key serialization**: SPKI Base64.
- **Identifier derivation**: SHA-256 over canonical public identity material (`spki`, key version, suite version), base64url encoded with `device:` prefix.
- **Fingerprint derivation**: SHA-256 over SPKI, rendered as short human-verifiable hex groups.
- **Signature encoding**: Base64 over Web Crypto signature bytes.
- **Versioning**: explicit package/challenge/proof/message/schema/policy versions.
- **Algorithm agility**: versioned suite fields and explicit rejection of unsupported suite/version.
- **Browser compatibility**: standard Web Crypto APIs used by existing project architecture.
- **Limitations**: no cross-device key transport, no hardware-key attestation, no hosted trust anchor yet.

## Private-key protection

- Private keys are generated with `extractable: false`.
- Public identity APIs return only public identity plus opaque key references (not key bytes).
- Private keys are never included in enrollment packages, audits, or message payload contracts.
- Private keys are not serialized to JSON and are not stored in localStorage.
- Durable private-key storage uses local IndexedDB CryptoKey records when available, bound to matching public identity metadata.
- If durable key storage is unavailable or binding checks fail, identity use fails closed (no silent replacement identity generation).

## Identifier and fingerprint derivation

- Deterministic canonical material ensures same public key material yields same identifier/fingerprint.
- Key changes produce new identifier/fingerprint.
- Validation rejects identifier/fingerprint mismatches.

## Canonical encoding

- Canonical serializer sorts object keys recursively and normalizes strings to NFC.
- Canonical encoding rejects unsupported/ambiguous values (`undefined`, non-finite numbers, `-0`, symbols, functions, bigint, non-plain objects, cyclic graphs).
- Canonical payloads are used for package digests, proof challenges, and signed message payloads.
- Domain separation is applied for proof challenges and signed message purposes.
- Canonicalization is stable across object insertion order and JSON whitespace formatting.

## Enrollment package

Versioned, provider-neutral package includes:

- package version
- device identifier
- SPKI public signing key
- cryptographic suite and key version
- fingerprint
- proposed label
- created and expiration timestamps
- enrollment nonce
- issuer identity
- proof-of-possession-required flag

Package validation rejects expired, malformed, secret-bearing, unsupported-version, mismatched-identity, future-dated, overlong-TTL, and schema-violating packages.

## Proof of possession

Local deterministic flow:

1. Challenge created with bounded lifetime and package digest binding.
2. Enrolling device signs canonical challenge payload.
3. Verifier checks:
   - challenge/proof version
   - challenge purpose/domain
   - challenge expiry
   - future timestamp/skew bounds
   - claimed device identifier binding
   - expected key fingerprint binding
   - package digest and nonce binding
   - signature validity against package public key
   - replay using bounded replay registry

Replay and tampering fail closed.

## Lifecycle transition table

| From | Allowed to |
|---|---|
| proposed | proof_verified, rejected, expired |
| proof_verified | operator_approved, rejected, expired |
| operator_approved | active, rejected, expired |
| active | suspended, revoked, replaced |
| suspended | active, revoked, replaced |
| revoked | _(none)_ |
| replaced | _(none)_ |
| rejected | _(none)_ |
| expired | _(none)_ |

## Operator approval

Operator approval is explicitly required and independently recorded before activation.

## Suspension and revocation

- Suspension blocks authorization until explicit reactivation policy is applied.
- Revocation is terminal and preserves revocation reason and audit history.
- Replacement creates/links a new identity and marks previous identity `replaced`.

## Replay protection

- Local in-memory bounded replay registry tracks message/challenge identifiers until expiration.
- Duplicate keys are rejected.
- Registry prunes expired entries and enforces bounded retention.
- Cross-device replay protection is deferred to future synchronization builds.

## Persistence model

Build 018 introduces no persisted `PersonalData` schema changes.

- Public trust registry and replay protections are deterministic in-memory contracts.
- Durable private-key storage is local runtime storage (IndexedDB CryptoKey store), bound to public identity metadata.
- If persistent key material is missing/corrupt/mismatched/unsupported at load, identity operations fail closed and require explicit operator recovery or replacement flow.

## Migration

- No migration changes required in Build 018.
- Builds 003–017 compatibility remains unchanged.

## Recovery

- Existing vault recovery behavior remains unchanged.
- Device trust records remain local-only.
- Build 018 does not claim encrypted vault backup includes recoverable non-extractable private keys.

## Rollback

- Rollback safety remains high: Build 018 adds contracts/services/tests/docs without persisted schema change.

## UI scope

- Broad Device Trust Center UI is deferred.
- Build 018 provides implementation contracts and tests first, avoiding premature management-surface expansion.

## Security analysis

- No network primitives or production endpoints introduced.
- No provider SDKs/OAuth/cloud/sync libraries introduced.
- Security boundary scan remains active and green.
- Proof/message verification and lifecycle transitions fail closed.
- Registry snapshots are immutable and deterministic.

## Privacy analysis

- Enrollment packages and audits exclude private keys and secret material.
- Local revocation affects local trust state only and does not imply remote propagation.
- No telemetry expansion introduced.

## Limitations

- No hosted identity exists.
- No cloud propagation exists.
- No synchronization exists.
- No connector identity exists.
- No real network transport exists.
- Local revocation affects only current local trust state.
- Build 019 must not assume authority beyond Build 018 contracts.
- Cross-restart durability depends on local browser/runtime support for IndexedDB CryptoKey storage.

## Test coverage

`tests/identity/device-identity-foundation.test.ts` covers:

- identity generation and deterministic representation
- identifier/fingerprint stability and mismatch rejection
- canonicalization stability and fail-closed behavior
- enrollment package validation and secret exclusion
- durable key binding checks and fail-closed reload behavior
- proof-of-possession verification and replay rejection
- lifecycle and authority transitions
- suspension/revocation/replacement semantics
- deterministic registry snapshots and immutability
- signed message verification with trust/purpose/freshness/replay gating
- audit reason codes and secret exclusion checks

Security suite continues to enforce no networking primitives in source.

## Definition of done

Build 018 is complete when:

- device identities are cryptographically generated and versioned
- public/private responsibilities are separated
- enrollment packages remain public-only
- proof-of-possession verifies locally with replay defense
- operator approval remains independently required
- lifecycle transitions are explicit and fail closed
- suspension and terminal revocation are enforced
- replay attempts are rejected in local model
- registry state is deterministic and immutable from callers
- no real networking or cloud behavior is introduced
- durable identity behavior is either available and validated or blocked fail-closed
- required validation suite passes

## Release-gate checklist

- [x] provider-neutral local cryptographic identity contracts
- [x] deterministic canonical identity and package encoding
- [x] enrollment package validation (public-only)
- [x] local proof-of-possession verification with replay protection
- [x] explicit operator-controlled lifecycle transitions
- [x] suspension/revocation/replacement semantics
- [x] deterministic local trust registry with immutable snapshot
- [x] signed message validation requires trust + purpose + freshness + replay checks
- [x] no network transport/provider/auth integration
- [x] durable private-key persistence with fail-closed binding checks
- [x] no persisted schema migration in Build 018
- [x] security boundary checks preserved
