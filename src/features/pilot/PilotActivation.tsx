import { useState } from 'react'
import type { PilotSession } from '../../types/operatorPilot'

export default function PilotActivation({
  session,
  onCreate,
  onStart,
}: {
  session?: PilotSession
  onCreate: (durationDays: number, acknowledgedPurpose: boolean, acknowledgedLocalMeasurement: boolean) => void
  onStart: () => void
}) {
  const [duration, setDuration] = useState(session?.selectedDurationDays ?? 30)
  const [ackPurpose, setAckPurpose] = useState(false)
  const [ackLocal, setAckLocal] = useState(false)

  return (
    <section className="panel" style={{ padding: '1rem' }} data-testid="pilot-activation">
      <p className="eyebrow">OPERATOR PILOT ACTIVATION</p>
      <h3 style={{ marginTop: '0.5rem' }}>Controlled pilot session</h3>
      <p className="emptyState">
        Pilot data remains private and local in your encrypted vault. No operator grade, ranking, or composite score is created.
      </p>

      {!session && (
        <>
          <label>
            PILOT DURATION DAYS
            <input
              type="number"
              min={14}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              data-testid="pilot-duration-input"
            />
          </label>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="checkbox" checked={ackPurpose} onChange={(e) => setAckPurpose(e.target.checked)} />
            I acknowledge pilot purpose.
          </label>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="checkbox" checked={ackLocal} onChange={(e) => setAckLocal(e.target.checked)} />
            I acknowledge private local measurement.
          </label>
          <button
            disabled={!ackPurpose || !ackLocal || duration < 14}
            onClick={() => onCreate(duration, ackPurpose, ackLocal)}
            data-testid="pilot-create-button"
          >
            Create pilot session
          </button>
        </>
      )}

      {session && (session.status === 'ready' || session.status === 'paused') && (
        <button onClick={onStart} data-testid="pilot-start-button">
          {session.status === 'ready' ? 'Start pilot' : 'Resume pilot'}
        </button>
      )}
    </section>
  )
}
