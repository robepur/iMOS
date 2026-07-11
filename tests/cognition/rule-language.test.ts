/**
 * tests/cognition/rule-language.test.ts
 * Tests updated rule language in v1.1.0 rules.
 */
import { describe, it, expect } from 'vitest'
import { RULE_REGISTRY, getRuleById } from '../../src/services/CognitiveSignalRuleRegistry'

describe('rule language v1.1.0', () => {
  it('repeated_decision_reopening has version 1.1.0 available', () => {
    const rule = getRuleById('repeated_decision_reopening', '1.1.0')
    expect(rule).not.toBeNull()
    expect(rule!.ruleVersion).toBe('1.1.0')
  })

  it('overdue_commitment_recurrence has version 1.1.0 available', () => {
    const rule = getRuleById('overdue_commitment_recurrence', '1.1.0')
    expect(rule).not.toBeNull()
    expect(rule!.ruleVersion).toBe('1.1.0')
  })

  it('repeated_decision_reopening v1.1.0 does not claim repeatedly reopened', () => {
    const rule = getRuleById('repeated_decision_reopening', '1.1.0')
    expect(rule!.plainLanguageTemplate).not.toContain('reopened')
    expect(rule!.plainLanguageTemplate).not.toContain('repeatedly')
  })

  it('overdue_commitment_recurrence v1.1.0 does not claim repeatedly overdue', () => {
    const rule = getRuleById('overdue_commitment_recurrence', '1.1.0')
    expect(rule!.plainLanguageTemplate).not.toContain('repeatedly overdue')
    expect(rule!.plainLanguageTemplate).not.toContain('repeatedly')
  })

  it('all rules have valid prohibitedInferenceNote', () => {
    for (const rule of RULE_REGISTRY) {
      expect(rule.prohibitedInferenceNote).toBeTruthy()
      expect(rule.prohibitedInferenceNote.length).toBeGreaterThan(10)
    }
  })
})
