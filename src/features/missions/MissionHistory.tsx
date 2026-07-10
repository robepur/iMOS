import type { MissionPlan, MissionStep } from '../../localData'

function stepCount(plan: MissionPlan, steps: MissionStep[]): number {
  return steps.filter((s) => plan.stepIds.includes(s.id) && s.status === 'completed').length
}

export default function MissionHistory({ plans, steps }: { plans: MissionPlan[]; steps: MissionStep[] }) {
  const history = [...plans].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <section className="mission-card">
      <p className="eyebrow">MISSION HISTORY</p>
      {history.length === 0 && <p className="emptyState">No mission history yet.</p>}
      {history.map((plan) => {
        const completed = stepCount(plan, steps)
        const duration = Math.max(0, Math.round((new Date(plan.updatedAt).getTime() - new Date(plan.createdAt).getTime()) / 86_400_000))
        return (
          <div key={plan.id} className="mission-history-item">
            <strong>{plan.title}</strong>
            <p>Status: {plan.status.toUpperCase()}</p>
            <p>Steps completed: {completed}/{plan.stepIds.length}</p>
            <p>Duration: {duration} day{duration !== 1 ? 's' : ''}</p>
            <p className="mission-evidence">{plan.explanation}</p>
          </div>
        )
      })}
    </section>
  )
}

