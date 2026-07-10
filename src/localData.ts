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

export function createInitialData(): PersonalData {
  const createdAt = new Date().toISOString()
  return {
    version: 1,
    priorities: [
      {
        id: 'priority-build-005',
        title: 'Establish Build 005',
        why: 'Protect and control access to personal credentials and secure notes.',
        completed: false,
        createdAt
      }
    ],
    commitments: [],
    decisions: [],
    reflections: [],
    secrets: [],
    timeline: [
      {
        id: 'system-build-005',
        type: 'system',
        title: 'Build 005 initialized',
        detail: 'Secure Secrets and Credential Management is ready for activation.',
        createdAt
      }
    ]
  }
}

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}
