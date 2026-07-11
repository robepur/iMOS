/**
 * CognitiveSignalRuleRegistry
 *
 * Versioned registry of all deterministic cognitive signal rules.
 *
 * Rules may only observe behavioral patterns from operator-authored records.
 * Rules must never infer emotion, health, personality, intent, or capability.
 * Unknown rules or versions must fail closed.
 *
 * Build 014: 7 initial rules.
 */

import type { DeterministicRule } from '../types/cognitive'

export const REGISTRY_VERSION = '1.0.0'

export const RULE_REGISTRY: DeterministicRule[] = [
  {
    ruleId: 'overdue_commitment_recurrence',
    ruleVersion: '1.0.0',
    purpose: 'Detect commitments that are repeatedly marked overdue without resolution.',
    permittedInputCategories: ['commitments'],
    minimumEvidenceCount: 3,
    observationWindowDays: 90,
    outputSignalType: 'overdue_commitment_recurrence',
    expirationDays: 30,
    permittedFeatureSurfaces: ['rosie_recommendations', 'review_center', 'morning_brief'],
    plainLanguageTemplate: '{count} commitments have been overdue repeatedly in the last {windowDays} days.',
    prohibitedInferenceNote:
      'Must not infer capability, motivation, stress, or personality. Observes recurrence of overdue state only.',
  },
  {
    ruleId: 'recommendation_response_pattern',
    ruleVersion: '1.0.0',
    purpose: 'Detect whether the operator tends to accept, dismiss, or snooze Rosie recommendations.',
    permittedInputCategories: ['recommendation_outcomes'],
    minimumEvidenceCount: 5,
    observationWindowDays: 60,
    outputSignalType: 'recommendation_response_pattern',
    expirationDays: 45,
    permittedFeatureSurfaces: ['rosie_recommendations', 'review_center'],
    plainLanguageTemplate:
      'In the last {windowDays} days, {count} recommendations were responded to with a consistent pattern ({detail}).',
    prohibitedInferenceNote:
      'Must not infer opinion, attitude, or trust. Observes response action choices only.',
  },
  {
    ruleId: 'repeated_decision_reopening',
    ruleVersion: '1.0.0',
    purpose: 'Detect decisions that have been revisited or reopened multiple times.',
    permittedInputCategories: ['decisions'],
    minimumEvidenceCount: 2,
    observationWindowDays: 90,
    outputSignalType: 'repeated_decision_reopening',
    expirationDays: 30,
    permittedFeatureSurfaces: ['rosie_recommendations', 'review_center', 'morning_brief'],
    plainLanguageTemplate: '{count} decisions have been reopened or revisited multiple times in the last {windowDays} days.',
    prohibitedInferenceNote:
      'Must not infer indecisiveness, anxiety, or emotion. Observes structural pattern of record state changes only.',
  },
  {
    ruleId: 'mission_completion_sequence',
    ruleVersion: '1.0.0',
    purpose: 'Detect which mission step ordering sequences are completed versus stalled.',
    permittedInputCategories: ['missions'],
    minimumEvidenceCount: 2,
    observationWindowDays: 60,
    outputSignalType: 'mission_completion_sequence',
    expirationDays: 30,
    permittedFeatureSurfaces: ['mission_planning', 'review_center'],
    plainLanguageTemplate:
      '{count} mission sequences observed in the last {windowDays} days. Completion and stall patterns recorded.',
    prohibitedInferenceNote:
      'Must not infer motivation, confidence, or capability. Observes step completion ordering only.',
  },
  {
    ruleId: 'review_timing_preference',
    ruleVersion: '1.0.0',
    purpose: 'Detect whether review actions (decisions, reflections) cluster at certain times of day or week.',
    permittedInputCategories: ['decisions', 'reflections', 'review_history'],
    minimumEvidenceCount: 5,
    observationWindowDays: 60,
    outputSignalType: 'review_timing_preference',
    expirationDays: 45,
    permittedFeatureSurfaces: ['review_center', 'morning_brief', 'evening_summary'],
    plainLanguageTemplate:
      '{count} review actions observed in the last {windowDays} days. Timing distribution recorded.',
    prohibitedInferenceNote:
      'Must not infer schedule preferences, sleep patterns, or work habits. Observes timestamp clustering of explicit operator actions only.',
  },
  {
    ruleId: 'summary_vs_detail_preference',
    ruleVersion: '1.0.0',
    purpose:
      'Detect whether the operator engages more with summary or detail views. Requires explicit preference mechanism not present in Build 014 — always returns no signal.',
    permittedInputCategories: ['preferences'],
    minimumEvidenceCount: 10,
    observationWindowDays: 60,
    outputSignalType: 'summary_vs_detail_preference',
    expirationDays: 60,
    permittedFeatureSurfaces: ['rosie_recommendations', 'review_center'],
    plainLanguageTemplate: 'Operator has shown a {detail} view preference across {count} interactions.',
    prohibitedInferenceNote:
      'Must not infer cognitive style, education, or expertise. Observes explicit view interaction choices only. Returns no signal in Build 014 — insufficient explicit preference data.',
  },
  {
    ruleId: 'preferred_evidence_depth',
    ruleVersion: '1.0.0',
    purpose:
      'Detect whether the operator tends to expand or collapse evidence sections. Requires explicit preference mechanism not present in Build 014 — always returns no signal.',
    permittedInputCategories: ['preferences'],
    minimumEvidenceCount: 10,
    observationWindowDays: 60,
    outputSignalType: 'preferred_evidence_depth',
    expirationDays: 60,
    permittedFeatureSurfaces: ['rosie_recommendations', 'understanding_dashboard'],
    plainLanguageTemplate: 'Operator has consistently used {detail} evidence depth across {count} interactions.',
    prohibitedInferenceNote:
      'Must not infer analytical style, thoroughness, or expertise. Observes explicit evidence panel interaction choices only. Returns no signal in Build 014.',
  },
]

// ---------------------------------------------------------------------------
// Registry validation
// ---------------------------------------------------------------------------

export function validateRegistry(registry: DeterministicRule[]): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const seen = new Set<string>()

  for (const rule of registry) {
    const key = `${rule.ruleId}@${rule.ruleVersion}`
    if (seen.has(key)) {
      errors.push(`Duplicate rule: ${key}`)
    }
    seen.add(key)

    if (!rule.ruleId || !rule.ruleVersion) {
      errors.push(`Rule missing id or version: ${JSON.stringify(rule)}`)
    }
    if (rule.minimumEvidenceCount < 1) {
      errors.push(`Rule ${rule.ruleId} has invalid minimumEvidenceCount: ${rule.minimumEvidenceCount}`)
    }
    if (rule.observationWindowDays < 1) {
      errors.push(`Rule ${rule.ruleId} has invalid observationWindowDays: ${rule.observationWindowDays}`)
    }
    if (!rule.outputSignalType) {
      errors.push(`Rule ${rule.ruleId} missing outputSignalType`)
    }
    if (!rule.prohibitedInferenceNote) {
      errors.push(`Rule ${rule.ruleId} missing prohibitedInferenceNote`)
    }
  }

  return { valid: errors.length === 0, errors }
}

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

export function getRuleById(ruleId: string, ruleVersion?: string): DeterministicRule | null {
  const match = RULE_REGISTRY.find((r) =>
    r.ruleId === ruleId && (ruleVersion === undefined || r.ruleVersion === ruleVersion),
  )
  return match ?? null
}

export function getRuleBySignalType(signalType: string): DeterministicRule | null {
  return RULE_REGISTRY.find((r) => r.outputSignalType === signalType) ?? null
}
