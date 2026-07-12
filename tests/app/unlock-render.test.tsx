import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../../src/App'
import { createInitialData } from '../../src/localData'

let mockVaultState: 'setup' | 'locked' | 'unlocked' = 'setup'
let mockData: ReturnType<typeof createInitialData> | null = null

vi.mock('../../src/hooks/useVault', () => ({
  useVault: () => ({
    vaultState: mockVaultState,
    data: mockData,
    passphrase: '',
    error: '',
    saving: false,
    setData: vi.fn(),
    createVault: vi.fn(),
    unlock: vi.fn(),
    lock: vi.fn(),
    reset: vi.fn(),
    addTimelineEntry: vi.fn(),
    updatePriorities: vi.fn(),
    updateSecrets: vi.fn(),
    addCommitment: vi.fn(),
    addDecision: vi.fn(),
    toggleCommitment: vi.fn(),
    toggleDecision: vi.fn(),
    completePrimaryPriority: vi.fn(),
    saveReflection: vi.fn(),
    deleteReflection: vi.fn(),
    restoreVault: vi.fn(),
    rotateVaultPassphrase: vi.fn(),
    dismissRecommendation: vi.fn(),
    snoozeRecommendation: vi.fn(),
    completeRecommendation: vi.fn(),
    syncUnderstandingState: vi.fn(),
    saveMissionPlan: vi.fn(),
    setMissionPlanStatus: vi.fn(),
    updateMissionPlan: vi.fn(),
    updateMissionStepStatus: vi.fn(),
    updateMissionStep: vi.fn(),
    addMissionStep: vi.fn(),
    deleteMissionStep: vi.fn(),
    reorderMissionSteps: vi.fn(),
    deleteMissionPlan: vi.fn(),
    updateCognitionConsent: vi.fn(),
    saveCognitiveSignals: vi.fn(),
    suppressCognitiveSignal: vi.fn(),
    saveOperatorUnderstandings: vi.fn(),
    confirmOperatorUnderstanding: vi.fn(),
    correctOperatorUnderstanding: vi.fn(),
    rejectOperatorUnderstanding: vi.fn(),
    expireOperatorUnderstanding: vi.fn(),
    suppressUnderstandingSourceSignal: vi.fn(),
    setPresentationPersonalizationEnabled: vi.fn(),
    saveResolvedPresentationProfile: vi.fn(),
    setPresentationOverride: vi.fn(),
    savePresentationOverrides: vi.fn(),
    removePresentationOverride: vi.fn(),
    restoreNeutralPresentation: vi.fn(),
  }),
}))

vi.mock('../../src/hooks/usePriorities', () => ({
  usePriorities: (data: ReturnType<typeof createInitialData> | null) => ({
    activePriorities: data?.priorities.filter((priority) => !priority.completed) ?? [],
    primary: data?.priorities.find((priority) => priority.primary) ?? null,
    criticalCount: 0,
    overdueCount: 0,
  }),
}))

vi.mock('../../src/hooks/useSecrets', () => ({
  useSecrets: (data: ReturnType<typeof createInitialData> | null) => ({
    records: data?.secrets ?? [],
    count: data?.secrets?.length ?? 0,
  }),
}))

vi.mock('../../src/hooks/useRecommendations', () => ({
  useRecommendations: () => ({
    active: [],
    patterns: { repeatedRecommendationDismissals: [] },
    criticalCount: 0,
  }),
}))

vi.mock('../../src/hooks/useKnowledgeGraph', () => ({
  useKnowledgeGraph: () => ({
    graph: { nodes: [], edges: [], builtAt: '' },
    getRelated: vi.fn(),
    search: vi.fn(),
    getStats: () => ({ totalNodes: 0, totalEdges: 0, avgDegree: 0, nodeCounts: {}, edgeCounts: {}, densestNode: null }),
    patch: vi.fn(),
  }),
}))

vi.mock('../../src/hooks/useUnderstanding', () => ({
  useUnderstanding: () => ({
    understanding: null,
  }),
}))

vi.mock('../../src/services/RosieEngine', () => ({
  RosieEngine: {
    getHealthSignals: () => [],
    getMorningBrief: () => ({ priorities: [], focus: '', activeMission: undefined, currentMissionStep: null, missionRisks: [] }),
    getEveningSummary: () => ({ completedMissionSteps: [], missionProgress: 0, outstandingBlocks: [], recommendedNextStep: null }),
  },
}))

vi.mock('../../src/services/UnderstandingEngine', () => ({
  UnderstandingEngine: {
    getMorningObservations: () => [],
    getEveningObservations: () => [],
    derivePatternKeys: () => [],
  },
}))

describe('App unlock render regression', () => {
  beforeEach(() => {
    mockVaultState = 'setup'
    mockData = null
  })

  it('renders setup state then unlocked shell without hook-order failure', () => {
    const result = render(<App />)
    expect(screen.getByText('CREATE VAULT')).toBeInTheDocument()

    mockVaultState = 'unlocked'
    mockData = createInitialData()
    mockData.onboardingState = {
      ...mockData.onboardingState!,
      status: 'completed',
      recoveryBackupConfirmed: true,
    }
    result.rerender(<App />)

    expect(screen.getByText('iMOS')).toBeInTheDocument()
    expect(screen.getByText('ENCRYPTED MODE')).toBeInTheDocument()
  })
})
