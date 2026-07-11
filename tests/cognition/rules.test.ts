/**
 * tests/cognition/rules.test.ts
 *
 * Tests for the CognitiveSignalRuleRegistry.
 */

import { describe, it, expect } from 'vitest'
import {
  RULE_REGISTRY,
  REGISTRY_VERSION,
  validateRegistry,
  getRuleById,
  getRuleBySignalType,
} from '../../src/services/CognitiveSignalRuleRegistry'

describe('CognitiveSignalRuleRegistry', () => {
  it('exports a non-empty registry', () => {
    expect(RULE_REGISTRY.length).toBeGreaterThan(0)
  })

  it('exports a semver-format registry version', () => {
    expect(REGISTRY_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('registry validates without errors', () => {
    const result = validateRegistry(RULE_REGISTRY)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('all 7 expected rules are present', () => {
    const ids = RULE_REGISTRY.map((r) => r.ruleId)
    expect(ids).toContain('overdue_commitment_recurrence')
    expect(ids).toContain('recommendation_response_pattern')
    expect(ids).toContain('repeated_decision_reopening')
    expect(ids).toContain('mission_completion_sequence')
    expect(ids).toContain('review_timing_preference')
    expect(ids).toContain('summary_vs_detail_preference')
    expect(ids).toContain('preferred_evidence_depth')
  })

  it('no duplicate rule id+version pairs', () => {
    const keys = RULE_REGISTRY.map((r) => `${r.ruleId}@${r.ruleVersion}`)
    const unique = new Set(keys)
    expect(unique.size).toBe(keys.length)
  })

  it('every rule has a prohibited inference note', () => {
    for (const rule of RULE_REGISTRY) {
      expect(rule.prohibitedInferenceNote.length).toBeGreaterThan(10)
    }
  })

  it('every rule has minimum evidence count >= 1', () => {
    for (const rule of RULE_REGISTRY) {
      expect(rule.minimumEvidenceCount).toBeGreaterThanOrEqual(1)
    }
  })

  it('every rule has observation window >= 1 day', () => {
    for (const rule of RULE_REGISTRY) {
      expect(rule.observationWindowDays).toBeGreaterThanOrEqual(1)
    }
  })

  it('getRuleById returns the correct rule', () => {
    const rule = getRuleById('overdue_commitment_recurrence', '1.0.0')
    expect(rule).not.toBeNull()
    expect(rule!.ruleId).toBe('overdue_commitment_recurrence')
    expect(rule!.ruleVersion).toBe('1.0.0')
  })

  it('getRuleById returns null for unknown id', () => {
    const rule = getRuleById('does_not_exist')
    expect(rule).toBeNull()
  })

  it('getRuleById returns null for wrong version', () => {
    const rule = getRuleById('overdue_commitment_recurrence', '99.0.0')
    expect(rule).toBeNull()
  })

  it('getRuleBySignalType returns the correct rule', () => {
    const rule = getRuleBySignalType('overdue_commitment_recurrence')
    expect(rule).not.toBeNull()
    expect(rule!.outputSignalType).toBe('overdue_commitment_recurrence')
  })

  it('getRuleBySignalType returns null for unknown type', () => {
    const rule = getRuleBySignalType('not_a_real_signal_type')
    expect(rule).toBeNull()
  })

  it('summary_vs_detail_preference and preferred_evidence_depth require high evidence count (Build 014 will not emit them)', () => {
    const summaryRule = getRuleById('summary_vs_detail_preference')
    const depthRule = getRuleById('preferred_evidence_depth')
    expect(summaryRule!.minimumEvidenceCount).toBeGreaterThanOrEqual(10)
    expect(depthRule!.minimumEvidenceCount).toBeGreaterThanOrEqual(10)
  })

  it('detects a registry with duplicate ids as invalid', () => {
    const dupe = [...RULE_REGISTRY, RULE_REGISTRY[0]]
    const result = validateRegistry(dupe)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
