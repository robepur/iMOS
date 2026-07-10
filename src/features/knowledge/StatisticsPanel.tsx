import type { GraphStats } from '../../services/KnowledgeGraph'

type Props = {
  stats: GraphStats
  builtAt: string
}

export default function StatisticsPanel({ stats, builtAt }: Props) {
  const rows: [string, string | number][] = [
    ['Total Nodes', stats.totalNodes],
    ['Total Relationships', stats.totalEdges],
    ['Average Degree', stats.avgDegree],
    ['Most Connected Priority', stats.mostConnectedPriority ?? '—'],
    ['Most Connected Commitment', stats.mostConnectedCommitment ?? '—'],
    ['Most Referenced Reflection', stats.mostReferencedReflection ?? '—'],
    ['Recommendation Coverage', `${stats.recommendationCoverage}%`],
  ]

  return (
    <section className="kg-stats-panel" aria-label="Knowledge Graph Statistics">
      <p className="eyebrow">GRAPH STATISTICS</p>
      {builtAt && (
        <p className="kg-stats-built">Graph built {new Date(builtAt).toLocaleTimeString()}</p>
      )}
      <table className="kg-stats-table">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="kg-stats-label">{label}</td>
              <td className="kg-stats-value">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
