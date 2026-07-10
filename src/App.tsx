import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  FlaskConical,
  Focus,
  KeyRound,
  Lock,
  LockKeyhole,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  X
} from 'lucide-react'
import { Commitment, createId, createInitialData, Decision, PersonalData, SecretRecord, TimelineEntry } from './localData'
import SecretsConsole from './SecretsConsole'
import {
  clearVault,
  exportEncryptedVault,
  getRecoveryAudit,
  legacyDataExists,
  readLegacyData,
  restoreBackup,
  rotatePassphrase,
  saveVault,
  testRecovery,
  unlockVault,
  vaultExists,
  verifyBackupPackage
} from './vault'

type Mode = 'arrival' | 'brief' | 'focus' | 'reflection'
type VaultState = 'setup' | 'locked' | 'unlocked'
type RecoveryAction = 'verify' | 'test' | 'restore' | 'rotate' | null

type RecoveryStatus = {
  tone: 'success' | 'error' | 'neutral'
  title: string
  detail: string
}

function normalizeData(value: PersonalData): PersonalData {
  return { ...value, secrets: value.secrets ?? [] }
}

export default function App() {
  const [vaultState, setVaultState] = useState<VaultState>(() => vaultExists() ? 'locked' : 'setup')
  const [data, setData] = useState<PersonalData | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [mode, setMode] = useState<Mode>('arrival')
  const [showDataPanel, setShowDataPanel] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [showSecrets, setShowSecrets] = useState(false)
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
      const startingData = normalizeData(legacyDataExists() ? readLegacyData() ?? createInitialData() : createInitialData())
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
      const unlocked = normalizeData(await unlockVault(pass))
      setPassphrase(pass)
      setData(unlocked)
      setVaultState('unlocked')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to unlock the vault.')
    }
  }

  function lock() {
    setData(null)
    setPassphrase('')
    setMode('arrival')
    setShowDataPanel(false)
    setShowRecovery(false)
    setShowSecrets(false)
    setVaultState('locked')
  }

  function reset() {
    const confirmed = window.confirm('Erase the encrypted iMOS vault from this browser? This cannot be undone without an exported vault backup.')
    if (!confirmed) return
    clearVault()
    setData(null)
    setPassphrase('')
    setMode('arrival')
    setShowDataPanel(false)
    setShowRecovery(false)
    setShowSecrets(false)
    setVaultState('setup')
  }

  if (vaultState !== 'unlocked' || !data) {
    return <VaultGate state={vaultState} error={error} onCreate={createVault} onUnlock={unlock} />
  }

  const openCommitments = data.commitments.filter((item) => item.status === 'open').length
  const openDecisions = data.decisions.filter((item) => item.status === 'open').length
  const secretCount = data.secrets?.length ?? 0
  const primary = data.priorities.find((item) => !item.completed)
  const stateItems = [
    ['Executive State', mode === 'focus' ? 'Focused' : 'Aware'],
    ['Vault', saving ? 'Securing' : 'Encrypted'],
    ['Secrets', secretCount ? `${secretCount} Secured` : 'Ready'],
    ['Commitments', openCommitments ? `${openCommitments} Open` : 'On Track']
  ]

  function addTimeline(entry: Omit<TimelineEntry, 'id' | 'createdAt'>) {
    setData((current) => current ? ({ ...current, timeline: [{ ...entry, id: createId('timeline'), createdAt: new Date().toISOString() }, ...current.timeline] }) : current)
  }

  function updateSecrets(records: SecretRecord[], event: string, detail: string) {
    const createdAt = new Date().toISOString()
    setData((current) => current ? ({
      ...current,
      secrets: records,
      timeline: [{ id: createId('timeline'), type: 'secret', title: event, detail, createdAt }, ...current.timeline]
    }) : current)
  }

  function addCommitment(title: string, due: string) {
    const item: Commitment = { id: createId('commitment'), title, due, status: 'open', createdAt: new Date().toISOString() }
    setData((current) => current ? ({ ...current, commitments: [item, ...current.commitments] }) : current)
    addTimeline({ type: 'commitment', title: 'Commitment captured', detail: title })
  }

  function addDecision(title: string, context: string) {
    const item: Decision = { id: createId('decision'), title, context, status: 'open', createdAt: new Date().toISOString() }
    setData((current) => current ? ({ ...current, decisions: [item, ...current.decisions] }) : current)
    addTimeline({ type: 'decision', title: 'Decision opened', detail: title })
  }

  function toggleCommitment(id: string) {
    setData((current) => current ? ({ ...current, commitments: current.commitments.map((item) => item.id === id ? { ...item, status: item.status === 'open' ? 'complete' : 'open' } : item) }) : current)
  }

  function toggleDecision(id: string) {
    setData((current) => current ? ({ ...current, decisions: current.decisions.map((item) => item.id === id ? { ...item, status: item.status === 'open' ? 'decided' : 'open' } : item) }) : current)
  }

  function completePriority() {
    if (!primary) return
    setData((current) => current ? ({ ...current, priorities: current.priorities.map((item) => item.id === primary.id ? { ...item, completed: true } : item) }) : current)
  }

  function saveReflection(accomplished: string, remember: string, tomorrow: string) {
    const createdAt = new Date().toISOString()
    setData((current) => current ? ({
      ...current,
      reflections: [{ id: createId('reflection'), accomplished, remember, tomorrow, createdAt }, ...current.reflections],
      timeline: [{ id: createId('timeline'), type: 'reflection', title: 'Executive reflection completed', detail: accomplished || 'Session reviewed.', createdAt }, ...current.timeline]
    }) : current)
    setMode('arrival')
  }

  async function restoreVault(backup: unknown, backupPassphrase: string) {
    const recovered = normalizeData(await restoreBackup(backup, backupPassphrase))
    setData(recovered)
    setPassphrase(backupPassphrase)
    setMode('arrival')
  }

  async function rotateVaultPassphrase(current: string, replacement: string) {
    await rotatePassphrase(data, current, replacement)
    setPassphrase(replacement)
  }

  return <main className="shell">
    <header className="topbar">
      <div><p className="eyebrow">INDIVIDUAL MISSION OPERATING SYSTEM</p><h1>iMOS</h1></div>
      <div className="topActions">
        <button className="utilityButton" onClick={() => setShowSecrets(true)}><KeyRound size={16} /> SECRETS</button>
        <button className="utilityButton" onClick={() => setShowDataPanel((value) => !value)}><LockKeyhole size={16} /> VAULT</button>
        <button className="utilityButton" onClick={lock}><Lock size={16} /> LOCK</button>
        <div className="secure"><ShieldCheck size={17} /> ENCRYPTED MODE</div>
      </div>
    </header>

    {showDataPanel && <section className="dataPanel panel">
      <div><p className="eyebrow">BUILD 005 VAULT CONTROL</p><h3>Encrypted. Recoverable. Controlled.</h3><p>Secrets, secure notes, recovery data, and operating context remain inside the encrypted personal vault.</p></div>
      <div className="dataActions">
        <button className="secondaryButton" onClick={() => void exportEncryptedVault()}><Download size={16} /> BACKUP</button>
        <button className="secondaryButton" onClick={() => setShowRecovery(true)}><ShieldCheck size={16} /> RECOVERY</button>
        <button className="dangerButton" onClick={reset}><RotateCcw size={16} /> ERASE</button>
      </div>
    </section>}

    {showSecrets && <SecretsConsole records={data.secrets ?? []} onChange={updateSecrets} onClose={() => setShowSecrets(false)} />}

    {showRecovery && <RecoveryConsole
      onClose={() => setShowRecovery(false)}
      onRestore={restoreVault}
      onRotate={rotateVaultPassphrase}
    />}

    <section className="statebar">{stateItems.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>

    <section className="workspace">
      <div className="primary panel">
        {mode === 'arrival' && <Arrival date={date} primary={primary} onBegin={() => setMode('brief')} />}
        {mode === 'brief' && <Brief data={data} onAddCommitment={addCommitment} onAddDecision={addDecision} onToggleCommitment={toggleCommitment} onToggleDecision={toggleDecision} onBegin={() => setMode('focus')} />}
        {mode === 'focus' && <FocusView primary={primary} onCompletePriority={completePriority} onComplete={() => setMode('reflection')} />}
        {mode === 'reflection' && <Reflection onSave={saveReflection} />}
      </div>
      <aside className="timeline panel">
        <div className="panelTitle"><Clock3 size={17} /><span>EXECUTIVE TIMELINE</span></div>
        {data.timeline.slice(0, 8).map((entry) => <TimelineItem key={entry.id} entry={entry} />)}
      </aside>
    </section>
  </main>
}

function RecoveryConsole({ onClose, onRestore, onRotate }: { onClose: () => void; onRestore: (backup: unknown, passphrase: string) => Promise<void>; onRotate: (current: string, replacement: string) => Promise<void> }) {
  const [action, setAction] = useState<RecoveryAction>(null)
  const [backup, setBackup] = useState<unknown>(null)
  const [fileName, setFileName] = useState('No backup selected')
  const [backupPassphrase, setBackupPassphrase] = useState('')
  const [currentPassphrase, setCurrentPassphrase] = useState('')
  const [newPassphrase, setNewPassphrase] = useState('')
  const [confirmPassphrase, setConfirmPassphrase] = useState('')
  const [working, setWorking] = useState(false)
  const [status, setStatus] = useState<RecoveryStatus>({ tone: 'neutral', title: 'Recovery ready', detail: 'Select an action to begin.' })
  const audit = getRecoveryAudit().slice(0, 4)

  async function selectBackup(file: File | undefined) {
    if (!file) return
    setStatus({ tone: 'neutral', title: 'Reading backup', detail: 'The file has not been trusted or decrypted.' })
    try {
      const parsed = JSON.parse(await file.text()) as unknown
      setBackup(parsed)
      setFileName(file.name)
      setStatus({ tone: 'neutral', title: 'Backup loaded', detail: 'Choose Verify or Test Recovery before restoration.' })
    } catch {
      setBackup(null)
      setFileName('No backup selected')
      setStatus({ tone: 'error', title: 'Backup rejected', detail: 'The selected file is not valid JSON.' })
    }
  }

  async function run(task: () => Promise<void>) {
    setWorking(true)
    try { await task() } catch (reason) {
      setStatus({ tone: 'error', title: 'Operation failed', detail: reason instanceof Error ? reason.message : 'The recovery operation failed closed.' })
    } finally { setWorking(false) }
  }

  async function verify() {
    if (!backup) throw new Error('Select an iMOS backup first.')
    const verified = await verifyBackupPackage(backup)
    setStatus({ tone: 'success', title: 'Backup verified', detail: `Created ${new Date(verified.createdAt).toLocaleString()}. Checksum and package controls passed.` })
  }

  async function test() {
    if (!backup) throw new Error('Select an iMOS backup first.')
    if (!backupPassphrase) throw new Error('Enter the backup passphrase.')
    const result = await testRecovery(backup, backupPassphrase)
    setStatus({ tone: 'success', title: 'Recovery test passed', detail: `${result.records} records decrypted and validated in memory. The active vault was not changed.` })
  }

  async function restore() {
    if (!backup) throw new Error('Select an iMOS backup first.')
    if (!backupPassphrase) throw new Error('Enter the backup passphrase.')
    if (!window.confirm('Replace the active vault with this verified backup?')) return
    await onRestore(backup, backupPassphrase)
    setStatus({ tone: 'success', title: 'Vault restored', detail: 'The active vault was replaced and reopened using the backup passphrase.' })
  }

  async function rotate() {
    if (newPassphrase.length < 12) throw new Error('The new passphrase must contain at least 12 characters.')
    if (newPassphrase !== confirmPassphrase) throw new Error('New passphrases do not match.')
    await onRotate(currentPassphrase, newPassphrase)
    setCurrentPassphrase('')
    setNewPassphrase('')
    setConfirmPassphrase('')
    setStatus({ tone: 'success', title: 'Passphrase rotated', detail: 'The vault was re encrypted and verified with new cryptographic material.' })
  }

  return <section className="recoveryConsole panel" aria-label="Secure Backup and Vault Recovery">
    <div className="recoveryHeader">
      <div><p className="eyebrow">BUILD 004 RECOVERY CONSOLE</p><h2>Secure Backup and Vault Recovery</h2><p>Every imported file remains untrusted until verification succeeds.</p></div>
      <button className="iconButton" onClick={onClose} aria-label="Close recovery console"><X size={18} /></button>
    </div>

    <div className={`recoveryStatus ${status.tone}`}><ShieldCheck size={20} /><div><strong>{status.title}</strong><p>{status.detail}</p></div></div>

    <div className="recoveryGrid">
      <label className="backupDrop"><Upload size={24} /><strong>SELECT .IMOS BACKUP</strong><span>{fileName}</span><input type="file" accept=".imos,application/json" onChange={(event) => void selectBackup(event.target.files?.[0])} /></label>
      <div className="recoveryActions">
        <button className={action === 'verify' ? '' : 'secondaryButton'} onClick={() => setAction('verify')}><FileCheck2 size={17} /> VERIFY BACKUP</button>
        <button className={action === 'test' ? '' : 'secondaryButton'} onClick={() => setAction('test')}><FlaskConical size={17} /> TEST RECOVERY</button>
        <button className={action === 'restore' ? '' : 'secondaryButton'} onClick={() => setAction('restore')}><Upload size={17} /> RESTORE VAULT</button>
        <button className={action === 'rotate' ? '' : 'secondaryButton'} onClick={() => setAction('rotate')}><KeyRound size={17} /> ROTATE PASSPHRASE</button>
      </div>
    </div>

    {action === 'verify' && <div className="recoveryOperation"><h3>Verify Backup</h3><p>Validate package format, version, KDF strength, and SHA 256 checksum.</p><button disabled={working} onClick={() => void run(verify)}>{working ? 'VERIFYING' : 'RUN VERIFICATION'}</button></div>}

    {(action === 'test' || action === 'restore') && <div className="recoveryOperation"><h3>{action === 'test' ? 'Test Recovery' : 'Restore Vault'}</h3><p>{action === 'test' ? 'Decrypt and validate the backup in memory without changing the active vault.' : 'Verify, decrypt, and replace the active vault as one controlled operation.'}</p><label>BACKUP PASSPHRASE<input type="password" value={backupPassphrase} onChange={(event) => setBackupPassphrase(event.target.value)} autoComplete="current-password" /></label><button disabled={working} onClick={() => void run(action === 'test' ? test : restore)}>{working ? 'WORKING' : action === 'test' ? 'RUN RECOVERY TEST' : 'RESTORE VERIFIED BACKUP'}</button></div>}

    {action === 'rotate' && <div className="recoveryOperation"><h3>Rotate Passphrase</h3><p>Authenticate the current passphrase. Re encrypt and verify the vault before committing the replacement.</p><div className="rotationGrid"><label>CURRENT PASSPHRASE<input type="password" value={currentPassphrase} onChange={(event) => setCurrentPassphrase(event.target.value)} autoComplete="current-password" /></label><label>NEW PASSPHRASE<input type="password" minLength={12} value={newPassphrase} onChange={(event) => setNewPassphrase(event.target.value)} autoComplete="new-password" /></label><label>CONFIRM NEW PASSPHRASE<input type="password" minLength={12} value={confirmPassphrase} onChange={(event) => setConfirmPassphrase(event.target.value)} autoComplete="new-password" /></label></div><button disabled={working} onClick={() => void run(rotate)}>{working ? 'ROTATING' : 'ROTATE AND VERIFY'}</button></div>}

    <div className="recoveryAudit"><p className="eyebrow">RECENT RECOVERY ACTIVITY</p>{audit.length === 0 ? <p>No recovery events recorded.</p> : audit.map((event) => <div key={event.id}><span>{new Date(event.createdAt).toLocaleString()}</span><strong>{event.type.replaceAll('-', ' ')}</strong><p>{event.detail}</p></div>)}</div>
  </section>
}

function VaultGate({ state, error, onCreate, onUnlock }: { state: 'setup' | 'locked'; error: string; onCreate: (passphrase: string) => Promise<void>; onUnlock: (passphrase: string) => Promise<void> }) {
  const [first, setFirst] = useState('')
  const [confirm, setConfirm] = useState('')
  const [working, setWorking] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (state === 'setup' && first !== confirm) return
    setWorking(true)
    try { state === 'setup' ? await onCreate(first) : await onUnlock(first) } finally { setWorking(false) }
  }

  return <main className="vaultShell"><section className="vaultCard panel"><div className="vaultIcon">{state === 'setup' ? <LockKeyhole size={30} /> : <Lock size={30} />}</div><p className="eyebrow">iMOS ENCRYPTED PERSONAL VAULT</p><h1>{state === 'setup' ? 'Create your vault.' : 'Vault locked.'}</h1><p className="lead">{state === 'setup' ? 'Choose a strong passphrase. iMOS cannot recover it if it is lost.' : 'Enter your passphrase to restore your private operating context.'}</p><form className="vaultForm" onSubmit={submit}><label>PASSPHRASE<input autoFocus type="password" minLength={12} required value={first} onChange={(event) => setFirst(event.target.value)} autoComplete={state === 'setup' ? 'new-password' : 'current-password'} /></label>{state === 'setup' && <label>CONFIRM PASSPHRASE<input type="password" minLength={12} required value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" /></label>}{state === 'setup' && confirm && first !== confirm && <p className="formError">Passphrases do not match.</p>}{error && <p className="formError">{error}</p>}<button disabled={working || (state === 'setup' && first !== confirm)}>{state === 'setup' ? <LockKeyhole size={17} /> : <KeyRound size={17} />}{working ? 'WORKING' : state === 'setup' ? 'CREATE VAULT' : 'UNLOCK VAULT'}</button></form><p className="vaultNotice">AES GCM encryption. PBKDF2 SHA 256. Local browser storage only. No ARGUS connection.</p></section></main>
}

function Arrival({ date, primary, onBegin }: { date: string; primary?: PersonalData['priorities'][number]; onBegin: () => void }) {
  return <div className="hero"><p className="eyebrow">{date.toUpperCase()}</p><h2>Good morning, Rob.</h2><p className="lead">Your private operating context is unlocked and ready.</p><div className="rosie"><Sparkles size={18} /><div><strong>ROSIE</strong><p>{primary ? `I recommend beginning with ${primary.title}. ${primary.why}` : 'Your current priorities are complete. We can review commitments and decisions before choosing the next mission.'}</p></div></div><button onClick={onBegin}>BEGIN <ArrowRight size={17} /></button></div>
}

function Brief({ data, onAddCommitment, onAddDecision, onToggleCommitment, onToggleDecision, onBegin }: { data: PersonalData; onAddCommitment: (title: string, due: string) => void; onAddDecision: (title: string, context: string) => void; onToggleCommitment: (id: string) => void; onToggleDecision: (id: string) => void; onBegin: () => void }) {
  const [capture, setCapture] = useState<'commitment' | 'decision' | null>(null)
  const commitments = data.commitments.filter((item) => item.status === 'open').slice(0, 3)
  const decisions = data.decisions.filter((item) => item.status === 'open').slice(0, 3)
  const primary = data.priorities.find((item) => !item.completed)
  return <div><p className="eyebrow">MORNING EXECUTIVE BRIEF</p><h2>Where we stand.</h2><div className="cards"><BriefCard label="PRIMARY MISSION" value={primary?.title ?? 'Define the next mission'} /><BriefCard label="COMMITMENTS" value={commitments.length ? `${commitments.length} require attention` : 'No critical risk'} /><BriefCard label="DECISIONS" value={decisions.length ? `${decisions.length} awaiting judgment` : 'No open decisions'} /><BriefCard label="SECRETS" value={`${data.secrets?.length ?? 0} encrypted records`} /></div><div className="recordGrid"><RecordList title="OPEN COMMITMENTS" items={commitments.map((item) => ({ id: item.id, title: item.title, meta: item.due || 'No due date' }))} onToggle={onToggleCommitment} /><RecordList title="OPEN DECISIONS" items={decisions.map((item) => ({ id: item.id, title: item.title, meta: item.context || 'No context added' }))} onToggle={onToggleDecision} /></div><div className="captureActions"><button className="secondaryButton" onClick={() => setCapture('commitment')}><Plus size={16} /> COMMITMENT</button><button className="secondaryButton" onClick={() => setCapture('decision')}><Plus size={16} /> DECISION</button></div>{capture === 'commitment' && <CommitmentForm onSave={(title, due) => { onAddCommitment(title, due); setCapture(null) }} onCancel={() => setCapture(null)} />}{capture === 'decision' && <DecisionForm onSave={(title, context) => { onAddDecision(title, context); setCapture(null) }} onCancel={() => setCapture(null)} />}<div className="recommendation"><strong>Rosie's recommendation</strong><p>Begin with one active priority. Your updates and secrets will be re encrypted automatically.</p></div><button onClick={onBegin}>ENTER FOCUS MODE <Focus size={17} /></button></div>
}

function FocusView({ primary, onCompletePriority, onComplete }: { primary?: PersonalData['priorities'][number]; onCompletePriority: () => void; onComplete: () => void }) {
  return <div><p className="eyebrow">FOCUS MODE</p><h2>{primary?.title ?? 'Define the next mission.'}</h2><p className="lead">One outcome. No unrelated information.</p><div className="focusGrid"><BriefCard label="OUTCOME" value={primary?.title ?? 'Create one clear outcome'} /><BriefCard label="WHY IT MATTERS" value={primary?.why ?? 'Direction must be established before execution.'} /><BriefCard label="DATA BOUNDARY" value="Encrypted local vault" /><BriefCard label="AUTOFILL" value="Disabled by design" /></div><div className="captureActions">{primary && <button className="secondaryButton" onClick={onCompletePriority}><CheckCircle2 size={17} /> MARK PRIORITY COMPLETE</button>}<button onClick={onComplete}>COMPLETE SESSION <ArrowRight size={17} /></button></div></div>
}

function Reflection({ onSave }: { onSave: (accomplished: string, remember: string, tomorrow: string) => void }) {
  const [accomplished, setAccomplished] = useState(''); const [remember, setRemember] = useState(''); const [tomorrow, setTomorrow] = useState('')
  return <div><p className="eyebrow">EXECUTIVE REFLECTION</p><h2>Close the loop.</h2><form className="reflectionForm" onSubmit={(event) => { event.preventDefault(); onSave(accomplished.trim(), remember.trim(), tomorrow.trim()) }}><label>WHAT DID WE ACCOMPLISH?<textarea value={accomplished} onChange={(event) => setAccomplished(event.target.value)} /></label><label>WHAT SHOULD ROSIE REMEMBER?<textarea value={remember} onChange={(event) => setRemember(event.target.value)} /></label><label>WHAT SHOULD HAPPEN TOMORROW?<textarea value={tomorrow} onChange={(event) => setTomorrow(event.target.value)} /></label><button type="submit">SAVE REFLECTION <CheckCircle2 size={17} /></button></form></div>
}

function CommitmentForm({ onSave, onCancel }: { onSave: (title: string, due: string) => void; onCancel: () => void }) { const [title, setTitle] = useState(''); const [due, setDue] = useState(''); return <form className="captureForm" onSubmit={(event) => { event.preventDefault(); if (title.trim()) onSave(title.trim(), due) }}><label>COMMITMENT<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>DUE<input type="date" value={due} onChange={(event) => setDue(event.target.value)} /></label><div className="captureActions"><button>SAVE</button><button type="button" className="secondaryButton" onClick={onCancel}>CANCEL</button></div></form> }
function DecisionForm({ onSave, onCancel }: { onSave: (title: string, context: string) => void; onCancel: () => void }) { const [title, setTitle] = useState(''); const [context, setContext] = useState(''); return <form className="captureForm" onSubmit={(event) => { event.preventDefault(); if (title.trim()) onSave(title.trim(), context.trim()) }}><label>DECISION<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>CONTEXT<textarea value={context} onChange={(event) => setContext(event.target.value)} /></label><div className="captureActions"><button>SAVE</button><button type="button" className="secondaryButton" onClick={onCancel}>CANCEL</button></div></form> }
function RecordList({ title, items, onToggle }: { title: string; items: { id: string; title: string; meta: string }[]; onToggle: (id: string) => void }) { return <section className="recordList"><p className="eyebrow">{title}</p>{items.length === 0 && <p className="emptyState">Nothing requires attention.</p>}{items.map((item) => <button key={item.id} className="recordRow" onClick={() => onToggle(item.id)}><span><strong>{item.title}</strong><small>{item.meta}</small></span><CheckCircle2 size={17} /></button>)}</section> }
function BriefCard({ label, value }: { label: string; value: string }) { return <div className="briefCard"><span>{label}</span><strong>{value}</strong></div> }
function TimelineItem({ entry }: { entry: TimelineEntry }) { const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(entry.createdAt)); return <div className="timelineItem"><span className="time">{time}</span><div><strong>{entry.title}</strong><p>{entry.detail}</p></div></div> }
