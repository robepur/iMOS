import { useCallback, useEffect, useState } from 'react'
import type {
  Commitment,
  Decision,
  MissionPlan,
  MissionStep,
  PersonalData,
  Priority,
  RosieRecommendation,
  SecretRecord,
  TimelineEntry,
  UnderstandingState,
} from '../localData'
import type {
  CognitionConsent,
  CognitiveSignal,
  OperatorUnderstanding,
  UnderstandingReviewEvent,
} from '../types/cognitive'
import type { RecoveryAuditEvent } from '../types/recovery'
import type {
  PresentationAdaptationAuditEvent,
  PresentationOverride,
  PresentationProfile,
} from '../types/presentation'
import { createId, createInitialData, normalizePersonalData } from '../localData'
import { VaultService } from '../services/VaultService'
import { StorageService } from '../services/StorageService'
import { buildCompleted, buildDismissed, buildSnoozed } from './useRecommendations'
import { MissionIntegrityService } from '../services/MissionIntegrityService'
import {
  confirmUnderstanding as confirmUnderstandingReview,
  correctUnderstanding as correctUnderstandingReview,
  rejectUnderstanding as rejectUnderstandingReview,
  expireUnderstanding as expireUnderstandingReview,
  suppressSourceSignal as suppressReviewSourceSignal,
} from '../services/UnderstandingReviewService'
import { isCognitionEnabled, isFeatureSurfacePermitted } from '../services/CognitionConsentService'

function canMutateUnderstandingReview(data: PersonalData): boolean {
  return isCognitionEnabled(data.cognitionConsent)
    && isFeatureSurfacePermitted(data.cognitionConsent, 'understanding_dashboard')
}

function canMutatePresentation(data: PersonalData, surface?: PresentationOverride['targetSurface']): boolean {
  if (!isCognitionEnabled(data.cognitionConsent)) return false
  if (surface) return isFeatureSurfacePermitted(data.cognitionConsent, surface)
  return ['briefing', 'review', 'mission_planning'].some((item) =>
    isFeatureSurfacePermitted(data.cognitionConsent, item as PresentationOverride['targetSurface']),
  )
}

export type VaultState = 'setup' | 'locked' | 'unlocked'

export type UseVaultReturn = {
  vaultState: VaultState
  data: PersonalData | null
  passphrase: string
  error: string
  saving: boolean
  setData: React.Dispatch<React.SetStateAction<PersonalData | null>>
  createVault: (passphrase: string) => Promise<void>
  unlock: (passphrase: string) => Promise<void>
  lock: () => void
  reset: () => void
  addTimelineEntry: (entry: Omit<TimelineEntry, 'id' | 'createdAt'>) => void
  updatePriorities: (priorities: Priority[], event: string, detail: string) => void
  updateSecrets: (records: SecretRecord[], event: string, detail: string) => void
  addCommitment: (title: string, due: string) => void
  addDecision: (title: string, context: string) => void
  toggleCommitment: (id: string) => void
  toggleDecision: (id: string) => void
  completePrimaryPriority: (primary: Priority) => void
  saveReflection: (accomplished: string, remember: string, tomorrow: string) => void
  deleteReflection: (id: string) => void
  restoreVault: (backup: unknown, backupPassphrase: string) => Promise<void>
  exportVaultBackup: () => Promise<void>
  recordRecoveryAuditEvent: (event: RecoveryAuditEvent) => void
  rotateVaultPassphrase: (current: string, replacement: string) => Promise<void>
  dismissRecommendation: (rec: RosieRecommendation) => void
  snoozeRecommendation: (rec: RosieRecommendation, days: number) => void
  completeRecommendation: (rec: RosieRecommendation) => void
  syncUnderstandingState: (nextState: UnderstandingState, events: Array<Omit<TimelineEntry, 'id' | 'createdAt'>>) => void
  saveMissionPlan: (plan: MissionPlan, steps: MissionStep[]) => void
  setMissionPlanStatus: (planId: string, status: MissionPlan['status']) => void
  updateMissionPlan: (planId: string, patch: Partial<Pick<MissionPlan, 'title' | 'objective' | 'explanation'>>) => void
  updateMissionStepStatus: (planId: string, stepId: string, status: MissionStep['status'], reason?: string) => void
  updateMissionStep: (planId: string, stepId: string, patch: Partial<Pick<MissionStep, 'title' | 'description' | 'estimatedEffort' | 'dependsOn'>>) => void
  addMissionStep: (planId: string, title: string) => void
  deleteMissionStep: (planId: string, stepId: string) => void
  reorderMissionSteps: (planId: string, orderedStepIds: string[]) => void
  deleteMissionPlan: (planId: string) => void
  /** Phase 3: Update the operator's cognition consent record. */
  updateCognitionConsent: (updated: CognitionConsent) => void
  /** Phase 3 Build 014: Save updated cognitive signals (merged by engine). */
  saveCognitiveSignals: (signals: CognitiveSignal[], registryVersion: string) => void
  /** Phase 3 Build 014: Suppress a cognitive signal by id. */
  suppressCognitiveSignal: (signalId: string) => void
  /** Phase 3 Build 015: Persist understanding review state. */
  saveOperatorUnderstandings: (
    understandings: OperatorUnderstanding[],
    rejectedSignatures: string[],
    reviewAudit: UnderstandingReviewEvent[],
  ) => void
  confirmOperatorUnderstanding: (understandingId: string) => void
  correctOperatorUnderstanding: (understandingId: string, correctedStatement: string, reason?: string) => void
  rejectOperatorUnderstanding: (understandingId: string, reason?: string) => void
  expireOperatorUnderstanding: (understandingId: string) => void
  suppressUnderstandingSourceSignal: (signalId: string) => void
  setPresentationPersonalizationEnabled: (enabled: boolean) => void
  saveResolvedPresentationProfile: (
    profile: PresentationProfile,
    audit: PresentationAdaptationAuditEvent[],
    registryVersion: string,
  ) => void
  setPresentationOverride: (override: PresentationOverride) => void
  savePresentationOverrides: (overrides: PresentationOverride[]) => void
  removePresentationOverride: (overrideId: string) => void
  restoreNeutralPresentation: () => void
  saveOrchestrationResult: (data: PersonalData) => void
  /** Phase 4 Build 024: Save operator onboarding progress. */
  saveOnboardingState: (state: import('../types/onboarding').OnboardingState) => void
  /** Phase 4 Build 024: Add a new pilot feedback entry. */
  addPilotFeedback: (entry: import('../types/pilotFeedback').PilotFeedbackEntry) => void
  /** Phase 4 Build 024: Update an existing pilot feedback entry. */
  updatePilotFeedback: (entry: import('../types/pilotFeedback').PilotFeedbackEntry) => void
  /** Phase 4 Build 024: Delete a pilot feedback entry by id. */
  deletePilotFeedback: (id: string) => void
  /** Phase 4 Build 026: Save operator pilot session lifecycle. */
  saveOperatorPilotSession: (session: import('../types/operatorPilot').PilotSession | undefined) => void
  /** Phase 4 Build 026: Save operator pilot day records. */
  saveOperatorPilotDayRecords: (records: import('../types/operatorPilot').PilotDayRecord[]) => void
  /** Phase 4 Build 026: Save operator pilot check ins. */
  saveOperatorPilotCheckIns: (checkIns: import('../types/operatorPilot').PilotCheckIn[]) => void
  /** Phase 4 Build 026: Save operator pilot concerns. */
  saveOperatorPilotConcerns: (concerns: import('../types/operatorPilot').PilotConcern[]) => void
  /** Phase 4 Build 026: Save operator pilot audit events. */
  saveOperatorPilotAudit: (audit: import('../types/operatorPilot').PilotAuditEvent[]) => void
  /** Phase 4 Build 026: Delete pilot measurements while preserving operational records. */
  deleteOperatorPilotMeasurements: () => void
}

function timelineSignature(entry: Omit<TimelineEntry, 'id' | 'createdAt'>): string {
  return `${entry.type}|${entry.title}|${entry.detail}`
}

function prependUniqueTimeline(
  timeline: TimelineEntry[],
  entries: Array<Omit<TimelineEntry, 'id' | 'createdAt'>>
): TimelineEntry[] {
  const existing = new Set(timeline.map((entry) => timelineSignature(entry)))
  const stamped: TimelineEntry[] = []
  for (const entry of entries) {
    const sig = timelineSignature(entry)
    if (existing.has(sig)) continue
    existing.add(sig)
    stamped.push({ ...entry, id: createId('timeline'), createdAt: new Date().toISOString() })
  }
  return [...stamped, ...timeline]
}

export function useVault(): UseVaultReturn {
  const [vaultState, setVaultState] = useState<VaultState>(() => StorageService.vaultExists() ? 'locked' : 'setup')
  const [data, setData] = useState<PersonalData | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Auto-save whenever data changes
  useEffect(() => {
    if (vaultState !== 'unlocked' || !data || !passphrase) return
    const timeout = window.setTimeout(async () => {
      setSaving(true)
      try { await VaultService.save(data, passphrase) } finally { setSaving(false) }
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [data, passphrase, vaultState])

  const createVault = useCallback(async (newPassphrase: string) => {
    setError('')
    try {
      const startingData = normalizePersonalData(
        StorageService.legacyDataExists() ? StorageService.readLegacyData() ?? createInitialData() : createInitialData()
      )
      await VaultService.create(startingData, newPassphrase)
      setPassphrase(newPassphrase)
      setData(startingData)
      setVaultState('unlocked')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create the encrypted vault.')
    }
  }, [])

  const unlock = useCallback(async (pass: string) => {
    setError('')
    try {
      const unlocked = await VaultService.unlock(pass)
      setPassphrase(pass)
      setData(unlocked)
      setVaultState('unlocked')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to unlock the vault.')
    }
  }, [])

  const _clearAllPanelState = useCallback(() => {
    setData(null)
    setPassphrase('')
  }, [])

  const lock = useCallback(() => {
    _clearAllPanelState()
    setVaultState('locked')
  }, [_clearAllPanelState])

  const reset = useCallback(() => {
    if (!window.confirm('Erase the encrypted iMOS vault from this browser? This cannot be undone without an exported vault backup.')) return
    StorageService.clearVault()
    _clearAllPanelState()
    setVaultState('setup')
  }, [_clearAllPanelState])

  const addTimelineEntry = useCallback((entry: Omit<TimelineEntry, 'id' | 'createdAt'>) => {
    setData((cur) => cur ? ({
      ...cur,
      timeline: [{ ...entry, id: createId('timeline'), createdAt: new Date().toISOString() }, ...cur.timeline]
    }) : cur)
  }, [])

  const updatePriorities = useCallback((priorities: Priority[], event: string, detail: string) => {
    const createdAt = new Date().toISOString()
    setData((cur) => cur ? ({
      ...cur,
      priorities,
      timeline: [{ id: createId('timeline'), type: 'priority' as const, title: event, detail, createdAt }, ...cur.timeline]
    }) : cur)
  }, [])

  const updateSecrets = useCallback((records: SecretRecord[], event: string, detail: string) => {
    const createdAt = new Date().toISOString()
    setData((cur) => cur ? ({
      ...cur,
      secrets: records,
      timeline: [{ id: createId('timeline'), type: 'secret' as const, title: event, detail, createdAt }, ...cur.timeline]
    }) : cur)
  }, [])

  const addCommitment = useCallback((title: string, due: string) => {
    const item: Commitment = { id: createId('commitment'), title, due, status: 'open', createdAt: new Date().toISOString() }
    setData((cur) => cur ? ({ ...cur, commitments: [item, ...cur.commitments] }) : cur)
    addTimelineEntry({ type: 'commitment', title: 'Commitment captured', detail: title })
  }, [addTimelineEntry])

  const addDecision = useCallback((title: string, context: string) => {
    const item: Decision = { id: createId('decision'), title, context, status: 'open', createdAt: new Date().toISOString() }
    setData((cur) => cur ? ({ ...cur, decisions: [item, ...cur.decisions] }) : cur)
    addTimelineEntry({ type: 'decision', title: 'Decision opened', detail: title })
  }, [addTimelineEntry])

  const toggleCommitment = useCallback((id: string) => {
    setData((cur) => cur ? ({
      ...cur,
      commitments: cur.commitments.map((c) => c.id === id ? { ...c, status: c.status === 'open' ? 'complete' as const : 'open' as const } : c)
    }) : cur)
  }, [])

  const toggleDecision = useCallback((id: string) => {
    setData((cur) => cur ? ({
      ...cur,
      decisions: cur.decisions.map((d) => d.id === id ? { ...d, status: d.status === 'open' ? 'decided' as const : 'open' as const } : d)
    }) : cur)
  }, [])

  const completePrimaryPriority = useCallback((primary: Priority) => {
    const now = new Date().toISOString()
    setData((cur) => {
      if (!cur) return cur
      const next = cur.priorities.map((p) =>
        p.id === primary.id ? { ...p, completed: true, primary: false, updatedAt: now, completedAt: now } : p
      )
      const stillActive = next.filter((p) => !p.completed)
      const hasPrimary = stillActive.some((p) => p.primary)
      const resolved = (hasPrimary || stillActive.length === 0)
        ? next
        : next.map((p, _, arr) => p.id === arr.find((x) => !x.completed)?.id ? { ...p, primary: true } : p)
      return {
        ...cur,
        priorities: resolved,
        timeline: [{ id: createId('timeline'), type: 'priority' as const, title: 'Priority completed', detail: primary.title, createdAt: now }, ...cur.timeline]
      }
    })
  }, [])

  const saveReflection = useCallback((accomplished: string, remember: string, tomorrow: string) => {
    const createdAt = new Date().toISOString()
    setData((cur) => cur ? ({
      ...cur,
      reflections: [{ id: createId('reflection'), accomplished, remember, tomorrow, createdAt }, ...cur.reflections],
      timeline: [{ id: createId('timeline'), type: 'reflection' as const, title: 'Executive reflection completed', detail: accomplished || 'Session reviewed.', createdAt }, ...cur.timeline]
    }) : cur)
  }, [])

  const deleteReflection = useCallback((id: string) => {
    const createdAt = new Date().toISOString()
    setData((cur) => cur ? ({
      ...cur,
      reflections: cur.reflections.filter((r) => r.id !== id),
      timeline: [{ id: createId('timeline'), type: 'reflection' as const, title: 'Reflection deleted', detail: 'An executive reflection was permanently removed.', createdAt }, ...cur.timeline]
    }) : cur)
  }, [])

  const restoreVault = useCallback(async (backup: unknown, backupPassphrase: string) => {
    const recovered = await VaultService.restore(backup, backupPassphrase)
    setData(recovered)
    setPassphrase(backupPassphrase)
  }, [])

  const recordRecoveryAuditEvent = useCallback((event: RecoveryAuditEvent) => {
    setData((prev) => prev ? ({
      ...prev,
      recoveryAudit: [event, ...(prev.recoveryAudit ?? [])].slice(0, 100),
    }) : prev)
  }, [])

  const exportVaultBackup = useCallback(async () => {
    await VaultService.exportBackup()
    recordRecoveryAuditEvent({
      id: createId('recovery-audit'),
      type: 'backup-created',
      createdAt: new Date().toISOString(),
      detail: 'Encrypted backup package created.',
    })
  }, [recordRecoveryAuditEvent])

  const rotateVaultPassphrase = useCallback(async (current: string, replacement: string) => {
    if (!data) return
    await VaultService.rotatePassphrase(data, current, replacement)
    setPassphrase(replacement)
    recordRecoveryAuditEvent({
      id: createId('recovery-audit'),
      type: 'passphrase-rotated',
      createdAt: new Date().toISOString(),
      detail: 'Vault re encrypted and verified with new passphrase material.',
    })
  }, [data, recordRecoveryAuditEvent])

  const dismissRecommendation = useCallback((rec: RosieRecommendation) => {
    setData((prev) => {
      if (!prev) return prev
      const existing = (prev.recommendations ?? []).filter((r) => r.id !== rec.id)
      return {
        ...prev,
        recommendations: [...existing, buildDismissed(rec)],
        timeline: prependUniqueTimeline(prev.timeline, [{
          type: 'system',
          title: 'Pattern dismissed',
          detail: `Recommendation dismissed: ${rec.title}`,
        }]),
      }
    })
  }, [])

  const snoozeRecommendation = useCallback((rec: RosieRecommendation, days: number) => {
    setData((prev) => {
      if (!prev) return prev
      const existing = (prev.recommendations ?? []).filter((r) => r.id !== rec.id)
      return {
        ...prev,
        recommendations: [...existing, buildSnoozed(rec, days)],
        timeline: prependUniqueTimeline(prev.timeline, [{
          type: 'system',
          title: 'Pattern snoozed',
          detail: `Recommendation snoozed for ${days} day${days !== 1 ? 's' : ''}: ${rec.title}`,
        }]),
      }
    })
  }, [])

  const completeRecommendation = useCallback((rec: RosieRecommendation) => {
    setData((prev) => {
      if (!prev) return prev
      const existing = (prev.recommendations ?? []).filter((r) => r.id !== rec.id)
      return {
        ...prev,
        recommendations: [...existing, buildCompleted(rec)],
        timeline: prependUniqueTimeline(prev.timeline, [{
          type: 'system',
          title: 'Recommendation completed',
          detail: rec.title,
        }]),
      }
    })
  }, [])

  const syncUnderstandingState = useCallback((nextState: UnderstandingState, events: Array<Omit<TimelineEntry, 'id' | 'createdAt'>>) => {
    setData((prev) => {
      if (!prev) return prev
      const current = prev.understandingState ?? { activeDriftSignals: [], activePatternKeys: [], trendDirections: {} }
      const unchanged = JSON.stringify(current) === JSON.stringify(nextState)
      const uniqueEvents = events.filter((event) => !prev.timeline.some(
        (entry) => entry.type === event.type && entry.title === event.title && entry.detail === event.detail
      ))
      if (unchanged && uniqueEvents.length === 0) return prev
      return {
        ...prev,
        understandingState: nextState,
        timeline: prependUniqueTimeline(prev.timeline, uniqueEvents),
      }
    })
  }, [])

  const saveMissionPlan = useCallback((plan: MissionPlan, steps: MissionStep[]) => {
    setData((prev) => {
      if (!prev) return prev
      const normalizedSteps = MissionIntegrityService.normalizeStepOrder(
        steps.map((step) => ({
          ...step,
          generatedByRosie: step.generatedByRosie ?? true,
          lastModifiedBy: step.lastModifiedBy ?? 'rosie',
        }))
      )
      const nextPlan: MissionPlan = {
        ...plan,
        stepIds: normalizedSteps.map((step) => step.id),
        updatedAt: new Date().toISOString(),
        generatedByRosie: plan.generatedByRosie ?? true,
        lastModifiedBy: plan.lastModifiedBy ?? 'rosie',
      }
      const issues = MissionIntegrityService.validatePlan(nextPlan, normalizedSteps)
      if (issues.length > 0) {
        setError(issues[0])
        return prev
      }

      const plans = prev.missionPlans ?? []
      const existingPlans = plans.filter((p) => p.id !== nextPlan.id)
      const existingSteps = (prev.missionSteps ?? []).filter((s) => !nextPlan.stepIds.includes(s.id))
      return {
        ...prev,
        missionPlans: [nextPlan, ...existingPlans],
        missionSteps: [...normalizedSteps, ...existingSteps],
        timeline: prependUniqueTimeline(prev.timeline, [{
          type: 'mission',
          title: 'Mission Created',
          detail: nextPlan.title,
        }]),
      }
    })
  }, [])

  const setMissionPlanStatus = useCallback((planId: string, status: MissionPlan['status']) => {
    setData((prev) => {
      if (!prev) return prev
      const titleByStatus: Record<MissionPlan['status'], string> = {
        draft: 'Mission Drafted',
        approved: 'Mission Approved',
        active: 'Mission Activated',
        paused: 'Mission Paused',
        completed: 'Mission Completed',
        cancelled: 'Mission Cancelled',
      }
      const mission = (prev.missionPlans ?? []).find((p) => p.id === planId)
      if (!mission) return prev
      const steps = (prev.missionSteps ?? []).filter((step) => mission.stepIds.includes(step.id))
      let nextMission: MissionPlan
      try {
        nextMission = MissionIntegrityService.transitionMission(mission, status, steps)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Mission status transition failed.')
        return prev
      }
      const issues = MissionIntegrityService.validatePlan(nextMission, MissionIntegrityService.normalizeStepOrder(steps))
      if (issues.length > 0) {
        setError(issues[0])
        return prev
      }

      return {
        ...prev,
        missionPlans: (prev.missionPlans ?? []).map((p) => p.id === planId ? nextMission : p),
        timeline: prependUniqueTimeline(prev.timeline, [{
          type: 'mission',
          title: titleByStatus[status],
          detail: mission.title,
        }]),
      }
    })
  }, [])

  const updateMissionPlan = useCallback((planId: string, patch: Partial<Pick<MissionPlan, 'title' | 'objective' | 'explanation'>>) => {
    setData((prev) => {
      if (!prev) return prev
      const mission = (prev.missionPlans ?? []).find((p) => p.id === planId)
      if (!mission) return prev
      const steps = (prev.missionSteps ?? []).filter((step) => mission.stepIds.includes(step.id))
      const nextMission: MissionPlan = {
        ...mission,
        ...patch,
        lastModifiedBy: 'operator',
        updatedAt: new Date().toISOString(),
      }
      const issues = MissionIntegrityService.validatePlan(nextMission, MissionIntegrityService.normalizeStepOrder(steps))
      if (issues.length > 0) {
        setError(issues[0])
        return prev
      }
      return {
        ...prev,
        missionPlans: (prev.missionPlans ?? []).map((p) => p.id === planId ? nextMission : p),
      }
    })
  }, [])

  const updateMissionStepStatus = useCallback((planId: string, stepId: string, status: MissionStep['status'], reason?: string) => {
    setData((prev) => {
      if (!prev) return prev
      const mission = (prev.missionPlans ?? []).find((p) => p.id === planId)
      if (!mission) return prev

      const missionStepIds = new Set(mission.stepIds)
      const planSteps = (prev.missionSteps ?? []).filter((step) => missionStepIds.has(step.id))
      const patchedPlanSteps = planSteps.map((step) => {
        if (step.id !== stepId) return step
        try {
          return MissionIntegrityService.transitionStep(step, status, planSteps, reason)
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : 'Mission step transition failed.')
          return step
        }
      })
      const normalizedPlanSteps = MissionIntegrityService.normalizeStepOrder(patchedPlanSteps)
      const detailStep = normalizedPlanSteps.find((s) => s.id === stepId)
      const allCompleted = mission.stepIds.every((id) => normalizedPlanSteps.find((s) => s.id === id)?.status === 'completed')
      let nextMission = mission
      if (allCompleted && mission.status === 'active') {
        try {
          nextMission = MissionIntegrityService.transitionMission(mission, 'completed', normalizedPlanSteps)
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : 'Mission completion transition failed.')
          return prev
        }
      }
      const issues = MissionIntegrityService.validatePlan(nextMission, normalizedPlanSteps)
      if (issues.length > 0) {
        setError(issues[0])
        return prev
      }
      const stepById = new Map(normalizedPlanSteps.map((step) => [step.id, step]))
      const nextMissionSteps = (prev.missionSteps ?? []).map((step) => missionStepIds.has(step.id) ? (stepById.get(step.id) ?? step) : step)

      return {
        ...prev,
        missionSteps: nextMissionSteps,
        missionPlans: (prev.missionPlans ?? []).map((p) => p.id === planId ? nextMission : p),
        timeline: prependUniqueTimeline(prev.timeline, [{
          type: 'mission',
          title: status === 'completed' ? 'Step Completed' : status === 'blocked' ? 'Blocked Work' : 'Step Activated',
          detail: detailStep?.title ?? stepId,
        }]),
      }
    })
  }, [])

  const updateMissionStep = useCallback((planId: string, stepId: string, patch: Partial<Pick<MissionStep, 'title' | 'description' | 'estimatedEffort' | 'dependsOn'>>) => {
    setData((prev) => {
      if (!prev) return prev
      const mission = (prev.missionPlans ?? []).find((p) => p.id === planId)
      if (!mission) return prev
      const missionStepIds = new Set(mission.stepIds)
      const planSteps = (prev.missionSteps ?? []).filter((step) => missionStepIds.has(step.id))
      const patchedPlanSteps = MissionIntegrityService.normalizeStepOrder(planSteps.map((step) => (
        step.id === stepId
          ? MissionIntegrityService.patchStep(step, patch)
          : step
      )))
      const issues = MissionIntegrityService.validatePlan(mission, patchedPlanSteps)
      if (issues.length > 0) {
        setError(issues[0])
        return prev
      }
      const stepById = new Map(patchedPlanSteps.map((step) => [step.id, step]))
      return {
        ...prev,
        missionSteps: (prev.missionSteps ?? []).map((step) => missionStepIds.has(step.id) ? (stepById.get(step.id) ?? step) : step),
        timeline: prependUniqueTimeline(prev.timeline, [{
          type: 'mission',
          title: 'Step Updated',
          detail: patchedPlanSteps.find((step) => step.id === stepId)?.title ?? stepId,
        }]),
      }
    })
  }, [])

  const addMissionStep = useCallback((planId: string, title: string) => {
    setData((prev) => {
      if (!prev) return prev
      const mission = (prev.missionPlans ?? []).find((p) => p.id === planId)
      if (!mission) return prev
      const stepTitle = title.trim()
      if (!stepTitle) return prev
      const missionStepIds = new Set(mission.stepIds)
      const planSteps = (prev.missionSteps ?? []).filter((step) => missionStepIds.has(step.id))
      const nextStep: MissionStep = {
        id: createId('mission-step'),
        title: stepTitle,
        description: '',
        order: planSteps.length + 1,
        status: 'pending',
        dependsOn: [],
        evidence: ['Operator added mission step'],
        estimatedEffort: 'medium',
        operatorModified: true,
        lastModifiedBy: 'operator',
      }
      const normalizedPlanSteps = MissionIntegrityService.normalizeStepOrder([...planSteps, nextStep])
      const nextMission = {
        ...mission,
        stepIds: normalizedPlanSteps.map((step) => step.id),
        updatedAt: new Date().toISOString(),
        lastModifiedBy: 'operator' as const,
      }
      const issues = MissionIntegrityService.validatePlan(nextMission, normalizedPlanSteps)
      if (issues.length > 0) {
        setError(issues[0])
        return prev
      }
      return {
        ...prev,
        missionPlans: (prev.missionPlans ?? []).map((plan) => plan.id === planId ? nextMission : plan),
        missionSteps: [...normalizedPlanSteps, ...(prev.missionSteps ?? []).filter((step) => !missionStepIds.has(step.id))],
        timeline: prependUniqueTimeline(prev.timeline, [{
          type: 'mission',
          title: 'Step Added',
          detail: stepTitle,
        }]),
      }
    })
  }, [])

  const deleteMissionStep = useCallback((planId: string, stepId: string) => {
    setData((prev) => {
      if (!prev) return prev
      const mission = (prev.missionPlans ?? []).find((p) => p.id === planId)
      if (!mission) return prev
      const missionStepIds = new Set(mission.stepIds)
      if (!missionStepIds.has(stepId)) return prev
      const remainingPlanSteps = MissionIntegrityService.normalizeStepOrder(
        (prev.missionSteps ?? [])
          .filter((step) => missionStepIds.has(step.id) && step.id !== stepId)
          .map((step) => ({ ...step, dependsOn: step.dependsOn.filter((dep) => dep !== stepId) }))
      )
      if (remainingPlanSteps.length === 0) {
        setError('Mission cannot be empty. Delete the mission instead.')
        return prev
      }
      const nextMission = {
        ...mission,
        stepIds: remainingPlanSteps.map((step) => step.id),
        updatedAt: new Date().toISOString(),
        lastModifiedBy: 'operator' as const,
      }
      const issues = MissionIntegrityService.validatePlan(nextMission, remainingPlanSteps)
      if (issues.length > 0) {
        setError(issues[0])
        return prev
      }
      const keepSteps = (prev.missionSteps ?? []).filter((step) => !missionStepIds.has(step.id))
      return {
        ...prev,
        missionPlans: (prev.missionPlans ?? []).map((plan) => plan.id === planId ? nextMission : plan),
        missionSteps: [...remainingPlanSteps, ...keepSteps],
        timeline: prependUniqueTimeline(prev.timeline, [{
          type: 'mission',
          title: 'Step Deleted',
          detail: stepId,
        }]),
      }
    })
  }, [])

  const reorderMissionSteps = useCallback((planId: string, orderedStepIds: string[]) => {
    setData((prev) => {
      if (!prev) return prev
      const mission = (prev.missionPlans ?? []).find((p) => p.id === planId)
      if (!mission) return prev
      const missionStepIds = new Set(mission.stepIds)
      const baseSteps = (prev.missionSteps ?? []).filter((step) => missionStepIds.has(step.id))
      if (baseSteps.length !== orderedStepIds.length) return prev

      const stepMap = new Map(baseSteps.map((step) => [step.id, step]))
      const reordered = orderedStepIds.map((id, index) => {
        const step = stepMap.get(id)
        if (!step) return null
        return { ...step, order: index + 1, operatorModified: true, lastModifiedBy: 'operator' as const }
      })
      if (reordered.some((step) => step === null)) return prev
      const normalized = MissionIntegrityService.normalizeStepOrder(reordered as MissionStep[])
      const issues = MissionIntegrityService.validatePlan(mission, normalized)
      if (issues.length > 0) {
        setError(issues[0])
        return prev
      }
      const keepSteps = (prev.missionSteps ?? []).filter((step) => !missionStepIds.has(step.id))
      return {
        ...prev,
        missionSteps: [...normalized, ...keepSteps],
        timeline: prependUniqueTimeline(prev.timeline, [{
          type: 'mission',
          title: 'Step Reordered',
          detail: mission.title,
        }]),
      }
    })
  }, [])

  const deleteMissionPlan = useCallback((planId: string) => {
    setData((prev) => {
      if (!prev) return prev
      const mission = (prev.missionPlans ?? []).find((p) => p.id === planId)
      if (!mission) return prev
      return {
        ...prev,
        missionPlans: (prev.missionPlans ?? []).filter((p) => p.id !== planId),
        missionSteps: (prev.missionSteps ?? []).filter((s) => !mission.stepIds.includes(s.id)),
        timeline: prependUniqueTimeline(prev.timeline, [{
          type: 'mission',
          title: 'Mission Deleted',
          detail: mission.title,
        }]),
      }
    })
  }, [])

  const updateCognitionConsent = useCallback((updated: CognitionConsent) => {
    setData((prev) => {
      if (!prev) return prev
      return { ...prev, cognitionConsent: updated }
    })
  }, [])

  const saveCognitiveSignals = useCallback((signals: CognitiveSignal[], registryVersion: string) => {
    setData((prev) => {
      if (!prev) return prev
      return { ...prev, cognitiveSignals: signals, cognitiveRuleRegistryVersion: registryVersion }
    })
  }, [])

  const suppressCognitiveSignal = useCallback((signalId: string) => {
    setData((prev) => {
      if (!prev) return prev
      const now = new Date()
      const updated = (prev.cognitiveSignals ?? []).map((s) => {
        if (s.id !== signalId) return s
        if (s.status === 'suppressed' || s.status === 'expired') return s
        return {
          ...s,
          status: 'suppressed' as const,
          suppressedAt: now.toISOString(),
          updatedAt: now.toISOString(),
          auditHistory: [
            ...s.auditHistory,
            { id: createId('sig-audit'), action: 'suppressed' as const, timestamp: now.toISOString(), detail: 'Operator suppressed signal.' },
          ],
        }
      })
      return { ...prev, cognitiveSignals: updated }
    })
  }, [])

  const saveOperatorUnderstandings = useCallback((
    understandings: OperatorUnderstanding[],
    rejectedSignatures: string[],
    reviewAudit: UnderstandingReviewEvent[],
  ) => {
    setData((prev) => {
      if (!prev || !canMutateUnderstandingReview(prev)) return prev
      return {
        ...prev,
        operatorUnderstandings: understandings,
        rejectedUnderstandingSignatures: rejectedSignatures,
        understandingReviewAudit: reviewAudit,
      }
    })
  }, [])

  const confirmOperatorUnderstanding = useCallback((understandingId: string) => {
    setData((prev) => {
      if (!prev || !canMutateUnderstandingReview(prev)) return prev
      return {
        ...prev,
        operatorUnderstandings: confirmUnderstandingReview(prev.operatorUnderstandings ?? [], understandingId, undefined, prev.cognitionConsent),
      }
    })
  }, [])

  const correctOperatorUnderstanding = useCallback((understandingId: string, correctedStatement: string, reason?: string) => {
    setData((prev) => {
      if (!prev || !canMutateUnderstandingReview(prev)) return prev
      return {
        ...prev,
        operatorUnderstandings: correctUnderstandingReview(
          prev.operatorUnderstandings ?? [],
          understandingId,
          correctedStatement,
          reason,
          undefined,
          prev.cognitionConsent,
        ),
      }
    })
  }, [])

  const rejectOperatorUnderstanding = useCallback((understandingId: string, reason?: string) => {
    setData((prev) => {
      if (!prev || !canMutateUnderstandingReview(prev)) return prev
      const result = rejectUnderstandingReview(
        prev.operatorUnderstandings ?? [],
        understandingId,
        prev.rejectedUnderstandingSignatures ?? [],
        reason,
        undefined,
        prev.cognitionConsent,
      )
      return {
        ...prev,
        operatorUnderstandings: result.understandings,
        rejectedUnderstandingSignatures: result.rejectedSignatures,
      }
    })
  }, [])

  const expireOperatorUnderstanding = useCallback((understandingId: string) => {
    setData((prev) => {
      if (!prev || !canMutateUnderstandingReview(prev)) return prev
      return {
        ...prev,
        operatorUnderstandings: expireUnderstandingReview(prev.operatorUnderstandings ?? [], understandingId, undefined, prev.cognitionConsent),
      }
    })
  }, [])

  const suppressUnderstandingSourceSignal = useCallback((signalId: string) => {
    setData((prev) => {
      if (!prev || !canMutateUnderstandingReview(prev)) return prev
      return {
        ...prev,
        cognitiveSignals: suppressReviewSourceSignal(prev.cognitiveSignals ?? [], signalId, undefined, prev.cognitionConsent),
      }
    })
  }, [])

  const setPresentationPersonalizationEnabled = useCallback((enabled: boolean) => {
    setData((prev) => {
      if (!prev) return prev
      if (enabled && !canMutatePresentation(prev)) return prev
      return { ...prev, presentationPersonalizationEnabled: enabled }
    })
  }, [])

  const saveResolvedPresentationProfile = useCallback((
    profile: PresentationProfile,
    audit: PresentationAdaptationAuditEvent[],
    registryVersion: string,
  ) => {
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        presentationProfile: profile,
        presentationAdaptationAudit: [...(prev.presentationAdaptationAudit ?? []), ...audit],
        presentationMappingRegistryVersion: registryVersion,
      }
    })
  }, [])

  const setPresentationOverride = useCallback((override: PresentationOverride) => {
    setData((prev) => {
      if (!prev || !canMutatePresentation(prev, override.targetSurface)) return prev
      const existing = (prev.presentationOverrides ?? []).find((item) => item.id === override.id)
      if (!existing) {
        return { ...prev, presentationOverrides: [...(prev.presentationOverrides ?? []), override] }
      }
      return {
        ...prev,
        presentationOverrides: (prev.presentationOverrides ?? []).map((item) => item.id === override.id ? override : item),
      }
    })
  }, [])

  const removePresentationOverride = useCallback((overrideId: string) => {
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        presentationOverrides: (prev.presentationOverrides ?? []).filter((override) => override.id !== overrideId),
      }
    })
  }, [])

  const savePresentationOverrides = useCallback((overrides: PresentationOverride[]) => {
    setData((prev) => {
      if (!prev || !canMutatePresentation(prev)) return prev
      const permitted = overrides.filter((override) => canMutatePresentation(prev, override.targetSurface))
      return { ...prev, presentationOverrides: permitted }
    })
  }, [])

  const restoreNeutralPresentation = useCallback(() => {
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        presentationOverrides: [],
        presentationPersonalizationEnabled: false,
      }
    })
  }, [])

  const saveOrchestrationResult = useCallback((result: PersonalData) => {
    setData(result)
  }, [])

  const saveOnboardingState = useCallback((state: import('../types/onboarding').OnboardingState) => {
    setData((prev) => {
      if (!prev) return prev
      return { ...prev, onboardingState: state }
    })
  }, [])

  const addPilotFeedback = useCallback((entry: import('../types/pilotFeedback').PilotFeedbackEntry) => {
    setData((prev) => {
      if (!prev) return prev
      return { ...prev, pilotFeedback: [...(prev.pilotFeedback ?? []), entry] }
    })
  }, [])

  const updatePilotFeedback = useCallback((entry: import('../types/pilotFeedback').PilotFeedbackEntry) => {
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        pilotFeedback: (prev.pilotFeedback ?? []).map(e => e.id === entry.id ? entry : e),
      }
    })
  }, [])

  const deletePilotFeedback = useCallback((id: string) => {
    setData((prev) => {
      if (!prev) return prev
      return { ...prev, pilotFeedback: (prev.pilotFeedback ?? []).filter(e => e.id !== id) }
    })
  }, [])

  const saveOperatorPilotSession = useCallback((session: import('../types/operatorPilot').PilotSession | undefined) => {
    setData((prev) => {
      if (!prev) return prev
      return { ...prev, operatorPilotSession: session }
    })
  }, [])

  const saveOperatorPilotDayRecords = useCallback((records: import('../types/operatorPilot').PilotDayRecord[]) => {
    setData((prev) => {
      if (!prev) return prev
      return { ...prev, operatorPilotDayRecords: records }
    })
  }, [])

  const saveOperatorPilotCheckIns = useCallback((checkIns: import('../types/operatorPilot').PilotCheckIn[]) => {
    setData((prev) => {
      if (!prev) return prev
      return { ...prev, operatorPilotCheckIns: checkIns }
    })
  }, [])

  const saveOperatorPilotConcerns = useCallback((concerns: import('../types/operatorPilot').PilotConcern[]) => {
    setData((prev) => {
      if (!prev) return prev
      return { ...prev, operatorPilotConcerns: concerns }
    })
  }, [])

  const saveOperatorPilotAudit = useCallback((audit: import('../types/operatorPilot').PilotAuditEvent[]) => {
    setData((prev) => {
      if (!prev) return prev
      return { ...prev, operatorPilotAudit: audit }
    })
  }, [])

  const deleteOperatorPilotMeasurements = useCallback(() => {
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        pilotFeedback: [],
        operatorPilotDayRecords: [],
        operatorPilotCheckIns: [],
        operatorPilotConcerns: [],
      }
    })
  }, [])

  return {
    vaultState, data, passphrase, error, saving, setData,
    createVault, unlock, lock, reset,
    addTimelineEntry, updatePriorities, updateSecrets,
    addCommitment, addDecision, toggleCommitment, toggleDecision,
    completePrimaryPriority, saveReflection, deleteReflection,
    restoreVault, exportVaultBackup, recordRecoveryAuditEvent, rotateVaultPassphrase,
    dismissRecommendation, snoozeRecommendation, completeRecommendation,
    syncUnderstandingState,
    saveMissionPlan, setMissionPlanStatus, updateMissionPlan, updateMissionStepStatus, updateMissionStep,
    addMissionStep, deleteMissionStep, reorderMissionSteps, deleteMissionPlan,
    updateCognitionConsent,
    saveCognitiveSignals,
    suppressCognitiveSignal,
    saveOperatorUnderstandings,
    confirmOperatorUnderstanding,
    correctOperatorUnderstanding,
    rejectOperatorUnderstanding,
    expireOperatorUnderstanding,
    suppressUnderstandingSourceSignal,
    setPresentationPersonalizationEnabled,
    saveResolvedPresentationProfile,
    setPresentationOverride,
    savePresentationOverrides,
    removePresentationOverride,
    restoreNeutralPresentation,
    saveOrchestrationResult,
    saveOnboardingState,
    addPilotFeedback,
    updatePilotFeedback,
    deletePilotFeedback,
    saveOperatorPilotSession,
    saveOperatorPilotDayRecords,
    saveOperatorPilotCheckIns,
    saveOperatorPilotConcerns,
    saveOperatorPilotAudit,
    deleteOperatorPilotMeasurements,
  }
}
