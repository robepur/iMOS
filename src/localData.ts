export type Priority = {
  id: string
  title: string
  why: string
  completed: boolean
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
  type: 'priority' | 'commitment' | 'decision' | 'reflection' | 'system'
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

export type PersonalData = {
  version: 1
  priorities: Priority[]
  commitments: Commitment[]
  decisions: Decision[]
  timeline: TimelineEntry[]
  reflections: Reflection[]
}

const STORAGE_KEY = 'imos.personal.v1'

const initialData: PersonalData = {
  version: 1,
  priorities: [
    {
      id: 'priority-build-002',
      title: 'Establish Build 002',
      why: 'Create trusted local continuity without adding external dependencies.',
      completed: false,
      createdAt: new Date().toISOString()
    }
  ],
  commitments: [],
  decisions: [],
  reflections: [],
  timeline: [
    {
      id: 'system-build-002',
      type: 'system',
      title: 'Build 002 initialized',
      detail: 'Local personal data foundation is active on this device.',
      createdAt: new Date().toISOString()
    }
  ]
}

function isPersonalData(value: unknown): value is PersonalData {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PersonalData>
  return candidate.version === 1 && Array.isArray(candidate.priorities) && Array.isArray(candidate.commitments) && Array.isArray(candidate.decisions) && Array.isArray(candidate.timeline) && Array.isArray(candidate.reflections)
}

export function loadPersonalData(): PersonalData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialData
    const parsed: unknown = JSON.parse(raw)
    return isPersonalData(parsed) ? parsed : initialData
  } catch {
    return initialData
  }
}

export function savePersonalData(data: PersonalData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function resetPersonalData(): PersonalData {
  localStorage.removeItem(STORAGE_KEY)
  return initialData
}

export function exportPersonalData(data: PersonalData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `imos-personal-export-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}
