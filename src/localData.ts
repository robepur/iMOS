import type {
  CognitionConsent,
  OperatorUnderstanding,
  CloudSyncConsentDeclaration,
  ConnectorConsentDeclaration,
  CognitiveSignal,
  UnderstandingReviewEvent,
  CognitiveSignalType,
} from './types/cognitive'
import type {
  PresentationAdaptationAuditEvent,
  PresentationOverride,
  PresentationProfile,
} from './types/presentation'

export type RosieRecommendation = {
  id: string
  category: 'priority' | 'commitment' | 'decision' | 'reflection' | 'review' | 'security'
  severity: 'critical' | 'high' | 'normal' | 'low'
  confidence: 'high' | 'medium' | 'low'
  title: string
  explanation: string
  evidence: string[]
  recommendedAction: string
  createdAt: string
  dismissed: boolean
  snoozedUntil?: string
  dismissedAt?: string
  snoozedAt?: string
  completed?: boolean
  completedAt?: string
}

export type NodeType =
  | 'priority' | 'commitment' | 'decision' | 'reflection'
  | 'timeline' | 'secret' | 'recommendation' | 'recovery' | 'memory' | 'understanding'
  | 'mission' | 'mission_step'

export type EdgeType =
  | 'related_to' | 'created_from' | 'references' | 'supports'
  | 'depends_on' | 'completed_by' | 'mentioned_in' | 'derived_from'
  | 'observed_in' | 'remembered_by' | 'generated_from' | 'blocked_by' | 'completes'

export type GraphNode = {
  id: string
  type: NodeType
  title: string
  createdAt: string
}

export type GraphEdge = {
  id: string
  source: string
  target: string
  type: EdgeType
  evidence: string[]
  createdAt: string
  confidence: 'high' | 'medium' | 'low'
}

export type KnowledgeGraphData = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  builtAt: string
}

export type PriorityLevel = 'critical' | 'high' | 'normal' | 'low'

export type ReviewPeriod = 'today' | 'week' | 'month' | 'quarter' | 'all'

export type Priority = {
  id: string
  title: string
  why: string
  level: PriorityLevel
  due: string
  completed: boolean
  primary: boolean
  order: number
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export type RosieMemoryItem = {
  id: string
  text: string
  sourceReflectionId: string
  createdAt: string
}

export type Commitment = {
  id: string
  title: string
  due: string
  status: 'open' | 'complete'
  createdAt: string
}

export type Decision = {
  id: string
  title: string
  context: string
  status: 'open' | 'decided'
  createdAt: string
}

export type TimelineEntry = {
  id: string
  type: 'priority' | 'commitment' | 'decision' | 'reflection' | 'system' | 'secret' | 'recovery' | 'mission'
  title: string
  detail: string
  createdAt: string
}

export type MissionPlan = {
  id: string
  title: string
  objective: string
  status: 'draft' | 'approved' | 'active' | 'paused' | 'completed' | 'cancelled'
  createdAt: string
  updatedAt: string
  sourcePriorityIds: string[]
  stepIds: string[]
  explanation: string
  approved: boolean
  generatedByRosie?: boolean
  requiresOperatorReview?: boolean
  lastModifiedBy?: 'operator' | 'rosie'
}

export type MissionStep = {
  id: string
  title: string
  description: string
  order: number
  status: 'pending' | 'active' | 'completed' | 'blocked'
  dependsOn: string[]
  evidence: string[]
  estimatedEffort: 'small' | 'medium' | 'large'
  completedAt?: string
  generatedByRosie?: boolean
  operatorModified?: boolean
  operatorOverrideReason?: string
  lastModifiedBy?: 'operator' | 'rosie'
}

export type Reflection = {
  id: string
  accomplished: string
  remember: string
  tomorrow: string
  createdAt: string
}

export type SecretRecord = {
  id: string
  title: string
  category: string
  username: string
  password: string
  url: string
  notes: string
  favorite: boolean
  createdAt: string
  updatedAt: string
  lastAccessedAt?: string
}

export type PersonalData = {
  version: 1
  priorities: Priority[]
  commitments: Commitment[]
  decisions: Decision[]
  timeline: TimelineEntry[]
  reflections: Reflection[]
  secrets?: SecretRecord[]
  recommendations?: RosieRecommendation[]
  knowledgeGraph?: KnowledgeGraphData
  understandingState?: UnderstandingState
  missionPlans?: MissionPlan[]
  missionSteps?: MissionStep[]
  /** Phase 3: operator cognition consent. Defaults to off. */
  cognitionConsent?: CognitionConsent
  /** Phase 3: operator-confirmed understandings derived from local records. */
  operatorUnderstandings?: OperatorUnderstanding[]
  /** Phase 3: cloud sync consent declaration (not implemented in Build 013). */
  cloudSyncConsentDeclaration?: CloudSyncConsentDeclaration
  /** Phase 3: per-connector consent declarations (not implemented in Build 013). */
  connectorConsentDeclarations?: ConnectorConsentDeclaration[]
  /** Phase 3 Build 014: proposed cognitive signals from local analysis. */
  cognitiveSignals?: CognitiveSignal[]
  /** Phase 3 Build 014: version of the rule registry active when signals were last computed. */
  cognitiveRuleRegistryVersion?: string
  /** Phase 3 Build 015: signatures that were explicitly rejected and must not silently reappear. */
  rejectedUnderstandingSignatures?: string[]
  /** Phase 3 Build 015: append-only audit history for understanding review operations. */
  understandingReviewAudit?: UnderstandingReviewEvent[]
  /** Phase 3 Build 016: operator-controlled presentation personalization switch. */
  presentationPersonalizationEnabled?: boolean
  /** Phase 3 Build 016: persisted resolved presentation profile. */
  presentationProfile?: PresentationProfile
  /** Phase 3 Build 016: explicit operator overrides for adaptation settings. */
  presentationOverrides?: PresentationOverride[]
  /** Phase 3 Build 016: append-only adaptation audit history. */
  presentationAdaptationAudit?: PresentationAdaptationAuditEvent[]
  /** Phase 3 Build 016: mapping registry version used for resolved profile. */
  presentationMappingRegistryVersion?: string
}

export type UnderstandingState = {
  activeDriftSignals: string[]
  activePatternKeys: string[]
  trendDirections: Record<string, 'increasing' | 'stable' | 'decreasing'>
}

const VALID_LEVELS: PriorityLevel[] = ['critical', 'high', 'normal', 'low']

function isSafeCognitionConsent(value: unknown): value is CognitionConsent {
  if (!value || typeof value !== 'object') return false
  const consent = value as Partial<CognitionConsent>
  if (!['off', 'on', 'revoked'].includes(String(consent.status))) return false
  if (typeof consent.version !== 'string' || typeof consent.purpose !== 'string' || typeof consent.updatedAt !== 'string') return false
  if (!Array.isArray(consent.permittedDataCategories) || !Array.isArray(consent.permittedFeatureSurfaces) || !Array.isArray(consent.auditHistory)) return false
  if (consent.status === 'revoked') {
    if (typeof consent.revokedAt !== 'string') return false
    if (consent.permittedDataCategories.length > 0 || consent.permittedFeatureSurfaces.length > 0) return false
  }
  return true
}

function isSafeOperatorUnderstanding(value: unknown): value is OperatorUnderstanding {
  if (!value || typeof value !== 'object') return false
  const understanding = value as Partial<OperatorUnderstanding>
  const validStates = ['observed', 'proposed', 'operator_confirmed', 'operator_corrected', 'operator_rejected', 'expired']
  if (typeof understanding.id !== 'string' || typeof understanding.statement !== 'string') return false
  if (!validStates.includes(String(understanding.state))) return false
  if (!Array.isArray(understanding.evidenceIds) || !Array.isArray(understanding.correctionHistory) || !Array.isArray(understanding.permittedFeatureUses)) return false
  if (typeof understanding.ruleId !== 'string' || typeof understanding.ruleVersion !== 'string' || typeof understanding.confidenceBasis !== 'string') return false
  const provenance = understanding.provenance
  if (!provenance || provenance.dataSource !== 'local_vault') return false
  if (typeof provenance.ruleId !== 'string' || typeof provenance.ruleVersion !== 'string' || !Array.isArray(provenance.evidenceTypes) || typeof provenance.generatedAt !== 'string') return false
  return provenance.ruleId === understanding.ruleId && provenance.ruleVersion === understanding.ruleVersion
}

function inferSignalTypeFromRuleId(ruleId: string): CognitiveSignalType {
  const known = [
    'repeated_decision_reopening',
    'overdue_commitment_recurrence',
    'recommendation_response_pattern',
    'mission_completion_sequence',
    'review_timing_preference',
    'summary_vs_detail_preference',
    'preferred_evidence_depth',
  ] as const
  if ((known as readonly string[]).includes(ruleId)) {
    return ruleId as CognitiveSignalType
  }
  // Build 013 compatibility fallback for legacy understandings without signal typing.
  return 'review_timing_preference'
}

function buildMaterialEvidenceSignature(parts: {
  ruleId: string
  ruleVersion: string
  signalType: string
  evidenceIds: string[]
  statement: string
}): string {
  const normalizedEvidence = [...parts.evidenceIds].map(String).sort().join(',')
  const normalizedStatement = parts.statement.trim().toLowerCase().replace(/\s+/g, ' ')
  return `${parts.ruleId}|${parts.ruleVersion}|${parts.signalType}|${normalizedEvidence}|${normalizedStatement}`
}

function normalizeOperatorUnderstanding(understanding: OperatorUnderstanding): OperatorUnderstanding {
  const normalizedSignalType = inferSignalTypeFromRuleId(understanding.ruleId)
  const sourceSignalId =
    typeof (understanding as Partial<OperatorUnderstanding>).sourceSignalId === 'string'
      ? String((understanding as Partial<OperatorUnderstanding>).sourceSignalId)
      : `legacy-signal-${understanding.id}`
  const materialSignature =
    typeof (understanding as Partial<OperatorUnderstanding>).materialEvidenceSignature === 'string'
      ? String((understanding as Partial<OperatorUnderstanding>).materialEvidenceSignature)
      : buildMaterialEvidenceSignature({
          ruleId: understanding.ruleId,
          ruleVersion: understanding.ruleVersion,
          signalType: normalizedSignalType,
          evidenceIds: understanding.evidenceIds,
          statement: understanding.statement,
        })

  return {
    ...understanding,
    sourceSignalId,
    signalType:
      (VALID_SIGNAL_TYPES as readonly string[]).includes(String((understanding as Partial<OperatorUnderstanding>).signalType))
        ? ((understanding as Partial<OperatorUnderstanding>).signalType as CognitiveSignalType)
        : normalizedSignalType,
    evidenceCount:
      typeof (understanding as Partial<OperatorUnderstanding>).evidenceCount === 'number'
        ? Number((understanding as Partial<OperatorUnderstanding>).evidenceCount)
        : understanding.evidenceIds.length,
    sourceSignalStatus:
      (VALID_SIGNAL_STATUSES as readonly string[]).includes(String((understanding as Partial<OperatorUnderstanding>).sourceSignalStatus))
        ? ((understanding as Partial<OperatorUnderstanding>).sourceSignalStatus as OperatorUnderstanding['sourceSignalStatus'])
        : 'proposed',
    reviewHistory: Array.isArray((understanding as Partial<OperatorUnderstanding>).reviewHistory)
      ? ((understanding as Partial<OperatorUnderstanding>).reviewHistory as OperatorUnderstanding['reviewHistory'])
      : [],
    materialEvidenceSignature: materialSignature,
    personalizationEligible:
      typeof (understanding as Partial<OperatorUnderstanding>).personalizationEligible === 'boolean'
        ? Boolean((understanding as Partial<OperatorUnderstanding>).personalizationEligible)
        : understanding.state === 'operator_confirmed',
  }
}

function normalizeCloudSyncDeclaration(value: unknown): CloudSyncConsentDeclaration {
  if (!value || typeof value !== 'object') return createDefaultCloudSyncConsent()
  const declaration = value as Partial<CloudSyncConsentDeclaration>
  if (!['not_offered', 'declined', 'enabled', 'revoked'].includes(String(declaration.status)) || typeof declaration.updatedAt !== 'string') {
    return createDefaultCloudSyncConsent()
  }
  return declaration as CloudSyncConsentDeclaration
}

const VALID_SIGNAL_TYPES = [
  'repeated_decision_reopening',
  'overdue_commitment_recurrence',
  'recommendation_response_pattern',
  'mission_completion_sequence',
  'review_timing_preference',
  'summary_vs_detail_preference',
  'preferred_evidence_depth',
] as const

const VALID_SIGNAL_STATUSES = ['observed', 'proposed', 'suppressed', 'expired'] as const

function createDefaultPresentationProfile(): PresentationProfile {
  return {
    profileVersion: 'v1',
    generatedAt: new Date().toISOString(),
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
  }
}

function isSafePresentationOverride(value: unknown): value is PresentationOverride {
  if (!value || typeof value !== 'object') return false
  const override = value as Partial<PresentationOverride>
  return (
    typeof override.id === 'string'
    && typeof override.targetSurface === 'string'
    && typeof override.setting === 'string'
    && typeof override.value === 'string'
    && typeof override.createdAt === 'string'
    && typeof override.updatedAt === 'string'
  )
}

function isSafePresentationAudit(value: unknown): value is PresentationAdaptationAuditEvent {
  if (!value || typeof value !== 'object') return false
  const event = value as Partial<PresentationAdaptationAuditEvent>
  return (
    typeof event.id === 'string'
    && typeof event.action === 'string'
    && typeof event.timestamp === 'string'
    && typeof event.detail === 'string'
  )
}

function isSafePresentationProfile(value: unknown): value is PresentationProfile {
  if (!value || typeof value !== 'object') return false
  const profile = value as Partial<PresentationProfile>
  return (
    typeof profile.profileVersion === 'string'
    && typeof profile.generatedAt === 'string'
    && Array.isArray(profile.sourceUnderstandingIds)
    && Array.isArray(profile.sourceRuleVersions)
    && typeof profile.summaryDetailMode === 'string'
    && typeof profile.informationDensity === 'string'
    && typeof profile.evidenceDepth === 'string'
    && Array.isArray(profile.briefingSectionOrder)
    && typeof profile.planningSequenceMode === 'string'
    && typeof profile.reviewTimingMode === 'string'
    && !!profile.expansionDefaults
    && Array.isArray(profile.activeAdaptations)
    && Array.isArray(profile.operatorOverrides)
    && Array.isArray(profile.explanations)
    && typeof profile.validationState === 'string'
  )
}

function isSafeCognitiveSignal(value: unknown): value is import('./types/cognitive').CognitiveSignal {
  if (!value || typeof value !== 'object') return false
  const s = value as Partial<import('./types/cognitive').CognitiveSignal>
  return (
    typeof s.id === 'string'
    && VALID_SIGNAL_TYPES.includes(s.signalType as typeof VALID_SIGNAL_TYPES[number])
    && VALID_SIGNAL_STATUSES.includes(s.status as typeof VALID_SIGNAL_STATUSES[number])
    && typeof s.deterministicRuleId === 'string'
    && typeof s.deterministicRuleVersion === 'string'
    && typeof s.signature === 'string'
    && Array.isArray(s.evidenceIds)
    && Array.isArray(s.auditHistory)
    && Array.isArray(s.permittedFeatureUses)
  )
}

export function normalizePersonalData(raw: PersonalData): PersonalData {
  const rawPriorities = (raw.priorities ?? []) as unknown as Array<Record<string, unknown>>
  const incomplete = rawPriorities.filter((p) => !p['completed'])
  const hasPrimary = incomplete.some((p) => p['primary'] === true)
  const firstIncompleteIndex = rawPriorities.findIndex((p) => !p['completed'])

  const priorities = rawPriorities.map((p, index): Priority => ({
    id: String(p['id'] ?? createId('priority')),
    title: String(p['title'] ?? ''),
    why: String(p['why'] ?? ''),
    level: VALID_LEVELS.includes(p['level'] as PriorityLevel) ? (p['level'] as PriorityLevel) : 'normal',
    due: String(p['due'] ?? ''),
    completed: Boolean(p['completed']),
    primary: hasPrimary ? Boolean(p['primary']) : index === firstIncompleteIndex,
    order: typeof p['order'] === 'number' ? p['order'] : index,
    createdAt: String(p['createdAt'] ?? new Date().toISOString()),
    updatedAt: String(p['updatedAt'] ?? p['createdAt'] ?? new Date().toISOString()),
    ...(p['completedAt'] ? { completedAt: String(p['completedAt']) } : {}),
  }))

  const missionPlans = (raw.missionPlans ?? []).map((plan): MissionPlan => ({
    ...plan,
    title: String(plan.title ?? ''),
    objective: String(plan.objective ?? ''),
    status: (['draft', 'approved', 'active', 'paused', 'completed', 'cancelled'] as const).includes(plan.status)
      ? plan.status
      : 'draft',
    sourcePriorityIds: Array.isArray(plan.sourcePriorityIds) ? plan.sourcePriorityIds.map(String) : [],
    stepIds: Array.isArray(plan.stepIds) ? plan.stepIds.map(String) : [],
    explanation: String(plan.explanation ?? ''),
    approved: Boolean(plan.approved),
    createdAt: String(plan.createdAt ?? new Date().toISOString()),
    updatedAt: String(plan.updatedAt ?? plan.createdAt ?? new Date().toISOString()),
    ...(plan.generatedByRosie !== undefined ? { generatedByRosie: Boolean(plan.generatedByRosie) } : {}),
    ...(plan.requiresOperatorReview !== undefined ? { requiresOperatorReview: Boolean(plan.requiresOperatorReview) } : {}),
    ...(plan.lastModifiedBy === 'operator' || plan.lastModifiedBy === 'rosie' ? { lastModifiedBy: plan.lastModifiedBy } : {}),
  }))

  const missionSteps = (raw.missionSteps ?? []).map((step, index): MissionStep => ({
    ...step,
    id: String(step.id ?? createId('mission-step')),
    title: String(step.title ?? ''),
    description: String(step.description ?? ''),
    order: typeof step.order === 'number' ? step.order : index + 1,
    status: (['pending', 'active', 'completed', 'blocked'] as const).includes(step.status) ? step.status : 'pending',
    dependsOn: Array.isArray(step.dependsOn) ? Array.from(new Set(step.dependsOn.map(String))) : [],
    evidence: Array.isArray(step.evidence) ? step.evidence.map((item) => String(item)) : [],
    estimatedEffort: (['small', 'medium', 'large'] as const).includes(step.estimatedEffort) ? step.estimatedEffort : 'medium',
    ...(step.completedAt ? { completedAt: String(step.completedAt) } : {}),
    ...(step.generatedByRosie !== undefined ? { generatedByRosie: Boolean(step.generatedByRosie) } : {}),
    ...(step.operatorModified !== undefined ? { operatorModified: Boolean(step.operatorModified) } : {}),
    ...(step.operatorOverrideReason ? { operatorOverrideReason: String(step.operatorOverrideReason) } : {}),
    ...(step.lastModifiedBy === 'operator' || step.lastModifiedBy === 'rosie' ? { lastModifiedBy: step.lastModifiedBy } : {}),
  }))

  return {
    ...raw,
    secrets: raw.secrets ?? [],
    priorities,
    recommendations: raw.recommendations ?? [],
    missionPlans,
    missionSteps,
    understandingState: raw.understandingState ?? {
      activeDriftSignals: [],
      activePatternKeys: [],
      trendDirections: {},
    },
    // Phase 3: safe defaults — consent is off until operator explicitly enables
    cognitionConsent: isSafeCognitionConsent(raw.cognitionConsent)
      ? raw.cognitionConsent
      : createDefaultCognitionConsent(),
    operatorUnderstandings: Array.isArray(raw.operatorUnderstandings)
      ? raw.operatorUnderstandings.filter(isSafeOperatorUnderstanding).map(normalizeOperatorUnderstanding)
      : [],
    cloudSyncConsentDeclaration: normalizeCloudSyncDeclaration(raw.cloudSyncConsentDeclaration),
    connectorConsentDeclarations: Array.isArray(raw.connectorConsentDeclarations)
      ? raw.connectorConsentDeclarations.filter((declaration) =>
          declaration
          && typeof declaration === 'object'
          && typeof declaration.connectorId === 'string'
          && ['not_offered', 'declined', 'enabled', 'revoked'].includes(declaration.status)
          && Array.isArray(declaration.permissionGrants)
          && Array.isArray(declaration.auditHistory),
        )
      : [],
    // Phase 3 Build 014: cognitive signals — malformed entries are discarded (fail closed)
    cognitiveSignals: Array.isArray(raw.cognitiveSignals)
      ? raw.cognitiveSignals.filter(isSafeCognitiveSignal)
      : [],
    cognitiveRuleRegistryVersion: typeof raw.cognitiveRuleRegistryVersion === 'string'
      ? raw.cognitiveRuleRegistryVersion
      : undefined,
    rejectedUnderstandingSignatures: Array.isArray(raw.rejectedUnderstandingSignatures)
      ? raw.rejectedUnderstandingSignatures.map(String)
      : [],
    understandingReviewAudit: Array.isArray(raw.understandingReviewAudit)
      ? raw.understandingReviewAudit
          .filter((event): event is UnderstandingReviewEvent => Boolean(
            event
            && typeof event === 'object'
            && typeof (event as { id?: unknown }).id === 'string'
            && typeof (event as { action?: unknown }).action === 'string'
            && typeof (event as { timestamp?: unknown }).timestamp === 'string'
            && typeof (event as { actor?: unknown }).actor === 'string'
            && typeof (event as { detail?: unknown }).detail === 'string',
          ))
      : [],
    presentationPersonalizationEnabled: raw.presentationPersonalizationEnabled === true,
    presentationProfile: isSafePresentationProfile(raw.presentationProfile)
      ? raw.presentationProfile
      : createDefaultPresentationProfile(),
    presentationOverrides: Array.isArray(raw.presentationOverrides)
      ? raw.presentationOverrides.filter(isSafePresentationOverride)
      : [],
    presentationAdaptationAudit: Array.isArray(raw.presentationAdaptationAudit)
      ? raw.presentationAdaptationAudit.filter(isSafePresentationAudit)
      : [],
    presentationMappingRegistryVersion: typeof raw.presentationMappingRegistryVersion === 'string'
      ? raw.presentationMappingRegistryVersion
      : undefined,
  }
}

export function getRosieMemory(data: PersonalData, period?: ReviewPeriod): RosieMemoryItem[] {
  const start = period ? getReviewPeriodStart(period) : null
  return data.reflections
    .filter((r) => r.remember.trim().length > 0 && (start === null || new Date(r.createdAt) >= start))
    .slice(0, 5)
    .map((r) => ({
      id: `memory-${r.id}`,
      text: r.remember.trim(),
      sourceReflectionId: r.id,
      createdAt: r.createdAt,
    }))
}

export function getReviewPeriodStart(period: ReviewPeriod): Date {
  const now = new Date()
  switch (period) {
    case 'today': return new Date(now.toDateString())
    case 'week': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case 'month': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case 'quarter': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    default: return new Date(0)
  }
}

export function inPeriod(isoDate: string, period: ReviewPeriod): boolean {
  if (period === 'all') return true
  return new Date(isoDate) >= getReviewPeriodStart(period)
}

// ---------------------------------------------------------------------------
// Phase 3 default factory helpers
// ---------------------------------------------------------------------------

export const COGNITION_CONSENT_VERSION = '1.0.0'

/** Returns a safe default CognitionConsent with status 'off'. */
export function createDefaultCognitionConsent(): CognitionConsent {
  return {
    status: 'off',
    version: COGNITION_CONSENT_VERSION,
    purpose:
      'Allow Rosie to observe your local encrypted records to surface patterns, ' +
      'reduce cognitive friction, and provide personalized briefing support. ' +
      'All analysis is local only. No data leaves your device.',
    updatedAt: new Date().toISOString(),
    permittedDataCategories: [],
    permittedFeatureSurfaces: [],
    auditHistory: [],
  }
}

/** Returns a safe default CloudSyncConsentDeclaration with status 'not_offered'. */
export function createDefaultCloudSyncConsent(): CloudSyncConsentDeclaration {
  return {
    status: 'not_offered',
    updatedAt: new Date().toISOString(),
  }
}

export function createInitialData(): PersonalData {
  const createdAt = new Date().toISOString()
  return {
    version: 1,
    priorities: [
      {
        id: 'priority-build-007',
        title: 'Establish Build 007',
        why: 'Activate operator intelligence, review system, and historical analysis.',
        level: 'high',
        due: '',
        completed: false,
        primary: true,
        order: 0,
        createdAt,
        updatedAt: createdAt,
      }
    ],
    commitments: [],
    decisions: [],
    reflections: [],
    secrets: [],
    timeline: [
      {
        id: 'system-build-007',
        type: 'system',
        title: 'Build 009 initialized',
        detail: 'Rosie Cognitive Partner is active.',
        createdAt
      }
    ],
    recommendations: [],
    missionPlans: [],
    missionSteps: [],
    understandingState: {
      activeDriftSignals: [],
      activePatternKeys: [],
      trendDirections: {},
    },
    cognitionConsent: createDefaultCognitionConsent(),
    operatorUnderstandings: [],
    cloudSyncConsentDeclaration: createDefaultCloudSyncConsent(),
    connectorConsentDeclarations: [],
    cognitiveSignals: [],
    rejectedUnderstandingSignatures: [],
    understandingReviewAudit: [],
    presentationPersonalizationEnabled: false,
    presentationProfile: createDefaultPresentationProfile(),
    presentationOverrides: [],
    presentationAdaptationAudit: [],
  }
}

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}
