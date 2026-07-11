import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Clock3, KeyRound, ListChecks, Lock, LockKeyhole, Network, Route, ShieldCheck, Zap } from 'lucide-react'
import { useVault } from './hooks/useVault'
import { usePriorities } from './hooks/usePriorities'
import { useSecrets } from './hooks/useSecrets'
import { useRecommendations } from './hooks/useRecommendations'
import { useKnowledgeGraph } from './hooks/useKnowledgeGraph'
import { useUnderstanding } from './hooks/useUnderstanding'
import { RosieEngine } from './services/RosieEngine'
import { UnderstandingEngine } from './services/UnderstandingEngine'
import {
  applyOperatorOverride,
  buildNeutralRestorationAudit,
  getNeutralPresentationProfile,
  PRESENTATION_MAPPING_REGISTRY_VERSION,
  resolveSurfacePresentation,
} from './services/AdaptivePresentationEngine'
import { runRosieOrchestration } from './services/RosieOrchestrationService'
import { ErrorBoundary } from './components/ErrorBoundary'
import VaultGate from './features/vault/VaultGate'
import DataPanel from './features/vault/DataPanel'
import { Arrival, Brief, FocusView, Reflection, TimelineItem } from './features/arrival/OperatingLoop'
import PriorityConsole from './features/priorities/PriorityConsole'

const ReviewCenter = lazy(() => import('./features/review/ReviewCenter'))
const RecoveryConsole = lazy(() => import('./features/recovery/RecoveryConsole'))
const SecretsConsole = lazy(() => import('./features/secrets/SecretsConsole'))
const ReflectionHistory = lazy(() => import('./features/reflection/ReflectionHistory'))
const KnowledgeGraphViewer = lazy(() => import('./features/knowledge/KnowledgeGraphViewer'))
const MissionPlanner = lazy(() => import('./features/missions/MissionPlanner'))
const RosieCenter = lazy(() => import('./features/rosie/RosieCenter'))

type Mode = 'arrival' | 'brief' | 'focus' | 'reflection'

export default function App() {
  const vault = useVault()
  const { activePriorities, primary, criticalCount, overdueCount } = usePriorities(vault.data)
  const secrets = useSecrets(vault.data)
  const { active: recs, criticalCount: recCritical } = useRecommendations(vault.data)
  const { graph, getStats } = useKnowledgeGraph(vault.data)
  const { understanding } = useUnderstanding(vault.data)

  const [mode, setMode] = useState<Mode>('arrival')
  const [showDataPanel, setShowDataPanel] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [showSecrets, setShowSecrets] = useState(false)
  const [showPriorities, setShowPriorities] = useState(false)
  const [showReflections, setShowReflections] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [showKnowledge, setShowKnowledge] = useState(false)
  const [showMissions, setShowMissions] = useState(false)
  const [showRosieCenter, setShowRosieCenter] = useState(false)

  const date = useMemo(() => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()), [])

  const lastOrchestrationKey = useRef<string | null>(null)
  useEffect(() => {
    if (!vault.data) return
    const consent = vault.data.cognitionConsent
    const key = JSON.stringify({
      consent: {
        status: consent?.status,
        updatedAt: consent?.updatedAt,
        categories: consent?.permittedDataCategories ?? [],
        surfaces: consent?.permittedFeatureSurfaces ?? [],
      },
      commitments: vault.data.commitments.map((item) => [item.id, item.status, item.due]),
      decisions: vault.data.decisions.map((item) => [item.id, item.status, item.context, item.createdAt]),
      reflections: vault.data.reflections.map((item) => [item.id, item.createdAt]),
      recommendations: (vault.data.recommendations ?? []).map((item) => [item.id, item.dismissed, item.createdAt]),
      missions: (vault.data.missionPlans ?? []).map((item) => [item.id, item.status, item.updatedAt, item.createdAt]),
      understandings: (vault.data.operatorUnderstandings ?? []).map((item) => [item.id, item.state, item.personalizationEligible, item.expiresAt, item.updatedAt, item.ruleId, item.ruleVersion]),
      overrides: (vault.data.presentationOverrides ?? []).map((item) => [item.id, item.setting, item.value, item.updatedAt]),
      personalizationEnabled: vault.data.presentationPersonalizationEnabled ?? false,
    })
    if (lastOrchestrationKey.current === key) return
    lastOrchestrationKey.current = key
    const result = runRosieOrchestration({ data: vault.data })
    if (result.changed) {
      vault.saveOrchestrationResult(result.data)
    }
  }, [vault])

  useEffect(() => {
    if (!understanding || !vault.data) return
    const nextState = {
      activeDriftSignals: understanding.drift.signals.map((s) => s.id),
      activePatternKeys: UnderstandingEngine.derivePatternKeys(understanding.patterns),
      trendDirections: {
        priorityLoad: understanding.trends.priorityLoad.direction,
        commitmentLoad: understanding.trends.commitmentLoad.direction,
        decisionLoad: understanding.trends.decisionLoad.direction,
        reflectionFrequency: understanding.trends.reflectionFrequency.direction,
        recommendationVolume: understanding.trends.recommendationVolume.direction,
        completionRate: understanding.trends.completionRate.direction,
      },
    }

    const previous = vault.data.understandingState ?? { activeDriftSignals: [], activePatternKeys: [], trendDirections: {} }
    const events: Array<{ type: 'system'; title: string; detail: string }> = []

    const newDrift = nextState.activeDriftSignals.filter((id) => !previous.activeDriftSignals.includes(id))
    const resolvedDrift = previous.activeDriftSignals.filter((id) => !nextState.activeDriftSignals.includes(id))
    newDrift.forEach((id) => events.push({ type: 'system', title: 'Operational drift detected', detail: id }))
    resolvedDrift.forEach((id) => events.push({ type: 'system', title: 'Pattern resolved', detail: `Drift resolved: ${id}` }))

    const newPatterns = nextState.activePatternKeys.filter((id) => !previous.activePatternKeys.includes(id))
    const resolvedPatterns = previous.activePatternKeys.filter((id) => !nextState.activePatternKeys.includes(id))
    newPatterns.forEach((key) => events.push({ type: 'system', title: 'Pattern detected', detail: key }))
    resolvedPatterns.forEach((key) => events.push({ type: 'system', title: 'Pattern resolved', detail: key }))

    Object.entries(nextState.trendDirections).forEach(([dimension, direction]) => {
      if (previous.trendDirections[dimension] !== direction) {
        events.push({ type: 'system', title: 'Trend detected', detail: `${dimension}:${direction}` })
      }
    })

    vault.syncUnderstandingState(nextState, events)
  }, [understanding, vault])

  if (vault.vaultState !== 'unlocked' || !vault.data) {
    return <VaultGate state={vault.vaultState as 'setup' | 'locked'} error={vault.error} onCreate={vault.createVault} onUnlock={vault.unlock} />
  }

  const { data } = vault
  const morningBrief = RosieEngine.getMorningBrief(data)
  const eveningSummary = RosieEngine.getEveningSummary(data)
  const openCommitments = data.commitments.filter((c) => c.status === 'open').length
  const graphStats = getStats()
  const morningObservations = understanding ? UnderstandingEngine.getMorningObservations(understanding) : []
  const eveningObservations = understanding ? UnderstandingEngine.getEveningObservations(understanding) : []
  const profile = data.presentationProfile
  const briefingPresentation = profile ? resolveSurfacePresentation(profile, 'briefing') : undefined
  const reviewPresentation = profile ? resolveSurfacePresentation(profile, 'review') : undefined
  const missionPresentation = profile ? resolveSurfacePresentation(profile, 'mission_planning') : undefined
  const proposedSignalsCount = (data.cognitiveSignals ?? []).filter((signal) => signal.status === 'proposed').length
  const proposedUnderstandingsCount = (data.operatorUnderstandings ?? []).filter((item) => item.state === 'proposed').length
  const rosieHasAlerts = recs.length > 0 || proposedSignalsCount > 0 || proposedUnderstandingsCount > 0

  const stateItems = [
    ['Executive State', mode === 'focus' ? 'Focused' : 'Aware'],
    ['Vault', vault.saving ? 'Securing' : 'Encrypted'],
    ['Priorities', criticalCount ? `${criticalCount} Critical` : activePriorities.length ? `${activePriorities.length} Active` : 'Clear'],
    ['Commitments', openCommitments ? `${openCommitments} Open` : 'On Track'],
    ['Rosie', recCritical > 0 ? `${recCritical} Critical` : recs.length > 0 ? `${recs.length} Recs` : 'Clear'],
    ['Graph', graphStats.totalEdges > 0 ? `${graphStats.totalEdges} Links` : 'Building'],
  ]

  return (
    <main className="shell">
      <header className="topbar">
        <div><p className="eyebrow">INDIVIDUAL MISSION OPERATING SYSTEM</p><h1>iMOS</h1></div>
        <div className="topActions">
          <button className="utilityButton" onClick={() => setShowReview(true)}><ShieldCheck size={16} /> REVIEW</button>
          <button className={`utilityButton${rosieHasAlerts ? ' utilityButton--alert' : ''}`} onClick={() => setShowRosieCenter(true)}>
            <Zap size={16} /> ROSIE{recs.length > 0 ? ` (${recs.length})` : ''}
          </button>
          <button className="utilityButton" onClick={() => setShowMissions(true)}><Route size={16} /> MISSION</button>
          <button className="utilityButton" onClick={() => setShowKnowledge(true)}><Network size={16} /> KNOWLEDGE</button>
          <button className="utilityButton" onClick={() => setShowPriorities(true)}><ListChecks size={16} /> PRIORITIES</button>
          <button className="utilityButton" onClick={() => setShowSecrets(true)}><KeyRound size={16} /> SECRETS</button>
          <button className="utilityButton" onClick={() => setShowDataPanel((v) => !v)}><LockKeyhole size={16} /> VAULT</button>
          <button className="utilityButton" onClick={vault.lock}><Lock size={16} /> LOCK</button>
          <div className="secure"><ShieldCheck size={17} /> ENCRYPTED MODE</div>
        </div>
      </header>

      {showDataPanel && <DataPanel onClose={() => setShowDataPanel(false)} onOpenRecovery={() => setShowRecovery(true)} onReset={vault.reset} onBackup={vault.exportVaultBackup} />}

      <ErrorBoundary>
        <Suspense fallback={null}>
          {showPriorities && <PriorityConsole priorities={data.priorities} onChange={vault.updatePriorities} onClose={() => setShowPriorities(false)} />}
          {showSecrets && <SecretsConsole records={secrets.records} onChange={vault.updateSecrets} onClose={() => setShowSecrets(false)} />}
          {showRecovery && <RecoveryConsole data={data} onClose={() => setShowRecovery(false)} onRestore={vault.restoreVault} onRotate={vault.rotateVaultPassphrase} onAudit={vault.recordRecoveryAuditEvent} />}
          {showReflections && <ReflectionHistory reflections={data.reflections} onDelete={vault.deleteReflection} onClose={() => setShowReflections(false)} />}
          {showReview && <ReviewCenter data={data} onDeleteReflection={vault.deleteReflection} onClose={() => setShowReview(false)} presentation={reviewPresentation} />}
          {showMissions && (
            <MissionPlanner
              data={data}
              onClose={() => setShowMissions(false)}
              onSaveMissionPlan={vault.saveMissionPlan}
              onSetMissionPlanStatus={vault.setMissionPlanStatus}
              onUpdateMissionPlan={vault.updateMissionPlan}
              onUpdateMissionStepStatus={vault.updateMissionStepStatus}
              onUpdateMissionStep={vault.updateMissionStep}
              onAddMissionStep={vault.addMissionStep}
              onDeleteMissionStep={vault.deleteMissionStep}
              onReorderMissionSteps={vault.reorderMissionSteps}
              onDeleteMissionPlan={vault.deleteMissionPlan}
              presentation={missionPresentation}
            />
          )}
          {showKnowledge && <KnowledgeGraphViewer graph={graph} onClose={() => setShowKnowledge(false)} />}
          {showRosieCenter && (
            <RosieCenter
              data={data}
              recs={recs}
              onClose={() => setShowRosieCenter(false)}
              onSuppressSignal={vault.suppressCognitiveSignal}
              onConfirmUnderstanding={vault.confirmOperatorUnderstanding}
              onCorrectUnderstanding={vault.correctOperatorUnderstanding}
              onRejectUnderstanding={vault.rejectOperatorUnderstanding}
              onExpireUnderstanding={vault.expireOperatorUnderstanding}
              onSuppressUnderstandingSignal={vault.suppressUnderstandingSourceSignal}
              onUpdateCognitionConsent={vault.updateCognitionConsent}
              onEnablePersonalizationChanged={vault.setPresentationPersonalizationEnabled}
              onOverrideChanged={(setting, value) => {
                const targetSurface = setting === 'planningSequenceMode'
                  ? 'missions'
                  : setting === 'reviewTimingMode' || setting === 'evidenceDepth'
                    ? 'review'
                    : 'briefing'
                const next = applyOperatorOverride(data.presentationOverrides ?? [], { targetSurface, setting, value })
                vault.savePresentationOverrides(next)
              }}
              onOverrideRemoved={vault.removePresentationOverride}
              onRestoreNeutral={() => {
                vault.restoreNeutralPresentation()
                vault.saveResolvedPresentationProfile(
                  getNeutralPresentationProfile(),
                  [buildNeutralRestorationAudit()],
                  PRESENTATION_MAPPING_REGISTRY_VERSION,
                )
              }}
              onCompleteRec={vault.completeRecommendation}
              onDismissRec={vault.dismissRecommendation}
              onSnoozeRec={vault.snoozeRecommendation}
            />
          )}
        </Suspense>
      </ErrorBoundary>

      <section className="statebar">{stateItems.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>

      <section className="workspace">
        <div className="primary panel">
          {mode === 'arrival' && <Arrival date={date} data={data} primary={primary} onBegin={() => setMode('brief')} />}
          {mode === 'brief' && <Brief data={data} overdueCount={overdueCount} criticalCount={criticalCount} secretCount={secrets.count} morningBrief={morningBrief} morningObservations={morningObservations} onAddCommitment={vault.addCommitment} onAddDecision={vault.addDecision} onToggleCommitment={vault.toggleCommitment} onToggleDecision={vault.toggleDecision} onOpenPriorities={() => setShowPriorities(true)} onOpenReflectionHistory={() => setShowReflections(true)} onBegin={() => setMode('focus')} presentation={briefingPresentation} />}
          {mode === 'focus' && <FocusView primary={primary} onCompletePriority={() => primary && vault.completePrimaryPriority(primary)} onComplete={() => setMode('reflection')} />}
          {mode === 'reflection' && <Reflection eveningSummary={eveningSummary} eveningObservations={eveningObservations} onSave={(a, r, t) => { vault.saveReflection(a, r, t); setMode('arrival') }} />}
        </div>
        <aside className="timeline panel">
          <div className="panelTitle"><Clock3 size={17} /><span>EXECUTIVE TIMELINE</span></div>
          {data.timeline.slice(0, 8).map((entry) => <TimelineItem key={entry.id} entry={entry} />)}
        </aside>
      </section>
    </main>
  )
}
