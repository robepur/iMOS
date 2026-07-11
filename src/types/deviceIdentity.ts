export type DeviceIdentifier = `device:${string}`
export type DeviceDisplayLabel = string
export type DeviceKeyVersion = `${number}.${number}.${number}`
export type CryptoSuiteVersion = `${number}.${number}.${number}`
export type DeviceSchemaVersion = `${number}.${number}.${number}`
export type DevicePolicyVersion = `${number}.${number}.${number}`

export type DeviceStatus =
  | 'proposed'
  | 'proof_verified'
  | 'operator_approved'
  | 'active'
  | 'rejected'
  | 'expired'
  | 'suspended'
  | 'revoked'
  | 'replaced'

export type DeviceTrustState = 'untrusted' | 'trusted' | 'suspended' | 'revoked' | 'replaced'

export type EnrollmentState =
  | 'none'
  | 'proposed'
  | 'proof_verified'
  | 'operator_approved'
  | 'active'
  | 'rejected'
  | 'expired'

export type RevocationState = 'none' | 'revoked'

export type RevocationReason =
  | 'operator_initiated'
  | 'device_compromised'
  | 'device_lost'
  | 'key_rotation'
  | 'policy_violation'
  | 'replacement'

export type OperatorApprovalRecord = {
  approvedBy: 'local_operator'
  approvedAt: string
  rationale?: string
}

export type DevicePublicIdentity = {
  deviceId: DeviceIdentifier
  displayLabel: DeviceDisplayLabel
  keyVersion: DeviceKeyVersion
  cryptoSuiteVersion: CryptoSuiteVersion
  createdAt: string
  enrolledAt?: string
  lastLocallyObservedAt: string
  publicSigningKeySpki: string
  keyFingerprint: string
  schemaVersion: DeviceSchemaVersion
  policyVersion: DevicePolicyVersion
  issuerIdentity: 'local_operator'
}

export type ReplacementRelationship = {
  replacedByDeviceId?: DeviceIdentifier
  replacesDeviceId?: DeviceIdentifier
  replacedAt?: string
}

export type DeviceTrustRecord = {
  deviceId: DeviceIdentifier
  status: DeviceStatus
  trustState: DeviceTrustState
  enrollmentState: EnrollmentState
  revocationState: RevocationState
  revocationReason?: RevocationReason
  publicIdentity: DevicePublicIdentity
  operatorApproval?: OperatorApprovalRecord
  replacement?: ReplacementRelationship
  createdAt: string
  updatedAt: string
  proofVerifiedAt?: string
  rejectionReason?: string
  expiredAt?: string
  suspendedAt?: string
  revokedAt?: string
}

export type IdentityLifecycleAuditAction =
  | 'device_generated'
  | 'enrollment_proposed'
  | 'proof_verified'
  | 'operator_approved'
  | 'device_activated'
  | 'enrollment_rejected'
  | 'enrollment_expired'
  | 'device_suspended'
  | 'device_revoked'
  | 'device_replaced'
  | 'message_verified'
  | 'message_rejected'

export type IdentityLifecycleAuditEvent = {
  id: string
  action: IdentityLifecycleAuditAction
  actor: 'local_operator' | 'system'
  deviceId: DeviceIdentifier
  timestamp: string
  reasonCode: string
  detail: string
}

export type EnrollmentPackage = {
  packageVersion: '1.0.0'
  purpose: 'device_enrollment'
  schemaVersion: DeviceSchemaVersion
  policyVersion: DevicePolicyVersion
  deviceId: DeviceIdentifier
  publicSigningKeySpki: string
  cryptoSuiteVersion: CryptoSuiteVersion
  keyVersion: DeviceKeyVersion
  keyFingerprint: string
  proposedDeviceLabel: DeviceDisplayLabel
  createdAt: string
  expiresAt: string
  enrollmentNonce: string
  issuerIdentity: 'local_operator'
  proofOfPossessionRequired: boolean
}

export type ProofChallenge = {
  challengeVersion: '1.0.0'
  purpose: 'proof_of_possession'
  challengeId: string
  expectedDeviceId: DeviceIdentifier
  expectedKeyFingerprint: string
  packageDigest: string
  nonce: string
  issuedAt: string
  expiresAt: string
}

export type ProofOfPossession = {
  proofVersion: '1.0.0'
  challengeId: string
  claimedDeviceId: DeviceIdentifier
  algorithm: 'ECDSA_P256_SHA256'
  signedAt: string
  signature: string
}

export type DeviceMessagePurpose =
  | 'identity_attestation'
  | 'enrollment_proposal'
  | 'trust_ping'

export type SignedDeviceMessage = {
  messageVersion: '1.0.0'
  cryptoSuiteVersion: CryptoSuiteVersion
  signerDeviceId: DeviceIdentifier
  purpose: DeviceMessagePurpose
  createdAt: string
  expiresAt: string
  nonce: string
  payload: unknown
  signature: string
}

export type DeviceIdentityValidationResult =
  | { valid: true }
  | { valid: false; reason: string }

export type DeviceRegistryValidationResult = {
  valid: boolean
  reasons: Array<
    | 'duplicate_device_id'
    | 'duplicate_fingerprint'
    | 'duplicate_public_key'
    | 'invalid_transition'
    | 'revoked_reactivation'
  >
}

export type DeviceTrustRegistrySnapshot = {
  currentDeviceId: DeviceIdentifier
  records: DeviceTrustRecord[]
  validation: DeviceRegistryValidationResult
}
