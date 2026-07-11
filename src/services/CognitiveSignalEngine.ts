/**
 * CognitiveSignalEngine
 *
 * Deterministic rule-based cognitive signal analysis engine.
 *
 * Build 014 constraints:
 * - Signals are PROPOSED only. They must never change system behavior.
 * - Analysis only runs when isCognitionEnabled(consent) === true.
 * - All rules are deterministic — no ML, no external AI, no heuristics.
 * - Every signal carries full provenance.
 * - Unknown rules or rule versions fail closed (return null).
 * - Stable signatures prevent duplicate signal accumulation.
 * - Time is injectable for determinism in tests.
 *
 * Zero Trust:
 * - No network requests.
 * - No secret values enter signals, evidence, logs, or audit history.
 * - Fail closed on invalid input, missing consent, or unknown rules.
 */

import type {
  CognitiveSignal,
  CognitiveSignalType,
  CognitiveSignalStatus,
  CognitiveSignalAuditEvent,
  CognitionConsent,
  CognitiveSignalProvenance,
} from '../types/cognitive'
import type { PersonalData } from '../localData'
import type { DeterministicRule } from '../types/cognitive'
import { isCognitionEnabled, isDataCategoryPermitted } from './CognitionConsentService'
import {
  RULE_REGISTRY,
  REGISTRY_VERSION,
  validateRegistry,
  getRuleById,
} from './CognitiveSignalRuleRegistry'
import { createId } from '../localData'

// ---------------------------------------------------------------------------
// Engine result
// ---------------------------------------------------------------------------

export type CognitiveSignalEngineResult = {
  signals: CognitiveSignal[]
  registryVersion: string
  analysisTimestamp: string
  blocked: boolean
  blockReason?: string
}

// ---------------------------------------------------------------------------
// Signature generation
// ---------------------------------------------------------------------------

function buildSignature(
  ruleId: string,
  ruleVersion: string,
  signalType: CognitiveSignalType,
  evidenceIds: string[],
  windowStart: string,
  windowEnd: string,
): string {
  const sorted = [...evidenceIds].sort().join(',')
  return `${ruleId}|${ruleVersion}|${signalType}|${sorted}|${windowStart}|${windowEnd}`
}

// ---------------------------------------------------------------------------
// Audit helpers
// ---------------------------------------------------------------------------

function makeAuditEvent(
  action: CognitiveSignalAuditEvent['action'],
  detail: string,
  now: Date,
): CognitiveSignalAuditEvent {
  return { id: createId('sig-audit'), action, timestamp: now.toISOString(), detail }
}

// ---------------------------------------------------------------------------
// Rule implementations
// ---------------------------------------------------------------------------

function analyzeOverdueCommitmentRecurrence(
  data: PersonalData,
  rule: DeterministicRule,
  windowStart: Date,
  windowEnd: Date,
): Omit<CognitiveSignal, 'id' | 'signature' | 'auditHistory' | 'createdAt' | 'updatedAt'> | null {
  const overdue = data.commitments.filter((c) => {
    if (c.status === 'complete') return false
    const due = c.due ? new Date(c.due) : null
    return due && due < windowEnd && due >= windowStart
  })
  if (overdue.length < rule.minimumEvidenceCount) return null
  const evidenceIds = overdue.map((c) => c.id)
  const expiresAt = rule.expirationDays
    ? new Date(windowEnd.getTime() + rule.expirationDays * 86400000).toISOString()
    : undefined
  return {
    signalType: rule.outputSignalType,
    plainLanguageStatement: `${overdue.length} commitments have been overdue repeatedly in the last ${rule.observationWindowDays} days.`,
    dataCategory: 'commitments',
    evidenceIds,
    evidenceCount: evidenceIds.length,
    deterministicRuleId: rule.ruleId,
    deterministicRuleVersion: rule.ruleVersion,
    confidenceBasis: `${overdue.length} overdue commitments observed in the ${rule.observationWindowDays}-day window.`,
    observationWindowStart: windowStart.toISOString(),
    observationWindowEnd: windowEnd.toISOString(),
    permittedFeatureUses: rule.permittedFeatureSurfaces,
    provenance: buildProvenance(rule, evidenceIds, windowStart, windowEnd),
    status: 'proposed',
    ...(expiresAt ? { expiresAt } : {}),
  }
}

function analyzeRecommendationResponsePattern(
  data: PersonalData,
  rule: DeterministicRule,
  windowStart: Date,
  windowEnd: Date,
): Omit<CognitiveSignal, 'id' | 'signature' | 'auditHistory' | 'createdAt' | 'updatedAt'> | null {
  const outcomes = (data.recommendations ?? []).filter((r) => {
    const ts = r.createdAt ? new Date(r.createdAt) : null
    return ts && ts >= windowStart && ts <= windowEnd && r.dismissed !== undefined
  })
  if (outcomes.length < rule.minimumEvidenceCount) return null
  const dismissed = outcomes.filter((r) => r.dismissed === true).length
  const accepted = outcomes.filter((r) => r.dismissed === false).length
  const dominant = dismissed > accepted ? 'dismiss' : 'accept'
  const evidenceIds = outcomes.map((r) => r.id)
  const expiresAt = rule.expirationDays
    ? new Date(windowEnd.getTime() + rule.expirationDays * 86400000).toISOString()
    : undefined
  return {
    signalType: rule.outputSignalType,
    plainLanguageStatement: `In the last ${rule.observationWindowDays} days, ${outcomes.length} recommendations were responded to with a consistent ${dominant} pattern.`,
    dataCategory: 'recommendation_outcomes',
    evidenceIds,
    evidenceCount: evidenceIds.length,
    deterministicRuleId: rule.ruleId,
    deterministicRuleVersion: rule.ruleVersion,
    confidenceBasis: `${dismissed} dismissed, ${accepted} accepted out of ${outcomes.length} recommendations in window.`,
    observationWindowStart: windowStart.toISOString(),
    observationWindowEnd: windowEnd.toISOString(),
    permittedFeatureUses: rule.permittedFeatureSurfaces,
    provenance: buildProvenance(rule, evidenceIds, windowStart, windowEnd),
    status: 'proposed',
    ...(expiresAt ? { expiresAt } : {}),
  }
}

function analyzeRepeatedDecisionReopening(
  data: PersonalData,
  rule: DeterministicRule,
  windowStart: Date,
  windowEnd: Date,
): Omit<CognitiveSignal, 'id' | 'signature' | 'auditHistory' | 'createdAt' | 'updatedAt'> | null {
  // Detect decisions that remain open and were created within the window —
  // these represent decisions that have not been resolved (a proxy for stalling/revisiting).
  const unresolved = data.decisions.filter((d) => {
    const ts = d.createdAt ? new Date(d.createdAt) : null
    return ts && ts >= windowStart && ts <= windowEnd && d.status === 'open'
  })
  if (unresolved.length < rule.minimumEvidenceCount) return null
  const evidenceIds = unresolved.map((d) => d.id)
  const expiresAt = rule.expirationDays
    ? new Date(windowEnd.getTime() + rule.expirationDays * 86400000).toISOString()
    : undefined
  return {
    signalType: rule.outputSignalType,
    plainLanguageStatement: `${unresolved.length} decisions remain unresolved in the last ${rule.observationWindowDays} days.`,
    dataCategory: 'decisions',
    evidenceIds,
    evidenceCount: evidenceIds.length,
    deterministicRuleId: rule.ruleId,
    deterministicRuleVersion: rule.ruleVersion,
    confidenceBasis: `${unresolved.length} open decisions in the ${rule.observationWindowDays}-day window.`,
    observationWindowStart: windowStart.toISOString(),
    observationWindowEnd: windowEnd.toISOString(),
    permittedFeatureUses: rule.permittedFeatureSurfaces,
    provenance: buildProvenance(rule, evidenceIds, windowStart, windowEnd),
    status: 'proposed',
    ...(expiresAt ? { expiresAt } : {}),
  }
}

function analyzeMissionCompletionSequence(
  data: PersonalData,
  rule: DeterministicRule,
  windowStart: Date,
  windowEnd: Date,
): Omit<CognitiveSignal, 'id' | 'signature' | 'auditHistory' | 'createdAt' | 'updatedAt'> | null {
  const missions = (data.missionPlans ?? []).filter((m) => {
    const ts = m.createdAt ? new Date(m.createdAt) : null
    return ts && ts >= windowStart && ts <= windowEnd
  })
  if (missions.length < rule.minimumEvidenceCount) return null
  const evidenceIds = missions.map((m) => m.id)
  const completed = missions.filter((m) => m.status === 'completed').length
  const expiresAt = rule.expirationDays
    ? new Date(windowEnd.getTime() + rule.expirationDays * 86400000).toISOString()
    : undefined
  return {
    signalType: rule.outputSignalType,
    plainLanguageStatement: `${missions.length} mission sequences observed in the last ${rule.observationWindowDays} days. ${completed} completed.`,
    dataCategory: 'missions',
    evidenceIds,
    evidenceCount: evidenceIds.length,
    deterministicRuleId: rule.ruleId,
    deterministicRuleVersion: rule.ruleVersion,
    confidenceBasis: `${missions.length} missions in window; ${completed} completed.`,
    observationWindowStart: windowStart.toISOString(),
    observationWindowEnd: windowEnd.toISOString(),
    permittedFeatureUses: rule.permittedFeatureSurfaces,
    provenance: buildProvenance(rule, evidenceIds, windowStart, windowEnd),
    status: 'proposed',
    ...(expiresAt ? { expiresAt } : {}),
  }
}

function analyzeReviewTimingPreference(
  data: PersonalData,
  rule: DeterministicRule,
  windowStart: Date,
  windowEnd: Date,
): Omit<CognitiveSignal, 'id' | 'signature' | 'auditHistory' | 'createdAt' | 'updatedAt'> | null {
  const actions = [
    ...data.decisions.map((d) => ({ id: d.id, ts: d.createdAt })),
    ...data.reflections.map((r) => ({ id: r.id, ts: r.createdAt })),
  ].filter(({ ts }) => {
    const t = ts ? new Date(ts) : null
    return t && t >= windowStart && t <= windowEnd
  })
  if (actions.length < rule.minimumEvidenceCount) return null
  const evidenceIds = actions.map((a) => a.id)
  const expiresAt = rule.expirationDays
    ? new Date(windowEnd.getTime() + rule.expirationDays * 86400000).toISOString()
    : undefined
  return {
    signalType: rule.outputSignalType,
    plainLanguageStatement: `${actions.length} review actions observed in the last ${rule.observationWindowDays} days. Timing distribution recorded.`,
    dataCategory: 'review_history',
    evidenceIds,
    evidenceCount: evidenceIds.length,
    deterministicRuleId: rule.ruleId,
    deterministicRuleVersion: rule.ruleVersion,
    confidenceBasis: `${actions.length} decision and reflection records in the ${rule.observationWindowDays}-day window.`,
    observationWindowStart: windowStart.toISOString(),
    observationWindowEnd: windowEnd.toISOString(),
    permittedFeatureUses: rule.permittedFeatureSurfaces,
    provenance: buildProvenance(rule, evidenceIds, windowStart, windowEnd),
    status: 'proposed',
    ...(expiresAt ? { expiresAt } : {}),
  }
}

// summary_vs_detail_preference and preferred_evidence_depth require explicit
// preference capture not available in Build 014. They always return null.
function analyzeSummaryVsDetail(): null { return null }
function analyzePreferredEvidenceDepth(): null { return null }

// ---------------------------------------------------------------------------
// Provenance builder
// ---------------------------------------------------------------------------

function buildProvenance(
  rule: DeterministicRule,
  evidenceIds: string[],
  windowStart: Date,
  windowEnd: Date,
): CognitiveSignalProvenance {
  return {
    deterministicRuleId: rule.ruleId,
    ruleVersion: rule.ruleVersion,
    evidenceIds: [...evidenceIds],
    analysisTimestamp: windowEnd.toISOString(),
    observationWindowStart: windowStart.toISOString(),
    observationWindowEnd: windowEnd.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Core analysis functions
// ---------------------------------------------------------------------------

export function validateSignal(signal: CognitiveSignal): boolean {
  if (!signal.id || !signal.signalType || !signal.deterministicRuleId || !signal.signature) return false
  if (!signal.provenance) return false
  if (!Array.isArray(signal.evidenceIds) || !Array.isArray(signal.auditHistory)) return false
  const rule = getRuleById(signal.deterministicRuleId, signal.deterministicRuleVersion)
  if (!rule) return false
  return true
}

export function analyzeRule(
  ruleId: string,
  ruleVersion: string,
  data: PersonalData,
  consent: CognitionConsent,
  now: Date,
): CognitiveSignal | null {
  const rule = getRuleById(ruleId, ruleVersion)
  if (!rule) return null

  // All required categories must be permitted
  for (const category of rule.permittedInputCategories) {
    if (!isDataCategoryPermitted(consent, category)) return null
  }

  const windowStart = new Date(now.getTime() - rule.observationWindowDays * 86400000)
  const windowEnd = now

  let partial: Omit<CognitiveSignal, 'id' | 'signature' | 'auditHistory' | 'createdAt' | 'updatedAt'> | null = null

  switch (rule.ruleId) {
    case 'overdue_commitment_recurrence':
      partial = analyzeOverdueCommitmentRecurrence(data, rule, windowStart, windowEnd)
      break
    case 'recommendation_response_pattern':
      partial = analyzeRecommendationResponsePattern(data, rule, windowStart, windowEnd)
      break
    case 'repeated_decision_reopening':
      partial = analyzeRepeatedDecisionReopening(data, rule, windowStart, windowEnd)
      break
    case 'mission_completion_sequence':
      partial = analyzeMissionCompletionSequence(data, rule, windowStart, windowEnd)
      break
    case 'review_timing_preference':
      partial = analyzeReviewTimingPreference(data, rule, windowStart, windowEnd)
      break
    case 'summary_vs_detail_preference':
      partial = analyzeSummaryVsDetail()
      break
    case 'preferred_evidence_depth':
      partial = analyzePreferredEvidenceDepth()
      break
    default:
      return null
  }

  if (!partial) return null

  const signature = buildSignature(
    rule.ruleId,
    rule.ruleVersion,
    partial.signalType,
    partial.evidenceIds,
    partial.observationWindowStart,
    partial.observationWindowEnd,
  )

  const signal: CognitiveSignal = {
    ...partial,
    id: createId('sig'),
    signature,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    auditHistory: [makeAuditEvent('proposed', `Rule ${rule.ruleId}@${rule.ruleVersion} produced signal.`, now)],
  }

  return signal
}

export function deduplicateSignals(
  existing: CognitiveSignal[],
  incoming: CognitiveSignal[],
): CognitiveSignal[] {
  const existingSignatures = new Set(existing.map((s) => s.signature))
  return incoming.filter((s) => !existingSignatures.has(s.signature))
}

export function expireSignals(signals: CognitiveSignal[], now: Date): CognitiveSignal[] {
  return signals.map((s) => {
    if (s.status === 'expired' || s.status === 'suppressed') return s
    if (s.expiresAt && new Date(s.expiresAt) <= now) {
      return {
        ...s,
        status: 'expired' as CognitiveSignalStatus,
        expiredAt: now.toISOString(),
        updatedAt: now.toISOString(),
        auditHistory: [
          ...s.auditHistory,
          makeAuditEvent('expired', `Signal expired at ${now.toISOString()}.`, now),
        ],
      }
    }
    return s
  })
}

export function suppressSignal(signals: CognitiveSignal[], signalId: string, now: Date): CognitiveSignal[] {
  return signals.map((s) => {
    if (s.id !== signalId) return s
    if (s.status === 'suppressed' || s.status === 'expired') return s
    return {
      ...s,
      status: 'suppressed' as CognitiveSignalStatus,
      suppressedAt: now.toISOString(),
      updatedAt: now.toISOString(),
      auditHistory: [
        ...s.auditHistory,
        makeAuditEvent('suppressed', `Operator suppressed signal at ${now.toISOString()}.`, now),
      ],
    }
  })
}

export function getActiveSignals(signals: CognitiveSignal[]): CognitiveSignal[] {
  return signals.filter((s) => s.status === 'proposed' || s.status === 'observed')
}

export function explainSignal(signal: CognitiveSignal): string {
  const rule = getRuleById(signal.deterministicRuleId, signal.deterministicRuleVersion)
  if (!rule) return `Signal type: ${signal.signalType}. Rule not found in registry.`
  return [
    `Signal: ${signal.plainLanguageStatement}`,
    `Rule: ${rule.ruleId} v${rule.ruleVersion}`,
    `Purpose: ${rule.purpose}`,
    `Confidence basis: ${signal.confidenceBasis}`,
    `Evidence count: ${signal.evidenceCount}`,
    `Observation window: ${signal.observationWindowStart} → ${signal.observationWindowEnd}`,
    `Prohibited inference: ${rule.prohibitedInferenceNote}`,
    `Status: ${signal.status}`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Top-level analyze
// ---------------------------------------------------------------------------

export function analyze(
  data: PersonalData,
  consent: CognitionConsent | undefined,
  now?: Date,
): CognitiveSignalEngineResult {
  const analysisTime = now ?? new Date()

  if (!isCognitionEnabled(consent)) {
    return {
      signals: [],
      registryVersion: REGISTRY_VERSION,
      analysisTimestamp: analysisTime.toISOString(),
      blocked: true,
      blockReason: 'Cognition consent is not enabled.',
    }
  }

  const registryValidation = validateRegistry(RULE_REGISTRY)
  if (!registryValidation.valid) {
    return {
      signals: [],
      registryVersion: REGISTRY_VERSION,
      analysisTimestamp: analysisTime.toISOString(),
      blocked: true,
      blockReason: `Registry validation failed: ${registryValidation.errors.join('; ')}`,
    }
  }

  const newSignals: CognitiveSignal[] = []

  for (const rule of RULE_REGISTRY) {
    const signal = analyzeRule(rule.ruleId, rule.ruleVersion, data, consent!, analysisTime)
    if (signal) newSignals.push(signal)
  }

  const existing = expireSignals(data.cognitiveSignals ?? [], analysisTime)
  const deduplicated = deduplicateSignals(existing, newSignals)
  const merged = [...existing, ...deduplicated]

  return {
    signals: merged,
    registryVersion: REGISTRY_VERSION,
    analysisTimestamp: analysisTime.toISOString(),
    blocked: false,
  }
}

export function createSignal(
  partial: Omit<CognitiveSignal, 'id' | 'signature' | 'auditHistory' | 'createdAt' | 'updatedAt'>,
  now: Date,
): CognitiveSignal {
  const signature = buildSignature(
    partial.deterministicRuleId,
    partial.deterministicRuleVersion,
    partial.signalType,
    partial.evidenceIds,
    partial.observationWindowStart,
    partial.observationWindowEnd,
  )
  return {
    ...partial,
    id: createId('sig'),
    signature,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    auditHistory: [makeAuditEvent('proposed', 'Signal created.', now)],
  }
}

export function updateSignal(
  signals: CognitiveSignal[],
  signalId: string,
  updates: Partial<Pick<CognitiveSignal, 'status' | 'expiresAt'>>,
  now: Date,
): CognitiveSignal[] {
  return signals.map((s) => {
    if (s.id !== signalId) return s
    return {
      ...s,
      ...updates,
      updatedAt: now.toISOString(),
      auditHistory: [
        ...s.auditHistory,
        makeAuditEvent('updated', `Signal updated: ${JSON.stringify(updates)}`, now),
      ],
    }
  })
}
