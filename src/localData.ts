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
}

export type NodeType =
  | 'priority' | 'commitment' | 'decision' | 'reflection'
  | 'timeline' | 'secret' | 'recommendation' | 'recovery' | 'memory'

export type EdgeType =
  | 'related_to' | 'created_from' | 'references' | 'supports'
  | 'depends_on' | 'completed_by' | 'mentioned_in' | 'derived_from'
  | 'observed_in' | 'remembered_by'

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
  type: 'priority' | 'commitment' | 'decision' | 'reflection' | 'system' | 'secret' | 'recovery'
  title: string
  detail: string
  createdAt: string
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

  return { ...raw, secrets: raw.secrets ?? [], priorities, recommendations: raw.recommendations ?? [] }
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
  }
}

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}
