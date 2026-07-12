import type { DevicePublicIdentity } from '../types/deviceIdentity'
import type { DeviceTrustRegistry } from './DeviceTrustRegistry'
import type {
  EncryptedSyncEnvelope,
  SyncDownloadResult,
  SyncQuarantineRecord,
  SyncUploadAcknowledgment,
} from '../types/sync'
import type { LocalDevicePrivateHandle, DevicePrivateKeyStore } from './DeviceIdentityService'
import { SyncEnvelopeService } from './SyncEnvelopeService'
import { SyncProtocolService } from './SyncProtocolService'
import { SyncQuarantineService } from './SyncQuarantineService'
import type { SyncTransportAdapter } from './SyncTransportAdapter'

export class SyncService {
  constructor(
    private readonly envelopeService: SyncEnvelopeService,
    private readonly protocolService: SyncProtocolService,
    private readonly quarantineService: SyncQuarantineService,
    private readonly transportAdapter: SyncTransportAdapter,
    private readonly signerIdentity: DevicePublicIdentity,
    private readonly signerHandle: LocalDevicePrivateHandle,
    private readonly trustRegistry?: DeviceTrustRegistry,
    private readonly keyStore?: DevicePrivateKeyStore,
  ) {}

  private resolveSignerIdentity(deviceId: DevicePublicIdentity['deviceId']): DevicePublicIdentity | null {
    if (deviceId === this.signerIdentity.deviceId) return this.signerIdentity
    if (!this.trustRegistry) return null
    return this.trustRegistry.getPublicIdentity(deviceId)
  }

  async uploadPlaintext(input: {
    namespace: `sync:${string}`
    objectId: `obj:${string}`
    objectVersion: `${number}`
    parentVersion?: `${number}`
    plaintext: string
    encryptionKey: CryptoKey
    now?: Date
    ttlMs?: number
    tombstone?: boolean
  }): Promise<SyncUploadAcknowledgment | { kind: 'conflict'; conflict: unknown }> {
    const now = input.now ?? new Date()
    const requestId = `sync-request:${crypto.randomUUID()}`
    const replayId = `sync-replay:${crypto.randomUUID()}`
    const createdAt = now.toISOString()
    const expiresAt = new Date(now.getTime() + (input.ttlMs ?? 180_000)).toISOString()
    const encrypted = await this.envelopeService.encryptEnvelope({
      namespace: input.namespace,
      objectId: input.objectId,
      objectVersion: input.objectVersion,
      parentVersion: input.parentVersion,
      signerDeviceId: this.signerIdentity.deviceId,
      plaintext: input.plaintext,
      key: input.encryptionKey,
      requestId,
      replayId,
      createdAt,
      expiresAt,
      tombstone: input.tombstone,
    })
    const validation = await this.protocolService.validateEnvelope(encrypted.envelope, now, false)
    if (!validation.ok) throw new Error(validation.error.message)
    const signedRequest = await this.protocolService.createSignedRequest({
      method: 'upload',
      namespace: encrypted.envelope.namespace,
      objectId: encrypted.envelope.objectId,
      objectVersion: encrypted.envelope.objectVersion,
      parentVersion: encrypted.envelope.parentVersion,
      signerDeviceId: this.signerIdentity.deviceId,
      requestId: encrypted.envelope.requestId,
      replayId: encrypted.envelope.replayId,
      ciphertextDigest: encrypted.envelope.ciphertextDigest,
      createdAt: encrypted.envelope.createdAt,
      expiresAt: encrypted.envelope.expiresAt,
      privateHandle: this.signerHandle,
      store: this.keyStore,
    })
    const signedEnvelope: EncryptedSyncEnvelope = {
      ...encrypted.envelope,
      signature: signedRequest.signature,
    }
    return this.transportAdapter.upload(signedEnvelope)
  }

  async downloadAndDecrypt(input: {
    namespace: `sync:${string}`
    objectId: `obj:${string}`
    decryptionKey: CryptoKey
    now?: Date
  }): Promise<{ result: SyncDownloadResult; plaintext?: string; quarantined?: SyncQuarantineRecord }> {
    const response = await this.transportAdapter.download({
      requestId: `sync-request:${crypto.randomUUID()}`,
      namespace: input.namespace,
      objectId: input.objectId,
    })
    if (response.kind !== 'found') return { result: response }
    const envelopeValidation = await this.protocolService.validateEnvelope(response.envelope, input.now ?? new Date(), false)
    if (!envelopeValidation.ok) {
      return {
        result: response,
        quarantined: this.quarantineService.quarantine({
          reason: 'schema_mismatch',
          requestId: response.requestId,
          namespace: response.envelope.namespace,
          objectId: response.envelope.objectId,
          detail: envelopeValidation.error.message,
          now: input.now,
        }),
      }
    }
    const signerIdentity = this.resolveSignerIdentity(response.envelope.signerDeviceId)
    if (!signerIdentity) {
      return {
        result: response,
        quarantined: this.quarantineService.quarantine({
          reason: 'unknown_device',
          requestId: response.requestId,
          namespace: response.envelope.namespace,
          objectId: response.envelope.objectId,
          detail: 'Downloaded envelope signer is not trusted locally.',
          now: input.now,
        }),
      }
    }
    const signatureValidation = await this.protocolService.verifySignedRequest({
      request: {
        protocolVersion: response.envelope.protocolVersion,
        method: 'upload',
        namespace: response.envelope.namespace,
        objectId: response.envelope.objectId,
        objectVersion: response.envelope.objectVersion,
        parentVersion: response.envelope.parentVersion,
        signerDeviceId: response.envelope.signerDeviceId,
        requestId: response.envelope.requestId,
        replayId: response.envelope.replayId,
        ciphertextDigest: response.envelope.ciphertextDigest,
        createdAt: response.envelope.createdAt,
        expiresAt: response.envelope.expiresAt,
        signature: response.envelope.signature,
      },
      signerIdentity,
      trustRegistry: this.trustRegistry,
      now: input.now,
      consumeReplay: false,
    })
    if (!signatureValidation.ok) {
      return {
        result: response,
        quarantined: this.quarantineService.quarantine({
          reason: 'bad_signature',
          requestId: response.requestId,
          namespace: response.envelope.namespace,
          objectId: response.envelope.objectId,
          detail: signatureValidation.error.message,
          now: input.now,
        }),
      }
    }
    try {
      const plaintext = await this.envelopeService.decryptEnvelope({
        envelope: response.envelope,
        key: input.decryptionKey,
      })
      return { result: response, plaintext }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to decrypt envelope.'
      return {
        result: response,
        quarantined: this.quarantineService.quarantine({
          reason: 'decryption_failure',
          requestId: response.requestId,
          namespace: response.envelope.namespace,
          objectId: response.envelope.objectId,
          detail: message,
          now: input.now,
        }),
      }
    }
  }
}
