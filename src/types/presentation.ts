import type { CognitionFeatureSurface } from './cognitive'

export type SummaryDetailMode = 'summary_first' | 'balanced' | 'detail_first'
export type InformationDensity = 'low' | 'standard' | 'high'
export type EvidenceDepth = 'collapsed' | 'standard' | 'expanded'
export type PlanningSequenceMode = 'sequential' | 'milestone_first' | 'dependency_first'
export type ReviewTimingMode = 'neutral' | 'morning' | 'midday' | 'evening'

export type ExpansionDefaults = {
  briefingDetailsExpanded: boolean
  reviewDetailsExpanded: boolean
  missionDetailsExpanded: boolean
  evidenceExpanded: boolean
}

export type AdaptationSettingKey =
  | 'summaryDetailMode'
  | 'informationDensity'
  | 'evidenceDepth'
  | 'planningSequenceMode'
  | 'reviewTimingMode'
  | 'briefingSectionOrder'
  | 'expansionDefaults'

export type PresentationMappingConflictBehavior = 'highest_priority' | 'newest_confirmed' | 'highest_evidence' | 'fail_closed'

export type PresentationMapping = {
  mappingId: string
  mappingVersion: string
  supportedRuleId: string
  requiredUnderstandingState: 'operator_confirmed'
  requiredFeatureSurface: CognitionFeatureSurface
  resultingSetting: AdaptationSettingKey
  priority: number
  conflictBehavior: PresentationMappingConflictBehavior
  explanation: string
  prohibitedBehavior: string
}

export type ActiveAdaptation = {
  adaptationId: string
  mappingId: string
  mappingVersion: string
  sourceUnderstandingId: string
  sourceRuleId: string
  sourceRuleVersion: string
  targetSurface: CognitionFeatureSurface
  setting: AdaptationSettingKey
  value: string
  reason: string
  activatedAt: string
  expiresAt?: string
}

export type PresentationOverride = {
  id: string
  targetSurface: CognitionFeatureSurface
  setting: AdaptationSettingKey
  value: string
  createdAt: string
  updatedAt: string
}

export type PresentationValidationState = 'neutral' | 'adaptive' | 'blocked'

export type AdaptationExplanation = {
  adaptationId: string
  summary: string
  sourceUnderstandingId: string
  mappingId: string
  overrideActive: boolean
}

export type PresentationProfile = {
  profileVersion: string
  generatedAt: string
  sourceUnderstandingIds: string[]
  sourceRuleVersions: string[]
  summaryDetailMode: SummaryDetailMode
  informationDensity: InformationDensity
  evidenceDepth: EvidenceDepth
  briefingSectionOrder: string[]
  planningSequenceMode: PlanningSequenceMode
  reviewTimingMode: ReviewTimingMode
  expansionDefaults: ExpansionDefaults
  activeAdaptations: ActiveAdaptation[]
  operatorOverrides: PresentationOverride[]
  explanations: AdaptationExplanation[]
  validationState: PresentationValidationState
}

export type PresentationAdaptationAuditAction =
  | 'personalization_enabled'
  | 'personalization_disabled'
  | 'adaptation_activated'
  | 'adaptation_changed'
  | 'adaptation_invalidated'
  | 'neutral_restored'
  | 'override_created'
  | 'override_changed'
  | 'override_removed'
  | 'conflict_resolved'
  | 'conflict_failed_closed'
  | 'blocked_by_consent'
  | 'blocked_by_permission'
  | 'invalid_understanding_rejected'

export type PresentationAdaptationAuditEvent = {
  id: string
  action: PresentationAdaptationAuditAction
  timestamp: string
  detail: string
}

export type SurfacePresentation = {
  personalized: boolean
  summaryDetailMode: SummaryDetailMode
  informationDensity: InformationDensity
  evidenceDepth: EvidenceDepth
  planningSequenceMode: PlanningSequenceMode
  reviewTimingMode: ReviewTimingMode
  briefingSectionOrder: string[]
  expansionDefaults: ExpansionDefaults
  indicator: string
}

