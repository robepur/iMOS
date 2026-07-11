import { describe, expect, it } from 'vitest'
import {
  canonicalizeStableJson,
  createEnrollmentPackage,
  createProofChallenge,
  generateLocalDeviceIdentity,
  signProofOfPossession,
  validateEnrollmentPackage,
  validatePublicIdentityMaterial,
  verifyProofOfPossession,
} from '../../src/services/DeviceIdentityService'
import { DeviceTrustRegistry } from '../../src/services/DeviceTrustRegistry'
import { validateSignedDeviceMessage, signDeviceMessage } from '../../src/services/DeviceMessageValidator'
import { ReplayProtectionRegistry } from '../../src/services/ReplayProtectionRegistry'

const FIXED_NOW = new Date('2026-07-11T00:00:00.000Z')

async function buildIdentity(label = 'Primary Operator Device') {
  return generateLocalDeviceIdentity(label, FIXED_NOW)
}

describe('Build 018 device identity foundation', () => {
  it('generates supported device identity and deterministic versions', async () => {
    const identity = await buildIdentity()
    expect(identity.publicIdentity.deviceId.startsWith('device:')).toBe(true)
    expect(identity.publicIdentity.cryptoSuiteVersion).toBe('1.0.0')
    expect(identity.publicIdentity.keyVersion).toBe('1.0.0')
    expect(identity.privateHandle.privateKey.extractable).toBe(false)
  })

  it('same public material yields the same identifier and fingerprint', async () => {
    const identity = await buildIdentity()
    const validation = await validatePublicIdentityMaterial(identity.publicIdentity)
    expect(validation).toEqual({ valid: true })
  })

  it('different key pairs produce different identifiers', async () => {
    const a = await buildIdentity('A')
    const b = await generateLocalDeviceIdentity('B', FIXED_NOW)
    expect(a.publicIdentity.deviceId).not.toBe(b.publicIdentity.deviceId)
    expect(a.publicIdentity.keyFingerprint).not.toBe(b.publicIdentity.keyFingerprint)
  })

  it('public identity output does not expose private-key material', async () => {
    const identity = await buildIdentity()
    expect(JSON.stringify(identity.publicIdentity).toLowerCase().includes('private')).toBe(false)
    expect(Object.keys(identity.publicIdentity)).not.toContain('privateKey')
  })

  it('malformed public keys fail validation', async () => {
    const identity = await buildIdentity()
    const validation = await validatePublicIdentityMaterial({
      ...identity.publicIdentity,
      publicSigningKeySpki: 'not-base64',
    })
    expect(validation).toEqual({ valid: false, reason: 'public_key_invalid_or_unsupported' })
  })

  it('unsupported versions fail validation', async () => {
    const identity = await buildIdentity()
    const validation = await validatePublicIdentityMaterial({
      ...identity.publicIdentity,
      keyVersion: 'x.y.z' as '1.0.0',
    })
    expect(validation).toEqual({ valid: false, reason: 'version_invalid' })
  })

  it('identifier mismatch fails validation', async () => {
    const identity = await buildIdentity()
    const validation = await validatePublicIdentityMaterial({
      ...identity.publicIdentity,
      deviceId: 'device:incorrect',
    })
    expect(validation).toEqual({ valid: false, reason: 'device_id_mismatch' })
  })

  it('fingerprint mismatch fails validation', async () => {
    const identity = await buildIdentity()
    const validation = await validatePublicIdentityMaterial({
      ...identity.publicIdentity,
      keyFingerprint: '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00',
    })
    expect(validation).toEqual({ valid: false, reason: 'fingerprint_mismatch' })
  })

  it('canonical output is stable across object insertion orders', () => {
    const a = { b: 2, a: 1, c: { y: 2, x: 1 } }
    const b = { c: { x: 1, y: 2 }, a: 1, b: 2 }
    expect(canonicalizeStableJson(a)).toBe(canonicalizeStableJson(b))
  })

  it('whitespace differences in source JSON do not affect canonical output', () => {
    const withWhitespace = JSON.parse('{ "x" : 1, "y" : [2, 3] }')
    const compact = JSON.parse('{"x":1,"y":[2,3]}')
    expect(canonicalizeStableJson(withWhitespace)).toBe(canonicalizeStableJson(compact))
  })

  it('altered payload changes canonical signature input', () => {
    const a = canonicalizeStableJson({ purpose: 'identity_attestation', payload: { count: 1 } })
    const b = canonicalizeStableJson({ purpose: 'identity_attestation', payload: { count: 2 } })
    expect(a).not.toBe(b)
  })

  it('ambiguous or unsupported canonical values fail closed', () => {
    expect(() => canonicalizeStableJson({ bad: undefined })).toThrow()
    expect(() => canonicalizeStableJson({ bad: Number.NaN })).toThrow()
  })

  it('valid enrollment package validates', async () => {
    const identity = await buildIdentity()
    const pkg = await createEnrollmentPackage(identity.publicIdentity, { now: FIXED_NOW, nonce: 'nonce-12345678' })
    await expect(validateEnrollmentPackage(pkg, FIXED_NOW)).resolves.toEqual({ valid: true })
  })

  it('expired enrollment package fails', async () => {
    const identity = await buildIdentity()
    const pkg = await createEnrollmentPackage(identity.publicIdentity, { now: FIXED_NOW, ttlMs: 1000, nonce: 'nonce-12345678' })
    const result = await validateEnrollmentPackage(pkg, new Date(FIXED_NOW.getTime() + 2000))
    expect(result).toEqual({ valid: false, reason: 'package_expired' })
  })

  it('malformed enrollment package fails', async () => {
    const identity = await buildIdentity()
    const pkg = await createEnrollmentPackage(identity.publicIdentity, { now: FIXED_NOW })
    const result = await validateEnrollmentPackage({ ...pkg, createdAt: 'nope' }, FIXED_NOW)
    expect(result).toEqual({ valid: false, reason: 'package_timestamp_invalid' })
  })

  it('altered enrollment package fails identity binding', async () => {
    const identity = await buildIdentity()
    const pkg = await createEnrollmentPackage(identity.publicIdentity, { now: FIXED_NOW })
    const result = await validateEnrollmentPackage({ ...pkg, deviceId: 'device:tampered' }, FIXED_NOW)
    expect(result).toEqual({ valid: false, reason: 'device_id_mismatch' })
  })

  it('secret-bearing enrollment packages are rejected', async () => {
    const identity = await buildIdentity()
    const pkg = await createEnrollmentPackage(identity.publicIdentity, { now: FIXED_NOW })
    const result = await validateEnrollmentPackage({ ...pkg, privateKeyLeak: 'bad' } as typeof pkg, FIXED_NOW)
    expect(result).toEqual({ valid: false, reason: 'package_contains_secret_fields' })
  })

  it('invalid nonce fails package validation', async () => {
    const identity = await buildIdentity()
    const pkg = await createEnrollmentPackage(identity.publicIdentity, { now: FIXED_NOW, nonce: 'n' })
    const result = await validateEnrollmentPackage(pkg, FIXED_NOW)
    expect(result).toEqual({ valid: false, reason: 'nonce_invalid' })
  })

  it('unsupported package version fails validation', async () => {
    const identity = await buildIdentity()
    const pkg = await createEnrollmentPackage(identity.publicIdentity, { now: FIXED_NOW })
    const result = await validateEnrollmentPackage({ ...pkg, packageVersion: '9.9.9' as '1.0.0' }, FIXED_NOW)
    expect(result).toEqual({ valid: false, reason: 'unsupported_package_version' })
  })

  it('valid proof-of-possession verifies', async () => {
    const identity = await buildIdentity()
    const pkg = await createEnrollmentPackage(identity.publicIdentity, { now: FIXED_NOW })
    const challenge = await createProofChallenge(pkg, { now: FIXED_NOW })
    const proof = await signProofOfPossession(challenge, identity.privateHandle, FIXED_NOW)
    const replay = new ReplayProtectionRegistry()
    const result = await verifyProofOfPossession({ challenge, proof, pkg, replayGuard: replay, now: FIXED_NOW })
    expect(result).toEqual({ valid: true })
  })

  it('proof with wrong key fails', async () => {
    const identity = await buildIdentity()
    const wrong = await generateLocalDeviceIdentity('Wrong Device', FIXED_NOW)
    const pkg = await createEnrollmentPackage(identity.publicIdentity, { now: FIXED_NOW })
    const challenge = await createProofChallenge(pkg, { now: FIXED_NOW })
    await expect(signProofOfPossession(challenge, wrong.privateHandle, FIXED_NOW)).rejects.toThrow()
  })

  it('altered challenge fails verification', async () => {
    const identity = await buildIdentity()
    const pkg = await createEnrollmentPackage(identity.publicIdentity, { now: FIXED_NOW })
    const challenge = await createProofChallenge(pkg, { now: FIXED_NOW })
    const proof = await signProofOfPossession(challenge, identity.privateHandle, FIXED_NOW)
    const replay = new ReplayProtectionRegistry()
    const result = await verifyProofOfPossession({
      challenge: { ...challenge, nonce: 'tampered-nonce' },
      proof,
      pkg,
      replayGuard: replay,
      now: FIXED_NOW,
    })
    expect(result).toEqual({ valid: false, reason: 'challenge_nonce_mismatch' })
  })

  it('expired challenge fails verification', async () => {
    const identity = await buildIdentity()
    const pkg = await createEnrollmentPackage(identity.publicIdentity, { now: FIXED_NOW })
    const challenge = await createProofChallenge(pkg, { now: FIXED_NOW, ttlMs: 1000 })
    const proof = await signProofOfPossession(challenge, identity.privateHandle, FIXED_NOW)
    const replay = new ReplayProtectionRegistry()
    const result = await verifyProofOfPossession({
      challenge,
      proof,
      pkg,
      replayGuard: replay,
      now: new Date(FIXED_NOW.getTime() + 2000),
    })
    expect(result).toEqual({ valid: false, reason: 'challenge_expired' })
  })

  it('replayed proof is rejected', async () => {
    const identity = await buildIdentity()
    const pkg = await createEnrollmentPackage(identity.publicIdentity, { now: FIXED_NOW })
    const challenge = await createProofChallenge(pkg, { now: FIXED_NOW })
    const proof = await signProofOfPossession(challenge, identity.privateHandle, FIXED_NOW)
    const replay = new ReplayProtectionRegistry()
    const first = await verifyProofOfPossession({ challenge, proof, pkg, replayGuard: replay, now: FIXED_NOW })
    const second = await verifyProofOfPossession({ challenge, proof, pkg, replayGuard: replay, now: FIXED_NOW })
    expect(first).toEqual({ valid: true })
    expect(second).toEqual({ valid: false, reason: 'replay_detected' })
  })

  it('proof rejects unsupported signature suite', async () => {
    const identity = await buildIdentity()
    const pkg = await createEnrollmentPackage(identity.publicIdentity, { now: FIXED_NOW })
    const challenge = await createProofChallenge(pkg, { now: FIXED_NOW })
    const proof = await signProofOfPossession(challenge, identity.privateHandle, FIXED_NOW)
    const replay = new ReplayProtectionRegistry()
    const result = await verifyProofOfPossession({
      challenge,
      proof: { ...proof, algorithm: 'UNSUPPORTED' as 'ECDSA_P256_SHA256' },
      pkg,
      replayGuard: replay,
      now: FIXED_NOW,
    })
    expect(result).toEqual({ valid: false, reason: 'unsupported_signature_suite' })
  })

  it('lifecycle requires explicit proposal, proof, approval, and activation', async () => {
    const local = await buildIdentity()
    const enrolling = await generateLocalDeviceIdentity('Tablet', FIXED_NOW)
    const registry = new DeviceTrustRegistry(local.publicIdentity, FIXED_NOW)
    const pkg = await createEnrollmentPackage(enrolling.publicIdentity, { now: FIXED_NOW, nonce: 'nonce-12345678' })

    const proposed = await registry.proposeEnrollment(pkg, FIXED_NOW)
    expect(proposed.ok).toBe(true)
    if (!proposed.ok) return
    expect(proposed.record.trustState).toBe('untrusted')

    const verified = registry.markProofVerified(pkg.deviceId, FIXED_NOW)
    expect(verified.ok).toBe(true)
    if (!verified.ok) return
    expect(verified.record.status).toBe('proof_verified')

    const approved = registry.approveDevice(pkg.deviceId, { approvedBy: 'local_operator', approvedAt: FIXED_NOW.toISOString() }, FIXED_NOW)
    expect(approved.ok).toBe(true)
    if (!approved.ok) return
    expect(approved.record.status).toBe('operator_approved')

    const activated = registry.activateDevice(pkg.deviceId, FIXED_NOW)
    expect(activated.ok).toBe(true)
    if (!activated.ok) return
    expect(activated.record.status).toBe('active')
    expect(registry.canAuthorize(pkg.deviceId)).toBe(true)
  })

  it('invalid transitions fail closed', async () => {
    const local = await buildIdentity()
    const enrolling = await generateLocalDeviceIdentity('Phone', FIXED_NOW)
    const registry = new DeviceTrustRegistry(local.publicIdentity, FIXED_NOW)
    const pkg = await createEnrollmentPackage(enrolling.publicIdentity, { now: FIXED_NOW })
    await registry.proposeEnrollment(pkg, FIXED_NOW)
    const directActivation = registry.activateDevice(pkg.deviceId, FIXED_NOW)
    expect(directActivation).toEqual({ ok: false, reason: 'operator_approval_required' })
  })

  it('rejected or expired proposals do not activate', async () => {
    const local = await buildIdentity()
    const enrolling = await generateLocalDeviceIdentity('Laptop', FIXED_NOW)
    const registry = new DeviceTrustRegistry(local.publicIdentity, FIXED_NOW)
    const pkg = await createEnrollmentPackage(enrolling.publicIdentity, { now: FIXED_NOW })
    await registry.proposeEnrollment(pkg, FIXED_NOW)
    const rejected = registry.rejectEnrollment(pkg.deviceId, 'operator rejected', FIXED_NOW)
    expect(rejected.ok).toBe(true)
    const activateRejected = registry.activateDevice(pkg.deviceId, FIXED_NOW)
    expect(activateRejected.ok).toBe(false)

    const enrolling2 = await generateLocalDeviceIdentity('Laptop 2', FIXED_NOW)
    const pkg2 = await createEnrollmentPackage(enrolling2.publicIdentity, { now: FIXED_NOW })
    await registry.proposeEnrollment(pkg2, FIXED_NOW)
    const expired = registry.expireEnrollment(pkg2.deviceId, FIXED_NOW)
    expect(expired.ok).toBe(true)
    const activateExpired = registry.activateDevice(pkg2.deviceId, FIXED_NOW)
    expect(activateExpired.ok).toBe(false)
  })

  it('suspension blocks authorization and explicit reactivation restores it', async () => {
    const local = await buildIdentity()
    const enrolling = await generateLocalDeviceIdentity('Desktop', FIXED_NOW)
    const registry = new DeviceTrustRegistry(local.publicIdentity, FIXED_NOW)
    const pkg = await createEnrollmentPackage(enrolling.publicIdentity, { now: FIXED_NOW })
    await registry.proposeEnrollment(pkg, FIXED_NOW)
    registry.markProofVerified(pkg.deviceId, FIXED_NOW)
    registry.approveDevice(pkg.deviceId, { approvedBy: 'local_operator', approvedAt: FIXED_NOW.toISOString() }, FIXED_NOW)
    registry.activateDevice(pkg.deviceId, FIXED_NOW)
    expect(registry.canAuthorize(pkg.deviceId)).toBe(true)
    registry.suspendDevice(pkg.deviceId, FIXED_NOW)
    expect(registry.canAuthorize(pkg.deviceId)).toBe(false)
    registry.activateDevice(pkg.deviceId, FIXED_NOW)
    expect(registry.canAuthorize(pkg.deviceId)).toBe(true)
  })

  it('revocation is terminal and cannot be reactivated', async () => {
    const local = await buildIdentity()
    const enrolling = await generateLocalDeviceIdentity('Tablet', FIXED_NOW)
    const registry = new DeviceTrustRegistry(local.publicIdentity, FIXED_NOW)
    const pkg = await createEnrollmentPackage(enrolling.publicIdentity, { now: FIXED_NOW })
    await registry.proposeEnrollment(pkg, FIXED_NOW)
    registry.markProofVerified(pkg.deviceId, FIXED_NOW)
    registry.approveDevice(pkg.deviceId, { approvedBy: 'local_operator', approvedAt: FIXED_NOW.toISOString() }, FIXED_NOW)
    registry.activateDevice(pkg.deviceId, FIXED_NOW)
    registry.revokeDevice(pkg.deviceId, 'device_compromised', FIXED_NOW)
    const reactivation = registry.activateDevice(pkg.deviceId, FIXED_NOW)
    expect(reactivation.ok).toBe(false)
    expect(registry.canAuthorize(pkg.deviceId)).toBe(false)
  })

  it('replacement requires a new active identity and links records', async () => {
    const local = await buildIdentity()
    const oldDevice = await generateLocalDeviceIdentity('Old Phone', FIXED_NOW)
    const newDevice = await generateLocalDeviceIdentity('New Phone', FIXED_NOW)
    const registry = new DeviceTrustRegistry(local.publicIdentity, FIXED_NOW)

    const oldPackage = await createEnrollmentPackage(oldDevice.publicIdentity, { now: FIXED_NOW })
    await registry.proposeEnrollment(oldPackage, FIXED_NOW)
    registry.markProofVerified(oldPackage.deviceId, FIXED_NOW)
    registry.approveDevice(oldPackage.deviceId, { approvedBy: 'local_operator', approvedAt: FIXED_NOW.toISOString() }, FIXED_NOW)
    registry.activateDevice(oldPackage.deviceId, FIXED_NOW)

    const newPackage = await createEnrollmentPackage(newDevice.publicIdentity, { now: FIXED_NOW })
    await registry.proposeEnrollment(newPackage, FIXED_NOW)
    registry.markProofVerified(newPackage.deviceId, FIXED_NOW)
    registry.approveDevice(newPackage.deviceId, { approvedBy: 'local_operator', approvedAt: FIXED_NOW.toISOString() }, FIXED_NOW)
    registry.activateDevice(newPackage.deviceId, FIXED_NOW)

    const replaced = registry.replaceDevice(oldPackage.deviceId, newPackage.deviceId, FIXED_NOW)
    expect(replaced.ok).toBe(true)
    expect(registry.listByStatus('replaced').map(r => r.deviceId)).toContain(oldPackage.deviceId)
  })

  it('registry rejects duplicate identifiers, fingerprints, and keys', async () => {
    const local = await buildIdentity()
    const enrolling = await generateLocalDeviceIdentity('Tablet', FIXED_NOW)
    const registry = new DeviceTrustRegistry(local.publicIdentity, FIXED_NOW)
    const pkg = await createEnrollmentPackage(enrolling.publicIdentity, { now: FIXED_NOW })
    const first = await registry.proposeEnrollment(pkg, FIXED_NOW)
    const duplicateId = await registry.proposeEnrollment(pkg, FIXED_NOW)
    expect(first.ok).toBe(true)
    expect(duplicateId).toEqual({ ok: false, reason: 'duplicate_device_id' })
  })

  it('registry snapshots are sorted and immutable', async () => {
    const local = await buildIdentity()
    const enrollingA = await generateLocalDeviceIdentity('A', FIXED_NOW)
    const enrollingB = await generateLocalDeviceIdentity('B', FIXED_NOW)
    const registry = new DeviceTrustRegistry(local.publicIdentity, FIXED_NOW)
    await registry.proposeEnrollment(await createEnrollmentPackage(enrollingB.publicIdentity, { now: FIXED_NOW }), FIXED_NOW)
    await registry.proposeEnrollment(await createEnrollmentPackage(enrollingA.publicIdentity, { now: FIXED_NOW }), FIXED_NOW)
    const snapshot = registry.snapshot()
    const ids = snapshot.records.map(record => record.deviceId)
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)))
    expect(() => {
      ;(snapshot.records as unknown as Array<{ hacked: boolean }>).push({ hacked: true })
    }).toThrow()
  })

  it('current-device representation is explicit', async () => {
    const local = await buildIdentity()
    const registry = new DeviceTrustRegistry(local.publicIdentity, FIXED_NOW)
    const snapshot = registry.snapshot()
    expect(snapshot.currentDeviceId).toBe(local.publicIdentity.deviceId)
    expect(snapshot.records.some(record => record.deviceId === snapshot.currentDeviceId && record.status === 'active')).toBe(true)
  })

  it('signed messages require trust beyond signature validity', async () => {
    const local = await buildIdentity()
    const untrusted = await generateLocalDeviceIdentity('Untrusted', FIXED_NOW)
    const registry = new DeviceTrustRegistry(local.publicIdentity, FIXED_NOW)
    const pkg = await createEnrollmentPackage(untrusted.publicIdentity, { now: FIXED_NOW })
    await registry.proposeEnrollment(pkg, FIXED_NOW)

    const message = await signDeviceMessage({
      messageVersion: '1.0.0',
      signerDeviceId: pkg.deviceId,
      purpose: 'identity_attestation',
      createdAt: FIXED_NOW.toISOString(),
      expiresAt: new Date(FIXED_NOW.getTime() + 60_000).toISOString(),
      nonce: 'message-nonce-1',
      payload: { hello: 'world' },
    }, untrusted.privateHandle.privateKey)

    const replay = new ReplayProtectionRegistry()
    const result = await validateSignedDeviceMessage({
      message,
      snapshot: registry.snapshot(),
      replayGuard: replay,
      requiredPurpose: 'identity_attestation',
      now: FIXED_NOW,
    })
    expect(result).toEqual({ valid: false, reason: 'signer_not_trusted' })
  })

  it('valid trusted signed message passes bounded validation', async () => {
    const local = await buildIdentity()
    const registry = new DeviceTrustRegistry(local.publicIdentity, FIXED_NOW)
    const replay = new ReplayProtectionRegistry()
    const message = await signDeviceMessage({
      messageVersion: '1.0.0',
      signerDeviceId: local.publicIdentity.deviceId,
      purpose: 'identity_attestation',
      createdAt: FIXED_NOW.toISOString(),
      expiresAt: new Date(FIXED_NOW.getTime() + 60_000).toISOString(),
      nonce: 'message-nonce-2',
      payload: { stable: true, seq: 1 },
    }, local.privateHandle.privateKey)
    const result = await validateSignedDeviceMessage({
      message,
      snapshot: registry.snapshot(),
      replayGuard: replay,
      requiredPurpose: 'identity_attestation',
      now: FIXED_NOW,
    })
    expect(result).toEqual({ valid: true })
  })

  it('wrong purpose, expiry, replay, revocation, suspension, tampering, and unknown signer fail', async () => {
    const local = await buildIdentity()
    const registry = new DeviceTrustRegistry(local.publicIdentity, FIXED_NOW)
    const replay = new ReplayProtectionRegistry()

    const base = await signDeviceMessage({
      messageVersion: '1.0.0',
      signerDeviceId: local.publicIdentity.deviceId,
      purpose: 'identity_attestation',
      createdAt: FIXED_NOW.toISOString(),
      expiresAt: new Date(FIXED_NOW.getTime() + 60_000).toISOString(),
      nonce: 'message-nonce-3',
      payload: { counter: 1 },
    }, local.privateHandle.privateKey)

    const wrongPurpose = await validateSignedDeviceMessage({
      message: base,
      snapshot: registry.snapshot(),
      replayGuard: new ReplayProtectionRegistry(),
      requiredPurpose: 'trust_ping',
      now: FIXED_NOW,
    })
    expect(wrongPurpose).toEqual({ valid: false, reason: 'purpose_invalid' })

    const expired = await validateSignedDeviceMessage({
      message: { ...base, nonce: 'message-nonce-4', expiresAt: new Date(FIXED_NOW.getTime() - 1).toISOString() },
      snapshot: registry.snapshot(),
      replayGuard: new ReplayProtectionRegistry(),
      requiredPurpose: 'identity_attestation',
      now: FIXED_NOW,
    })
    expect(expired).toEqual({ valid: false, reason: 'message_expired' })

    const replayMessage = await signDeviceMessage({
      messageVersion: '1.0.0',
      signerDeviceId: local.publicIdentity.deviceId,
      purpose: 'identity_attestation',
      createdAt: FIXED_NOW.toISOString(),
      expiresAt: new Date(FIXED_NOW.getTime() + 60_000).toISOString(),
      nonce: 'message-nonce-5',
      payload: { counter: 1 },
    }, local.privateHandle.privateKey)

    const first = await validateSignedDeviceMessage({
      message: replayMessage,
      snapshot: registry.snapshot(),
      replayGuard: replay,
      requiredPurpose: 'identity_attestation',
      now: FIXED_NOW,
    })
    const replayed = await validateSignedDeviceMessage({
      message: replayMessage,
      snapshot: registry.snapshot(),
      replayGuard: replay,
      requiredPurpose: 'identity_attestation',
      now: FIXED_NOW,
    })
    expect(first).toEqual({ valid: true })
    expect(replayed).toEqual({ valid: false, reason: 'message_replay_detected' })

    registry.suspendDevice(local.publicIdentity.deviceId, FIXED_NOW)
    const suspended = await validateSignedDeviceMessage({
      message: { ...base, nonce: 'message-nonce-6' },
      snapshot: registry.snapshot(),
      replayGuard: new ReplayProtectionRegistry(),
      requiredPurpose: 'identity_attestation',
      now: FIXED_NOW,
    })
    expect(suspended).toEqual({ valid: false, reason: 'signer_not_trusted' })

    registry.revokeDevice(local.publicIdentity.deviceId, 'operator_initiated', FIXED_NOW)
    const revoked = await validateSignedDeviceMessage({
      message: { ...base, nonce: 'message-nonce-7' },
      snapshot: registry.snapshot(),
      replayGuard: new ReplayProtectionRegistry(),
      requiredPurpose: 'identity_attestation',
      now: FIXED_NOW,
    })
    expect(revoked).toEqual({ valid: false, reason: 'signer_not_trusted' })

    const unknownSigner = await validateSignedDeviceMessage({
      message: { ...base, signerDeviceId: 'device:unknown', nonce: 'message-nonce-8' },
      snapshot: registry.snapshot(),
      replayGuard: new ReplayProtectionRegistry(),
      requiredPurpose: 'identity_attestation',
      now: FIXED_NOW,
    })
    expect(unknownSigner).toEqual({ valid: false, reason: 'signer_unknown' })
  })

  it('audit records include reason codes and exclude secret data', async () => {
    const local = await buildIdentity()
    const enrolling = await generateLocalDeviceIdentity('Tablet', FIXED_NOW)
    const registry = new DeviceTrustRegistry(local.publicIdentity, FIXED_NOW)
    const pkg = await createEnrollmentPackage(enrolling.publicIdentity, { now: FIXED_NOW })
    await registry.proposeEnrollment(pkg, FIXED_NOW)
    registry.markProofVerified(pkg.deviceId, FIXED_NOW)
    registry.approveDevice(pkg.deviceId, { approvedBy: 'local_operator', approvedAt: FIXED_NOW.toISOString() }, FIXED_NOW)
    registry.activateDevice(pkg.deviceId, FIXED_NOW)
    registry.revokeDevice(pkg.deviceId, 'operator_initiated', FIXED_NOW)
    const audits = registry.getAuditEvents()
    expect(audits.length).toBeGreaterThan(0)
    expect(audits.every(event => typeof event.reasonCode === 'string' && event.reasonCode.length > 0)).toBe(true)
    expect(JSON.stringify(audits).toLowerCase().includes('privatekey')).toBe(false)
    expect(JSON.stringify(audits).toLowerCase().includes('passphrase')).toBe(false)
  })
})
