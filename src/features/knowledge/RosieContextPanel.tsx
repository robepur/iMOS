import type { GraphNode, KnowledgeGraphData } from '../../localData'
import type { RelatedRecord } from '../../services/KnowledgeGraph'
import { KnowledgeGraph } from '../../services/KnowledgeGraph'
import RelationshipPanel from './RelationshipPanel'

const NODE_TYPE_LABELS: Record<GraphNode['type'], string> = {
  priority: 'Priority', commitment: 'Commitment', decision: 'Decision',
  reflection: 'Reflection', timeline: 'Timeline', secret: 'Secret',
  recommendation: 'Recommendation', recovery: 'Recovery', memory: 'Memory', understanding: 'Understanding',
}

type Props = {
  nodeId: string
  graph: KnowledgeGraphData
  onNavigate: (id: string) => void
  onClose?: () => void
}

export default function RosieContextPanel({ nodeId, graph, onNavigate, onClose }: Props) {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))
  const node = nodeMap.get(nodeId)
  if (!node) return null

  const related: RelatedRecord[] = KnowledgeGraph.getRelated(graph, nodeId)

  // Group related by type for display
  const byType = new Map<GraphNode['type'], RelatedRecord[]>()
  for (const r of related) {
    const arr = byType.get(r.node.type) ?? []
    arr.push(r)
    byType.set(r.node.type, arr)
  }

  const typeOrder: GraphNode['type'][] = [
    'priority', 'commitment', 'decision', 'reflection',
    'recommendation', 'understanding', 'memory', 'timeline', 'secret', 'recovery',
  ]

  return (
    <aside className="rosie-context-panel" aria-label="Rosie Context Panel">
      <div className="rcp-header">
        <p className="eyebrow">ROSIE CONTEXT</p>
        <span className={`kg-type-badge kg-type-badge--${node.type}`}>{NODE_TYPE_LABELS[node.type]}</span>
        {onClose && <button className="closeButton rcp-close" onClick={onClose} aria-label="Close context panel">✕</button>}
      </div>
      <h4 className="rcp-title">{node.title}</h4>

      {related.length === 0 ? (
        <p className="rcp-empty">No relationships discovered for this record yet.</p>
      ) : (
        <div className="rcp-groups">
          {typeOrder.map((type) => {
            const recs = byType.get(type)
            if (!recs || recs.length === 0) return null
            return (
              <div key={type} className="rcp-group">
                <p className="eyebrow">{NODE_TYPE_LABELS[type]} ({recs.length})</p>
                <RelationshipPanel related={recs} nodeMap={nodeMap} onNavigate={onNavigate} />
              </div>
            )
          })}
        </div>
      )}
    </aside>
  )
}
