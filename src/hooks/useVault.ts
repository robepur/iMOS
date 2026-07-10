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
import { createId, createInitialData, normalizePersonalData } from '../localData'
import { VaultService } from '../services/VaultService'
import { StorageService } from '../services/StorageService'
import { buildCompleted, buildDismissed, buildSnoozed } from './useRecommendations'

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
  rotateVaultPassphrase: (current: string, replacement: string) => Promise<void>
  dismissRecommendation: (rec: RosieRecommendation) => void
  snoozeRecommendation: (rec: RosieRecommendation, days: number) => void
  completeRecommendation: (rec: RosieRecommendation) => void
  syncUnderstandingState: (nextState: UnderstandingState, events: Array<Omit<TimelineEntry, 'id' | 'createdAt'>>) => void
  saveMissionPlan: (plan: MissionPlan, steps: MissionStep[]) => void
  setMissionPlanStatus: (planId: string, status: MissionPlan['status']) => void
  updateMissionPlan: (planId: string, patch: Partial<Pick<MissionPlan, 'title' | 'objective' | 'explanation'>>) => void
  updateMissionStepStatus: (planId: string, stepId: string, status: MissionStep['status']) => void
  deleteMissionPlan: (planId: string) => void
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

  const rotateVaultPassphrase = useCallback(async (current: string, replacement: string) => {
    if (!data) return
    await VaultService.rotatePassphrase(data, current, replacement)
    setPassphrase(replacement)
  }, [data])

  const dismissRecommendation = useCallback((rec: RosieRecommendation) => {
    setData((prev) => {
      if (!prev) return prev
      const existing = (prev.recommendations ?? []).filter((r) => r.id !== rec.id)
      return {
        ...prev,
        recommendations: [...existing, buildDismissed(rec)],
        timeline: [{
          id: createId('timeline'),
          type: 'system',
          title: 'Pattern dismissed',
          detail: `Recommendation dismissed: ${rec.title}`,
          createdAt: new Date().toISOString(),
        }, ...prev.timeline],
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
        timeline: [{
          id: createId('timeline'),
          type: 'system',
          title: 'Pattern snoozed',
          detail: `Recommendation snoozed for ${days} day${days !== 1 ? 's' : ''}: ${rec.title}`,
          createdAt: new Date().toISOString(),
        }, ...prev.timeline],
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
        timeline: [{
          id: createId('timeline'),
          type: 'system',
          title: 'Recommendation completed',
          detail: rec.title,
          createdAt: new Date().toISOString(),
        }, ...prev.timeline],
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
      const stamped = uniqueEvents.map((event) => ({ ...event, id: createId('timeline'), createdAt: new Date().toISOString() }))
      return {
        ...prev,
        understandingState: nextState,
        timeline: [...stamped, ...prev.timeline],
      }
    })
  }, [])

  const saveMissionPlan = useCallback((plan: MissionPlan, steps: MissionStep[]) => {
    setData((prev) => {
      if (!prev) return prev
      const plans = prev.missionPlans ?? []
      const existingPlans = plans.filter((p) => p.id !== plan.id)
      const existingSteps = (prev.missionSteps ?? []).filter((s) => !plan.stepIds.includes(s.id))
      return {
        ...prev,
        missionPlans: [{ ...plan, updatedAt: new Date().toISOString() }, ...existingPlans],
        missionSteps: [...steps, ...existingSteps],
        timeline: [{
          id: createId('timeline'),
          type: 'mission',
          title: 'Mission Created',
          detail: plan.title,
          createdAt: new Date().toISOString(),
        }, ...prev.timeline],
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
      return {
        ...prev,
        missionPlans: (prev.missionPlans ?? []).map((p) => p.id === planId ? { ...p, status, approved: status === 'approved' || p.approved, updatedAt: new Date().toISOString() } : p),
        timeline: [{
          id: createId('timeline'),
          type: 'mission',
          title: titleByStatus[status],
          detail: mission.title,
          createdAt: new Date().toISOString(),
        }, ...prev.timeline],
      }
    })
  }, [])

  const updateMissionPlan = useCallback((planId: string, patch: Partial<Pick<MissionPlan, 'title' | 'objective' | 'explanation'>>) => {
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        missionPlans: (prev.missionPlans ?? []).map((p) => p.id === planId ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p),
      }
    })
  }, [])

  const updateMissionStepStatus = useCallback((planId: string, stepId: string, status: MissionStep['status']) => {
    setData((prev) => {
      if (!prev) return prev
      const mission = (prev.missionPlans ?? []).find((p) => p.id === planId)
      if (!mission) return prev

      const missionSteps = (prev.missionSteps ?? []).map((step) => {
        if (step.id !== stepId) return step
        return {
          ...step,
          status,
          ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {}),
        }
      })
      const detailStep = missionSteps.find((s) => s.id === stepId)
      const allCompleted = mission.stepIds.every((id) => missionSteps.find((s) => s.id === id)?.status === 'completed')

      return {
        ...prev,
        missionSteps,
        missionPlans: (prev.missionPlans ?? []).map((p) => p.id === planId
          ? { ...p, status: allCompleted ? 'completed' : p.status, updatedAt: new Date().toISOString() }
          : p),
        timeline: [{
          id: createId('timeline'),
          type: 'mission',
          title: status === 'completed' ? 'Step Completed' : 'Blocked Work',
          detail: detailStep?.title ?? stepId,
          createdAt: new Date().toISOString(),
        }, ...prev.timeline],
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
        timeline: [{
          id: createId('timeline'),
          type: 'mission',
          title: 'Mission Cancelled',
          detail: mission.title,
          createdAt: new Date().toISOString(),
        }, ...prev.timeline],
      }
    })
  }, [])

  return {
    vaultState, data, passphrase, error, saving, setData,
    createVault, unlock, lock, reset,
    addTimelineEntry, updatePriorities, updateSecrets,
    addCommitment, addDecision, toggleCommitment, toggleDecision,
    completePrimaryPriority, saveReflection, deleteReflection,
    restoreVault, rotateVaultPassphrase,
    dismissRecommendation, snoozeRecommendation, completeRecommendation,
    syncUnderstandingState,
    saveMissionPlan, setMissionPlanStatus, updateMissionPlan, updateMissionStepStatus, deleteMissionPlan,
  }
}
