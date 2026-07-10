import type { GraphNode, GraphEdge } from '../../localData'
import type { RelatedRecord } from '../../services/KnowledgeGraph'
import { KnowledgeGraph } from '../../services/KnowledgeGraph'

const EDGE_LABELS: Record<GraphEdge['type'], string> = {
  related_to:    'Related To',
  created_from:  'Created From',
  references:    'References',
  supports:      'Supports',
  depends_on:    'Depends On',
  completed_by:  'Completed By',
  mentioned_in:  'Mentioned In',
  derived_from:  'Derived From',
  observed_in:   'Observed In',
  remembered_by: 'Remembered By',
  generated_from: 'Generated From',
  blocked_by: 'Blocked By',
  completes: 'Completes',
}

const NODE_TYPE_LABELS: Record<GraphNode['type'], string> = {
  priority: 'Priority', commitment: 'Commitment', decision: 'Decision',
  reflection: 'Reflection', timeline: 'Timeline', secret: 'Secret',
  recommendation: 'Recommendation', recovery: 'Recovery', memory: 'Memory', understanding: 'Understanding',
  mission: 'Mission', mission_step: 'Mission Step',
}

type Props = {
  related: RelatedRecord[]
  nodeMap: Map<string, GraphNode>
  onNavigate: (id: string) => void
}

export default function RelationshipPanel({ related, nodeMap, onNavigate }: Props) {
  return (
    <ul className="rel-list" aria-label="Relationships">
      {related.map(({ node, edge, direction }) => {
        const sourceNode = nodeMap.get(edge.source)
        const targetNode = nodeMap.get(edge.target)
        const sourceTitle = sourceNode?.title ?? edge.source
        const targetTitle = targetNode?.title ?? edge.target
        const explanation = KnowledgeGraph.explainEdge(edge, sourceTitle, targetTitle)
        return (
          <li key={edge.id} className="rel-item">
            <div className="rel-item-header">
              <span className={`kg-type-badge kg-type-badge--${node.type}`}>{NODE_TYPE_LABELS[node.type]}</span>
              <span className={`rel-edge-type rel-edge-type--${edge.type}`}>{EDGE_LABELS[edge.type]}</span>
              <span className={`rel-confidence rel-confidence--${edge.confidence}`}>{edge.confidence} confidence</span>
              <span className="rel-direction">{direction === 'outbound' ? '→' : '←'}</span>
            </div>
            <button
              className="rel-node-title"
              onClick={() => onNavigate(node.id)}
              aria-label={`Navigate to ${node.title}`}
            >
              {node.title}
            </button>
            <p className="rel-explanation">{explanation}</p>
            {edge.evidence.length > 0 && (
              <details className="rel-evidence-details">
                <summary className="rel-evidence-summary">Evidence ({edge.evidence.length})</summary>
                <ul className="rel-evidence-list">
                  {edge.evidence.map((ev, i) => <li key={i}>{ev}</li>)}
                </ul>
              </details>
            )}
          </li>
        )
      })}
    </ul>
  )
}
