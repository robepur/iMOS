import { useEffect, useMemo, useState } from 'react'
import {
  Clock3,
  Download,
  KeyRound,
  ListChecks,
  Lock,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react'
import {
  Commitment,
  createId,
  createInitialData,
  Decision,
  normalizePersonalData,
  Priority,
  SecretRecord,
  TimelineEntry,
} from './localData'
import VaultGate from './VaultGate'
import RecoveryConsole from './RecoveryConsole'
import { Arrival, Brief, FocusView, Reflection, TimelineItem } from './OperatingLoop'
import PriorityConsole from './PriorityConsole'
import ReflectionHistory from './ReflectionHistory'
import SecretsConsole from './SecretsConsole'
import ReviewCenter from './ReviewCenter'
import {
  clearVault,
  exportEncryptedVault,
  legacyDataExists,
  readLegacyData,
  restoreBackup,
  rotatePassphrase,
  saveVault,
  unlockVault,
  vaultExists,
} from './vault'

type Mode = 'arrival' | 'brief' | 'focus' | 'reflection'
type VaultState = 'setup' | 'locked' | 'unlocked'

export default function App() {
  const [vaultState, setVaultState] = useState<VaultState>(() => vaultExists() ? 'locked' : 'setup')
  const [data, setData] = useState<ReturnType<typeof normalizePersonalData> | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [mode, setMode] = useState<Mode>('arrival')
  const [showDataPanel, setShowDataPanel] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [showSecrets, setShowSecrets] = useState(false)
  const [showPriorities, setShowPriorities] = useState(false)
  const [showReflectionHistory, setShowReflectionHistory] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const date = useMemo(() => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()), [])

  useEffect(() => {
    if (vaultState !== 'unlocked' || !data || !passphrase) return
    const timeout = window.setTimeout(async () => {
      setSaving(true)
      try { await saveVault(data, passphrase) } finally { setSaving(false) }
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [data, passphrase, vaultState])

  async function createVault(newPassphrase: string) {
    setError('')
    try {
      const startingData = normalizePersonalData(legacyDataExists() ? readLegacyData() ?? createInitialData() : createInitialData())
      await saveVault(startingData, newPassphrase)
      setPassphrase(newPassphrase)
      setData(startingData)
      setVaultState('unlocked')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create the encrypted vault.')
    }
  }

  async function unlock(pass: string) {
    setError('')
    try {
      setPassphrase(pass)
      setData(normalizePersonalData(await unlockVault(pass)))
      setVaultState('unlocked')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to unlock the vault.')
    }
  }

  function lock() {
    setData(null); setPassphrase(''); setMode('arrival')
    setShowDataPanel(false); setShowRecovery(false); setShowSecrets(false)
    setShowPriorities(false); setShowReflectionHistory(false); setShowReview(false)
    setVaultState('locked')
  }

  function reset() {
    if (!window.confirm('Erase the encrypted iMOS vault from this browser? This cannot be undone without an exported vault backup.')) return
    clearVault()
    setData(null); setPassphrase(''); setMode('arrival')
    setShowDataPanel(false); setShowRecovery(false); setShowSecrets(false)
    setShowPriorities(false); setShowReflectionHistory(false); setShowReview(false)
    setVaultState('setup')
  }

  if (vaultState !== 'unlocked' || !data) {
    return <VaultGate state={vaultState as 'setup' | 'locked'} error={error} onCreate={createVault} onUnlock={unlock} />
  }

  const activePriorities = data.priorities.filter((p) => !p.completed)
  const primary = activePriorities.find((p) => p.primary) ?? activePriorities[0]
  const criticalCount = activePriorities.filter((p) => p.level === 'critical').length
  const overdueCount = activePriorities.filter((p) => p.due && new Date(p.due) < new Date(new Date().toDateString())).length
  const openCommitments = data.commitments.filter((item) => item.status === 'open').length
  const openDecisions = data.decisions.filter((item) => item.status === 'open').length
  const secretCount = data.secrets?.length ?? 0

  const stateItems = [
    ['Executive State', mode === 'focus' ? 'Focused' : 'Aware'],
    ['Vault', saving ? 'Securing' : 'Encrypted'],
    ['Priorities', criticalCount ? `${criticalCount} Critical` : activePriorities.length ? `${activePriorities.length} Active` : 'Clear'],
    ['Commitments', openCommitments ? `${openCommitments} Open` : 'On Track'],
  ]

  function addTimelineEntry(entry: Omit<TimelineEntry, 'id' | 'createdAt'>) {
    setData((cur) => cur ? ({ ...cur, timeline: [{ ...entry, id: createId('timeline'), createdAt: new Date().toISOString() }, ...cur.timeline] }) : cur)
  }

  function updatePriorities(priorities: Priority[], event: string, detail: string) {
    const createdAt = new Date().toISOString()
    setData((cur) => cur ? ({ ...cur, priorities, timeline: [{ id: createId('timeline'), type: 'priority', title: event, detail, createdAt }, ...cur.timeline] }) : cur)
  }

  function updateSecrets(records: SecretRecord[], event: string, detail: string) {
    const createdAt = new Date().toISOString()
    setData((cur) => cur ? ({ ...cur, secrets: records, timeline: [{ id: createId('timeline'), type: 'secret', title: event, detail, createdAt }, ...cur.timeline] }) : cur)
  }

  function addCommitment(title: string, due: string) {
    const item: Commitment = { id: createId('commitment'), title, due, status: 'open', createdAt: new Date().toISOString() }
    setData((cur) => cur ? ({ ...cur, commitments: [item, ...cur.commitments] }) : cur)
    addTimelineEntry({ type: 'commitment', title: 'Commitment captured', detail: title })
  }

  function addDecision(title: string, context: string) {
    const item: Decision = { id: createId('decision'), title, context, status: 'open', createdAt: new Date().toISOString() }
    setData((cur) => cur ? ({ ...cur, decisions: [item, ...cur.decisions] }) : cur)
    addTimelineEntry({ type: 'decision', title: 'Decision opened', detail: title })
  }

  function toggleCommitment(id: string) {
    setData((cur) => cur ? ({ ...cur, commitments: cur.commitments.map((item) => item.id === id ? { ...item, status: item.status === 'open' ? 'complete' : 'open' } : item) }) : cur)
  }

  function toggleDecision(id: string) {
    setData((cur) => cur ? ({ ...cur, decisions: cur.decisions.map((item) => item.id === id ? { ...item, status: item.status === 'open' ? 'decided' : 'open' } : item) }) : cur)
  }

  function completePrimaryPriority() {
    if (!primary) return
    const now = new Date().toISOString()
    setData((cur) => {
      if (!cur) return cur
      const next = cur.priorities.map((p) => p.id === primary.id ? { ...p, completed: true, primary: false, updatedAt: now, completedAt: now } : p)
      const stillActive = next.filter((p) => !p.completed)
      const hasPrimary = stillActive.some((p) => p.primary)
      const resolved = (hasPrimary || stillActive.length === 0) ? next : next.map((p, _, arr) => p.id === arr.find((x) => !x.completed)?.id ? { ...p, primary: true } : p)
      return { ...cur, priorities: resolved, timeline: [{ id: createId('timeline'), type: 'priority', title: 'Priority completed', detail: primary.title, createdAt: now }, ...cur.timeline] }
    })
  }

  function saveReflection(accomplished: string, remember: string, tomorrow: string) {
    const createdAt = new Date().toISOString()
    setData((cur) => cur ? ({ ...cur, reflections: [{ id: createId('reflection'), accomplished, remember, tomorrow, createdAt }, ...cur.reflections], timeline: [{ id: createId('timeline'), type: 'reflection', title: 'Executive reflection completed', detail: accomplished || 'Session reviewed.', createdAt }, ...cur.timeline] }) : cur)
    setMode('arrival')
  }

  function deleteReflection(id: string) {
    const createdAt = new Date().toISOString()
    setData((cur) => cur ? ({ ...cur, reflections: cur.reflections.filter((r) => r.id !== id), timeline: [{ id: createId('timeline'), type: 'reflection', title: 'Reflection deleted', detail: 'An executive reflection was permanently removed.', createdAt }, ...cur.timeline] }) : cur)
  }

  async function restoreVault(backup: unknown, backupPassphrase: string) {
    setData(normalizePersonalData(await restoreBackup(backup, backupPassphrase)))
    setPassphrase(backupPassphrase)
    setMode('arrival')
  }

  async function rotateVaultPassphrase(current: string, replacement: string) {
    await rotatePassphrase(data!, current, replacement)
    setPassphrase(replacement)
  }

  return <main className="shell">
    <header className="topbar">
      <div><p className="eyebrow">INDIVIDUAL MISSION OPERATING SYSTEM</p><h1>iMOS</h1></div>
      <div className="topActions">
        <button className="utilityButton" onClick={() => setShowReview(true)}><ShieldCheck size={16} /> REVIEW</button>
        <button className="utilityButton" onClick={() => setShowPriorities(true)}><ListChecks size={16} /> PRIORITIES</button>
        <button className="utilityButton" onClick={() => setShowSecrets(true)}><KeyRound size={16} /> SECRETS</button>
        <button className="utilityButton" onClick={() => setShowDataPanel((v) => !v)}><LockKeyhole size={16} /> VAULT</button>
        <button className="utilityButton" onClick={lock}><Lock size={16} /> LOCK</button>
        <div className="secure"><ShieldCheck size={17} /> ENCRYPTED MODE</div>
      </div>
    </header>

    {showDataPanel && <section className="dataPanel panel">
      <div><p className="eyebrow">BUILD 007 VAULT CONTROL</p><h3>Encrypted. Recoverable. Controlled.</h3><p>Priorities, secrets, recovery data, and operating context remain inside the encrypted personal vault.</p></div>
      <div className="dataActions">
        <button className="secondaryButton" onClick={() => void exportEncryptedVault()}><Download size={16} /> BACKUP</button>
        <button className="secondaryButton" onClick={() => setShowRecovery(true)}><ShieldCheck size={16} /> RECOVERY</button>
        <button className="dangerButton" onClick={reset}><RotateCcw size={16} /> ERASE</button>
      </div>
    </section>}

    {showPriorities && <PriorityConsole priorities={data.priorities} onChange={updatePriorities} onClose={() => setShowPriorities(false)} />}
    {showSecrets && <SecretsConsole records={data.secrets ?? []} onChange={updateSecrets} onClose={() => setShowSecrets(false)} />}
    {showRecovery && <RecoveryConsole onClose={() => setShowRecovery(false)} onRestore={restoreVault} onRotate={rotateVaultPassphrase} />}
    {showReflectionHistory && <ReflectionHistory reflections={data.reflections} onDelete={deleteReflection} onClose={() => setShowReflectionHistory(false)} />}
    {showReview && <ReviewCenter data={data} onDeleteReflection={deleteReflection} onClose={() => setShowReview(false)} />}

    <section className="statebar">{stateItems.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>

    <section className="workspace">
      <div className="primary panel">
        {mode === 'arrival' && <Arrival date={date} data={data} primary={primary} onBegin={() => setMode('brief')} />}
        {mode === 'brief' && <Brief data={data} overdueCount={overdueCount} criticalCount={criticalCount} secretCount={secretCount} onAddCommitment={addCommitment} onAddDecision={addDecision} onToggleCommitment={toggleCommitment} onToggleDecision={toggleDecision} onOpenPriorities={() => setShowPriorities(true)} onOpenReflectionHistory={() => setShowReflectionHistory(true)} onBegin={() => setMode('focus')} />}
        {mode === 'focus' && <FocusView primary={primary} onCompletePriority={completePrimaryPriority} onComplete={() => setMode('reflection')} />}
        {mode === 'reflection' && <Reflection onSave={saveReflection} />}
      </div>
      <aside className="timeline panel">
        <div className="panelTitle"><Clock3 size={17} /><span>EXECUTIVE TIMELINE</span></div>
        {data.timeline.slice(0, 8).map((entry) => <TimelineItem key={entry.id} entry={entry} />)}
      </aside>
    </section>
  </main>
}
