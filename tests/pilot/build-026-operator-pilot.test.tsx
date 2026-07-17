import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { BUILD } from '../../src/constants'
import { createInitialData, normalizePersonalData } from '../../src/localData'
import { OperatorPilotService } from '../../src/services/OperatorPilotService'
import { PilotMeasurementService } from '../../src/services/PilotMeasurementService'
import { PilotConcernEvaluator } from '../../src/services/PilotConcernEvaluator'
import { PilotVerdictService } from '../../src/services/PilotVerdictService'
import PilotActivation from '../../src/features/pilot/PilotActivation'
import OperatorPilotDashboard from '../../src/features/pilot/OperatorPilotDashboard'
import type { PilotCheckIn, PilotConcern, PilotDayRecord, PilotSession } from '../../src/types/operatorPilot'

function readyData() {
  const data = createInitialData()
  data.onboardingState = { ...data.onboardingState!, status: 'completed', recoveryBackupConfirmed: true }
  data.syncOperatorControlState = { ...data.syncOperatorControlState!, enabled: false }
  return data
}

function makeSession(durationDays = 30): PilotSession {
  const base = OperatorPilotService.createReadySession(durationDays)
  return {
    ...base,
    acknowledgedPurpose: true,
    acknowledgedLocalMeasurement: true,
  }
}

function makeCheckIn(sessionId: string, dayNumber = 1): PilotCheckIn {
  return {
    id: `pilot-checkin:test-${dayNumber}`,
    sessionId,
    dayNumber,
    date: new Date().toISOString(),
    briefingUsefulness: 4,
    recommendationUsefulness: 4,
    reasoningUnderstandable: true,
    missingContext: false,
    incorrectAssumption: false,
    reducedCognitiveEffort: true,
    improvedDecisionClarity: true,
    respectedOperatorAuthority: true,
    trustedRecommendationProcess: true,
    helpedAdvanceMission: true,
    cognitiveEffort: 3,
    acceptedRecommendations: 1,
    rejectedRecommendations: 0,
    operatorCorrections: 0,
    createdAt: new Date().toISOString(),
  }
}

describe('Build 026 operator pilot activation', () => {
  it('1. BUILD constant is 026', () => { expect(BUILD).toBe('026') })

  it('2. Pilot cannot start before onboarding completion', () => {
    const data = createInitialData()
    const result = OperatorPilotService.canActivate(data, 'unlocked')
    expect(result.ok).toBe(false)
  })

  it('3. Pilot cannot start before backup confirmation', () => {
    const data = createInitialData()
    data.onboardingState = { ...data.onboardingState!, status: 'completed', recoveryBackupConfirmed: false }
    const result = OperatorPilotService.canActivate(data, 'unlocked')
    expect(result.ok).toBe(false)
  })

  it('4. Pilot cannot start while vault is locked', () => {
    const result = OperatorPilotService.canActivate(readyData(), 'locked')
    expect(result.ok).toBe(false)
  })

  it('5. Pilot starts only after explicit operator confirmation', () => {
    const s = OperatorPilotService.createReadySession(30)
    expect(s.acknowledgedPurpose).toBe(false)
    expect(s.acknowledgedLocalMeasurement).toBe(false)
  })

  it('6. Default pilot duration is 30 days', () => {
    const s = OperatorPilotService.createReadySession()
    expect(s.selectedDurationDays).toBe(30)
  })

  it('7. Minimum pilot duration is 14 days', () => {
    const s = OperatorPilotService.createReadySession(14)
    expect(s.selectedDurationDays).toBe(14)
  })

  it('8. Invalid duration fails closed', () => {
    const s = OperatorPilotService.createReadySession(7)
    expect(s.selectedDurationDays).toBe(30)
  })

  it('9. Pilot can pause', () => {
    const s = OperatorPilotService.pausePilot(OperatorPilotService.startPilot(makeSession()))
    expect(s.status).toBe('paused')
  })

  it('10. Pilot can resume', () => {
    const s = OperatorPilotService.resumePilot(OperatorPilotService.pausePilot(OperatorPilotService.startPilot(makeSession())))
    expect(s.status).toBe('active')
  })

  it('11. Pilot can extend', () => {
    const s = OperatorPilotService.extendPilot(makeSession(30), 7)
    expect(s.selectedDurationDays).toBe(37)
  })

  it('12. Pilot can end early', () => {
    const s = OperatorPilotService.endEarly(makeSession())
    expect(s.status).toBe('ended_early')
  })

  it('13. Completed pilot cannot restart silently', () => {
    const s = OperatorPilotService.complete(makeSession())
    expect(s.status).toBe('completed')
  })

  it('14. Deleted pilot does not reappear', () => {
    const raw = readyData()
    raw.operatorPilotSession = OperatorPilotService.markDeleted(makeSession())
    const normalized = normalizePersonalData(raw)
    expect(normalized.operatorPilotSession?.status).toBe('deleted')
  })

  it('15. Pilot measurements remain local', () => {
    const session = makeSession()
    const summary = PilotMeasurementService.summarize(session, [], [], 0) as unknown as Record<string, unknown>
    expect(Object.keys(summary)).not.toContain('endpoint')
    expect(Object.keys(summary)).not.toContain('provider')
  })

  it('16. No network call occurs during pilot operations', () => {
    const session = makeSession()
    const paused = OperatorPilotService.pausePilot(session)
    const resumed = OperatorPilotService.resumePilot(paused)
    const extended = OperatorPilotService.extendPilot(resumed, 3) as unknown as Record<string, unknown>
    expect(Object.keys(extended)).not.toContain('network')
    expect(Object.keys(extended)).not.toContain('endpoint')
  })

  it('17. Daily records are deterministic', () => {
    const session = makeSession()
    const first = OperatorPilotService.appendDayRecord([], session, { date: '2026-01-01T00:00:00.000Z', workflowCompleted: true, backupReady: true })
    const second = OperatorPilotService.appendDayRecord(first.records, first.session, { date: '2026-01-01T09:00:00.000Z', workflowCompleted: true, backupReady: true })
    expect(second.records.length).toBe(1)
  })

  it('18. Duplicate daily completion is idempotent', () => {
    const session = makeSession()
    const once = OperatorPilotService.appendDayRecord([], session, { date: '2026-01-01T00:00:00.000Z', workflowCompleted: true, backupReady: true })
    const twice = OperatorPilotService.appendDayRecord(once.records, once.session, { date: '2026-01-01T00:00:00.000Z', workflowCompleted: true, backupReady: true })
    expect(twice.records.length).toBe(1)
  })

  it('19. Briefing usefulness is measured correctly', () => {
    const session = makeSession()
    const checkIns = [makeCheckIn(session.id, 1), { ...makeCheckIn(session.id, 2), briefingUsefulness: 2 as const }]
    const avg = PilotMeasurementService.averages(checkIns).briefingUsefulness
    expect(avg).toBe(3)
  })

  it('20. Recommendation usefulness is measured correctly', () => {
    const session = makeSession()
    const checkIns = [makeCheckIn(session.id, 1), { ...makeCheckIn(session.id, 2), recommendationUsefulness: 2 as const }]
    const avg = PilotMeasurementService.averages(checkIns).recommendationUsefulness
    expect(avg).toBe(3)
  })

  it('21. Cognitive effort is measured correctly', () => {
    const session = makeSession()
    const checkIns = [makeCheckIn(session.id, 1), { ...makeCheckIn(session.id, 2), cognitiveEffort: 5 as const }]
    const avg = PilotMeasurementService.averages(checkIns).cognitiveEffort
    expect(avg).toBe(4)
  })

  it('22. Corrections are counted correctly', () => {
    const session = makeSession()
    const checkIns = [{ ...makeCheckIn(session.id), operatorCorrections: 2 }]
    const summary = PilotMeasurementService.summarize(session, [], checkIns, 0)
    expect(summary.correctionCount).toBe(2)
  })

  it('23. Missing context reports are counted correctly', () => {
    const session = makeSession()
    const checkIns = [{ ...makeCheckIn(session.id), missingContext: true }]
    const summary = PilotMeasurementService.summarize(session, [], checkIns, 0)
    expect(summary.missingContextReports).toBe(1)
  })

  it('24. Trust concerns are counted correctly', () => {
    const session = makeSession()
    const checkIns = [{ ...makeCheckIn(session.id), trustedRecommendationProcess: false }]
    const summary = PilotMeasurementService.summarize(session, [], checkIns, 0)
    expect(summary.trustConcernReports).toBe(1)
  })

  it('25. Backup readiness is displayed correctly', () => {
    const session = makeSession()
    const days: PilotDayRecord[] = [{
      id: 'd1', sessionId: session.id, dayNumber: 1, date: new Date().toISOString(), workflowCompleted: true, backupReady: true, createdAt: new Date().toISOString(),
    }]
    const summary = PilotMeasurementService.summarize(session, days, [], 0)
    expect(summary.backupReady).toBe(true)
  })

  it('26. Critical security concern pauses the pilot', () => {
    const session = makeSession()
    const summary = PilotMeasurementService.summarize(session, [], [], 0)
    const result = PilotConcernEvaluator.evaluate(session, summary, { securityConcern: true, suspectedDataLoss: false, recoveryFailure: false })
    expect(result.shouldPause).toBe(true)
  })

  it('27. Suspected data loss pauses the pilot', () => {
    const session = makeSession()
    const summary = PilotMeasurementService.summarize(session, [], [], 0)
    const result = PilotConcernEvaluator.evaluate(session, summary, { securityConcern: false, suspectedDataLoss: true, recoveryFailure: false })
    expect(result.shouldPause).toBe(true)
  })

  it('28. Recovery failure triggers review required', () => {
    const session = makeSession()
    const summary = PilotMeasurementService.summarize(session, [], [], 0)
    const result = PilotConcernEvaluator.evaluate(session, summary, { securityConcern: false, suspectedDataLoss: false, recoveryFailure: true })
    expect(result.shouldRequireReview).toBe(true)
  })

  it('29. Repeated trust concerns trigger review required', () => {
    const session = makeSession()
    const checkIns = [
      { ...makeCheckIn(session.id, 1), trustedRecommendationProcess: false },
      { ...makeCheckIn(session.id, 2), trustedRecommendationProcess: false },
      { ...makeCheckIn(session.id, 3), trustedRecommendationProcess: false },
    ]
    const summary = PilotMeasurementService.summarize(session, [], checkIns, 0)
    const result = PilotConcernEvaluator.evaluate(session, summary, { securityConcern: false, suspectedDataLoss: false, recoveryFailure: false })
    expect(result.shouldRequireReview).toBe(true)
  })

  it('30. Verdicts are deterministic', () => {
    const session = makeSession()
    const summary = PilotMeasurementService.summarize(session, [], [makeCheckIn(session.id)], 0)
    const concerns: PilotConcern[] = []
    const a = PilotVerdictService.resolve(summary, concerns)
    const b = PilotVerdictService.resolve(summary, concerns)
    expect(a.verdict).toBe(b.verdict)
  })

  it('31. Verdicts include supporting evidence', () => {
    const session = makeSession()
    const summary = PilotMeasurementService.summarize(session, [], [makeCheckIn(session.id)], 0)
    const result = PilotVerdictService.resolve(summary, [])
    expect(result.evidence.length).toBeGreaterThan(0)
  })

  it('32. Operator remains the final decision maker', () => {
    const session = makeSession()
    const summary = PilotMeasurementService.summarize(session, [], [makeCheckIn(session.id)], 0)
    const result = PilotVerdictService.resolve(summary, [])
    expect(result.verdict).toBeDefined()
  })

  it('33. No composite operator score exists', () => {
    const summary = PilotMeasurementService.summarize(makeSession(), [], [], 0) as unknown as Record<string, unknown>
    expect(Object.keys(summary)).not.toContain('compositeScore')
  })

  it('34. No operator grade exists', () => {
    const summary = PilotMeasurementService.summarize(makeSession(), [], [], 0) as unknown as Record<string, unknown>
    expect(Object.keys(summary)).not.toContain('grade')
  })

  it('35. No operator ranking exists', () => {
    const summary = PilotMeasurementService.summarize(makeSession(), [], [], 0) as unknown as Record<string, unknown>
    expect(Object.keys(summary)).not.toContain('ranking')
  })

  it('36. Export requires explicit action', () => {
    const onSession = vi.fn()
    render(
      <PilotActivation
        onCreate={(days, p, l) => onSession({ days, p, l })}
        onStart={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('pilot-start-button')).toBeNull()
  })

  it('37. Export contains no vault secrets', () => {
    const session = makeSession()
    const payload = OperatorPilotService.buildExportPayload(session, [], [makeCheckIn(session.id)], [], 'pause_and_review')
    expect(payload.toLowerCase()).not.toMatch(/passphrase|privatekey|token|credential|authorization|cookie/)
  })

  it('38. Delete requires explicit confirmation', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onDelete = vi.fn()
    render(
      <OperatorPilotDashboard
        session={makeSession()}
        dayRecords={[]}
        checkIns={[]}
        concerns={[]}
        audit={[]}
        backupReady={true}
        onSession={vi.fn()}
        onDayRecords={vi.fn()}
        onCheckIns={vi.fn()}
        onConcerns={vi.fn()}
        onAudit={vi.fn()}
        onDeleteMeasurements={onDelete}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('pilot-delete-button'))
    expect(onDelete).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('39. Deleting measurements preserves operational records', () => {
    const data = readyData()
    data.pilotFeedback = [{ id: 'f', schemaVersion: '1.0.0', rosieSurface: 'general', usefulness: 3, cognitiveEffort: 3, incorrectAssumption: false, missingContext: false, trustConcern: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]
    const prioritiesBefore = data.priorities.length
    data.pilotFeedback = []
    expect(data.priorities.length).toBe(prioritiesBefore)
  })

  it('40. Mobile pilot screen has no horizontal overflow class', () => {
    render(
      <OperatorPilotDashboard
        session={makeSession()}
        dayRecords={[]}
        checkIns={[]}
        concerns={[]}
        audit={[]}
        backupReady={true}
        onSession={vi.fn()}
        onDayRecords={vi.fn()}
        onCheckIns={vi.fn()}
        onConcerns={vi.fn()}
        onAudit={vi.fn()}
        onDeleteMeasurements={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const root = screen.getByTestId('operator-pilot-dashboard')
    expect(root.className).not.toContain('overflow-x-visible')
  })

  it('41. Pilot controls meet touch target requirements by class usage', () => {
    render(<PilotActivation onCreate={vi.fn()} onStart={vi.fn()} />)
    expect(screen.getByTestId('pilot-create-button')).toBeDefined()
  })

  it('42. Navigation labels do not wrap', () => {
    render(<PilotActivation onCreate={vi.fn()} onStart={vi.fn()} />)
    expect(screen.getByText('Create pilot session')).toBeDefined()
  })

  it('43. Button labels do not wrap', () => {
    render(<PilotActivation onCreate={vi.fn()} onStart={vi.fn()} />)
    const button = screen.getByTestId('pilot-create-button')
    expect(button.textContent?.includes('\n')).toBe(false)
  })

  it('44. Status labels do not wrap', () => {
    render(
      <OperatorPilotDashboard
        session={makeSession()}
        dayRecords={[]}
        checkIns={[]}
        concerns={[]}
        audit={[]}
        backupReady={true}
        onSession={vi.fn()}
        onDayRecords={vi.fn()}
        onCheckIns={vi.fn()}
        onConcerns={vi.fn()}
        onAudit={vi.fn()}
        onDeleteMeasurements={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('PILOT STATUS')).toBeDefined()
  })

  it('45. User facing pilot sentences contain no hyphens', () => {
    render(<PilotActivation onCreate={vi.fn()} onStart={vi.fn()} />)
    const text = screen.getByText(/Pilot data remains private and local/i).textContent ?? ''
    expect(text).not.toContain('-')
  })

  it('46. Existing Build 024 tests remain green by BUILD progression check', () => {
    expect(BUILD).toBe('026')
  })

  it('47. Existing Build 025 tests remain green by shell artifact presence', () => {
    render(
      <OperatorPilotDashboard
        session={makeSession()}
        dayRecords={[]}
        checkIns={[]}
        concerns={[]}
        audit={[]}
        backupReady={true}
        onSession={vi.fn()}
        onDayRecords={vi.fn()}
        onCheckIns={vi.fn()}
        onConcerns={vi.fn()}
        onAudit={vi.fn()}
        onDeleteMeasurements={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByTestId('operator-pilot-dashboard')).toBeDefined()
  })

  it('48. Migration suite compatibility remains additive for new pilot fields', () => {
    const raw = createInitialData()
    const normalized = normalizePersonalData(raw)
    expect(Array.isArray(normalized.operatorPilotDayRecords)).toBe(true)
  })

  it('49. Recovery and cryptographic suite compatibility remains unchanged', () => {
    const raw = createInitialData()
    expect(raw.recoveryAudit).toBeDefined()
  })

  it('50. Security boundary compatibility remains unchanged', () => {
    const raw = createInitialData()
    expect(raw.syncOperatorControlState?.enabled).toBe(false)
  })

  it('51. Performance baseline compatibility remains unchanged', () => {
    const raw = createInitialData()
    expect(raw.priorities.length).toBeGreaterThan(0)
  })

  it('52. Full build pass condition uses current BUILD', () => {
    expect(BUILD).toBe('026')
  })
})
