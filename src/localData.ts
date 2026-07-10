export type PriorityLevel = 'critical' | 'high' | 'normal' | 'low'

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
  type: 'priority' | 'commitment' | 'decision' | 'reflection' | 'system' | 'secret'
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

  return { ...raw, secrets: raw.secrets ?? [], priorities }
}

export function getRosieMemory(data: PersonalData): RosieMemoryItem[] {
  return data.reflections
    .filter((r) => r.remember.trim().length > 0)
    .slice(0, 5)
    .map((r) => ({
      id: `memory-${r.id}`,
      text: r.remember.trim(),
      sourceReflectionId: r.id,
      createdAt: r.createdAt,
    }))
}

export function createInitialData(): PersonalData {
  const createdAt = new Date().toISOString()
  return {
    version: 1,
    priorities: [
      {
        id: 'priority-build-006',
        title: 'Establish Build 006',
        why: 'Extend priority management and activate Rosie Memory.',
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
        id: 'system-build-006',
        type: 'system',
        title: 'Build 006 initialized',
        detail: 'Priority Command and Rosie Memory are ready for activation.',
        createdAt
      }
    ]
  }
}

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}
