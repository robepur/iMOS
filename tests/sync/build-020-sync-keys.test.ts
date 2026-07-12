import { describe, expect, it } from 'vitest'
import {
  InMemoryDevicePrivateKeyStore,
  generateLocalDeviceIdentity,
} from '../../src/services/DeviceIdentityService'
import { DeviceTrustRegistry } from '../../src/services/DeviceTrustRegistry'
import {
  SyncKeyArchitectureService,
  createSyncKeyArchitecture,
} from '../../src/services/SyncKeyArchitectureService'

describe('Build 020 sync key architecture and identity hardening', () => {
  it('derives the same hierarchy only from the correct recovery secret', async () => {
    const created = await createSyncKeyArchitecture('correct horse battery staple')
    const descriptor = created.descriptor()
    const restored = await SyncKeyArchitectureService.restore('correct horse battery staple', descriptor)

    expect(restored.descriptor()).toEqual(descriptor)
    await expect(
      SyncKeyArchitectureService.restore('this secret is incorrect', descriptor),
    ).rejects.toThrow('does not match')
  })

  it('wraps unique object keys and restores them as non-extractable keys', async () => {
    const architecture = await createSyncKeyArchitecture('operator controlled recovery secret')
    const first = await architecture.createObjectKey('sync:operator', 'obj:decision-1')
    const second = await architecture.createObjectKey('sync:operator', 'obj:decision-1')

    expect(first.wrapped.objectKeyId).not.toBe(second.wrapped.objectKeyId)
    expect(first.key.extractable).toBe(false)

    const restoredKey = await architecture.unwrapObjectKey(first.wrapped)
    expect(restoredKey.extractable).toBe(false)

    const iv = crypto.getRandomValues(new Uint8Array(12))
    const plaintext = new TextEncoder().encode('Build 020 round trip')
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, first.key, plaintext)
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, restoredKey, encrypted)
    expect(new TextDecoder().decode(decrypted)).toBe('Build 020 round trip')
  })

  it('fails closed when wrapped key binding metadata is changed', async () => {
    const architecture = await createSyncKeyArchitecture('operator controlled recovery secret')
    const { wrapped } = await architecture.createObjectKey('sync:operator', 'obj:decision-2')

    await expect(architecture.unwrapObjectKey({
      ...wrapped,
      objectId: 'obj:decision-tampered',
    })).rejects.toThrow()
  })

  it('creates and validates a device-bound signed key grant', async () => {
    const store = new InMemoryDevicePrivateKeyStore()
    const identity = await generateLocalDeviceIdentity('Build 020 Device', new Date(), { store })
    const trust = new DeviceTrustRegistry(identity.publicIdentity)
    const architecture = await createSyncKeyArchitecture('operator controlled recovery secret')
    const now = new Date()

    const grant = await architecture.createDeviceGrant({
      issuerIdentity: identity.publicIdentity,
      issuerHandle: identity.privateHandle,
      recipientDeviceId: identity.publicIdentity.deviceId,
      trustRegistry: trust,
      store,
      now,
    })

    const validation = await architecture.validateDeviceGrant({
      grant,
      expectedRecipientDeviceId: identity.publicIdentity.deviceId,
      trustRegistry: trust,
      now,
    })
    expect(validation).toEqual({ valid: true })

    const tampered = await architecture.validateDeviceGrant({
      grant: { ...grant, nonce: `${grant.nonce}-tampered` },
      expectedRecipientDeviceId: identity.publicIdentity.deviceId,
      trustRegistry: trust,
      now,
    })
    expect(tampered).toEqual({ valid: false, reason: 'signature_invalid' })
  })

  it('denies grants when device trust is no longer active', async () => {
    const store = new InMemoryDevicePrivateKeyStore()
    const identity = await generateLocalDeviceIdentity('Revoked Build 020 Device', new Date(), { store })
    const trust = new DeviceTrustRegistry(identity.publicIdentity)
    const architecture = await createSyncKeyArchitecture('operator controlled recovery secret')
    trust.revokeDevice(identity.publicIdentity.deviceId, 'operator_requested')

    await expect(architecture.createDeviceGrant({
      issuerIdentity: identity.publicIdentity,
      issuerHandle: identity.privateHandle,
      recipientDeviceId: identity.publicIdentity.deviceId,
      trustRegistry: trust,
      store,
    })).rejects.toThrow('not active and trusted')
  })

  it('does not expose recoverable root or object key material in descriptors', async () => {
    const architecture = await createSyncKeyArchitecture('operator controlled recovery secret')
    const descriptor = architecture.descriptor()
    const { wrapped } = await architecture.createObjectKey('sync:operator', 'obj:secret-scan')
    const serialized = JSON.stringify({ descriptor, wrapped }).toLowerCase()

    expect(serialized).not.toContain('recoverysecret')
    expect(serialized).not.toContain('privatekey')
    expect(serialized).not.toContain('rawobjectkey')
  })
})
