import type { CognitionConsent, CognitionFeatureSurface, OperatorUnderstanding } from '../types/cognitive'
import type {
  ActiveAdaptation,
  AdaptationExplanation,
  AdaptationSettingKey,
  PresentationAdaptationAuditEvent,
  PresentationMapping,
  PresentationOverride,
  PresentationProfile,
  SurfacePresentation,
} from '../types/presentation'

export const PRESENTATION_PROFILE_VERSION = 'v1'
export const PRESENTATION_MAPPING_REGISTRY_VERSION = '2026.07.11'

const COGNITIVE_CATEGORY = 'understanding_history'

const MAPPINGS: PresentationMapping[] = [
  {
    mappingId: 'map-summary-detail',
    mappingVersion: '1',
    supportedRuleId: 'summary_vs_detail_preference',
    requiredUnderstandingState: 'operator_confirmed',
    requiredFeatureSurface: 'briefing',
    resultingSetting: 'summaryDetailMode',
    priority: 90,
    conflictBehavior: 'highest_priority',
    explanation: 'Prefers detail-forward summaries in briefing and review.',
    prohibitedBehavior: 'No hidden or autonomous action may be introduced.',
  },
  {
    mappingId: 'map-evidence-depth',
    mappingVersion: '1',
    supportedRuleId: 'preferred_evidence_depth',
    requiredUnderstandingState: 'operator_confirmed',
    requiredFeatureSurface: 'review',
    resultingSetting: 'evidenceDepth',
    priority: 80,
    conflictBehavior: 'highest_evidence',
    explanation: 'Expands evidence where confirmed preference exists.',
    prohibitedBehavior: 'No sensitive values may be surfaced.',
  },
]

const nowIso = () => new Date().toISOString()

const uuid = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `presentation-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const parseDate = (value?: string) => {
  if (!value) return Number.NaN
  return new Date(value).getTime()
}

export const getNeutralPresentationProfile = (): PresentationProfile => ({
  profileVersion: PRESENTATION_PROFILE_VERSION,
  generatedAt: nowIso(),
  sourceUnderstandingIds: [],
  sourceRuleVersions: [],
  summaryDetailMode: 'balanced',
  informationDensity: 'standard',
  evidenceDepth: 'standard',
  briefingSectionOrder: ['overview', 'recommendations', 'focus', 'evidence'],
  planningSequenceMode: 'sequential',
  reviewTimingMode: 'neutral',
  expansionDefaults: {
    briefingDetailsExpanded: false,
    reviewDetailsExpanded: false,
    missionDetailsExpanded: false,
    evidenceExpanded: false,
  },
  activeAdaptations: [],
  operatorOverrides: [],
  explanations: [],
  validationState: 'neutral',
})

const hasConsent = (consent: CognitionConsent | null | undefined) =>
  !!consent
  && consent.status === 'on'
  && typeof consent.version === 'string'
  && typeof consent.updatedAt === 'string'
  && Array.isArray(consent.permittedDataCategories)
  && Array.isArray(consent.permittedFeatureSurfaces)
  && consent.permittedDataCategories.includes(COGNITIVE_CATEGORY)

const isUnderstandingEligible = (understanding: OperatorUnderstanding, now: number) => {
  if (understanding.state !== 'operator_confirmed') return false
  if (!understanding.personalizationEligible) return false
  if (understanding.expiresAt && parseDate(understanding.expiresAt) <= now) return false
  if (!understanding.provenance || understanding.provenance.dataSource !== 'local_vault') return false
  if (understanding.provenance.ruleId !== understanding.ruleId) return false
  if (understanding.provenance.ruleVersion !== understanding.ruleVersion) return false
  if (!Array.isArray(understanding.evidenceIds) || understanding.evidenceIds.length === 0) return false
  return true
}

const inferValue = (mapping: PresentationMapping): string | null => {
  switch (mapping.resultingSetting) {
    case 'summaryDetailMode':
      return 'detail_first'
    case 'evidenceDepth':
      return 'expanded'
    case 'reviewTimingMode':
      return 'morning'
    case 'planningSequenceMode':
      return 'dependency_first'
    default:
      return null
  }
}

const buildCandidate = (understanding: OperatorUnderstanding, mapping: PresentationMapping): ActiveAdaptation | null => {
  const value = inferValue(mapping)
  if (!value) return null
  return {
    adaptationId: uuid(),
    mappingId: mapping.mappingId,
    mappingVersion: mapping.mappingVersion,
    sourceUnderstandingId: understanding.id,
    sourceRuleId: understanding.ruleId,
    sourceRuleVersion: understanding.ruleVersion,
    targetSurface: mapping.requiredFeatureSurface,
    setting: mapping.resultingSetting,
    value,
    reason: mapping.explanation,
    activatedAt: nowIso(),
    expiresAt: understanding.expiresAt,
  }
}

const resolveConflict = (setting: AdaptationSettingKey, candidates: ActiveAdaptation[], understandings: Map<string, OperatorUnderstanding>) => {
  const sorted = [...candidates].sort((a, b) => {
    const ma = MAPPINGS.find(m => m.mappingId === a.mappingId)
    const mb = MAPPINGS.find(m => m.mappingId === b.mappingId)
    const pa = ma?.priority ?? 0
    const pb = mb?.priority ?? 0
    if (pa !== pb) return pb - pa
    const ua = understandings.get(a.sourceUnderstandingId)
    const ub = understandings.get(b.sourceUnderstandingId)
    const ta = parseDate(ua?.updatedAt)
    const tb = parseDate(ub?.updatedAt)
    if (ta !== tb) return tb - ta
    return b.sourceUnderstandingId.localeCompare(a.sourceUnderstandingId)
  })
  return sorted[0] ?? null
}

const applySetting = (profile: PresentationProfile, adaptation: ActiveAdaptation) => {
  if (adaptation.setting === 'summaryDetailMode') profile.summaryDetailMode = adaptation.value as PresentationProfile['summaryDetailMode']
  if (adaptation.setting === 'informationDensity') profile.informationDensity = adaptation.value as PresentationProfile['informationDensity']
  if (adaptation.setting === 'evidenceDepth') profile.evidenceDepth = adaptation.value as PresentationProfile['evidenceDepth']
  if (adaptation.setting === 'planningSequenceMode') profile.planningSequenceMode = adaptation.value as PresentationProfile['planningSequenceMode']
  if (adaptation.setting === 'reviewTimingMode') profile.reviewTimingMode = adaptation.value as PresentationProfile['reviewTimingMode']
}

const applyOverride = (profile: PresentationProfile, override: PresentationOverride) => {
  applySetting(
    profile,
    {
      adaptationId: override.id,
      mappingId: 'operator-override',
      mappingVersion: '1',
      sourceUnderstandingId: 'operator-override',
      sourceRuleId: 'operator-override',
      sourceRuleVersion: '1',
      targetSurface: override.targetSurface,
      setting: override.setting,
      value: override.value,
      reason: 'Operator override',
      activatedAt: override.updatedAt,
    },
  )
}

const buildExplanation = (adaptation: ActiveAdaptation, overrideActive: boolean): AdaptationExplanation => ({
  adaptationId: adaptation.adaptationId,
  summary: adaptation.reason,
  sourceUnderstandingId: adaptation.sourceUnderstandingId,
  mappingId: adaptation.mappingId,
  overrideActive,
})

export const resolvePresentationProfile = (params: {
  consent: CognitionConsent | null | undefined
  enabled: boolean
  understandings: OperatorUnderstanding[]
  overrides: PresentationOverride[]
}): { profile: PresentationProfile; audit: PresentationAdaptationAuditEvent[] } => {
  const audit: PresentationAdaptationAuditEvent[] = []
  const neutral = getNeutralPresentationProfile()
  if (!params.enabled) {
    audit.push({ id: uuid(), action: 'personalization_disabled', timestamp: nowIso(), detail: 'Presentation personalization is disabled.' })
    return { profile: neutral, audit }
  }
  if (!hasConsent(params.consent)) {
    audit.push({ id: uuid(), action: 'blocked_by_consent', timestamp: nowIso(), detail: 'Consent is not granted for cognitive signals.' })
    return { profile: { ...neutral, validationState: 'blocked' }, audit }
  }

  const now = Date.now()
  const byId = new Map(params.understandings.map(u => [u.id, u]))
  const eligible = params.understandings.filter(u => isUnderstandingEligible(u, now))
  const candidatesBySetting = new Map<AdaptationSettingKey, ActiveAdaptation[]>()

  for (const understanding of eligible) {
    const hasMapping = MAPPINGS.some(m => m.supportedRuleId === understanding.ruleId)
    if (!hasMapping) {
      audit.push({ id: uuid(), action: 'invalid_understanding_rejected', timestamp: nowIso(), detail: `Unsupported rule ${understanding.ruleId}` })
      continue
    }
    const mappings = MAPPINGS.filter(m => m.supportedRuleId === understanding.ruleId)
    for (const mapping of mappings) {
      if (!params.consent!.permittedFeatureSurfaces.includes(mapping.requiredFeatureSurface)) {
        audit.push({ id: uuid(), action: 'blocked_by_permission', timestamp: nowIso(), detail: `Surface ${mapping.requiredFeatureSurface} is not permitted.` })
        continue
      }
      const candidate = buildCandidate(understanding, mapping)
      if (!candidate) continue
      const group = candidatesBySetting.get(candidate.setting) || []
      group.push(candidate)
      candidatesBySetting.set(candidate.setting, group)
    }
  }

  const chosen: ActiveAdaptation[] = []
  for (const [setting, candidates] of candidatesBySetting.entries()) {
    const selected = resolveConflict(setting, candidates, byId)
    if (selected) {
      chosen.push(selected)
      audit.push({ id: uuid(), action: 'conflict_resolved', timestamp: nowIso(), detail: `Selected mapping ${selected.mappingId} for ${setting}.` })
    }
  }

  const profile: PresentationProfile = {
    ...neutral,
    generatedAt: nowIso(),
    sourceUnderstandingIds: chosen.map(c => c.sourceUnderstandingId),
    sourceRuleVersions: chosen.map(c => c.sourceRuleVersion),
    activeAdaptations: chosen,
    operatorOverrides: [...params.overrides],
    validationState: chosen.length > 0 ? 'adaptive' : 'neutral',
  }

  for (const adaptation of chosen) {
    applySetting(profile, adaptation)
    audit.push({ id: uuid(), action: 'adaptation_activated', timestamp: nowIso(), detail: `${adaptation.setting} set by ${adaptation.mappingId}` })
  }

  for (const override of params.overrides) {
    applyOverride(profile, override)
    audit.push({ id: uuid(), action: 'override_changed', timestamp: nowIso(), detail: `Override applied for ${override.setting}` })
  }

  profile.explanations = chosen.map(a => buildExplanation(a, params.overrides.some(o => o.setting === a.setting)))
  return { profile, audit }
}

export const getActiveAdaptations = (profile: PresentationProfile) => profile.activeAdaptations

export const applyOperatorOverride = (overrides: PresentationOverride[], input: Omit<PresentationOverride, 'id' | 'createdAt' | 'updatedAt'>): PresentationOverride[] => {
  const existing = overrides.find(
    o => o.targetSurface === input.targetSurface && o.setting === input.setting,
  )
  if (existing) {
    return overrides.map(o =>
      o.id === existing.id
        ? { ...o, value: input.value, updatedAt: nowIso() }
        : o,
    )
  }
  return [
    ...overrides,
    {
      id: uuid(),
      targetSurface: input.targetSurface,
      setting: input.setting,
      value: input.value,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ]
}

export const removeOperatorOverride = (overrides: PresentationOverride[], id: string) => overrides.filter(o => o.id !== id)

export const resolveSurfacePresentation = (profile: PresentationProfile, surface: CognitionFeatureSurface): SurfacePresentation => {
  const neutral = getNeutralPresentationProfile()
  const scoped: PresentationProfile = {
    ...neutral,
    validationState: profile.validationState,
    activeAdaptations: profile.activeAdaptations.filter((item) => item.targetSurface === surface),
    operatorOverrides: profile.operatorOverrides.filter((item) => item.targetSurface === surface),
  }
  for (const adaptation of scoped.activeAdaptations) applySetting(scoped, adaptation)
  for (const override of scoped.operatorOverrides) applyOverride(scoped, override)
  const personalized = scoped.activeAdaptations.length > 0 || scoped.operatorOverrides.length > 0
  return {
    personalized,
    summaryDetailMode: scoped.summaryDetailMode,
    informationDensity: scoped.informationDensity,
    evidenceDepth: scoped.evidenceDepth,
    planningSequenceMode: scoped.planningSequenceMode,
    reviewTimingMode: scoped.reviewTimingMode,
    briefingSectionOrder: scoped.briefingSectionOrder,
    expansionDefaults: scoped.expansionDefaults,
    indicator: personalized
      ? 'Personalized presentation active'
      : profile.validationState === 'blocked'
        ? 'Personalization blocked by consent'
        : 'Neutral presentation',
  }
}

export const explainAdaptation = (profile: PresentationProfile, adaptationId: string) =>
  profile.explanations.find(e => e.adaptationId === adaptationId)?.summary || 'No explanation available.'

export const isAdaptationExpired = (adaptation: ActiveAdaptation) => !!adaptation.expiresAt && parseDate(adaptation.expiresAt) <= Date.now()

export const buildNeutralRestorationAudit = (): PresentationAdaptationAuditEvent => ({
  id: uuid(),
  action: 'neutral_restored',
  timestamp: nowIso(),
  detail: 'Operator restored neutral presentation.',
})
