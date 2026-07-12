# BUILD 020: Sync Key Architecture and Device Identity Hardening

## Purpose

Build 020 establishes the minimum cryptographic key architecture required for reliable encrypted synchronization across operator approved devices.

## Scope implemented

1. Operator controlled sync root derivation through PBKDF2 SHA 256
2. Deterministic namespace key derivation through HKDF SHA 256
3. Unique AES 256 GCM object data keys
4. Authenticated object key wrapping bound to hierarchy, namespace, object, key identifiers, and creation time
5. Recovery descriptor validation with no recovery secret or raw key persistence
6. Device bound signed key grants
7. Active trust validation for grant issuer and recipient
8. Private handle binding validation before grant authorization
9. Negative tests for incorrect recovery secrets, metadata tampering, signature tampering, and revoked devices

## Key hierarchy

The Build 020 hierarchy is:

Operator recovery secret

PBKDF2 root material

HKDF namespace wrapping key

Unique object data key

Encrypted sync envelope

The recovery secret and root material are never included in descriptors, wrapped key records, grants, logs, or transport payloads.

## Multi device authorization

A trusted device may issue a short lived signed grant to another active trusted device.

The grant authorizes the recipient to participate in the same key hierarchy after the operator supplies the correct recovery secret locally. The grant does not carry the recovery secret or root key material.

Grant validation fails closed when:

1. The hierarchy does not match
2. The issuer is not active and trusted
3. The recipient is not active and trusted
4. The grant is expired or created too far in the future
5. The recipient binding is wrong
6. The signature is invalid
7. The issuer identity cannot be resolved

## Security boundaries

1. No new network primitive
2. No provider SDK
3. No hosted identity assumption
4. No OAuth or connector token
5. No exportable device private key
6. No automatic remote vault mutation
7. Sync remains disabled by default through the Build 019 transport control
8. Existing default deny connectivity policy remains unchanged

## Migration and rollback

Build 020 is additive.

Existing Build 019 envelopes and local vaults remain readable. The new hierarchy descriptor and wrapped key contracts do not modify existing vault persistence. Rollback does not require data transformation.

## Acceptance gates

1. Correct recovery secret deterministically restores the hierarchy
2. Incorrect recovery secret is rejected
3. Object keys are unique and nonextractable after creation and restore
4. Wrapped key metadata tampering fails authentication
5. Signed grants validate only for trusted active devices
6. Revoked devices cannot authorize key access
7. Existing Build 019 security boundaries remain intact
8. Full CI must pass before merge

## Deferred to Build 021

1. Deterministic conflict resolution
2. Object version convergence
3. Replay safe synchronization state machine
4. Quarantine behavior for conflicting histories
5. Multi device end to end synchronization orchestration
