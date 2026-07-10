import { FormEvent, useState } from 'react'
import { KeyRound, Lock, LockKeyhole } from 'lucide-react'

export default function VaultGate({ state, error, onCreate, onUnlock }: {
  state: 'setup' | 'locked'
  error: string
  onCreate: (passphrase: string) => Promise<void>
  onUnlock: (passphrase: string) => Promise<void>
}) {
  const [first, setFirst] = useState('')
  const [confirm, setConfirm] = useState('')
  const [working, setWorking] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (state === 'setup' && first !== confirm) return
    setWorking(true)
    try { state === 'setup' ? await onCreate(first) : await onUnlock(first) } finally { setWorking(false) }
  }

  return (
    <main className="vaultShell">
      <section className="vaultCard panel">
        <div className="vaultIcon">{state === 'setup' ? <LockKeyhole size={30} /> : <Lock size={30} />}</div>
        <p className="eyebrow">iMOS ENCRYPTED PERSONAL VAULT</p>
        <h1>{state === 'setup' ? 'Create your vault.' : 'Vault locked.'}</h1>
        <p className="lead">
          {state === 'setup'
            ? 'Choose a strong passphrase. iMOS cannot recover it if it is lost.'
            : 'Enter your passphrase to restore your private operating context.'}
        </p>
        <form className="vaultForm" onSubmit={submit}>
          <label>
            PASSPHRASE
            <input
              autoFocus
              type="password"
              minLength={12}
              required
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              autoComplete={state === 'setup' ? 'new-password' : 'current-password'}
            />
          </label>
          {state === 'setup' && (
            <label>
              CONFIRM PASSPHRASE
              <input
                type="password"
                minLength={12}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </label>
          )}
          {state === 'setup' && confirm && first !== confirm && (
            <p className="formError">Passphrases do not match.</p>
          )}
          {error && <p className="formError">{error}</p>}
          <button disabled={working || (state === 'setup' && first !== confirm)}>
            {state === 'setup' ? <LockKeyhole size={17} /> : <KeyRound size={17} />}
            {working ? 'WORKING' : state === 'setup' ? 'CREATE VAULT' : 'UNLOCK VAULT'}
          </button>
        </form>
        <p className="vaultNotice">AES GCM encryption. PBKDF2 SHA 256. Local browser storage only. No ARGUS connection.</p>
      </section>
    </main>
  )
}

