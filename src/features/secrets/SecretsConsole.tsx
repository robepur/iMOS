import { FormEvent, useMemo, useState } from 'react'
import { Clipboard, Eye, EyeOff, KeyRound, Plus, Search, Star, Trash2, X } from 'lucide-react'
import type { SecretRecord } from '../../localData'

const CLIPBOARD_CLEAR_MS = 30_000

type Props = {
  records: SecretRecord[]
  onChange: (records: SecretRecord[], event: string, detail: string) => void
  onClose: () => void
}

export default function SecretsConsole({ records, onChange, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [editing, setEditing] = useState<SecretRecord | null>(null)
  const [revealed, setRevealed] = useState<string | null>(null)
  const [status, setStatus] = useState('Secrets remain encrypted inside the active iMOS vault.')

  const categories = useMemo(() => ['All', ...Array.from(new Set(records.map((item) => item.category).filter(Boolean))).sort()], [records])
  const filtered = useMemo(() => records.filter((item) => {
    const matchesCategory = category === 'All' || item.category === category
    const haystack = `${item.title} ${item.username} ${item.url} ${item.category} ${item.notes}`.toLowerCase()
    return matchesCategory && haystack.includes(query.trim().toLowerCase())
  }), [records, query, category])

  function save(record: SecretRecord) {
    const exists = records.some((item) => item.id === record.id)
    const next = exists ? records.map((item) => item.id === record.id ? record : item) : [record, ...records]
    onChange(next, exists ? 'Secret updated' : 'Secret created', record.title)
    setEditing(null)
    setStatus(`${record.title} secured in the encrypted vault.`)
  }

  function remove(record: SecretRecord) {
    if (!window.confirm(`Delete ${record.title}? This action is permanent after the vault saves.`)) return
    onChange(records.filter((item) => item.id !== record.id), 'Secret deleted', record.title)
    setStatus(`${record.title} deleted.`)
  }

  function reveal(record: SecretRecord) {
    setRevealed((current) => current === record.id ? null : record.id)
    onChange(records.map((item) => item.id === record.id ? { ...item, lastAccessedAt: new Date().toISOString() } : item), 'Secret accessed', record.title)
  }

  async function copy(record: SecretRecord, value: string, field: string) {
    await navigator.clipboard.writeText(value)
    onChange(records.map((item) => item.id === record.id ? { ...item, lastAccessedAt: new Date().toISOString() } : item), 'Secret copied', `${record.title}: ${field}`)
    setStatus(`${field} copied. Clipboard clears in 30 seconds.`)
    window.setTimeout(async () => {
      try {
        if (await navigator.clipboard.readText() === value) await navigator.clipboard.writeText('')
      } catch {
        // Browsers may deny clipboard reads after the initiating gesture.
      }
    }, CLIPBOARD_CLEAR_MS)
  }

  return <section className="secretsConsole panel" aria-label="Secure Secrets and Credential Management">
    <div className="recoveryHeader">
      <div><p className="eyebrow">BUILD 005 SECRETS CONSOLE</p><h2>Secure Secrets and Credentials</h2><p>Search and use encrypted credentials only while the vault is unlocked.</p></div>
      <button className="iconButton" onClick={onClose} aria-label="Close secrets console"><X size={18} /></button>
    </div>

    <div className="secretsToolbar">
      <label className="secretSearch"><Search size={17} /><input aria-label="Search secrets" placeholder="Search credentials and secure notes" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <select aria-label="Filter category" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select>
      <button onClick={() => setEditing(emptyRecord())}><Plus size={17} /> NEW SECRET</button>
    </div>

    <div className="secretStatus"><KeyRound size={17} /><span>{status}</span></div>

    <div className="secretGrid">
      {filtered.length === 0 && <div className="secretEmpty"><KeyRound size={28} /><strong>No secrets found.</strong><p>Create the first encrypted credential or secure note.</p></div>}
      {filtered.map((record) => <article className="secretCard" key={record.id}>
        <div className="secretCardHeader"><div><span>{record.category || 'Uncategorized'}</span><h3>{record.title}</h3></div><button className="iconButton" aria-label="Toggle favorite" onClick={() => onChange(records.map((item) => item.id === record.id ? { ...item, favorite: !item.favorite, updatedAt: new Date().toISOString() } : item), 'Secret updated', record.title)}><Star size={17} fill={record.favorite ? 'currentColor' : 'none'} /></button></div>
        {record.username && <div className="secretField"><span>USERNAME</span><strong>{record.username}</strong><button className="iconButton" onClick={() => void copy(record, record.username, 'Username')}><Clipboard size={16} /></button></div>}
        {record.password && <div className="secretField"><span>PASSWORD</span><strong>{revealed === record.id ? record.password : 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢'}</strong><div><button className="iconButton" onClick={() => reveal(record)}>{revealed === record.id ? <EyeOff size={16} /> : <Eye size={16} />}</button><button className="iconButton" onClick={() => void copy(record, record.password, 'Password')}><Clipboard size={16} /></button></div></div>}
        {record.url && <p className="secretMeta">{record.url}</p>}
        {record.notes && <p className="secretNotes">{record.notes}</p>}
        <div className="secretCardActions"><button className="secondaryButton" onClick={() => setEditing(record)}>EDIT</button><button className="dangerButton" onClick={() => remove(record)}><Trash2 size={15} /> DELETE</button></div>
      </article>)}
    </div>

    {editing && <SecretEditor record={editing} onCancel={() => setEditing(null)} onSave={save} />}
  </section>
}

function emptyRecord(): SecretRecord {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), title: '', category: 'General', username: '', password: '', url: '', notes: '', favorite: false, createdAt: now, updatedAt: now }
}

function SecretEditor({ record, onCancel, onSave }: { record: SecretRecord; onCancel: () => void; onSave: (record: SecretRecord) => void }) {
  const [draft, setDraft] = useState(record)
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft.title.trim()) return
    onSave({ ...draft, title: draft.title.trim(), category: draft.category.trim() || 'General', updatedAt: new Date().toISOString() })
  }
  return <div className="secretEditorBackdrop"><form className="secretEditor panel" onSubmit={submit}>
    <div className="recoveryHeader"><div><p className="eyebrow">ENCRYPTED RECORD</p><h3>{record.title ? 'Edit secret' : 'Create secret'}</h3></div><button type="button" className="iconButton" onClick={onCancel}><X size={18} /></button></div>
    <div className="rotationGrid">
      <label>TITLE<input autoFocus required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <label>CATEGORY<input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label>
      <label>USERNAME<input value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} autoComplete="off" /></label>
      <label>PASSWORD<input type="password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} autoComplete="new-password" /></label>
      <label>URL<input value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} /></label>
    </div>
    <label>SECURE NOTES<textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
    <div className="captureActions"><button type="submit">SAVE ENCRYPTED RECORD</button><button type="button" className="secondaryButton" onClick={onCancel}>CANCEL</button></div>
  </form></div>
}

