import { useState } from 'react'
import { CheckCircle, ArrowRight, Pause, RotateCcw, Shield, Zap, Database, RefreshCw } from 'lucide-react'
import type { OnboardingState, OnboardingStepId } from '../../types/onboarding'
import {
  ONBOARDING_STEPS,
  ONBOARDING_SCHEMA_VERSION,
  ONBOARDING_TOTAL_STEPS,
} from '../../types/onboarding'

interface OnboardingFlowProps {
  state: OnboardingState
  onUpdate: (next: OnboardingState) => void
  onComplete: () => void
  onPause: () => void
  onOpenRecovery: () => void
}

interface StepContent {
  id: OnboardingStepId
  title: string
  body: string
  primaryAction: string
  icon: React.ReactNode
}

const STEP_CONTENT: StepContent[] = [
  {
    id: 'what_is_imos',
    icon: <Shield size={28} />,
    title: 'Welcome to iMOS',
    body: 'iMOS is your Individual Mission Operating System — a private, encrypted space to manage your priorities, commitments, decisions, and reflections. Everything stays on your device. Nothing is shared without your permission.',
    primaryAction: 'Continue',
  },
  {
    id: 'rosie_role',
    icon: <Zap size={28} />,
    title: 'Meet Rosie',
    body: 'Rosie is your AI cognitive partner. She reads your local data to offer daily briefings, surface patterns, and make bounded recommendations. She explains every suggestion so you can accept, reject, or correct it.',
    primaryAction: 'Continue',
  },
  {
    id: 'operator_control',
    icon: <CheckCircle size={28} />,
    title: 'You are in control',
    body: 'iMOS never changes anything without your confirmation. Rosie observes and advises — you decide. Every recommendation requires your explicit action. Rosie adapts only when you confirm she has understood you correctly.',
    primaryAction: 'Continue',
  },
  {
    id: 'vault_protection',
    icon: <Database size={28} />,
    title: 'Your vault is encrypted',
    body: 'All your data is encrypted with AES-256. Your passphrase is never stored or transmitted. If you lose it, no one can recover your vault — including iMOS. Choose something memorable and write it somewhere safe.',
    primaryAction: 'Continue',
  },
  {
    id: 'vault_ready',
    icon: <CheckCircle size={28} />,
    title: 'Your vault is ready',
    body: 'Your encrypted vault has been created and unlocked. Your priorities, commitments, decisions, and reflections will be stored here securely.',
    primaryAction: 'Continue',
  },
  {
    id: 'recovery_backup',
    icon: <RefreshCw size={28} />,
    title: 'Create a recovery backup',
    body: 'Before you continue, create a recovery backup. This backup lets you restore your vault if you change devices or your browser data is lost. Store it somewhere secure and separate from your passphrase.',
    primaryAction: 'Open Recovery Console',
  },
  {
    id: 'recovery_confirmed',
    icon: <CheckCircle size={28} />,
    title: 'Recovery backup confirmed',
    body: 'Your recovery backup is ready. You can create new backups at any time from the Vault menu. Keep your backup and passphrase in separate secure locations.',
    primaryAction: 'Continue',
  },
  {
    id: 'daily_briefing',
    icon: <Zap size={28} />,
    title: 'Your daily briefing',
    body: 'Each day, iMOS opens with an arrival screen. Start your day by reviewing your morning brief — Rosie summarises your priorities, upcoming commitments, and any observations she has made about your operational patterns.',
    primaryAction: 'Continue',
  },
  {
    id: 'features_overview',
    icon: <Database size={28} />,
    title: 'Your operating tools',
    body: 'iMOS gives you: Priorities (what matters most), Commitments (what you have promised), Decisions (choices with context), Reflections (daily review), Missions (goal sequences), Secrets (encrypted credentials), and a Knowledge Graph that connects everything.',
    primaryAction: 'Continue',
  },
  {
    id: 'rosie_corrections',
    icon: <Zap size={28} />,
    title: 'Correcting Rosie',
    body: 'When Rosie gets something wrong, tell her. Open the Rosie panel, find the understanding, and mark it corrected. Your correction is recorded and Rosie will not repeat the same mistake. You can review all her understandings at any time.',
    primaryAction: 'Continue',
  },
  {
    id: 'sync_optional',
    icon: <Shield size={28} />,
    title: 'Synchronisation is optional',
    body: 'iMOS works entirely offline by default. Synchronisation across devices is available in a future release and will require your explicit consent. It is disabled now and will never activate without your permission.',
    primaryAction: 'Continue',
  },
  {
    id: 'complete',
    icon: <CheckCircle size={28} />,
    title: 'You are ready',
    body: 'Onboarding is complete. Your vault is encrypted, your recovery backup is set, and Rosie is ready to assist. You can review this guide at any time from the Vault menu.',
    primaryAction: 'Begin using iMOS',
  },
]

export default function OnboardingFlow({ state, onUpdate, onComplete, onPause, onOpenRecovery }: OnboardingFlowProps) {
  const [recovering, setRecovering] = useState(false)

  const stepIndex = Math.min(state.currentStepIndex, ONBOARDING_STEPS.length - 1)
  const currentStepId = ONBOARDING_STEPS[stepIndex]
  const content = STEP_CONTENT.find(s => s.id === currentStepId) ?? STEP_CONTENT[0]
  const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1
  const isRecoveryStep = currentStepId === 'recovery_backup'
  const isRecoveryConfirm = currentStepId === 'recovery_confirmed'
  const progress = Math.round((stepIndex / (ONBOARDING_TOTAL_STEPS - 1)) * 100)

  function advance(now = new Date()) {
    const nextIndex = stepIndex + 1
    const completedStepIds = state.completedStepIds.includes(currentStepId)
      ? state.completedStepIds
      : [...state.completedStepIds, currentStepId]

    if (isLastStep) {
      const completed: OnboardingState = {
        ...state,
        status: 'completed',
        currentStepIndex: nextIndex,
        completedStepIds,
        completedAt: now.toISOString(),
        lastUpdatedAt: now.toISOString(),
      }
      onUpdate(completed)
      onComplete()
      return
    }

    onUpdate({
      ...state,
      schemaVersion: ONBOARDING_SCHEMA_VERSION,
      status: 'in_progress',
      currentStepIndex: nextIndex,
      completedStepIds,
      lastUpdatedAt: now.toISOString(),
    })
  }

  function handlePrimary() {
    if (isRecoveryStep) {
      onOpenRecovery()
      setRecovering(true)
      return
    }
    advance()
  }

  function handleRecoveryDone(now = new Date()) {
    setRecovering(false)
    onUpdate({
      ...state,
      schemaVersion: ONBOARDING_SCHEMA_VERSION,
      status: 'in_progress',
      currentStepIndex: stepIndex + 1,
      completedStepIds: state.completedStepIds.includes(currentStepId)
        ? state.completedStepIds
        : [...state.completedStepIds, currentStepId],
      recoveryBackupConfirmed: true,
      lastUpdatedAt: now.toISOString(),
    })
  }

  return (
    <div className="secretEditorBackdrop" data-testid="onboarding-flow">
      <div className="panel" style={{ maxWidth: 520, width: '100%', padding: '2rem' }}>
        {/* Progress */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <p className="eyebrow">ONBOARDING — STEP {stepIndex + 1} OF {ONBOARDING_TOTAL_STEPS}</p>
            <p className="eyebrow">{progress}%</p>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Onboarding progress"
            style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}
          >
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* Step content */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ marginBottom: '1rem', opacity: 0.7 }}>{content.icon}</div>
          <h2 style={{ marginBottom: '0.75rem' }}>{content.title}</h2>
          <p style={{ lineHeight: 1.6, opacity: 0.85 }}>{content.body}</p>
        </div>

        {/* Recovery confirmation button (only on recovery_confirmed step) */}
        {isRecoveryStep && recovering && (
          <button
            className="secondaryButton"
            style={{ width: '100%', marginBottom: '0.75rem' }}
            onClick={() => handleRecoveryDone()}
            data-testid="onboarding-recovery-done"
          >
            <CheckCircle size={16} /> I have created my recovery backup
          </button>
        )}

        {/* Primary action */}
        {!(isRecoveryStep && recovering) && (
          <button
            style={{ width: '100%', marginBottom: '0.75rem' }}
            onClick={handlePrimary}
            data-testid="onboarding-primary-action"
          >
            {content.primaryAction} <ArrowRight size={16} />
          </button>
        )}

        {/* Pause (not on last step) */}
        {!isLastStep && !isRecoveryConfirm && (
          <button
            className="secondaryButton"
            style={{ width: '100%' }}
            onClick={onPause}
            data-testid="onboarding-pause"
          >
            <Pause size={16} /> Save progress and continue later
          </button>
        )}
      </div>
    </div>
  )
}

/** Minimal review view — shown when operator revisits onboarding after completion. */
export function OnboardingReview({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const content = STEP_CONTENT[step]

  return (
    <div className="secretEditorBackdrop" data-testid="onboarding-review">
      <div className="panel" style={{ maxWidth: 520, width: '100%', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <p className="eyebrow">ONBOARDING GUIDE — {step + 1} / {STEP_CONTENT.length}</p>
          <button className="iconButton" onClick={onClose} aria-label="Close onboarding review">✕</button>
        </div>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ marginBottom: '1rem', opacity: 0.7 }}>{content.icon}</div>
          <h2 style={{ marginBottom: '0.75rem' }}>{content.title}</h2>
          <p style={{ lineHeight: 1.6, opacity: 0.85 }}>{content.body}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="secondaryButton"
            style={{ flex: 1 }}
            disabled={step === 0}
            onClick={() => setStep(s => Math.max(0, s - 1))}
          >
            Previous
          </button>
          {step < STEP_CONTENT.length - 1 ? (
            <button style={{ flex: 1 }} onClick={() => setStep(s => s + 1)}>
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button style={{ flex: 1 }} onClick={onClose}>
              <CheckCircle size={16} /> Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
