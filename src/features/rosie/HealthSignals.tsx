import type { HealthSignals, HealthSignalLevel } from '../../services/RosieEngine'

const SIGNAL_LABELS: Record<keyof HealthSignals, string> = {
  priorityLoad: 'Priority Load',
  commitmentLoad: 'Commitment Load',
  decisionLoad: 'Decision Load',
  reflectionFrequency: 'Reflection Frequency',
  backupHealth: 'Backup Health',
  recoveryHealth: 'Recovery Health',
}

const LEVEL_LABELS: Record<HealthSignalLevel, string> = {
  green: 'Nominal',
  amber: 'Monitor',
  red: 'Action Required',
}

type Props = {
  signals: HealthSignals
}

export default function HealthSignals({ signals }: Props) {
  return (
    <section className="health-signals-panel" aria-label="Operational Health Signals">
      <p className="eyebrow">OPERATIONAL HEALTH</p>
      <table className="health-table">
        <thead>
          <tr>
            <th scope="col">Signal</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {(Object.keys(SIGNAL_LABELS) as (keyof HealthSignals)[]).map((key) => {
            const level = signals[key]
            return (
              <tr key={key} className={`health-row health-row--${level}`}>
                <td>{SIGNAL_LABELS[key]}</td>
                <td>
                  <span className={`health-dot health-dot--${level}`} aria-hidden="true" />
                  <span>{LEVEL_LABELS[level]}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
