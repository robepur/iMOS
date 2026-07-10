import { useState } from 'react'
import type { KnowledgeGraphData, GraphNode } from '../../localData'
import type { RelatedRecord } from '../../services/KnowledgeGraph'
import { KnowledgeGraph } from '../../services/KnowledgeGraph'
import { Network } from 'lucide-react'
import RelationshipPanel from './RelationshipPanel'

const NODE_TYPE_LABELS: Record<GraphNode['type'], string> = {
  priority: 'Priority', commitment: 'Commitment', decision: 'Decision',
  reflection: 'Reflection', timeline: 'Timeline', secret: 'Secret',
  recommendation: 'Recommendation', recovery: 'Recovery', memory: 'Memory', understanding: 'Understanding',
  mission: 'Mission', mission_step: 'Mission Step',
}

type Props = {
  graph: KnowledgeGraphData
  initialNodeId?: string
  onClose: () => void
}

export default function KnowledgeGraphViewer({ graph, initialNodeId, onClose }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(initialNodeId ?? null)
  const [typeFilter, setTypeFilter] = useState<GraphNode['type'] | 'all'>('all')

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))
  const selected = selectedId ? nodeMap.get(selectedId) ?? null : null

  const filteredNodes = typeFilter === 'all'
    ? graph.nodes
    : graph.nodes.filter((n) => n.type === typeFilter)

  const related: RelatedRecord[] = selected ? KnowledgeGraph.getRelated(graph, selected.id) : []

  const types = Array.from(new Set(graph.nodes.map((n) => n.type)))

  return (
    <section className="kg-viewer panel" aria-label="Knowledge Graph Viewer">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">OPERATOR KNOWLEDGE GRAPH</p>
          <h2>Relationship Explorer</h2>
        </div>
        <button className="closeButton" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="kg-layout">
        {/* Node list */}
        <div className="kg-node-list">
          <div className="kg-filter-bar">
            <label htmlFor="kg-type-filter" className="eyebrow">FILTER TYPE</label>
            <select
              id="kg-type-filter"
              className="kg-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as GraphNode['type'] | 'all')}
            >
              <option value="all">All ({graph.nodes.length})</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {NODE_TYPE_LABELS[t]} ({graph.nodes.filter((n) => n.type === t).length})
                </option>
              ))}
            </select>
          </div>
          <ul className="kg-nodes" role="listbox" aria-label="Records">
            {filteredNodes.map((node) => {
              const degree = graph.edges.filter((e) => e.source === node.id || e.target === node.id).length
              return (
                <li
                  key={node.id}
                  className={`kg-node-item${selected?.id === node.id ? ' kg-node-item--active' : ''}`}
                  role="option"
                  aria-selected={selected?.id === node.id}
                  tabIndex={0}
                  onClick={() => setSelectedId(node.id)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedId(node.id)}
                >
                  <span className={`kg-node-type-dot kg-node-type-dot--${node.type}`} />
                  <span className="kg-node-title">{node.title}</span>
                  {degree > 0 && <span className="kg-degree-badge">{degree}</span>}
                </li>
              )
            })}
            {filteredNodes.length === 0 && (
              <li className="kg-empty-list">No records of this type.</li>
            )}
          </ul>
        </div>

        {/* Detail panel */}
        <div className="kg-detail">
          {!selected ? (
            <div className="kg-no-selection">
              <Network size={40} />
              <p>Select a record from the list to explore its relationships.</p>
              <p className="kg-stat-line"><strong>{graph.nodes.length}</strong> nodes · <strong>{graph.edges.length}</strong> relationships discovered</p>
            </div>
          ) : (
            <>
              <div className="kg-selected-header">
                <span className={`kg-type-badge kg-type-badge--${selected.type}`}>{NODE_TYPE_LABELS[selected.type]}</span>
                <h3 className="kg-selected-title">{selected.title}</h3>
                <p className="kg-selected-date">{new Date(selected.createdAt).toLocaleDateString()}</p>
              </div>
              <p className="kg-connection-count">{related.length} relationship{related.length !== 1 ? 's' : ''} discovered</p>
              {related.length > 0 ? (
                <RelationshipPanel
                  related={related}
                  nodeMap={nodeMap}
                  onNavigate={(id) => setSelectedId(id)}
                />
              ) : (
                <p className="kg-no-relations">No relationships discovered for this record.</p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
