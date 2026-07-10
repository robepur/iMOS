import { useState } from 'react'
import { BrainCircuit, CheckCircle2, ChevronDown, ChevronUp, ShieldAlert, XCircle } from 'lucide-react'
import type {
  CognitionConsent,
  CognitionDataCategory,
  CognitionFeatureSurface,
} from '../../types/cognitive'
import {
  enableCognition,
  disableCognition,
  revokeCognition,
  resetCognition,
  updateCognitionPermissions,
} from '../../services/CognitionConsentService'
import {
  COGNITION_DATA_CATEGORY_LABELS,
  COGNITION_FEATURE_SURFACE_LABELS,
} from '../../constants'

const ALL_CATEGORIES: CognitionDataCategory[] = [
  'priorities', 'commitments', 'decisions', 'reflections',
  'review_history', 'understanding_history', 'missions',
  'recommendation_outcomes', 'preferences',
]

const ALL_SURFACES: CognitionFeatureSurface[] = [
  'briefing', 'review', 'missions', 'recommendations', 'understanding_dashboard',
]

type Props = {
  consent: CognitionConsent
  onUpdate: (updated: CognitionConsent) => void
  onClose: () => void
}

export default function CognitionConsentPanel({ consent, onUpdate, onClose }: Props) {
  const [showAudit, setShowAudit] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [categories, setCategories] = useState<CognitionDataCategory[]>(consent.permittedDataCategories)
  const [surfaces, setSurfaces] = useState<CognitionFeatureSurface[]>(consent.permittedFeatureSurfaces)

  function handleEnable() {
    onUpdate(enableCognition(consent, categories, surfaces))
  }

  function handleDisable() {
    onUpdate(disableCognition(consent))
  }

  function handleRevoke() {
    if (!confirmRevoke) { setConfirmRevoke(true); return }
    onUpdate(revokeCognition(consent))
    setConfirmRevoke(false)
  }

  function handleReset() {
    if (!confirmReset) { setConfirmReset(true); return }
    onUpdate(resetCognition(consent))
    setConfirmReset(false)
    setCategories([])
    setSurfaces([])
  }

  function handleUpdatePermissions() {
    if (consent.status !== 'on') return
    onUpdate(updateCognitionPermissions(consent, categories, surfaces))
  }

  function toggleCategory(cat: CognitionDataCategory) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  function toggleSurface(surf: CognitionFeatureSurface) {
    setSurfaces((prev) =>
      prev.includes(surf) ? prev.filter((s) => s !== surf) : [...prev, surf]
    )
  }

  const isOff = consent.status === 'off'
  const isOn = consent.status === 'on'
  const isRevoked = consent.status === 'revoked'

  return (
    <section className="recoveryConsole panel" aria-label="Cognition Consent">
      <div className="recoveryHeader">
        <div>
          <p className="eyebrow">COGNITION CONSENT</p>
          <h2>Rosie Cognitive Learning</h2>
          <p>
            Control how Rosie may observe your local encrypted records to improve
            planning, briefing, and review support. All analysis is local only.
            No data leaves your device.
          </p>
        </div>
        <button className="iconButton" onClick={onClose} aria-label="Close cognition consent panel">
          <XCircle size={20} />
        </button>
      </div>

      {/* Status */}
      <div style={{ margin: '22px 0', padding: '18px', border: '1px solid rgba(255,255,255,.1)', background: 'rgba(0,0,0,.16)' }}>
        <p className="eyebrow">CURRENT STATUS</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          {isOn && <><CheckCircle2 size={18} color="#4caf74" /><strong style={{ color: '#4caf74' }}>ENABLED</strong></>}
          {isOff && <><BrainCircuit size={18} color="#8fa5b9" /><strong style={{ color: '#8fa5b9' }}>OFF</strong></>}
          {isRevoked && <><ShieldAlert size={18} color="#f0b4b2" /><strong style={{ color: '#f0b4b2' }}>REVOKED</strong></>}
          <span style={{ color: '#8fa5b9', fontSize: 12, marginLeft: 8 }}>Version {consent.version}</span>
        </div>
        {isOn && consent.grantedAt && (
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#8fa5b9' }}>
            Enabled: {new Date(consent.grantedAt).toLocaleString()}
          </p>
        )}
        {isRevoked && consent.revokedAt && (
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#f0b4b2' }}>
            Revoked: {new Date(consent.revokedAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Purpose */}
      <div style={{ margin: '0 0 22px', padding: '18px', border: '1px solid rgba(255,255,255,.1)', background: 'rgba(0,0,0,.12)' }}>
        <p className="eyebrow">PURPOSE</p>
        <p style={{ margin: '10px 0 0', color: '#b8c4cf', lineHeight: 1.6, fontSize: 14 }}>{consent.purpose}</p>
      </div>

      {/* Permitted data categories */}
      {!isRevoked && (
        <div style={{ margin: '0 0 22px' }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>PERMITTED DATA CATEGORIES</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {ALL_CATEGORIES.map((cat) => (
              <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.03)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={categories.includes(cat)}
                  onChange={() => toggleCategory(cat)}
                  aria-label={COGNITION_DATA_CATEGORY_LABELS[cat]}
                  disabled={isRevoked}
                />
                <span style={{ fontSize: 13 }}>{COGNITION_DATA_CATEGORY_LABELS[cat]}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Permitted feature surfaces */}
      {!isRevoked && (
        <div style={{ margin: '0 0 22px' }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>PERMITTED FEATURE SURFACES</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {ALL_SURFACES.map((surf) => (
              <label key={surf} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.03)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={surfaces.includes(surf)}
                  onChange={() => toggleSurface(surf)}
                  aria-label={COGNITION_FEATURE_SURFACE_LABELS[surf]}
                  disabled={isRevoked}
                />
                <span style={{ fontSize: 13 }}>{COGNITION_FEATURE_SURFACE_LABELS[surf]}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
        {isOff && (
          <button onClick={handleEnable}>
            <BrainCircuit size={16} /> ENABLE COGNITION
          </button>
        )}
        {isOn && (
          <>
            <button className="secondaryButton" onClick={handleUpdatePermissions}>
              SAVE PERMISSIONS
            </button>
            <button className="dangerButton" onClick={handleDisable}>
              DISABLE COGNITION
            </button>
          </>
        )}
        {!isRevoked && (
          <button className="dangerButton" onClick={handleRevoke}>
            {confirmRevoke ? 'CONFIRM REVOKE' : 'REVOKE CONSENT'}
          </button>
        )}
        {confirmRevoke && (
          <button className="secondaryButton" onClick={() => setConfirmRevoke(false)}>
            CANCEL
          </button>
        )}
        <button className="dangerButton" onClick={handleReset}>
          {confirmReset ? 'CONFIRM RESET' : 'RESET CONSENT'}
        </button>
        {confirmReset && (
          <button className="secondaryButton" onClick={() => setConfirmReset(false)}>
            CANCEL
          </button>
        )}
      </div>

      {isRevoked && (
        <div style={{ padding: '16px', background: 'rgba(104,15,14,.12)', border: '1px solid #8f2c2a', marginBottom: 22 }}>
          <p style={{ margin: 0, color: '#f0b4b2', fontSize: 13, lineHeight: 1.6 }}>
            Cognition consent has been revoked. Reset consent to restore access.
          </p>
        </div>
      )}

      {/* Audit history */}
      <div>
        <button
          className="secondaryButton"
          onClick={() => setShowAudit((v) => !v)}
          aria-expanded={showAudit}
          style={{ marginBottom: showAudit ? 12 : 0 }}
        >
          {showAudit ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          AUDIT HISTORY ({consent.auditHistory.length})
        </button>

        {showAudit && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
            {consent.auditHistory.length === 0 && (
              <p className="emptyState" style={{ padding: '14px 0' }}>No consent changes recorded yet.</p>
            )}
            {[...consent.auditHistory].reverse().map((event) => (
              <div
                key={event.id}
                style={{ padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}
              >
                <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
                  <strong style={{ fontSize: 12, letterSpacing: '.1em', color: '#c5a253' }}>{event.action.toUpperCase()}</strong>
                  <span style={{ fontSize: 11, color: '#8fa5b9' }}>{new Date(event.timestamp).toLocaleString()}</span>
                </div>
                <p style={{ margin: '5px 0 0', fontSize: 12, color: '#8396a8', lineHeight: 1.45 }}>{event.detail}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
