import type { DependencyReport } from '../../services/DependencyEngine'

export default function DependencyViewer({ report }: { report: DependencyReport }) {
  return (
    <section className="mission-card">
      <p className="eyebrow">DEPENDENCY ANALYSIS</p>
      <div className="mission-stats-grid">
        <div><span>Blocking decisions</span><strong>{report.blockingDecisions.length}</strong></div>
        <div><span>Blocking commitments</span><strong>{report.blockingCommitments.length}</strong></div>
        <div><span>Missing prerequisites</span><strong>{report.missingPrerequisites.length}</strong></div>
        <div><span>Completed dependencies</span><strong>{report.completedDependencies}</strong></div>
      </div>
      {report.circularDependency && <p className="mission-risk">Circular dependency detected.</p>}
      {report.blockedSteps.length > 0 && <p className="mission-risk">Blocked steps: {report.blockedSteps.length}</p>}
    </section>
  )
}

