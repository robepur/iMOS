import { useState } from 'react'
import { X, Zap, Eye, Brain, Sliders, Shield } from 'lucide-react'
import type { PersonalData, RosieRecommendation } from '../../localData'
import type { CognitionConsent } from '../../types/cognitive'
import type { AdaptationSettingKey } from '../../types/presentation'
import { CognitionConsentPanel, CognitiveSignalsPanel, PersonalizationControlCenter, UnderstandingReviewCenter } from '../cognition'
import { isCognitionEnabled } from '../../services/CognitionConsentService'

type RosieCenterTab = 'overview' | 'notices' | 'understands' | 'personalization' | 'privacy'

type RosieCenterProps = {
  data: PersonalData
  recs: RosieRecommendation[]
  onClose: () => void
  onSuppressSignal: (signalId: string) => void
  onConfirmUnderstanding: (id: string) => void
  onCorrectUnderstanding: (id: string, corrected: string, reason?: string) => void
  onRejectUnderstanding: (id: string, reason?: string) => void
  onExpireUnderstanding: (id: string) => void
  onSuppressUnderstandingSignal: (signalId: string) => void
  onUpdateCognitionConsent: (consent: CognitionConsent) => void
  onEnablePersonalizationChanged: (enabled: boolean) => void
  onOverrideChanged: (setting: AdaptationSettingKey, value: string) => void
  onOverrideRemoved: (overrideId: string) => void
  onRestoreNeutral: () => void
  onCompleteRec: (rec: RosieRecommendation) => void
  onDismissRec: (rec: RosieRecommendation) => void
  onSnoozeRec: (rec: RosieRecommendation, days: number) => void
}

export default function RosieCenter(props: RosieCenterProps) {
  const { data, recs, onClose } = props
  const [tab, setTab] = useState<RosieCenterTab>('overview')

  const cognitionEnabled = isCognitionEnabled(data.cognitionConsent)
  const proposedSignals = (data.cognitiveSignals ?? []).filter((s) => s.status === 'proposed')
  const proposedUnderstandings = (data.operatorUnderstandings ?? []).filter((u) => u.state === 'proposed')
  const hasAlerts = proposedSignals.length > 0 || proposedUnderstandings.length > 0 || recs.length > 0

  const noop = () => {}

  return (
    <div className="overlay" role="dialog" aria-label="Rosie Center">
      <div className="panel" style={{ maxWidth: 900, width: '100%' }}>
        <div className="panelHeader">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={18} />
            <h2>ROSIE{hasAlerts ? ` — ${recs.length + proposedSignals.length + proposedUnderstandings.length} items need attention` : ''}</h2>
          </div>
          <button className="iconButton" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: '8px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <button className={`utilityButton${tab === 'overview' ? ' utilityButton--active' : ''}${recs.length > 0 ? ' utilityButton--alert' : ''}`} onClick={() => setTab('overview')}>
            <Zap size={14} /> Overview{recs.length > 0 ? ` (${recs.length})` : ''}
          </button>
          <button className={`utilityButton${tab === 'notices' ? ' utilityButton--active' : ''}${proposedSignals.length > 0 ? ' utilityButton--alert' : ''}`} onClick={() => setTab('notices')}>
            <Eye size={14} /> What Rosie Notices{proposedSignals.length > 0 ? ` (${proposedSignals.length})` : ''}
          </button>
          <button className={`utilityButton${tab === 'understands' ? ' utilityButton--active' : ''}${proposedUnderstandings.length > 0 ? ' utilityButton--alert' : ''}`} onClick={() => setTab('understands')}>
            <Brain size={14} /> What Rosie Understands{proposedUnderstandings.length > 0 ? ` (${proposedUnderstandings.length})` : ''}
          </button>
          <button className={`utilityButton${tab === 'personalization' ? ' utilityButton--active' : ''}`} onClick={() => setTab('personalization')}>
            <Sliders size={14} /> Personalization
          </button>
          <button className={`utilityButton${tab === 'privacy' ? ' utilityButton--active' : ''}`} onClick={() => setTab('privacy')}>
            <Shield size={14} /> Privacy and Control
          </button>
        </div>

        <div style={{ padding: 16, overflowY: 'auto', maxHeight: 'calc(90vh - 120px)' }}>
          {tab === 'overview' && (
            <div>
              <h3 style={{ marginBottom: 12 }}>Rosie Overview</h3>
              {!cognitionEnabled && (
                <div className="callout callout--warning">
                  <p>Rosie learning is currently disabled. Enable it in Privacy and Control to surface cognitive observations.</p>
                </div>
              )}
              {recs.length === 0 && !hasAlerts && (
                <p className="muted">No items need attention right now.</p>
              )}
              {recs.length > 0 && (
                <div>
                  <h4 style={{ marginBottom: 8 }}>Recommendations ({recs.length})</h4>
                  {recs.map((rec) => (
                    <div key={rec.id} className="card" style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong>{rec.title}</strong>
                          <p style={{ margin: '4px 0', fontSize: 13 }}>{rec.explanation}</p>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button className="utilityButton" onClick={() => props.onCompleteRec(rec)}>Done</button>
                          <button className="utilityButton" onClick={() => props.onDismissRec(rec)}>Dismiss</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {proposedSignals.length > 0 && (
                <p className="muted" style={{ marginTop: 12 }}>
                  {proposedSignals.length} observation{proposedSignals.length !== 1 ? 's' : ''} in What Rosie Notices.
                </p>
              )}
              {proposedUnderstandings.length > 0 && (
                <p className="muted">
                  {proposedUnderstandings.length} proposed understanding{proposedUnderstandings.length !== 1 ? 's' : ''} in What Rosie Understands.
                </p>
              )}
            </div>
          )}

          {tab === 'notices' && (
            <CognitiveSignalsPanel
              signals={data.cognitiveSignals ?? []}
              onSuppress={props.onSuppressSignal}
              onClose={noop}
            />
          )}

          {tab === 'understands' && (
            <UnderstandingReviewCenter
              understandings={data.operatorUnderstandings ?? []}
              signals={data.cognitiveSignals ?? []}
              onConfirm={props.onConfirmUnderstanding}
              onCorrect={props.onCorrectUnderstanding}
              onReject={props.onRejectUnderstanding}
              onExpire={props.onExpireUnderstanding}
              onSuppressSignal={props.onSuppressUnderstandingSignal}
              onClose={noop}
            />
          )}

          {tab === 'personalization' && data.cognitionConsent && data.presentationProfile && (
            <PersonalizationControlCenter
              consent={data.cognitionConsent}
              enabled={data.presentationPersonalizationEnabled ?? false}
              profile={data.presentationProfile}
              overrides={data.presentationOverrides ?? []}
              onEnableChanged={props.onEnablePersonalizationChanged}
              onOverrideChanged={props.onOverrideChanged}
              onOverrideRemoved={props.onOverrideRemoved}
              onRestoreNeutral={props.onRestoreNeutral}
              onClose={noop}
            />
          )}

          {tab === 'privacy' && data.cognitionConsent && (
            <div>
              <h3 style={{ marginBottom: 12 }}>Privacy and Learning Controls</h3>
              <CognitionConsentPanel
                consent={data.cognitionConsent}
                onUpdate={props.onUpdateCognitionConsent}
                onClose={noop}
              />
              {data.recoveryAudit && data.recoveryAudit.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h4>Recovery Audit History</h4>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {data.recoveryAudit.slice(0, 20).map((event) => (
                      <div key={event.id} className="card" style={{ marginBottom: 4 }}>
                        <span className="badge">{event.type}</span>
                        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)' }}>{event.createdAt}</span>
                        <p style={{ margin: '4px 0 0', fontSize: 12 }}>{event.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
