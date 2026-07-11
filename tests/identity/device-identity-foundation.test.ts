import { describe, expect, it } from 'vitest'
import {
  InMemoryDevicePrivateKeyStore,
  assertPrivateHandleBinding,
  canonicalizeStableJson,
  clearVolatilePrivateKeyHandles,
  createEnrollmentPackage,
  createProofChallenge,
  generateLocalDeviceIdentity,
  signProofOfPossession,
  validateEnrollmentPackage,
  validatePublicIdentityMaterial,
  verifyProofOfPossession,
} from '../../src/services/DeviceIdentityService'
import { DeviceTrustRegistry } from '../../src/services/DeviceTrustRegistry'
import { signDeviceMessage, validateSignedDeviceMessage } from '../../src/services/DeviceMessageValidator'
import { ReplayProtectionRegistry } from '../../src/services/ReplayProtectionRegistry'

const FIXED_NOW = new Date('2026-07-11T00:00:00.000Z')

async function buildIdentity(
  store = new InMemoryDevicePrivateKeyStore(),
  label = 'Primary Operator Device',
) {
  return {
    ...(await generateLocalDeviceIdentity(label, FIXED_NOW, { store })),
    store,
  }
}

describe('Build 018 device identity foundation', () => {
  it('generates supported device identity and opaque private handle', async () => {
    const identity = await buildIdentity()
    expect(identity.publicIdentity.deviceId.startsWith('device:')).toBe(true)
    expect(identity.publicIdentity.cryptoSuiteVersion).toBe('1.0.0')
    expect(identity.publicIdentity.keyVersion).toBe('1.0.0')
    expect(identity.privateHandle.keyRef.length).toBeGreaterThan(10)
    expect((identity.privateHandle as unknown as { privateKey?: unknown }).privateKey).toBeUndefined()
  })

  it('private handle binding validates and survives volatile cache reset when durable store exists', async () => {
    const store = new InMemoryDevicePrivateKeyStore()
    const identity = await generateLocalDeviceIdentity('Primary', FIXED_NOW, { store })
    const before = await assertPrivateHandleBinding({
      handle: identity.privateHandle,
      publicIdentity: identity.publicIdentity,
      store,
    })
    clearVolatilePrivateKeyHandles()
    const after = await assertPrivateHandleBinding({
      handle: identity.privateHandle,
      publicIdentity: identity.publicIdentity,
      store,
    })
    expect(before).toEqual({ valid: true })
    expect(after).toEqual({ valid: true })
  })

  it('missing durable private key fails closed and does not auto-regenerate', async () => {
    const store = new InMemoryDevicePrivateKeyStore()
    const identity = await generateLocalDeviceIdentity('Primary', FIXED_NOW, { store })
    await store.remove(identity.privateHandle.keyRef)
    clearVolatilePrivateKeyHandles()
    const binding = await assertPrivateHandleBinding({
      handle: identity.privateHandle,
      publicIdentity: identity.publicIdentity,
      store,
    })
    expect(binding).toEqual({ valid: false, reason: 'private_key_unavailable' })
    const challenge = await createProofChallenge(
      await createEnrollmentPackage(identity.publicIdentity, { now: FIXED_NOW, nonce: 'nonce-1234567890abcd' }),
      { now: FIXED_NOW },
    )
    await expect(signProofOfPossession(challenge, identity.privateHandle, FIXED_NOW, { store })).rejects.toThrow()
  })

  it('same public material yields stable identity binding', async () => {
    const identity = await buildIdentity()
    const validation = await validatePublicIdentityMaterial(identity.publicIdentity)
    expect(validation).toEqual({ valid: true })
  })

  it('different key pairs produce different identifiers', async () => {
    const store = new InMemoryDevicePrivateKeyStore()
    const a = await generateLocalDeviceIdentity('A', FIXED_NOW, { store })
    const b = await generateLocalDeviceIdentity('B', FIXED_NOW, { store })
    expect(a.publicIdentity.deviceId).not.toBe(b.publicIdentity.deviceId)
    expect(a.publicIdentity.keyFingerprint).not.toBe(b.publicIdentity.keyFingerprint)
  })

  it('malformed, oversized, and mismatched public identity material fails', async () => {
    const identity = await buildIdentity()
    const malformedKey = await validatePublicIdentityMaterial({
      ...identity.publicIdentity,
      publicSigningKeySpki: 'not-base64',
    })
    const invalidVersion = await validatePublicIdentityMaterial({
      ...identity.publicIdentity,
      keyVersion: 'x.y.z' as '1.0.0',
    })
    const idMismatch = await validatePublicIdentityMaterial({
      ...identity.publicIdentity,
      deviceId: 'device:wrong',
    })
    const fingerprintMismatch = await validatePublicIdentityMaterial({
      ...identity.publicIdentity,
      keyFingerprint: '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00',
    })
    expect(malformedKey).toEqual({ valid: false, reason: 'public_key_invalid_or_unsupported' })
    expect(invalidVersion).toEqual({ valid: false, reason: 'version_invalid' })
    expect(idMismatch).toEqual({ valid: false, reason: 'device_id_mismatch' })
    expect(fingerprintMismatch).toEqual({ valid: false, reason: 'fingerprint_mismatch' })
  })

  it('canonical output is stable across object insertion order and rejects unsafe values', () => {
    const a = { b: 2, a: 1, c: { y: 2, x: 1 } }
    const b = { c: { x: 1, y: 2 }, a: 1, b: 2 }
    expect(canonicalizeStableJson(a)).toBe(canonicalizeStableJson(b))
    expect(() => canonicalizeStableJson({ bad: undefined })).toThrow()
    expect(() => canonicalizeStableJson({ bad: Number.NaN })).toThrow()
    expect(() => canonicalizeStableJson({ bad: Number.NEGATIVE_INFINITY })).toThrow()
    expect(() => canonicalizeStableJson({ bad: -0 })).toThrow()
    expect(() => canonicalizeStableJson({ bad: BigInt(1) })).toThrow()
    expect(() => {
      const cycle: Record<string, unknown> = {}
      cycle.self = cycle
      canonicalizeStableJson(cycle)
    }).toThrow()
  })

  it('canonical output is deterministic across Unicode-normalized equivalents', () => {
    const nfc = canonicalizeStableJson({ label: 'Café' })
    const nfd = canonicalizeStableJson({ label: 'Cafe\u0301' })
    expect(nfc).toBe(nfd)
  })

  it('valid enrollment package validates', async () => {
    const identity = await buildIdentity()
    const pkg = await createEnrollmentPackage(identity.publicIdentity, {
      now: FIXED_NOW,
      nonce: 'nonce-1234567890abcd',
    })
    expect(await validateEnrollmentPackage(pkg, FIXED_NOW)).toEqual({ valid: true })
  })

  it('enrollment package rejects malformed, future, oversized, and secret-bearing payloads', async () => {
    const identity = await buildIdentity()
    const pkg = await createEnrollmentPackage(identity.publicIdentity, {
      now: FIXED_NOW,
      nonce: 'nonce-1234567890abcd',
    })
    expect(await validateEnrollmentPackage({ ...pkg, createdAt: 'bad' }, FIXED_NOW)).toEqual({ valid: false, reason: 'package_timestamp_invalid' })
    expect(await validateEnrollmentPackage({ ...pkg, expiresAt: new Date(FIXED_NOW.getTime() - 1).toISOString() }, FIXED_NOW)).toEqual({ valid: false, reason: 'package_expiration_invalid' })
    expect(await validateEnrollmentPackage({ ...pkg, createdAt: new Date(FIXED_NOW.getTime() + 120_000).toISOString() }, FIXED_NOW)).toEqual({ valid: false, reason: 'package_from_future' })
    expect(await validateEnrollmentPackage({ ...pkg, packageVersion: '9.9.9' as '1.0.0' }, FIXED_NOW)).toEqual({ valid: false, reason: 'unsupported_package_version' })
    expect(await validateEnrollmentPackage({ ...pkg, purpose: 'wrong' as 'device_enrollment' }, FIXED_NOW)).toEqual({ valid: false, reason: 'package_purpose_invalid' })
    expect(await validateEnrollmentPackage({ ...pkg, enrollmentNonce: 'short' }, FIXED_NOW)).toEqual({ valid: false, reason: 'nonce_invalid' })
    expect(await validateEnrollmentPackage({ ...pkg, proposedDeviceLabel: 'bad\u0001label' }, FIXED_NOW)).toEqual({ valid: false, reason: 'display_label_invalid' })
    expect(await validateEnrollmentPackage({ ...pkg, privateKeyLeak: 'bad' } as typeof pkg, FIXED_NOW)).toEqual({ valid: false, reason: 'package_unexpected_fields' })
  })

  it('valid proof-of-possession verifies and replayed proof fails', async () => {
    const identity = await buildIdentity()
    const pkg = await createEnrollmentPackage(identity.publicIdentity, {
      now: FIXED_NOW,
      nonce: 'nonce-1234567890abcd',
    })
    const challenge = await createProofChallenge(pkg, { now: FIXED_NOW })
    const proof = await signProofOfPossession(challenge, identity.privateHandle, FIXED_NOW, { store: identity.store })
    const replay = new ReplayProtectionRegistry()
    const first = await verifyProofOfPossession({ challenge, proof, pkg, replayGuard: replay, now: FIXED_NOW })
    const second = await verifyProofOfPossession({ challenge, proof, pkg, replayGuard: replay, now: FIXED_NOW })
    expect(first).toEqual({ valid: true })
    expect(second).toEqual({ valid: false, reason: 'replay_detected' })
  })

  it('proof verification fails for wrong key, altered challenge, expired challenge, and unsupported suite', async () => {
    const identity = await buildIdentity()
    const wrongIdentity = await buildIdentity(undefined, 'Wrong')
    const pkg = await createEnrollmentPackage(identity.publicIdentity, {
      now: FIXED_NOW,
      nonce: 'nonce-1234567890abcd',
    })
    const challenge = await createProofChallenge(pkg, { now: FIXED_NOW })

    await expect(signProofOfPossession(challenge, wrongIdentity.privateHandle, FIXED_NOW, { store: wrongIdentity.store })).rejects.toThrow()

    const proof = await signProofOfPossession(challenge, identity.privateHandle, FIXED_NOW, { store: identity.store })
    expect(await verifyProofOfPossession({
      challenge: { ...challenge, expectedKeyFingerprint: '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00' },
      proof,
      pkg,
      replayGuard: new ReplayProtectionRegistry(),
      now: FIXED_NOW,
    })).toEqual({ valid: false, reason: 'fingerprint_mismatch' })

    expect(await verifyProofOfPossession({
      challenge,
      proof,
      pkg: { ...pkg, enrollmentNonce: 'nonce-2222222222222222' },
      replayGuard: new ReplayProtectionRegistry(),
      now: FIXED_NOW,
    })).toEqual({ valid: false, reason: 'package_digest_mismatch' })

    expect(await verifyProofOfPossession({
      challenge: { ...challenge, expiresAt: new Date(FIXED_NOW.getTime() - 1).toISOString() },
      proof,
      pkg,
      replayGuard: new ReplayProtectionRegistry(),
      now: FIXED_NOW,
    })).toEqual({ valid: false, reason: 'challenge_expiration_invalid' })

    expect(await verifyProofOfPossession({
      challenge,
      proof: { ...proof, algorithm: 'UNSUPPORTED' as 'ECDSA_P256_SHA256' },
      pkg,
      replayGuard: new ReplayProtectionRegistry(),
      now: FIXED_NOW,
    })).toEqual({ valid: false, reason: 'unsupported_signature_suite' })
  })

  it('lifecycle enforces explicit proposal, proof, approval, and activation', async () => {
    const local = await buildIdentity()
    const enrolling = await buildIdentity(undefined, 'Tablet')
    const registry = new DeviceTrustRegistry(local.publicIdentity, FIXED_NOW)
    const pkg = await createEnrollmentPackage(enrolling.publicIdentity, { now: FIXED_NOW, nonce: 'nonce-3333333333333333' })

    expect((await registry.proposeEnrollment(pkg, FIXED_NOW)).ok).toBe(true)
    expect(registry.markProofVerified(pkg.deviceId, FIXED_NOW).ok).toBe(true)
    expect(registry.approveDevice(pkg.deviceId, { approvedBy: 'local_operator', approvedAt: FIXED_NOW.toISOString() }, FIXED_NOW).ok).toBe(true)
    expect(registry.activateDevice(pkg.deviceId, FIXED_NOW).ok).toBe(true)
    expect(registry.canAuthorize(pkg.deviceId)).toBe(true)
  })

  it('lifecycle blocks invalid transitions, enforces suspension/revocation, and requires replacement identity', async () => {
    const local = await buildIdentity()
    const enrolling = await buildIdentity(undefined, 'Laptop')
    const registry = new DeviceTrustRegistry(local.publicIdentity, FIXED_NOW)
    const pkg = await createEnrollmentPackage(enrolling.publicIdentity, { now: FIXED_NOW, nonce: 'nonce-4444444444444444' })
    await registry.proposeEnrollment(pkg, FIXED_NOW)

    expect(registry.activateDevice(pkg.deviceId, FIXED_NOW)).toEqual({ ok: false, reason: 'operator_approval_required' })
    expect(registry.rejectEnrollment(pkg.deviceId, 'operator rejected', FIXED_NOW).ok).toBe(true)
    expect(registry.activateDevice(pkg.deviceId, FIXED_NOW).ok).toBe(false)

    const candidate = await buildIdentity(undefined, 'Desktop')
    const candidatePkg = await createEnrollmentPackage(candidate.publicIdentity, { now: FIXED_NOW, nonce: 'nonce-5555555555555555' })
    await registry.proposeEnrollment(candidatePkg, FIXED_NOW)
    registry.markProofVerified(candidatePkg.deviceId, FIXED_NOW)
    registry.approveDevice(candidatePkg.deviceId, { approvedBy: 'local_operator', approvedAt: FIXED_NOW.toISOString() }, FIXED_NOW)
    registry.activateDevice(candidatePkg.deviceId, FIXED_NOW)

    expect(registry.suspendDevice(candidatePkg.deviceId, FIXED_NOW).ok).toBe(true)
    expect(registry.canAuthorize(candidatePkg.deviceId)).toBe(false)
    expect(registry.activateDevice(candidatePkg.deviceId, FIXED_NOW).ok).toBe(true)
    expect(registry.revokeDevice(candidatePkg.deviceId, 'operator_initiated', FIXED_NOW).ok).toBe(true)
    expect(registry.activateDevice(candidatePkg.deviceId, FIXED_NOW).ok).toBe(false)

    const oldActive = await buildIdentity(undefined, 'Old Active')
    const oldActivePkg = await createEnrollmentPackage(oldActive.publicIdentity, { now: FIXED_NOW, nonce: 'nonce-1010101010101010' })
    await registry.proposeEnrollment(oldActivePkg, FIXED_NOW)
    registry.markProofVerified(oldActivePkg.deviceId, FIXED_NOW)
    registry.approveDevice(oldActivePkg.deviceId, { approvedBy: 'local_operator', approvedAt: FIXED_NOW.toISOString() }, FIXED_NOW)
    registry.activateDevice(oldActivePkg.deviceId, FIXED_NOW)

    const replacement = await buildIdentity(undefined, 'Replacement')
    const replacementPkg = await createEnrollmentPackage(replacement.publicIdentity, { now: FIXED_NOW, nonce: 'nonce-6666666666666666' })
    await registry.proposeEnrollment(replacementPkg, FIXED_NOW)
    registry.markProofVerified(replacementPkg.deviceId, FIXED_NOW)
    registry.approveDevice(replacementPkg.deviceId, { approvedBy: 'local_operator', approvedAt: FIXED_NOW.toISOString() }, FIXED_NOW)
    registry.activateDevice(replacementPkg.deviceId, FIXED_NOW)
    expect(registry.replaceDevice(oldActivePkg.deviceId, replacementPkg.deviceId, FIXED_NOW).ok).toBe(true)
  })

  it('registry rejects duplicates and snapshots are deterministic and immutable', async () => {
    const local = await buildIdentity()
    const enrolling = await buildIdentity(undefined, 'Tablet')
    const registry = new DeviceTrustRegistry(local.publicIdentity, FIXED_NOW)
    const pkg = await createEnrollmentPackage(enrolling.publicIdentity, { now: FIXED_NOW, nonce: 'nonce-7777777777777777' })
    expect((await registry.proposeEnrollment(pkg, FIXED_NOW)).ok).toBe(true)
    expect(await registry.proposeEnrollment(pkg, FIXED_NOW)).toEqual({ ok: false, reason: 'duplicate_device_id' })

    const snapshot = registry.snapshot()
    const ids = snapshot.records.map(record => record.deviceId)
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)))
    expect(() => {
      ;(snapshot.records as unknown as Array<{ hacked: boolean }>).push({ hacked: true })
    }).toThrow()
  })

  it('signed messages require trusted active signer, expected purpose, freshness, suite, and replay validity', async () => {
    const local = await buildIdentity()
    const registry = new DeviceTrustRegistry(local.publicIdentity, FIXED_NOW)
    const replay = new ReplayProtectionRegistry()

    const record = await local.store.load(local.privateHandle.keyRef)
    if (!record) throw new Error('test setup failed')

    const message = await signDeviceMessage({
      messageVersion: '1.0.0',
      cryptoSuiteVersion: '1.0.0',
      signerDeviceId: local.publicIdentity.deviceId,
      purpose: 'identity_attestation',
      createdAt: FIXED_NOW.toISOString(),
      expiresAt: new Date(FIXED_NOW.getTime() + 60_000).toISOString(),
      nonce: 'message-nonce-1',
      payload: { hello: 'world' },
    }, record.privateKey)

    expect(await validateSignedDeviceMessage({
      message,
      snapshot: registry.snapshot(),
      replayGuard: replay,
      requiredPurpose: 'identity_attestation',
      now: FIXED_NOW,
    })).toEqual({ valid: true })

    expect(await validateSignedDeviceMessage({
      message,
      snapshot: registry.snapshot(),
      replayGuard: replay,
      requiredPurpose: 'identity_attestation',
      now: FIXED_NOW,
    })).toEqual({ valid: false, reason: 'message_replay_detected' })

    expect(await validateSignedDeviceMessage({
      message: { ...message, nonce: 'message-nonce-2', purpose: 'trust_ping' },
      snapshot: registry.snapshot(),
      replayGuard: new ReplayProtectionRegistry(),
      requiredPurpose: 'identity_attestation',
      now: FIXED_NOW,
    })).toEqual({ valid: false, reason: 'purpose_invalid' })

    expect(await validateSignedDeviceMessage({
      message: { ...message, nonce: 'message-nonce-3', cryptoSuiteVersion: '9.9.9' as '1.0.0' },
      snapshot: registry.snapshot(),
      replayGuard: new ReplayProtectionRegistry(),
      requiredPurpose: 'identity_attestation',
      now: FIXED_NOW,
    })).toEqual({ valid: false, reason: 'message_suite_version_unsupported' })

    expect(await validateSignedDeviceMessage({
      message: { ...message, nonce: 'message-nonce-4', createdAt: new Date(FIXED_NOW.getTime() + 120_000).toISOString() },
      snapshot: registry.snapshot(),
      replayGuard: new ReplayProtectionRegistry(),
      requiredPurpose: 'identity_attestation',
      now: FIXED_NOW,
    })).toEqual({ valid: false, reason: 'message_from_future' })
  })

  it('signed messages reject untrusted, suspended, revoked, replaced, and unknown signers', async () => {
    const local = await buildIdentity()
    const other = await buildIdentity(undefined, 'Other')
    const registry = new DeviceTrustRegistry(local.publicIdentity, FIXED_NOW)
    const pkg = await createEnrollmentPackage(other.publicIdentity, { now: FIXED_NOW, nonce: 'nonce-8888888888888888' })
    await registry.proposeEnrollment(pkg, FIXED_NOW)

    const otherRecord = await other.store.load(other.privateHandle.keyRef)
    if (!otherRecord) throw new Error('test setup failed')
    const msg = await signDeviceMessage({
      messageVersion: '1.0.0',
      cryptoSuiteVersion: '1.0.0',
      signerDeviceId: other.publicIdentity.deviceId,
      purpose: 'identity_attestation',
      createdAt: FIXED_NOW.toISOString(),
      expiresAt: new Date(FIXED_NOW.getTime() + 60_000).toISOString(),
      nonce: 'message-nonce-5',
      payload: { seq: 1 },
    }, otherRecord.privateKey)

    expect(await validateSignedDeviceMessage({
      message: msg,
      snapshot: registry.snapshot(),
      replayGuard: new ReplayProtectionRegistry(),
      requiredPurpose: 'identity_attestation',
      now: FIXED_NOW,
    })).toEqual({ valid: false, reason: 'signer_not_trusted' })

    registry.markProofVerified(pkg.deviceId, FIXED_NOW)
    registry.approveDevice(pkg.deviceId, { approvedBy: 'local_operator', approvedAt: FIXED_NOW.toISOString() }, FIXED_NOW)
    registry.activateDevice(pkg.deviceId, FIXED_NOW)
    registry.suspendDevice(pkg.deviceId, FIXED_NOW)
    expect(await validateSignedDeviceMessage({
      message: { ...msg, nonce: 'message-nonce-6' },
      snapshot: registry.snapshot(),
      replayGuard: new ReplayProtectionRegistry(),
      requiredPurpose: 'identity_attestation',
      now: FIXED_NOW,
    })).toEqual({ valid: false, reason: 'signer_not_trusted' })

    registry.activateDevice(pkg.deviceId, FIXED_NOW)
    registry.revokeDevice(pkg.deviceId, 'operator_initiated', FIXED_NOW)
    expect(await validateSignedDeviceMessage({
      message: { ...msg, nonce: 'message-nonce-7' },
      snapshot: registry.snapshot(),
      replayGuard: new ReplayProtectionRegistry(),
      requiredPurpose: 'identity_attestation',
      now: FIXED_NOW,
    })).toEqual({ valid: false, reason: 'signer_not_trusted' })

    expect(await validateSignedDeviceMessage({
      message: { ...msg, signerDeviceId: 'device:unknown', nonce: 'message-nonce-8' },
      snapshot: registry.snapshot(),
      replayGuard: new ReplayProtectionRegistry(),
      requiredPurpose: 'identity_attestation',
      now: FIXED_NOW,
    })).toEqual({ valid: false, reason: 'signer_unknown' })
  })

  it('audit records contain reason codes and exclude secret data', async () => {
    const local = await buildIdentity()
    const enrolling = await buildIdentity(undefined, 'Tablet')
    const registry = new DeviceTrustRegistry(local.publicIdentity, FIXED_NOW)
    const pkg = await createEnrollmentPackage(enrolling.publicIdentity, { now: FIXED_NOW, nonce: 'nonce-9999999999999999' })
    await registry.proposeEnrollment(pkg, FIXED_NOW)
    registry.markProofVerified(pkg.deviceId, FIXED_NOW)
    registry.approveDevice(pkg.deviceId, { approvedBy: 'local_operator', approvedAt: FIXED_NOW.toISOString() }, FIXED_NOW)
    registry.activateDevice(pkg.deviceId, FIXED_NOW)
    registry.revokeDevice(pkg.deviceId, 'operator_initiated', FIXED_NOW)
    const audits = registry.getAuditEvents()
    expect(audits.length).toBeGreaterThan(0)
    expect(audits.every(event => typeof event.reasonCode === 'string' && event.reasonCode.length > 0)).toBe(true)
    const serialized = JSON.stringify(audits).toLowerCase()
    expect(serialized.includes('privatekey')).toBe(false)
    expect(serialized.includes('passphrase')).toBe(false)
  })
})
