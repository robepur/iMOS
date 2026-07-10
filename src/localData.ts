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

export function createInitialData(): PersonalData {
  const createdAt = new Date().toISOString()
  return {
    version: 1,
    priorities: [
      {
        id: 'priority-build-003',
        title: 'Establish Build 003',
        why: 'Protect personal continuity with authenticated local encryption.',
        completed: false,
        createdAt
      }
    ],
    commitments: [],
    decisions: [],
    reflections: [],
    timeline: [
      {
        id: 'system-build-003',
        type: 'system',
        title: 'Build 003 initialized',
        detail: 'Encrypted Personal Vault is ready for activation.',
        createdAt
      }
    ]
  }
}

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}
