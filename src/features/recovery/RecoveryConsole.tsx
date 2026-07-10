import { useState } from 'react'
import { FileCheck2, FlaskConical, KeyRound, ShieldCheck, Upload, X } from 'lucide-react'
import { getRecoveryAudit, restoreBackup, rotatePassphrase, testRecovery, verifyBackupPackage } from '../../vault'

type RecoveryAction = 'verify' | 'test' | 'restore' | 'rotate' | null
type RecoveryStatus = { tone: 'success' | 'error' | 'neutral'; title: string; detail: string }

export default function RecoveryConsole({ onClose, onRestore, onRotate }: {
  onClose: () => void
  onRestore: (backup: unknown, passphrase: string) => Promise<void>
  onRotate: (current: string, replacement: string) => Promise<void>
}) {
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

  async function testRec() {
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

  return (
    <section className="recoveryConsole panel" aria-label="Secure Backup and Vault Recovery">
      <div className="recoveryHeader">
        <div>
          <p className="eyebrow">BUILD 004 RECOVERY CONSOLE</p>
          <h2>Secure Backup and Vault Recovery</h2>
          <p>Every imported file remains untrusted until verification succeeds.</p>
        </div>
        <button className="iconButton" onClick={onClose} aria-label="Close recovery console"><X size={18} /></button>
      </div>

      <div className={`recoveryStatus ${status.tone}`}>
        <ShieldCheck size={20} />
        <div><strong>{status.title}</strong><p>{status.detail}</p></div>
      </div>

      <div className="recoveryGrid">
        <label className="backupDrop">
          <Upload size={24} /><strong>SELECT .IMOS BACKUP</strong><span>{fileName}</span>
          <input type="file" accept=".imos,application/json" onChange={(e) => void selectBackup(e.target.files?.[0])} />
        </label>
        <div className="recoveryActions">
          <button className={action === 'verify' ? '' : 'secondaryButton'} onClick={() => setAction('verify')}><FileCheck2 size={17} /> VERIFY BACKUP</button>
          <button className={action === 'test' ? '' : 'secondaryButton'} onClick={() => setAction('test')}><FlaskConical size={17} /> TEST RECOVERY</button>
          <button className={action === 'restore' ? '' : 'secondaryButton'} onClick={() => setAction('restore')}><Upload size={17} /> RESTORE VAULT</button>
          <button className={action === 'rotate' ? '' : 'secondaryButton'} onClick={() => setAction('rotate')}><KeyRound size={17} /> ROTATE PASSPHRASE</button>
        </div>
      </div>

      {action === 'verify' && (
        <div className="recoveryOperation">
          <h3>Verify Backup</h3>
          <p>Validate package format, version, KDF strength, and SHA 256 checksum.</p>
          <button disabled={working} onClick={() => void run(verify)}>{working ? 'VERIFYING' : 'RUN VERIFICATION'}</button>
        </div>
      )}

      {(action === 'test' || action === 'restore') && (
        <div className="recoveryOperation">
          <h3>{action === 'test' ? 'Test Recovery' : 'Restore Vault'}</h3>
          <p>{action === 'test' ? 'Decrypt and validate the backup in memory without changing the active vault.' : 'Verify, decrypt, and replace the active vault as one controlled operation.'}</p>
          <label>BACKUP PASSPHRASE<input type="password" value={backupPassphrase} onChange={(e) => setBackupPassphrase(e.target.value)} autoComplete="current-password" /></label>
          <button disabled={working} onClick={() => void run(action === 'test' ? testRec : restore)}>
            {working ? 'WORKING' : action === 'test' ? 'RUN RECOVERY TEST' : 'RESTORE VERIFIED BACKUP'}
          </button>
        </div>
      )}

      {action === 'rotate' && (
        <div className="recoveryOperation">
          <h3>Rotate Passphrase</h3>
          <p>Authenticate the current passphrase. Re encrypt and verify the vault before committing the replacement.</p>
          <div className="rotationGrid">
            <label>CURRENT PASSPHRASE<input type="password" value={currentPassphrase} onChange={(e) => setCurrentPassphrase(e.target.value)} autoComplete="current-password" /></label>
            <label>NEW PASSPHRASE<input type="password" minLength={12} value={newPassphrase} onChange={(e) => setNewPassphrase(e.target.value)} autoComplete="new-password" /></label>
            <label>CONFIRM NEW PASSPHRASE<input type="password" minLength={12} value={confirmPassphrase} onChange={(e) => setConfirmPassphrase(e.target.value)} autoComplete="new-password" /></label>
          </div>
          <button disabled={working} onClick={() => void run(rotate)}>{working ? 'ROTATING' : 'ROTATE AND VERIFY'}</button>
        </div>
      )}

      <div className="recoveryAudit">
        <p className="eyebrow">RECENT RECOVERY ACTIVITY</p>
        {audit.length === 0
          ? <p>No recovery events recorded.</p>
          : audit.map((event) => (
              <div key={event.id}>
                <span>{new Date(event.createdAt).toLocaleString()}</span>
                <strong>{event.type.replaceAll('-', ' ')}</strong>
                <p>{event.detail}</p>
              </div>
            ))
        }
      </div>
    </section>
  )
}


