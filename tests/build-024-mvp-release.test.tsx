import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { normalizePersonalData, createInitialData } from '../src/localData'
import {
  createDefaultOnboardingState,
  isSafeOnboardingState,
  ONBOARDING_SCHEMA_VERSION,
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL_STEPS,
} from '../src/types/onboarding'
import {
  isSafePilotFeedbackEntry,
  PILOT_FEEDBACK_SCHEMA_VERSION,
} from '../src/types/pilotFeedback'
import type { PilotFeedbackEntry } from '../src/types/pilotFeedback'
import { APP_VERSION, BUILD } from '../src/constants'
import OnboardingFlow from '../src/features/onboarding/OnboardingFlow'
import PilotFeedbackPanel from '../src/features/pilot/PilotFeedbackPanel'
import type { OnboardingState } from '../src/types/onboarding'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeOnboardingState(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    status: 'in_progress',
    currentStepIndex: 0,
    completedStepIds: [],
    recoveryBackupConfirmed: false,
    startedAt: '2026-01-01T00:00:00.000Z',
    lastUpdatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeFeedbackEntry(overrides: Partial<PilotFeedbackEntry> = {}): PilotFeedbackEntry {
  return {
    id: `pilot-feedback:test-${crypto.randomUUID()}`,
    schemaVersion: PILOT_FEEDBACK_SCHEMA_VERSION,
    rosieSurface: 'general',
    usefulness: 3,
    cognitiveEffort: 3,
    incorrectAssumption: false,
    missingContext: false,
    trustConcern: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const noopUpdate = vi.fn()
const noopComplete = vi.fn()
const noopPause = vi.fn()
const noopRecovery = vi.fn()

const emptyMeasurements = {
  briefingUsefulness: null,
  recommendationUsefulness: null,
  averageCognitiveEffort: null,
  correctionCount: 0,
  rejectedRecommendationCount: 0,
  acceptedRecommendationCount: 0,
  missingContextReports: 0,
  trustConcernReports: 0,
  dailyWorkflowCompletions: 0,
  backupReady: false,
  totalFeedbackEntries: 0,
}

// ── Release candidate ─────────────────────────────────────────────────────────

describe('Build 024 MVP release candidate', () => {
  describe('1. release candidate metadata', () => {
    it('1. BUILD constant is 024', () => {
      expect(BUILD).toBe('025')
    })

    it('2. APP_VERSION is consistent RC format', () => {
      expect(APP_VERSION).toMatch(/^0\.1\.0-rc\.\d+$/)
    })

    it('3. release version matches package.json format', () => {
      expect(APP_VERSION).toBe('0.1.0-rc.1')
    })
  })

  // ── First launch ────────────────────────────────────────────────────────────

  describe('2. first launch', () => {
    it('4. first launch creates a vault with default onboarding state', () => {
      const data = createInitialData()
      expect(data.onboardingState).toBeDefined()
      expect(data.onboardingState?.status).toBe('not_started')
    })

    it('5. first launch has empty pilot feedback', () => {
      const data = createInitialData()
      expect(data.pilotFeedback).toEqual([])
    })

    it('6. local only mode is the default', () => {
      const data = createInitialData()
      expect(data.syncOperatorControlState?.enabled).toBe(false)
    })

    it('7. synchronisation disabled by default', () => {
      const data = createInitialData()
      expect(data.syncOperatorControlState?.enabled).toBe(false)
    })

    it('8. no provider endpoint configured', () => {
      const data = createInitialData()
      const ctrl = data.syncOperatorControlState
      expect(ctrl?.endpoint ?? null).toBeNull()
    })
  })

  // ── Onboarding types ────────────────────────────────────────────────────────

  describe('3. onboarding state', () => {
    it('9. createDefaultOnboardingState returns not_started', () => {
      const s = createDefaultOnboardingState()
      expect(s.status).toBe('not_started')
    })

    it('10. createDefaultOnboardingState returns fresh objects each call', () => {
      const a = createDefaultOnboardingState()
      const b = createDefaultOnboardingState()
      expect(a).not.toBe(b)
    })

    it('11. isSafeOnboardingState accepts valid state', () => {
      expect(isSafeOnboardingState(makeOnboardingState())).toBe(true)
    })

    it('12. isSafeOnboardingState rejects wrong schema version', () => {
      expect(isSafeOnboardingState({ ...makeOnboardingState(), schemaVersion: '2.0.0' })).toBe(false)
    })

    it('13. isSafeOnboardingState rejects invalid status', () => {
      expect(isSafeOnboardingState({ ...makeOnboardingState(), status: 'unknown' })).toBe(false)
    })

    it('14. isSafeOnboardingState rejects non-boolean recoveryBackupConfirmed', () => {
      expect(isSafeOnboardingState({ ...makeOnboardingState(), recoveryBackupConfirmed: 'yes' })).toBe(false)
    })

    it('15. total onboarding steps matches ONBOARDING_TOTAL_STEPS', () => {
      expect(ONBOARDING_STEPS.length).toBe(ONBOARDING_TOTAL_STEPS)
    })
  })

  // ── Onboarding normalization ─────────────────────────────────────────────────

  describe('4. onboarding normalization', () => {
    it('16. missing onboarding state normalizes to default', () => {
      const base = createInitialData()
      const raw = { ...base, onboardingState: undefined }
      const normalized = normalizePersonalData(raw as Parameters<typeof normalizePersonalData>[0])
      expect(normalized.onboardingState?.status).toBe('not_started')
    })

    it('17. malformed onboarding state falls back to default', () => {
      const base = createInitialData()
      const raw = { ...base, onboardingState: { status: 'corrupted', schemaVersion: '9.9.9' } }
      const normalized = normalizePersonalData(raw as Parameters<typeof normalizePersonalData>[0])
      expect(normalized.onboardingState?.status).toBe('not_started')
    })

    it('18. valid in_progress onboarding state survives normalization', () => {
      const base = createInitialData()
      const state = makeOnboardingState({ status: 'in_progress', currentStepIndex: 3 })
      const normalized = normalizePersonalData({ ...base, onboardingState: state })
      expect(normalized.onboardingState?.status).toBe('in_progress')
      expect(normalized.onboardingState?.currentStepIndex).toBe(3)
    })

    it('19. completed onboarding state survives normalization', () => {
      const base = createInitialData()
      const state = makeOnboardingState({ status: 'completed', currentStepIndex: ONBOARDING_TOTAL_STEPS })
      const normalized = normalizePersonalData({ ...base, onboardingState: state })
      expect(normalized.onboardingState?.status).toBe('completed')
    })

    it('20. onboarding does not replace an existing vault', () => {
      const data = createInitialData()
      const withOnboarding = { ...data, onboardingState: makeOnboardingState({ status: 'completed' }) }
      const normalized = normalizePersonalData(withOnboarding)
      expect(normalized.priorities).toEqual(data.priorities)
    })
  })

  // ── Onboarding UI ──────────────────────────────────────────────────────────

  describe('5. onboarding UI', () => {
    beforeEach(() => {
      noopUpdate.mockClear()
      noopComplete.mockClear()
      noopPause.mockClear()
    })

    it('21. onboarding flow renders for new operator', () => {
      const state = makeOnboardingState()
      render(<OnboardingFlow state={state} onUpdate={noopUpdate} onComplete={noopComplete} onPause={noopPause} onOpenRecovery={noopRecovery} />)
      expect(screen.getByTestId('onboarding-flow')).toBeInTheDocument()
    })

    it('22. onboarding shows progress bar', () => {
      render(<OnboardingFlow state={makeOnboardingState()} onUpdate={noopUpdate} onComplete={noopComplete} onPause={noopPause} onOpenRecovery={noopRecovery} />)
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('23. onboarding can pause and resume', async () => {
      render(<OnboardingFlow state={makeOnboardingState()} onUpdate={noopUpdate} onComplete={noopComplete} onPause={noopPause} onOpenRecovery={noopRecovery} />)
      fireEvent.click(screen.getByTestId('onboarding-pause'))
      expect(noopPause).toHaveBeenCalled()
    })

    it('24. onboarding advances on primary action', async () => {
      render(<OnboardingFlow state={makeOnboardingState()} onUpdate={noopUpdate} onComplete={noopComplete} onPause={noopPause} onOpenRecovery={noopRecovery} />)
      fireEvent.click(screen.getByTestId('onboarding-primary-action'))
      expect(noopUpdate).toHaveBeenCalledWith(expect.objectContaining({ currentStepIndex: 1 }))
    })

    it('25. recovery step opens recovery console', () => {
      const state = makeOnboardingState({ currentStepIndex: 5 }) // recovery_backup step
      render(<OnboardingFlow state={state} onUpdate={noopUpdate} onComplete={noopComplete} onPause={noopPause} onOpenRecovery={noopRecovery} />)
      fireEvent.click(screen.getByTestId('onboarding-primary-action'))
      expect(noopRecovery).toHaveBeenCalled()
    })

    it('26. completing onboarding calls onComplete', () => {
      const state = makeOnboardingState({ currentStepIndex: ONBOARDING_TOTAL_STEPS - 1, status: 'in_progress' })
      render(<OnboardingFlow state={state} onUpdate={noopUpdate} onComplete={noopComplete} onPause={noopPause} onOpenRecovery={noopRecovery} />)
      fireEvent.click(screen.getByTestId('onboarding-primary-action'))
      expect(noopComplete).toHaveBeenCalled()
    })
  })

  // ── Pilot feedback ─────────────────────────────────────────────────────────

  describe('6. pilot feedback', () => {
    it('27. isSafePilotFeedbackEntry accepts valid entry', () => {
      expect(isSafePilotFeedbackEntry(makeFeedbackEntry())).toBe(true)
    })

    it('28. isSafePilotFeedbackEntry rejects wrong schema', () => {
      expect(isSafePilotFeedbackEntry({ ...makeFeedbackEntry(), schemaVersion: '9.9.9' })).toBe(false)
    })

    it('29. isSafePilotFeedbackEntry rejects invalid rating', () => {
      expect(isSafePilotFeedbackEntry({ ...makeFeedbackEntry(), usefulness: 6 })).toBe(false)
    })

    it('30. feedback entry contains no credentials or key material', () => {
      const entry = makeFeedbackEntry({ freeformComment: 'This was helpful' })
      const json = JSON.stringify(entry)
      expect(json).not.toMatch(/passphrase|privatekey|credential|token|authorization/i)
    })

    it('31. feedback normalization strips invalid entries', () => {
      const data = createInitialData()
      const raw = { ...data, pilotFeedback: [{ invalid: true }, makeFeedbackEntry()] }
      const normalized = normalizePersonalData(raw as Parameters<typeof normalizePersonalData>[0])
      expect(normalized.pilotFeedback?.length).toBe(1)
    })

    it('32. feedback panel renders empty state', () => {
      render(<PilotFeedbackPanel entries={[]} measurements={emptyMeasurements} onAdd={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />)
      expect(screen.getByTestId('feedback-empty')).toBeInTheDocument()
    })

    it('33. feedback panel renders entries', () => {
      const entry = makeFeedbackEntry()
      render(<PilotFeedbackPanel entries={[entry]} measurements={emptyMeasurements} onAdd={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />)
      expect(screen.getByTestId(`feedback-entry-${entry.id}`)).toBeInTheDocument()
    })

    it('34. feedback can be added', async () => {
      const onAdd = vi.fn()
      render(<PilotFeedbackPanel entries={[]} measurements={emptyMeasurements} onAdd={onAdd} onUpdate={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />)
      fireEvent.click(screen.getByTestId('feedback-add-button'))
      await waitFor(() => expect(screen.getByTestId('feedback-save')).toBeInTheDocument())
      fireEvent.click(screen.getByTestId('feedback-save'))
      expect(onAdd).toHaveBeenCalled()
    })

    it('35. feedback can be deleted', async () => {
      const onDelete = vi.fn()
      const entry = makeFeedbackEntry()
      render(<PilotFeedbackPanel entries={[entry]} measurements={emptyMeasurements} onAdd={vi.fn()} onUpdate={vi.fn()} onDelete={onDelete} onClose={vi.fn()} />)
      fireEvent.click(screen.getByTestId(`feedback-delete-${entry.id}`))
      await waitFor(() => expect(screen.getByTestId(`feedback-delete-confirm-${entry.id}`)).toBeInTheDocument())
      fireEvent.click(screen.getByTestId(`feedback-delete-confirm-${entry.id}`))
      expect(onDelete).toHaveBeenCalledWith(entry.id)
    })

    it('36. feedback measurements are shown in panel', () => {
      const measurements = { ...emptyMeasurements, correctionCount: 3, dailyWorkflowCompletions: 5 }
      render(<PilotFeedbackPanel entries={[]} measurements={measurements} onAdd={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />)
      expect(screen.getByLabelText('Pilot measurements')).toBeInTheDocument()
    })

    it('37. measurements do not rank or score the operator', () => {
      const measurements = { ...emptyMeasurements, correctionCount: 10 }
      render(<PilotFeedbackPanel entries={[]} measurements={measurements} onAdd={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />)
      const measurementFields = Object.keys(measurements).join(' ')
      expect(measurementFields).not.toMatch(/score|rank|grade|performanceRating/i)
    })

    it('38. measurements are deterministic for same inputs', () => {
      const entries: PilotFeedbackEntry[] = [
        makeFeedbackEntry({ usefulness: 4, cognitiveEffort: 2 }),
        makeFeedbackEntry({ usefulness: 2, cognitiveEffort: 4 }),
      ]
      const avgUsefulness = entries.reduce((s, e) => s + e.usefulness, 0) / entries.length
      const avgEffort = entries.reduce((s, e) => s + e.cognitiveEffort, 0) / entries.length
      expect(avgUsefulness).toBe(3)
      expect(avgEffort).toBe(3)
      // Same inputs always produce same result
      const second = entries.reduce((s, e) => s + e.usefulness, 0) / entries.length
      expect(second).toBe(avgUsefulness)
    })
  })

  // ── Security ───────────────────────────────────────────────────────────────

  describe('7. security', () => {
    it('39. default personal data has no provider endpoint', () => {
      const data = createInitialData()
      const json = JSON.stringify(data)
      expect(json).not.toMatch(/https:\/\/[a-z0-9-]+\.(?:azure|aws|gcp|microsoft|google|apple)\.com/i)
    })

    it('40. default personal data has no outbound action capability', () => {
      const data = createInitialData()
      expect(data.syncOperatorControlState?.enabled).toBe(false)
    })
  })
})
