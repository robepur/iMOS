import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { BrainCircuit, Clock3, KeyRound, ListChecks, Lock, LockKeyhole, Network, Route, ShieldCheck, Zap } from 'lucide-react'
import { useVault } from './hooks/useVault'
import { usePriorities } from './hooks/usePriorities'
import { useSecrets } from './hooks/useSecrets'
import { useRecommendations } from './hooks/useRecommendations'
import { useKnowledgeGraph } from './hooks/useKnowledgeGraph'
import { useUnderstanding } from './hooks/useUnderstanding'
import { RosieEngine } from './services/RosieEngine'
import { UnderstandingEngine } from './services/UnderstandingEngine'
import { analyze as analyzeSignals } from './services/CognitiveSignalEngine'
import { isCognitionEnabled } from './services/CognitionConsentService'
import { createProposedUnderstanding } from './services/UnderstandingReviewService'
import {
  applyOperatorOverride,
  buildNeutralRestorationAudit,
  getNeutralPresentationProfile,
  PRESENTATION_MAPPING_REGISTRY_VERSION,
  removeOperatorOverride,
  resolvePresentationProfile,
  resolveSurfacePresentation,
} from './services/AdaptivePresentationEngine'
import { ErrorBoundary } from './components/ErrorBoundary'
import VaultGate from './features/vault/VaultGate'
import DataPanel from './features/vault/DataPanel'
import { Arrival, Brief, FocusView, Reflection, TimelineItem } from './features/arrival/OperatingLoop'
import PriorityConsole from './features/priorities/PriorityConsole'
import { CognitionConsentPanel, CognitiveSignalsPanel, PersonalizationControlCenter, UnderstandingReviewCenter } from './features/cognition'

const ReviewCenter           = lazy(() => import('./features/review/ReviewCenter'))
const RecoveryConsole        = lazy(() => import('./features/recovery/RecoveryConsole'))
const SecretsConsole         = lazy(() => import('./features/secrets/SecretsConsole'))
const ReflectionHistory      = lazy(() => import('./features/reflection/ReflectionHistory'))
const RecommendationCenter   = lazy(() => import('./features/rosie/RecommendationCenter'))
const KnowledgeGraphViewer   = lazy(() => import('./features/knowledge/KnowledgeGraphViewer'))
const UnderstandingDashboard = lazy(() => import('./features/understanding/UnderstandingDashboard'))
const MissionPlanner         = lazy(() => import('./features/missions/MissionPlanner'))

type Mode = 'arrival' | 'brief' | 'focus' | 'reflection'

export default function App() {
  const vault = useVault()
  const { activePriorities, primary, criticalCount, overdueCount } = usePriorities(vault.data)
  const secrets = useSecrets(vault.data)
  const { active: recs, patterns, criticalCount: recCritical } = useRecommendations(vault.data)
  const { graph, getStats } = useKnowledgeGraph(vault.data)
  const { understanding } = useUnderstanding(vault.data)

  const [mode, setMode] = useState<Mode>('arrival')
  const [showDataPanel, setShowDataPanel]           = useState(false)
  const [showRecovery, setShowRecovery]             = useState(false)
  const [showSecrets, setShowSecrets]               = useState(false)
  const [showPriorities, setShowPriorities]         = useState(false)
  const [showReflections, setShowReflections]       = useState(false)
  const [showReview, setShowReview]                 = useState(false)
  const [showRosie, setShowRosie]                   = useState(false)
  const [showKnowledge, setShowKnowledge]           = useState(false)
  const [showUnderstanding, setShowUnderstanding]   = useState(false)
  const [showMissions, setShowMissions]             = useState(false)
  const [showCognition, setShowCognition]           = useState(false)
  const [showSignals, setShowSignals]               = useState(false)
  const [showUnderstandingReview, setShowUnderstandingReview] = useState(false)
  const [showPersonalization, setShowPersonalization] = useState(false)

  const date = useMemo(() => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()), [])

  // Run cognitive signal analysis when vault data changes (consent must be enabled)
  const lastSignalAnalysis = useRef<string | null>(null)
  useEffect(() => {
    if (!vault.data) return
    const consent = vault.data.cognitionConsent
    if (!isCognitionEnabled(consent)) {
      lastSignalAnalysis.current = null
      return
    }
    const enabledConsent = consent!
    // Deterministic fingerprint of every approved Build 014 input. Cognitive
    // signal persistence is intentionally excluded to prevent save loops.
    const dataKey = JSON.stringify({
      consent: {
        status: enabledConsent.status,
        updatedAt: enabledConsent.updatedAt,
        categories: enabledConsent.permittedDataCategories,
        surfaces: enabledConsent.permittedFeatureSurfaces,
      },
      commitments: vault.data.commitments.map((item) => [item.id, item.status, item.due]),
      decisions: vault.data.decisions.map((item) => [item.id, item.status, item.context, item.createdAt]),
      reflections: vault.data.reflections.map((item) => [item.id, item.createdAt]),
      recommendations: (vault.data.recommendations ?? []).map((item) => [item.id, item.dismissed, item.createdAt]),
      missions: (vault.data.missionPlans ?? []).map((item) => [item.id, item.status, item.updatedAt, item.createdAt]),
    })
    if (lastSignalAnalysis.current === dataKey) return
    lastSignalAnalysis.current = dataKey
    const result = analyzeSignals(vault.data, consent)
    if (!result.blocked) {
      vault.saveCognitiveSignals(result.signals, result.registryVersion)
    }
  }, [vault])

  const lastPresentationResolution = useRef<string | null>(null)
  useEffect(() => {
    if (!vault.data) return
    const key = JSON.stringify({
      consentStatus: vault.data.cognitionConsent?.status,
      consentUpdatedAt: vault.data.cognitionConsent?.updatedAt,
      enabled: vault.data.presentationPersonalizationEnabled ?? false,
      understandings: (vault.data.operatorUnderstandings ?? []).map((item) => [
        item.id, item.state, item.personalizationEligible, item.expiresAt, item.updatedAt, item.ruleId, item.ruleVersion,
      ]),
      overrides: (vault.data.presentationOverrides ?? []).map((item) => [item.id, item.setting, item.value, item.updatedAt]),
    })
    if (lastPresentationResolution.current === key) return
    lastPresentationResolution.current = key
    const result = resolvePresentationProfile({
      consent: vault.data.cognitionConsent,
      enabled: vault.data.presentationPersonalizationEnabled ?? false,
      understandings: vault.data.operatorUnderstandings ?? [],
      overrides: vault.data.presentationOverrides ?? [],
    })
    vault.saveResolvedPresentationProfile(result.profile, result.audit, PRESENTATION_MAPPING_REGISTRY_VERSION)
  }, [vault])

  const lastUnderstandingConversion = useRef<string | null>(null)
  useEffect(() => {
    if (!vault.data) return
    const consent = vault.data.cognitionConsent
    if (!isCognitionEnabled(consent)) {
      lastUnderstandingConversion.current = null
      return
    }
    const proposedSignals = (vault.data.cognitiveSignals ?? []).filter((signal) => signal.status === 'proposed')
    const conversionKey = JSON.stringify({
      consentUpdatedAt: consent?.updatedAt,
      signals: proposedSignals.map((signal) => [signal.id, signal.signature, signal.status, signal.updatedAt]),
      rejected: vault.data.rejectedUnderstandingSignatures ?? [],
    })
    if (lastUnderstandingConversion.current === conversionKey) return
    lastUnderstandingConversion.current = conversionKey

    let understandings = vault.data.operatorUnderstandings ?? []
    let rejectedSignatures = vault.data.rejectedUnderstandingSignatures ?? []
    let reviewAudit = vault.data.understandingReviewAudit ?? []

    for (const signal of proposedSignals) {
      const conversion = createProposedUnderstanding({
        signal,
        consent,
        existingUnderstandings: understandings,
        rejectedSignatures,
        reviewAudit,
      })
      understandings = conversion.understandings
      rejectedSignatures = conversion.rejectedSignatures
      reviewAudit = conversion.reviewAudit
    }

    const changed =
      understandings.length !== (vault.data.operatorUnderstandings ?? []).length
      || rejectedSignatures.length !== (vault.data.rejectedUnderstandingSignatures ?? []).length
      || reviewAudit.length !== (vault.data.understandingReviewAudit ?? []).length
    if (changed) {
      vault.saveOperatorUnderstandings(understandings, rejectedSignatures, reviewAudit)
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
  const healthSignals = RosieEngine.getHealthSignals(data)
  const morningBrief = RosieEngine.getMorningBrief(data)
  const eveningSummary = RosieEngine.getEveningSummary(data)
  const openCommitments = data.commitments.filter((c) => c.status === 'open').length
  const graphStats = getStats()
  const driftCritical = understanding?.drift.hasCritical ?? false
  const morningObservations = understanding ? UnderstandingEngine.getMorningObservations(understanding) : []
  const eveningObservations = understanding ? UnderstandingEngine.getEveningObservations(understanding) : []
  const profile = data.presentationProfile
  const briefingPresentation = profile ? resolveSurfacePresentation(profile, 'briefing') : undefined
  const reviewPresentation = profile ? resolveSurfacePresentation(profile, 'review') : undefined
  const missionPresentation = profile ? resolveSurfacePresentation(profile, 'mission_planning') : undefined

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
          <button className={`utilityButton${recs.length > 0 ? ' utilityButton--alert' : ''}`} onClick={() => setShowRosie(true)}>
            <Zap size={16} /> ROSIE{recs.length > 0 ? ` (${recs.length})` : ''}
          </button>
          <button className={`utilityButton${driftCritical ? ' utilityButton--alert' : ''}`} onClick={() => setShowUnderstanding(true)}>
            <BrainCircuit size={16} /> UNDERSTAND
          </button>
          <button className="utilityButton" onClick={() => setShowMissions(true)}><Route size={16} /> MISSION</button>
          <button className="utilityButton" onClick={() => setShowCognition(true)}><BrainCircuit size={16} /> COGNITION</button>
          {isCognitionEnabled(data.cognitionConsent) && (
            <button
              className={`utilityButton${(data.cognitiveSignals ?? []).filter((s) => s.status === 'proposed').length > 0 ? ' utilityButton--alert' : ''}`}
              onClick={() => setShowSignals(true)}
            >
              <BrainCircuit size={16} /> SIGNALS{(data.cognitiveSignals ?? []).filter((s) => s.status === 'proposed').length > 0 ? ` (${(data.cognitiveSignals ?? []).filter((s) => s.status === 'proposed').length})` : ''}
            </button>
          )}
          {isCognitionEnabled(data.cognitionConsent) && (
            <button
              className={`utilityButton${(data.operatorUnderstandings ?? []).filter((u) => u.state === 'proposed').length > 0 ? ' utilityButton--alert' : ''}`}
              onClick={() => setShowUnderstandingReview(true)}
            >
              <BrainCircuit size={16} /> UNDERSTANDINGS{(data.operatorUnderstandings ?? []).filter((u) => u.state === 'proposed').length > 0 ? ` (${(data.operatorUnderstandings ?? []).filter((u) => u.state === 'proposed').length})` : ''}
            </button>
          )}
          {isCognitionEnabled(data.cognitionConsent) && (
            <button className="utilityButton" onClick={() => setShowPersonalization(true)}>
              <BrainCircuit size={16} /> PERSONALIZATION
            </button>
          )}
          <button className="utilityButton" onClick={() => setShowKnowledge(true)}><Network size={16} /> KNOWLEDGE</button>
          <button className="utilityButton" onClick={() => setShowPriorities(true)}><ListChecks size={16} /> PRIORITIES</button>
          <button className="utilityButton" onClick={() => setShowSecrets(true)}><KeyRound size={16} /> SECRETS</button>
          <button className="utilityButton" onClick={() => setShowDataPanel((v) => !v)}><LockKeyhole size={16} /> VAULT</button>
          <button className="utilityButton" onClick={vault.lock}><Lock size={16} /> LOCK</button>
          <div className="secure"><ShieldCheck size={17} /> ENCRYPTED MODE</div>
        </div>
      </header>

      {showDataPanel && <DataPanel onClose={() => setShowDataPanel(false)} onOpenRecovery={() => setShowRecovery(true)} onReset={vault.reset} />}

      <ErrorBoundary>
        <Suspense fallback={null}>
          {showPriorities && <PriorityConsole priorities={data.priorities} onChange={vault.updatePriorities} onClose={() => setShowPriorities(false)} />}
          {showSecrets && <SecretsConsole records={secrets.records} onChange={vault.updateSecrets} onClose={() => setShowSecrets(false)} />}
          {showRecovery && <RecoveryConsole onClose={() => setShowRecovery(false)} onRestore={vault.restoreVault} onRotate={vault.rotateVaultPassphrase} />}
          {showReflections && <ReflectionHistory reflections={data.reflections} onDelete={vault.deleteReflection} onClose={() => setShowReflections(false)} />}
          {showReview && <ReviewCenter data={data} onDeleteReflection={vault.deleteReflection} onClose={() => setShowReview(false)} presentation={reviewPresentation} />}
          {showRosie && <RecommendationCenter recs={recs} patterns={patterns} healthSignals={healthSignals} onComplete={vault.completeRecommendation} onDismiss={vault.dismissRecommendation} onSnooze={vault.snoozeRecommendation} onClose={() => setShowRosie(false)} />}
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
          {showUnderstanding && understanding && <UnderstandingDashboard understanding={understanding} onClose={() => setShowUnderstanding(false)} />}
          {showCognition && data.cognitionConsent && (
            <CognitionConsentPanel
              consent={data.cognitionConsent}
              onUpdate={vault.updateCognitionConsent}
              onClose={() => setShowCognition(false)}
            />
          )}
          {showSignals && (
            <CognitiveSignalsPanel
              signals={data.cognitiveSignals ?? []}
              onSuppress={vault.suppressCognitiveSignal}
              onClose={() => setShowSignals(false)}
            />
          )}
          {showUnderstandingReview && (
            <UnderstandingReviewCenter
              understandings={data.operatorUnderstandings ?? []}
              signals={data.cognitiveSignals ?? []}
              onConfirm={vault.confirmOperatorUnderstanding}
              onCorrect={vault.correctOperatorUnderstanding}
              onReject={vault.rejectOperatorUnderstanding}
              onExpire={vault.expireOperatorUnderstanding}
              onSuppressSignal={vault.suppressUnderstandingSourceSignal}
              onClose={() => setShowUnderstandingReview(false)}
            />
          )}
          {showPersonalization && data.cognitionConsent && data.presentationProfile && (
            <PersonalizationControlCenter
              consent={data.cognitionConsent}
              enabled={data.presentationPersonalizationEnabled ?? false}
              profile={data.presentationProfile}
              overrides={data.presentationOverrides ?? []}
              onEnableChanged={vault.setPresentationPersonalizationEnabled}
              onOverrideChanged={(setting, value) => {
                const targetSurface = setting === 'planningSequenceMode'
                  ? 'missions'
                  : setting === 'reviewTimingMode' || setting === 'evidenceDepth'
                    ? 'review'
                    : 'briefing'
                const next = applyOperatorOverride(data.presentationOverrides ?? [], { targetSurface, setting, value })
                vault.savePresentationOverrides(next)
              }}
              onOverrideRemoved={(overrideId) => vault.savePresentationOverrides(removeOperatorOverride(data.presentationOverrides ?? [], overrideId))}
              onRestoreNeutral={() => {
                vault.restoreNeutralPresentation()
                vault.saveResolvedPresentationProfile(
                  getNeutralPresentationProfile(),
                  [buildNeutralRestorationAudit()],
                  PRESENTATION_MAPPING_REGISTRY_VERSION,
                )
              }}
              onClose={() => setShowPersonalization(false)}
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
