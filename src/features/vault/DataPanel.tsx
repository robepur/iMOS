import { Download, RotateCcw, ShieldCheck } from 'lucide-react'

type Props = {
  onClose: () => void
  onOpenRecovery: () => void
  onReset: () => void
  onBackup: () => Promise<void>
}

export default function DataPanel({ onClose, onOpenRecovery, onReset, onBackup }: Props) {
  return (
    <section className="dataPanel panel" aria-label="Vault Control">
      <div>
        <p className="eyebrow">VAULT CONTROL</p>
        <h3>Encrypted. Recoverable. Controlled.</h3>
        <p>All operator data remains inside the encrypted personal vault.</p>
      </div>
      <div className="dataActions">
        <button className="secondaryButton" onClick={() => void onBackup()}>
          <Download size={16} /> BACKUP
        </button>
        <button className="secondaryButton" onClick={() => { onClose(); onOpenRecovery() }}>
          <ShieldCheck size={16} /> RECOVERY
        </button>
        <button className="dangerButton" onClick={onReset}>
          <RotateCcw size={16} /> ERASE
        </button>
      </div>
    </section>
  )
}
