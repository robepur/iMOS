import { lazy, Suspense, useMemo, useState } from 'react'
import { Clock3, Download, KeyRound, ListChecks, Lock, LockKeyhole, RotateCcw, ShieldCheck } from 'lucide-react'
import { useVault } from './hooks/useVault'
import { usePriorities } from './hooks/usePriorities'
import { useSecrets } from './hooks/useSecrets'
import { VaultService } from './services/VaultService'
import { ErrorBoundary } from './components/ErrorBoundary'
import VaultGate from './features/vault/VaultGate'
import { Arrival, Brief, FocusView, Reflection, TimelineItem } from './features/arrival/OperatingLoop'
import PriorityConsole from './features/priorities/PriorityConsole'

// Lazy-loaded feature consoles
const ReviewCenter     = lazy(() => import('./features/review/ReviewCenter'))
const RecoveryConsole  = lazy(() => import('./features/recovery/RecoveryConsole'))
const SecretsConsole   = lazy(() => import('./features/secrets/SecretsConsole'))
const ReflectionHistory = lazy(() => import('./features/reflection/ReflectionHistory'))

type Mode = 'arrival' | 'brief' | 'focus' | 'reflection'

export default function App() {
  const vault = useVault()
  const { activePriorities, primary, criticalCount, overdueCount } = usePriorities(vault.data)
  const secrets = useSecrets(vault.data)

  const [mode, setMode] = useState<Mode>('arrival')
  const [showDataPanel, setShowDataPanel] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [showSecrets, setShowSecrets] = useState(false)
  const [showPriorities, setShowPriorities] = useState(false)
  const [showReflections, setShowReflections] = useState(false)
  const [showReview, setShowReview] = useState(false)

  const date = useMemo(() => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()), [])

  if (vault.vaultState !== 'unlocked' || !vault.data) {
    return <VaultGate state={vault.vaultState as 'setup' | 'locked'} error={vault.error} onCreate={vault.createVault} onUnlock={vault.unlock} />
  }

  const { data } = vault
  const openCommitments = data.commitments.filter((c) => c.status === 'open').length
  const openDecisions = data.decisions.filter((d) => d.status === 'open').length

  const stateItems = [
    ['Executive State', mode === 'focus' ? 'Focused' : 'Aware'],
    ['Vault', vault.saving ? 'Securing' : 'Encrypted'],
    ['Priorities', criticalCount ? `${criticalCount} Critical` : activePriorities.length ? `${activePriorities.length} Active` : 'Clear'],
    ['Commitments', openCommitments ? `${openCommitments} Open` : 'On Track'],
  ]

  function handleReflectionSave(a: string, r: string, t: string) {
    vault.saveReflection(a, r, t)
    setMode('arrival')
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div><p className="eyebrow">INDIVIDUAL MISSION OPERATING SYSTEM</p><h1>iMOS</h1></div>
        <div className="topActions">
          <button className="utilityButton" onClick={() => setShowReview(true)}><ShieldCheck size={16} /> REVIEW</button>
          <button className="utilityButton" onClick={() => setShowPriorities(true)}><ListChecks size={16} /> PRIORITIES</button>
          <button className="utilityButton" onClick={() => setShowSecrets(true)}><KeyRound size={16} /> SECRETS</button>
          <button className="utilityButton" onClick={() => setShowDataPanel((v) => !v)}><LockKeyhole size={16} /> VAULT</button>
          <button className="utilityButton" onClick={vault.lock}><Lock size={16} /> LOCK</button>
          <div className="secure"><ShieldCheck size={17} /> ENCRYPTED MODE</div>
        </div>
      </header>

      {showDataPanel && (
        <section className="dataPanel panel">
          <div><p className="eyebrow">BUILD 008 VAULT CONTROL</p><h3>Encrypted. Recoverable. Controlled.</h3><p>All operator data remains inside the encrypted personal vault.</p></div>
          <div className="dataActions">
            <button className="secondaryButton" onClick={() => void VaultService.exportBackup()}><Download size={16} /> BACKUP</button>
            <button className="secondaryButton" onClick={() => { setShowDataPanel(false); setShowRecovery(true) }}><ShieldCheck size={16} /> RECOVERY</button>
            <button className="dangerButton" onClick={vault.reset}><RotateCcw size={16} /> ERASE</button>
          </div>
        </section>
      )}

      <ErrorBoundary>
        <Suspense fallback={null}>
          {showPriorities && <PriorityConsole priorities={data.priorities} onChange={vault.updatePriorities} onClose={() => setShowPriorities(false)} />}
          {showSecrets && <SecretsConsole records={secrets.records} onChange={vault.updateSecrets} onClose={() => setShowSecrets(false)} />}
          {showRecovery && <RecoveryConsole onClose={() => setShowRecovery(false)} onRestore={vault.restoreVault} onRotate={vault.rotateVaultPassphrase} />}
          {showReflections && <ReflectionHistory reflections={data.reflections} onDelete={vault.deleteReflection} onClose={() => setShowReflections(false)} />}
          {showReview && <ReviewCenter data={data} onDeleteReflection={vault.deleteReflection} onClose={() => setShowReview(false)} />}
        </Suspense>
      </ErrorBoundary>

      <section className="statebar">{stateItems.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>

      <section className="workspace">
        <div className="primary panel">
          {mode === 'arrival' && <Arrival date={date} data={data} primary={primary} onBegin={() => setMode('brief')} />}
          {mode === 'brief' && <Brief data={data} overdueCount={overdueCount} criticalCount={criticalCount} secretCount={secrets.count} onAddCommitment={vault.addCommitment} onAddDecision={vault.addDecision} onToggleCommitment={vault.toggleCommitment} onToggleDecision={vault.toggleDecision} onOpenPriorities={() => setShowPriorities(true)} onOpenReflectionHistory={() => setShowReflections(true)} onBegin={() => setMode('focus')} />}
          {mode === 'focus' && <FocusView primary={primary} onCompletePriority={() => primary && vault.completePrimaryPriority(primary)} onComplete={() => setMode('reflection')} />}
          {mode === 'reflection' && <Reflection onSave={handleReflectionSave} />}
        </div>
        <aside className="timeline panel">
          <div className="panelTitle"><Clock3 size={17} /><span>EXECUTIVE TIMELINE</span></div>
          {data.timeline.slice(0, 8).map((entry) => <TimelineItem key={entry.id} entry={entry} />)}
        </aside>
      </section>
    </main>
  )
}
