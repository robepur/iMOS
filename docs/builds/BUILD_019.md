# BUILD 019 — Encrypted Sync Transport and Quarantine Foundation

## Purpose

Build 019 introduces a provider-neutral encrypted sync transport foundation with strict policy enforcement, signed request contracts, replay defenses, deterministic local reference behavior, and quarantine-first failure handling.

## Scope implemented

1. Sync protocol contracts and schema (`src/types/sync.ts`)
2. Envelope encryption/decryption service (`src/services/SyncEnvelopeService.ts`)
3. Protocol validation and signed request verification (`src/services/SyncProtocolService.ts`)
4. Local deterministic reference sync service (`src/services/LocalReferenceSyncService.ts`)
5. Quarantine store for malformed/untrusted remote payloads (`src/services/SyncQuarantineService.ts`)
6. Capability-gated transport adapter (`src/services/SyncTransportAdapter.ts`)
7. Orchestrator service that combines validation, transport, and quarantine (`src/services/SyncService.ts`)
8. Additive persistence defaults for operator sync controls and quarantine (`src/localData.ts`)

## Build 019 boundaries

- Transport remains disabled by default.
- Only local loopback endpoints (`localhost` / `127.0.0.1`) are allowed for Build 019.
- No cloud SDK is introduced in client/runtime code.
- No OAuth, hosted identity, connector auth, token persistence, or provider API logic is introduced.
- No plaintext vault payload is uploaded by transport contracts.
- No automatic vault mutation occurs from remote responses.

## Azure decision and portability

Azure hosting is treated as an external deployment decision, not a client protocol dependency.

- Build 019 client protocol and envelope contracts are provider-neutral.
- Provider selection remains deferred to hosted rollout gates.
- Build 019 runtime code does not include Azure SDK coupling.

## Server-visible metadata envelope

Build 019 defines a minimum visible metadata envelope:

- namespace
- object identifier
- object version and optional parent version
- protocol/envelope/schema/crypto versions
- ciphertext byte length
- ciphertext digest (derived from ciphertext bytes, not plaintext)
- request id and replay id
- created and expiry timestamps
- tombstone flag

Any envelope expansion is a reviewed architecture change.

## Security model

- Deny-by-default capability/adapter policy gates every request.
- Fetch usage is constrained to one approved adapter file and enforced by security boundary scan exceptions.
- Redirects are denied by policy.
- Requests are signed with Build 018 device identity and validated before decrypt.
- Downloaded envelopes are verified against the actual trusted signer identity, not assumed to be local-only.
- Replay IDs are one-time use with expiry.
- Remote responses are treated as untrusted input and can be quarantined.
- Sync remains operator-controlled and disabled by default.
- Persisted envelope reads do not burn replay state merely by being downloaded again.

## Migration and rollback

- Persistence changes are additive only (`syncOperatorControlState`, `syncQuarantine`).
- Defaults preserve existing behavior with networking disabled.
- Existing vaults load without operator action.
- Rollback remains data-compatible; unknown additive fields are ignorable.

## Limitations

- No production endpoint is configured.
- No hosted synchronization workflow is activated.
- No multi-device enrollment flow is started.
- No Build 020 behavior is implemented.
