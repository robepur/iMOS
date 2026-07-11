import type { CognitionConsent } from '../../types/cognitive'
import type { PresentationOverride, PresentationProfile } from '../../types/presentation'
import type { AdaptationSettingKey } from '../../types/presentation'

const SETTING_OPTIONS: { value: AdaptationSettingKey; label: string; values: string[] }[] = [
  { value: 'summaryDetailMode', label: 'Summary Detail Mode', values: ['summary_first', 'balanced', 'detail_first'] },
  { value: 'informationDensity', label: 'Information Density', values: ['low', 'standard', 'high'] },
  { value: 'evidenceDepth', label: 'Evidence Depth', values: ['collapsed', 'standard', 'expanded'] },
  { value: 'planningSequenceMode', label: 'Planning Sequence', values: ['sequential', 'milestone_first', 'dependency_first'] },
  { value: 'reviewTimingMode', label: 'Review Timing', values: ['neutral', 'morning', 'midday', 'evening'] },
]

type Props = {
  consent: CognitionConsent
  enabled: boolean
  profile: PresentationProfile
  overrides: PresentationOverride[]
  onEnableChanged: (enabled: boolean) => void
  onOverrideChanged: (setting: AdaptationSettingKey, value: string) => void
  onOverrideRemoved: (overrideId: string) => void
  onRestoreNeutral: () => void
  onClose: () => void
}

export function PersonalizationControlCenter({
  consent,
  enabled,
  profile,
  overrides,
  onEnableChanged,
  onOverrideChanged,
  onOverrideRemoved,
  onRestoreNeutral,
  onClose,
}: Props) {
  const blocked = consent.status !== 'on'
  return (
    <section className="recoveryConsole panel" aria-label="Personalization Control Center">
      <div className="recoveryHeader">
        <div>
          <p className="eyebrow">ADAPTIVE PRESENTATION</p>
          <h2>Personalization Control Center</h2>
          <p>Presentation-only adaptation with explicit operator control and reversible overrides.</p>
        </div>
        <button className="iconButton" onClick={onClose} aria-label="Close personalization control center">✕</button>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            checked={enabled}
            disabled={blocked}
            onChange={(event) => onEnableChanged(event.target.checked)}
            aria-label="Enable adaptive presentation"
          />
          <strong>{enabled ? 'Adaptive presentation enabled' : 'Adaptive presentation disabled'}</strong>
        </label>
        {blocked && <p className="dashRecent">Consent is not enabled for cognition surfaces.</p>}
        <p className="dashRecent">{profile.validationState === 'adaptive' ? 'Personalized profile is active.' : 'Neutral profile is active.'}</p>
      </div>

      <div className="dashSection" style={{ marginBottom: 16 }}>
        <p className="eyebrow">ACTIVE ADAPTATIONS ({profile.activeAdaptations.length})</p>
        {profile.activeAdaptations.length === 0 && <p className="emptyState">No active adaptations.</p>}
        {profile.activeAdaptations.map((item) => (
          <div key={item.adaptationId} className="memoryItem">
            <p><strong>{item.setting}</strong>: {item.value}</p>
            <span className="memoryDate">From understanding {item.sourceUnderstandingId}</span>
          </div>
        ))}
      </div>

      <div className="dashSection" style={{ marginBottom: 16 }}>
        <p className="eyebrow">OPERATOR OVERRIDES</p>
        {SETTING_OPTIONS.map((option) => (
          <label key={option.value} className="mission-label">
            {option.label}
            <select
              value={overrides.find((o) => o.setting === option.value)?.value ?? ''}
              onChange={(event) => {
                if (!event.target.value) return
                onOverrideChanged(option.value, event.target.value)
              }}
              aria-label={option.label}
            >
              <option value="">No override</option>
              {option.values.map((candidate) => <option key={candidate} value={candidate}>{candidate}</option>)}
            </select>
          </label>
        ))}
        {overrides.length > 0 && (
          <div className="captureActions">
            {overrides.map((override) => (
              <button key={override.id} className="secondaryButton" onClick={() => onOverrideRemoved(override.id)}>
                Remove {override.setting}
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="dangerButton" onClick={onRestoreNeutral}>Restore neutral profile</button>
    </section>
  )
}
