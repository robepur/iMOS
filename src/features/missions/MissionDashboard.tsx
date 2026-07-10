import type { MissionPlan, MissionStep } from '../../localData'
import { MissionPlanningEngine } from '../../services/MissionPlanningEngine'

export default function MissionDashboard({ activePlan, steps }: { activePlan: MissionPlan | null; steps: MissionStep[] }) {
  if (!activePlan) {
    return (
      <section className="mission-card">
        <p className="eyebrow">MISSION DASHBOARD</p>
        <p className="emptyState">No active mission.</p>
      </section>
    )
  }

  const progress = MissionPlanningEngine.getProgress(steps)
  return (
    <section className="mission-card">
      <p className="eyebrow">MISSION DASHBOARD</p>
      <h3>{activePlan.title}</h3>
      <p>{activePlan.objective}</p>
      <div className="mission-progress">
        <div className="mission-progress-bar"><span style={{ width: `${progress.completionPercent}%` }} /></div>
        <p>{progress.completionPercent}% complete · {progress.completedSteps}/{steps.length} steps</p>
      </div>
      {progress.activeStep && <p>Current active step: <strong>{progress.activeStep.title}</strong></p>}
      {progress.blockedSteps > 0 && <p className="mission-risk">Blocked steps: {progress.blockedSteps}</p>}
    </section>
  )
}

