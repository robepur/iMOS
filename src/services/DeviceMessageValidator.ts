import type {
  DeviceIdentityValidationResult,
  DeviceMessagePurpose,
  DeviceTrustRegistrySnapshot,
  SignedDeviceMessage,
} from '../types/deviceIdentity'
import type { ReplayGuard } from './DeviceIdentityService'
import { canonicalizeUtf8 } from './DeviceIdentityService'

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function findSigner(snapshot: DeviceTrustRegistrySnapshot, deviceId: string) {
  return snapshot.records.find(record => record.deviceId === deviceId) ?? null
}

function isIsoTimestamp(value: string): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

async function importPublicKey(spkiBase64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki',
    base64ToBytes(spkiBase64),
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['verify'],
  )
}

function messageSigningPayload(message: Omit<SignedDeviceMessage, 'signature'>): Uint8Array {
  return canonicalizeUtf8({
    domain: `signed_device_message:${message.purpose}`,
    messageVersion: message.messageVersion,
    cryptoSuiteVersion: message.cryptoSuiteVersion,
    signerDeviceId: message.signerDeviceId,
    purpose: message.purpose,
    createdAt: message.createdAt,
    expiresAt: message.expiresAt,
    nonce: message.nonce,
    payload: message.payload,
  })
}

export async function signDeviceMessage(
  message: Omit<SignedDeviceMessage, 'signature'>,
  privateKey: CryptoKey,
): Promise<SignedDeviceMessage> {
  if (message.cryptoSuiteVersion !== '1.0.0') {
    throw new Error('Unsupported message cryptographic suite version.')
  }
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    messageSigningPayload(message),
  )
  let binary = ''
  new Uint8Array(signature).forEach((byte) => { binary += String.fromCharCode(byte) })
  return { ...message, signature: btoa(binary) }
}

export async function validateSignedDeviceMessage(input: {
  message: SignedDeviceMessage
  snapshot: DeviceTrustRegistrySnapshot
  replayGuard: ReplayGuard
  requiredPurpose: DeviceMessagePurpose
  now?: Date
}): Promise<DeviceIdentityValidationResult> {
  const now = input.now ?? new Date()
  const { message, snapshot, replayGuard, requiredPurpose } = input
  if (!snapshot.validation.valid) return { valid: false, reason: 'registry_invalid' }
  if (message.messageVersion !== '1.0.0') return { valid: false, reason: 'message_version_unsupported' }
  if (message.cryptoSuiteVersion !== '1.0.0') return { valid: false, reason: 'message_suite_version_unsupported' }
  if (!isIsoTimestamp(message.createdAt) || !isIsoTimestamp(message.expiresAt)) {
    return { valid: false, reason: 'message_timestamp_invalid' }
  }
  if (!message.nonce || message.nonce.length < 8) return { valid: false, reason: 'nonce_invalid' }
  if (message.purpose !== requiredPurpose) return { valid: false, reason: 'purpose_invalid' }

  const createdAtMs = Date.parse(message.createdAt)
  const expiresAtMs = Date.parse(message.expiresAt)
  if (createdAtMs > now.getTime() + 60_000) return { valid: false, reason: 'message_from_future' }
  if (expiresAtMs <= createdAtMs) return { valid: false, reason: 'message_expiration_invalid' }
  if (expiresAtMs - createdAtMs > 5 * 60_000) return { valid: false, reason: 'message_ttl_exceeds_limit' }
  if (expiresAtMs <= now.getTime()) return { valid: false, reason: 'message_expired' }

  const signer = findSigner(snapshot, message.signerDeviceId)
  if (!signer) return { valid: false, reason: 'signer_unknown' }
  if (signer.status !== 'active' || signer.trustState !== 'trusted') {
    return { valid: false, reason: 'signer_not_trusted' }
  }
  if (signer.revocationState === 'revoked') return { valid: false, reason: 'signer_revoked' }

  try {
    const verifyKey = await importPublicKey(signer.publicIdentity.publicSigningKeySpki)
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      verifyKey,
      base64ToBytes(message.signature),
      messageSigningPayload({
        messageVersion: message.messageVersion,
        cryptoSuiteVersion: message.cryptoSuiteVersion,
        signerDeviceId: message.signerDeviceId,
        purpose: message.purpose,
        createdAt: message.createdAt,
        expiresAt: message.expiresAt,
        nonce: message.nonce,
        payload: message.payload,
      }),
    )
    if (!ok) return { valid: false, reason: 'signature_invalid' }
  } catch {
    return { valid: false, reason: 'signature_verification_failed' }
  }

  if (!replayGuard.consumeOnce(`msg:${message.signerDeviceId}:${message.nonce}`, message.expiresAt, now)) {
    return { valid: false, reason: 'message_replay_detected' }
  }

  return { valid: true }
}
