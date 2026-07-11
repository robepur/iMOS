import { createId } from '../localData'
import type {
  DeviceIdentifier,
  DevicePublicIdentity,
  DeviceRegistryValidationResult,
  DeviceStatus,
  DeviceTrustRecord,
  DeviceTrustRegistrySnapshot,
  EnrollmentPackage,
  IdentityLifecycleAuditEvent,
  OperatorApprovalRecord,
  RevocationReason,
} from '../types/deviceIdentity'
import { validateEnrollmentPackage } from './DeviceIdentityService'

const ALLOWED_TRANSITIONS: Record<DeviceStatus, DeviceStatus[]> = {
  proposed: ['proof_verified', 'rejected', 'expired'],
  proof_verified: ['operator_approved', 'rejected', 'expired'],
  operator_approved: ['active', 'rejected', 'expired'],
  active: ['suspended', 'revoked', 'replaced'],
  suspended: ['active', 'revoked', 'replaced'],
  revoked: [],
  replaced: [],
  rejected: [],
  expired: [],
}

function freeze<T>(value: T): T {
  if (!value || typeof value !== 'object') return value
  const obj = value as Record<string, unknown>
  for (const key of Object.keys(obj)) {
    const child = obj[key]
    if (child && typeof child === 'object') freeze(child)
  }
  return Object.freeze(value)
}

function cloneRecord(record: DeviceTrustRecord): DeviceTrustRecord {
  return {
    ...record,
    publicIdentity: { ...record.publicIdentity },
    operatorApproval: record.operatorApproval ? { ...record.operatorApproval } : undefined,
    replacement: record.replacement ? { ...record.replacement } : undefined,
  }
}

function statusToTrustState(status: DeviceStatus): DeviceTrustRecord['trustState'] {
  if (status === 'active') return 'trusted'
  if (status === 'suspended') return 'suspended'
  if (status === 'revoked') return 'revoked'
  if (status === 'replaced') return 'replaced'
  return 'untrusted'
}

function statusToEnrollmentState(status: DeviceStatus): DeviceTrustRecord['enrollmentState'] {
  if (status === 'proof_verified') return 'proof_verified'
  if (status === 'operator_approved') return 'operator_approved'
  if (status === 'active') return 'active'
  if (status === 'rejected') return 'rejected'
  if (status === 'expired') return 'expired'
  return 'proposed'
}

export class DeviceTrustRegistry {
  private readonly records = new Map<DeviceIdentifier, DeviceTrustRecord>()
  private readonly audits: IdentityLifecycleAuditEvent[] = []
  private readonly currentDeviceId: DeviceIdentifier

  constructor(currentDevice: DevicePublicIdentity, now = new Date()) {
    this.currentDeviceId = currentDevice.deviceId
    const timestamp = now.toISOString()
    const currentRecord: DeviceTrustRecord = {
      deviceId: currentDevice.deviceId,
      status: 'active',
      trustState: 'trusted',
      enrollmentState: 'active',
      revocationState: 'none',
      publicIdentity: { ...currentDevice, enrolledAt: currentDevice.enrolledAt ?? timestamp },
      operatorApproval: { approvedBy: 'local_operator', approvedAt: timestamp, rationale: 'Local device bootstrap.' },
      createdAt: timestamp,
      updatedAt: timestamp,
      proofVerifiedAt: timestamp,
    }
    this.records.set(currentDevice.deviceId, currentRecord)
    this.audit('device_generated', currentDevice.deviceId, 'current_device_initialized', 'Current local device initialized as trusted.', timestamp)
  }

  private audit(
    action: IdentityLifecycleAuditEvent['action'],
    deviceId: DeviceIdentifier,
    reasonCode: string,
    detail: string,
    timestamp: string,
    actor: IdentityLifecycleAuditEvent['actor'] = 'system',
  ): void {
    this.audits.unshift({
      id: createId('device-audit'),
      action,
      actor,
      deviceId,
      timestamp,
      reasonCode,
      detail,
    })
    if (this.audits.length > 500) this.audits.length = 500
  }

  private findByFingerprint(fingerprint: string): DeviceTrustRecord | undefined {
    return [...this.records.values()].find(record => record.publicIdentity.keyFingerprint === fingerprint)
  }

  private findByPublicKey(spki: string): DeviceTrustRecord | undefined {
    return [...this.records.values()].find(record => record.publicIdentity.publicSigningKeySpki === spki)
  }

  private transition(
    deviceId: DeviceIdentifier,
    nextStatus: DeviceStatus,
    now = new Date(),
    reasonCode = 'status_transition',
    actor: IdentityLifecycleAuditEvent['actor'] = 'system',
  ): { ok: true; record: DeviceTrustRecord } | { ok: false; reason: string } {
    const current = this.records.get(deviceId)
    if (!current) return { ok: false, reason: 'device_not_found' }
    if (!ALLOWED_TRANSITIONS[current.status].includes(nextStatus)) {
      return { ok: false, reason: 'invalid_transition' }
    }
    if (current.status === 'revoked' && nextStatus !== 'revoked') {
      return { ok: false, reason: 'revoked_terminal' }
    }
    const timestamp = now.toISOString()
    const updated: DeviceTrustRecord = {
      ...current,
      status: nextStatus,
      trustState: statusToTrustState(nextStatus),
      enrollmentState: statusToEnrollmentState(nextStatus),
      updatedAt: timestamp,
      ...(nextStatus === 'expired' ? { expiredAt: timestamp } : {}),
      ...(nextStatus === 'suspended' ? { suspendedAt: timestamp } : {}),
      ...(nextStatus === 'revoked' ? { revokedAt: timestamp, revocationState: 'revoked' as const } : {}),
    }
    this.records.set(deviceId, updated)
    return { ok: true, record: updated }
  }

  async proposeEnrollment(
    pkg: EnrollmentPackage,
    now = new Date(),
  ): Promise<{ ok: true; record: DeviceTrustRecord } | { ok: false; reason: string }> {
    const packageValidation = await validateEnrollmentPackage(pkg, now)
    if (!packageValidation.valid) return { ok: false, reason: packageValidation.reason }
    if (this.records.has(pkg.deviceId)) return { ok: false, reason: 'duplicate_device_id' }
    const sameFingerprint = this.findByFingerprint(pkg.keyFingerprint)
    if (sameFingerprint) return { ok: false, reason: 'duplicate_fingerprint' }
    const samePublicKey = this.findByPublicKey(pkg.publicSigningKeySpki)
    if (samePublicKey) return { ok: false, reason: 'duplicate_public_key' }

    const timestamp = now.toISOString()
    const record: DeviceTrustRecord = {
      deviceId: pkg.deviceId,
      status: 'proposed',
      trustState: 'untrusted',
      enrollmentState: 'proposed',
      revocationState: 'none',
      publicIdentity: {
        deviceId: pkg.deviceId,
        displayLabel: pkg.proposedDeviceLabel,
        keyVersion: pkg.keyVersion,
        cryptoSuiteVersion: pkg.cryptoSuiteVersion,
        createdAt: pkg.createdAt,
        enrolledAt: undefined,
        lastLocallyObservedAt: timestamp,
        publicSigningKeySpki: pkg.publicSigningKeySpki,
        keyFingerprint: pkg.keyFingerprint,
        schemaVersion: pkg.schemaVersion,
        policyVersion: pkg.policyVersion,
        issuerIdentity: pkg.issuerIdentity,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    this.records.set(pkg.deviceId, record)
    this.audit('enrollment_proposed', pkg.deviceId, 'enrollment_proposed', 'Enrollment package accepted as proposed.', timestamp, 'local_operator')
    return { ok: true, record: cloneRecord(record) }
  }

  markProofVerified(deviceId: DeviceIdentifier, now = new Date()): { ok: true; record: DeviceTrustRecord } | { ok: false; reason: string } {
    const result = this.transition(deviceId, 'proof_verified', now, 'proof_verified')
    if (!result.ok) return result
    const updated = { ...result.record, proofVerifiedAt: now.toISOString() }
    this.records.set(deviceId, updated)
    this.audit('proof_verified', deviceId, 'proof_verified', 'Proof of possession verified.', now.toISOString(), 'system')
    return { ok: true, record: cloneRecord(updated) }
  }

  approveDevice(
    deviceId: DeviceIdentifier,
    approval: OperatorApprovalRecord,
    now = new Date(),
  ): { ok: true; record: DeviceTrustRecord } | { ok: false; reason: string } {
    const transitioned = this.transition(deviceId, 'operator_approved', now, 'operator_approved', 'local_operator')
    if (!transitioned.ok) return transitioned
    const updated = {
      ...transitioned.record,
      operatorApproval: { ...approval },
      updatedAt: now.toISOString(),
    }
    this.records.set(deviceId, updated)
    this.audit('operator_approved', deviceId, 'operator_approved', 'Operator approval recorded.', now.toISOString(), 'local_operator')
    return { ok: true, record: cloneRecord(updated) }
  }

  activateDevice(deviceId: DeviceIdentifier, now = new Date()): { ok: true; record: DeviceTrustRecord } | { ok: false; reason: string } {
    const current = this.records.get(deviceId)
    if (!current) return { ok: false, reason: 'device_not_found' }
    if (!current.operatorApproval) return { ok: false, reason: 'operator_approval_required' }
    const transitioned = this.transition(deviceId, 'active', now, 'device_activated')
    if (!transitioned.ok) return transitioned
    const updated = {
      ...transitioned.record,
      publicIdentity: {
        ...transitioned.record.publicIdentity,
        enrolledAt: transitioned.record.publicIdentity.enrolledAt ?? now.toISOString(),
        lastLocallyObservedAt: now.toISOString(),
      },
    }
    this.records.set(deviceId, updated)
    this.audit('device_activated', deviceId, 'device_activated', 'Device is active and trusted.', now.toISOString(), 'local_operator')
    return { ok: true, record: cloneRecord(updated) }
  }

  rejectEnrollment(deviceId: DeviceIdentifier, reason: string, now = new Date()): { ok: true; record: DeviceTrustRecord } | { ok: false; reason: string } {
    const transitioned = this.transition(deviceId, 'rejected', now, 'enrollment_rejected')
    if (!transitioned.ok) return transitioned
    const updated = { ...transitioned.record, rejectionReason: reason }
    this.records.set(deviceId, updated)
    this.audit('enrollment_rejected', deviceId, 'enrollment_rejected', reason, now.toISOString(), 'local_operator')
    return { ok: true, record: cloneRecord(updated) }
  }

  expireEnrollment(deviceId: DeviceIdentifier, now = new Date()): { ok: true; record: DeviceTrustRecord } | { ok: false; reason: string } {
    const transitioned = this.transition(deviceId, 'expired', now, 'enrollment_expired')
    if (!transitioned.ok) return transitioned
    this.audit('enrollment_expired', deviceId, 'enrollment_expired', 'Enrollment proposal expired.', now.toISOString(), 'system')
    return { ok: true, record: cloneRecord(transitioned.record) }
  }

  suspendDevice(deviceId: DeviceIdentifier, now = new Date()): { ok: true; record: DeviceTrustRecord } | { ok: false; reason: string } {
    const transitioned = this.transition(deviceId, 'suspended', now, 'device_suspended', 'local_operator')
    if (!transitioned.ok) return transitioned
    this.audit('device_suspended', deviceId, 'device_suspended', 'Device suspended by operator.', now.toISOString(), 'local_operator')
    return { ok: true, record: cloneRecord(transitioned.record) }
  }

  revokeDevice(
    deviceId: DeviceIdentifier,
    revocationReason: RevocationReason,
    now = new Date(),
  ): { ok: true; record: DeviceTrustRecord } | { ok: false; reason: string } {
    const transitioned = this.transition(deviceId, 'revoked', now, 'device_revoked', 'local_operator')
    if (!transitioned.ok) return transitioned
    const updated = {
      ...transitioned.record,
      revocationReason,
      revocationState: 'revoked' as const,
    }
    this.records.set(deviceId, updated)
    this.audit('device_revoked', deviceId, 'device_revoked', `Revoked: ${revocationReason}.`, now.toISOString(), 'local_operator')
    return { ok: true, record: cloneRecord(updated) }
  }

  replaceDevice(
    replacedDeviceId: DeviceIdentifier,
    replacementDeviceId: DeviceIdentifier,
    now = new Date(),
  ): { ok: true } | { ok: false; reason: string } {
    const previous = this.records.get(replacedDeviceId)
    const next = this.records.get(replacementDeviceId)
    if (!previous || !next) return { ok: false, reason: 'device_not_found' }
    if (next.status !== 'active') return { ok: false, reason: 'replacement_device_not_active' }
    if (replacedDeviceId === replacementDeviceId) return { ok: false, reason: 'replacement_device_same_as_source' }
    if (this.wouldCreateReplacementCycle(replacedDeviceId, replacementDeviceId)) {
      return { ok: false, reason: 'replacement_cycle_detected' }
    }
    const transitioned = this.transition(replacedDeviceId, 'replaced', now, 'device_replaced', 'local_operator')
    if (!transitioned.ok) return transitioned
    const updatedPrev = {
      ...transitioned.record,
      replacement: {
        ...(transitioned.record.replacement ?? {}),
        replacedByDeviceId: replacementDeviceId,
        replacedAt: now.toISOString(),
      },
    }
    const updatedNext = {
      ...next,
      replacement: {
        ...(next.replacement ?? {}),
        replacesDeviceId: replacedDeviceId,
      },
    }
    this.records.set(replacedDeviceId, updatedPrev)
    this.records.set(replacementDeviceId, updatedNext)
    this.audit('device_replaced', replacedDeviceId, 'device_replaced', `Replaced by ${replacementDeviceId}.`, now.toISOString(), 'local_operator')
    return { ok: true }
  }

  private wouldCreateReplacementCycle(source: DeviceIdentifier, candidate: DeviceIdentifier): boolean {
    let cursor: DeviceIdentifier | undefined = candidate
    const seen = new Set<string>()
    while (cursor) {
      if (cursor === source) return true
      if (seen.has(cursor)) return true
      seen.add(cursor)
      const record = this.records.get(cursor)
      cursor = record?.replacement?.replacesDeviceId
    }
    return false
  }

  canAuthorize(deviceId: DeviceIdentifier): boolean {
    const record = this.records.get(deviceId)
    if (!record) return false
    return record.status === 'active' && record.trustState === 'trusted' && record.revocationState === 'none'
  }

  listByStatus(status: DeviceStatus): DeviceTrustRecord[] {
    return [...this.records.values()]
      .filter(record => record.status === status)
      .map(cloneRecord)
      .sort((a, b) => a.deviceId.localeCompare(b.deviceId))
  }

  getAuditEvents(): IdentityLifecycleAuditEvent[] {
    return this.audits.map(event => ({ ...event }))
  }

  validate(): DeviceRegistryValidationResult {
    const reasons = new Set<DeviceRegistryValidationResult['reasons'][number]>()
    const ids = new Set<string>()
    const fingerprints = new Set<string>()
    const publicKeys = new Set<string>()

    for (const record of this.records.values()) {
      if (ids.has(record.deviceId)) reasons.add('duplicate_device_id')
      ids.add(record.deviceId)
      if (fingerprints.has(record.publicIdentity.keyFingerprint)) reasons.add('duplicate_fingerprint')
      fingerprints.add(record.publicIdentity.keyFingerprint)
      if (publicKeys.has(record.publicIdentity.publicSigningKeySpki)) reasons.add('duplicate_public_key')
      publicKeys.add(record.publicIdentity.publicSigningKeySpki)

      if (record.revocationState === 'revoked' && record.status !== 'revoked') reasons.add('revoked_reactivation')
      if (!Object.keys(ALLOWED_TRANSITIONS).includes(record.status)) reasons.add('invalid_transition')
    }

    return { valid: reasons.size === 0, reasons: [...reasons].sort() }
  }

  snapshot(): DeviceTrustRegistrySnapshot {
    const records = [...this.records.values()]
      .map(cloneRecord)
      .sort((a, b) => a.deviceId.localeCompare(b.deviceId))
    const snapshot: DeviceTrustRegistrySnapshot = {
      currentDeviceId: this.currentDeviceId,
      records,
      validation: this.validate(),
    }
    return freeze(snapshot)
  }
}
