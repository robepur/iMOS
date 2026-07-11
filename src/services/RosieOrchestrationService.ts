/**
 * RosieOrchestrationService
 *
 * Single deterministic orchestration entry point for Rosie cognitive processing.
 */

import type { PersonalData } from '../localData'
import type { PresentationProfile } from '../types/presentation'
import { isCognitionEnabled } from './CognitionConsentService'
import { analyze as analyzeSignals } from './CognitiveSignalEngine'
import { createProposedUnderstanding } from './UnderstandingReviewService'
import {
  resolvePresentationProfile,
  PRESENTATION_MAPPING_REGISTRY_VERSION,
} from './AdaptivePresentationEngine'

// Compare profiles excluding the generatedAt timestamp (which is non-deterministic)
function stablePresentationKey(profile: PresentationProfile | undefined): string {
  if (!profile) return ''
  const { generatedAt: _g, ...rest } = profile
  return JSON.stringify(rest)
}

export type OrchestrationInput = {
  data: PersonalData
  now?: Date
}

export type OrchestrationResult = {
  data: PersonalData
  changed: boolean
  blocked: boolean
  blockReason?: string
}

export function runRosieOrchestration(input: OrchestrationInput): OrchestrationResult {
  const { data, now = new Date() } = input
  const consent = data.cognitionConsent

  let candidate = { ...data }
  let changed = false

  if (!isCognitionEnabled(consent)) {
    return { data, changed: false, blocked: true, blockReason: 'Cognition consent is not enabled.' }
  }

  const signalResult = analyzeSignals(candidate, consent, now)
  if (signalResult.blocked) {
    return { data, changed: false, blocked: true, blockReason: signalResult.blockReason }
  }

  const newSignals = signalResult.signals
  const signalsChanged =
    JSON.stringify(candidate.cognitiveSignals ?? []) !== JSON.stringify(newSignals)
    || candidate.cognitiveRuleRegistryVersion !== signalResult.registryVersion
  if (signalsChanged) {
    candidate = { ...candidate, cognitiveSignals: newSignals, cognitiveRuleRegistryVersion: signalResult.registryVersion }
    changed = true
  }

  const proposedSignals = newSignals.filter((s) => s.status === 'proposed')
  let understandings = candidate.operatorUnderstandings ?? []
  let rejectedSignatures = candidate.rejectedUnderstandingSignatures ?? []
  let reviewAudit = candidate.understandingReviewAudit ?? []

  for (const signal of proposedSignals) {
    const conversion = createProposedUnderstanding({
      signal,
      consent: consent!,
      existingUnderstandings: understandings,
      rejectedSignatures,
      reviewAudit,
    })
    understandings = conversion.understandings
    rejectedSignatures = conversion.rejectedSignatures
    reviewAudit = conversion.reviewAudit
  }

  const understandingLengthChanged =
    understandings.length !== (candidate.operatorUnderstandings ?? []).length
    || rejectedSignatures.length !== (candidate.rejectedUnderstandingSignatures ?? []).length
    || reviewAudit.length !== (candidate.understandingReviewAudit ?? []).length

  if (understandingLengthChanged) {
    candidate = {
      ...candidate,
      operatorUnderstandings: understandings,
      rejectedUnderstandingSignatures: rejectedSignatures,
      understandingReviewAudit: reviewAudit,
    }
    changed = true
  }

  const presentationResult = resolvePresentationProfile({
    consent: candidate.cognitionConsent,
    enabled: candidate.presentationPersonalizationEnabled ?? false,
    understandings: candidate.operatorUnderstandings ?? [],
    overrides: candidate.presentationOverrides ?? [],
  })

  const presentationChanged =
    stablePresentationKey(candidate.presentationProfile) !== stablePresentationKey(presentationResult.profile)
    || candidate.presentationMappingRegistryVersion !== PRESENTATION_MAPPING_REGISTRY_VERSION
  if (presentationChanged) {
    candidate = {
      ...candidate,
      presentationProfile: presentationResult.profile,
      presentationAdaptationAudit: [...(candidate.presentationAdaptationAudit ?? []), ...presentationResult.audit],
      presentationMappingRegistryVersion: PRESENTATION_MAPPING_REGISTRY_VERSION,
    }
    changed = true
  }

  return { data: candidate, changed, blocked: false }
}
