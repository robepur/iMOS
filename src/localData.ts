import type {
  CognitionConsent,
  OperatorUnderstanding,
  CloudSyncConsentDeclaration,
  ConnectorConsentDeclaration,
} from './types/cognitive'

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
}

export type UnderstandingState = {
  activeDriftSignals: string[]
  activePatternKeys: string[]
  trendDirections: Record<string, 'increasing' | 'stable' | 'decreasing'>
}

const VALID_LEVELS: PriorityLevel[] = ['critical', 'high', 'normal', 'low']

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
    cognitionConsent: raw.cognitionConsent ?? createDefaultCognitionConsent(),
    operatorUnderstandings: raw.operatorUnderstandings ?? [],
    cloudSyncConsentDeclaration: raw.cloudSyncConsentDeclaration ?? createDefaultCloudSyncConsent(),
    connectorConsentDeclarations: raw.connectorConsentDeclarations ?? [],
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
  }
}

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}
