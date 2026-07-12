import type {
  ConvergenceQuarantineReason,
  ConvergenceReviewReason,
  RemoteObjectDescriptor,
  SyncConvergenceAuditEvent,
  SyncConvergenceOutcome,
  SyncObjectLedgerEntry,
} from '../types/syncConvergence'

function parseVer(v: `${number}`): number {
  return parseInt(v, 10)
}

function quarantine(
  remote: RemoteObjectDescriptor,
  reason: ConvergenceQuarantineReason,
): Extract<SyncConvergenceOutcome, { verdict: 'quarantine_required' }> {
  return {
    verdict: 'quarantine_required',
    namespace: remote.namespace,
    objectId: remote.objectId,
    reason,
    remoteVersion: remote.objectVersion,
  }
}

function review(
  remote: RemoteObjectDescriptor,
  localVersion: `${number}` | undefined,
  reason: ConvergenceReviewReason,
): Extract<SyncConvergenceOutcome, { verdict: 'operator_review_required' }> {
  return {
    verdict: 'operator_review_required',
    namespace: remote.namespace,
    objectId: remote.objectId,
    reason,
    localVersion,
    remoteVersion: remote.objectVersion,
  }
}

/**
 * Deterministic sync convergence engine.
 *
 * Pure function: no network, no side effects, no async.
 * All security-relevant fields on RemoteObjectDescriptor must be resolved
 * by the caller (SyncService) before calling this function.
 *
 * Decision order:
 *   1. Security checks — always first, always fail closed
 *   2. Structural validity (parent version sanity)
 *   3. New object (no ledger entry) — accept remote
 *   4. Key hierarchy binding
 *   5. Version comparison and lineage resolution
 */
export function evaluateConvergence(
  ledgerEntry: SyncObjectLedgerEntry | null,
  remote: RemoteObjectDescriptor,
): SyncConvergenceOutcome {
  // 1. Security checks — signature and signer state must be verified before anything else
  if (!remote.isSignatureVerified) return quarantine(remote, 'bad_signature')
  if (remote.isSignerRevoked) return quarantine(remote, 'revoked_or_suspended_signer')
  if (remote.isSignerSuspended) return quarantine(remote, 'revoked_or_suspended_signer')
  if (!remote.isSignerActive) return quarantine(remote, 'unknown_device')

  // 2. Structural validity: parentVersion must be strictly less than objectVersion
  if (remote.parentVersion !== undefined) {
    if (parseVer(remote.parentVersion) >= parseVer(remote.objectVersion)) {
      return quarantine(remote, 'tampered_parent_version')
    }
  }

  // 3. No prior ledger entry — first time seeing this object; accept unconditionally
  if (ledgerEntry === null) {
    return {
      verdict: 'accept_remote',
      namespace: remote.namespace,
      objectId: remote.objectId,
      objectVersion: remote.objectVersion,
      parentVersion: remote.parentVersion,
      contentDigest: remote.contentDigest,
      tombstone: remote.tombstone,
    }
  }

  // 4. Key hierarchy must match the established chain for this namespace/object
  if (remote.hierarchyId !== ledgerEntry.hierarchyId) {
    return quarantine(remote, 'wrong_key_hierarchy')
  }

  const localVer = parseVer(ledgerEntry.acceptedVersion)
  const remoteVer = parseVer(remote.objectVersion)

  // 5a. Same version number
  if (remoteVer === localVer) {
    if (remote.contentDigest === ledgerEntry.contentDigest) {
      // Identical state — duplicate delivery is idempotent
      return {
        verdict: 'already_synchronized',
        namespace: remote.namespace,
        objectId: remote.objectId,
        objectVersion: remote.objectVersion,
      }
    }
    // Same version, different digest — the content was tampered
    return quarantine(remote, 'tampered_digest')
  }

  // 5b. Remote is older than locally accepted
  if (remoteVer < localVer) {
    // Replay: a version we previously accepted is being re-presented
    if ((ledgerEntry.acceptedVersionHistory as readonly string[]).includes(remote.objectVersion)) {
      return quarantine(remote, 'replay_attempt')
    }
    // Stale: remote simply hasn't caught up to current accepted version
    return {
      verdict: 'accept_local',
      namespace: remote.namespace,
      objectId: remote.objectId,
      localVersion: ledgerEntry.acceptedVersion,
      remoteVersion: remote.objectVersion,
    }
  }

  // 5c. Remote is newer than locally accepted (remoteVer > localVer)

  // Distinguish divergent histories from rollback attempts:
  // - Divergent: remote forked from the SAME parent we forked from (same common ancestor, different paths)
  // - Rollback: remote is trying to build from a DIFFERENT older version (unknown/discarded ancestor)
  if (remote.parentVersion !== undefined && parseVer(remote.parentVersion) < localVer) {
    if (remote.parentVersion === ledgerEntry.acceptedParentVersion) {
      // Both sides evolved from the same ancestor — divergent histories, not a rollback
      return review(remote, ledgerEntry.acceptedVersion, 'divergent_histories')
    }
    // Remote is building from a non-shared older version — explicit rollback attempt
    return quarantine(remote, 'rollback_attempt')
  }

  // Direct descendant: remote's declared parent is exactly our accepted version
  if (remote.parentVersion === ledgerEntry.acceptedVersion) {
    // Tombstone of a live object requires operator confirmation
    if (remote.tombstone && !ledgerEntry.tombstone) {
      return review(remote, ledgerEntry.acceptedVersion, 'tombstone_conflict')
    }
    return {
      verdict: 'accept_remote',
      namespace: remote.namespace,
      objectId: remote.objectId,
      objectVersion: remote.objectVersion,
      parentVersion: remote.parentVersion,
      contentDigest: remote.contentDigest,
      tombstone: remote.tombstone,
    }
  }

  // Divergent: remote is newer but does not descend from the accepted version
  return review(remote, ledgerEntry.acceptedVersion, 'divergent_histories')
}

function verdictToAction(verdict: SyncConvergenceOutcome['verdict']): SyncConvergenceAuditEvent['action'] {
  switch (verdict) {
    case 'already_synchronized': return 'convergence_already_synchronized'
    case 'accept_remote': return 'convergence_accept_remote'
    case 'accept_local': return 'convergence_accept_local'
    case 'operator_review_required': return 'convergence_operator_review_required'
    case 'quarantine_required': return 'convergence_quarantine_required'
  }
}

export function auditConvergenceOutcome(
  outcome: SyncConvergenceOutcome,
  now = new Date(),
): SyncConvergenceAuditEvent {
  const reason =
    'reason' in outcome && outcome.reason !== undefined ? String(outcome.reason) : undefined
  return {
    id: `sync-convergence-audit:${crypto.randomUUID()}`,
    action: verdictToAction(outcome.verdict),
    namespace: outcome.namespace,
    objectId: outcome.objectId,
    verdict: outcome.verdict,
    reason,
    createdAt: now.toISOString(),
  }
}
