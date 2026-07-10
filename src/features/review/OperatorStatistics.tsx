import { PersonalData } from '../../localData'

export default function OperatorStatistics({ data }: { data: PersonalData }) {
  const totalPriorities = data.priorities.length
  const completedPriorities = data.priorities.filter((p) => p.completed).length
  const completionPct = totalPriorities > 0 ? Math.round((completedPriorities / totalPriorities) * 100) : 0

  const commitmentsCreated = data.commitments.length
  const commitmentsCompleted = data.commitments.filter((c) => c.status === 'complete').length
  const decisionsMade = data.decisions.filter((d) => d.status === 'decided').length
  const reflectionsCompleted = data.reflections.length
  const secretsStored = data.secrets?.length ?? 0

  const recoveryTests = data.timeline.filter((e) => e.type === 'recovery' || (e.type === 'system' && e.title.toLowerCase().includes('recovery'))).length
  const backupsCreated = data.timeline.filter((e) => e.type === 'system' && e.title.toLowerCase().includes('backup')).length

  const stats: { label: string; value: string }[] = [
    { label: 'Total Priorities', value: String(totalPriorities) },
    { label: 'Completed Priorities', value: String(completedPriorities) },
    { label: 'Completion Rate', value: `${completionPct}%` },
    { label: 'Commitments Created', value: String(commitmentsCreated) },
    { label: 'Commitments Completed', value: String(commitmentsCompleted) },
    { label: 'Decisions Made', value: String(decisionsMade) },
    { label: 'Reflections Completed', value: String(reflectionsCompleted) },
    { label: 'Secrets Stored', value: String(secretsStored) },
    { label: 'Recovery Tests', value: String(recoveryTests) },
    { label: 'Backups Created', value: String(backupsCreated) },
  ]

  return (
    <div className="operatorStats">
      <p className="eyebrow">OPERATOR STATISTICS</p>
      <p className="statsNote">All statistics are read only. Derived from encrypted vault records.</p>
      <div className="statsGrid">
        {stats.map((s) => (
          <div key={s.label} className="statCard">
            <span className="statLabel">{s.label}</span>
            <strong className="statValue">{s.value}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

