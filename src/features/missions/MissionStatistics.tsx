import type { MissionPlan, MissionStep } from '../../localData'

function avgDurationDays(plans: MissionPlan[]): number | null {
  const completed = plans.filter((p) => p.status === 'completed')
  if (completed.length === 0) return null
  const days = completed.map((p) => (new Date(p.updatedAt).getTime() - new Date(p.createdAt).getTime()) / 86_400_000)
  return parseFloat((days.reduce((a, b) => a + b, 0) / days.length).toFixed(1))
}

export default function MissionStatistics({ plans, steps }: { plans: MissionPlan[]; steps: MissionStep[] }) {
  const activeMissions = plans.filter((p) => p.status === 'active').length
  const completedMissions = plans.filter((p) => p.status === 'completed').length
  const blockedMissions = plans.filter((p) => p.status === 'paused').length
  const completionRate = plans.length === 0 ? 0 : Math.round((completedMissions / plans.length) * 100)
  const completedSteps = steps.filter((s) => s.status === 'completed').length
  const avgStepCompletion = steps.length === 0 ? 0 : Math.round((completedSteps / steps.length) * 100)
  const mostCommonBlocker = steps.filter((s) => s.status === 'blocked')[0]?.title ?? 'None'
  const avgDuration = avgDurationDays(plans)

  return (
    <section className="mission-card">
      <p className="eyebrow">MISSION STATISTICS</p>
      <table className="ud-stats-table">
        <tbody>
          <tr><td className="ud-stat-label">Active Missions</td><td className="ud-stat-value">{activeMissions}</td></tr>
          <tr><td className="ud-stat-label">Completed Missions</td><td className="ud-stat-value">{completedMissions}</td></tr>
          <tr><td className="ud-stat-label">Average Mission Duration</td><td className="ud-stat-value">{avgDuration !== null ? `${avgDuration} days` : '—'}</td></tr>
          <tr><td className="ud-stat-label">Average Step Completion</td><td className="ud-stat-value">{avgStepCompletion}%</td></tr>
          <tr><td className="ud-stat-label">Blocked Missions</td><td className="ud-stat-value">{blockedMissions}</td></tr>
          <tr><td className="ud-stat-label">Most Common Blocker</td><td className="ud-stat-value">{mostCommonBlocker}</td></tr>
          <tr><td className="ud-stat-label">Mission Completion Rate</td><td className="ud-stat-value">{completionRate}%</td></tr>
        </tbody>
      </table>
    </section>
  )
}

