import { useState, useDeferredValue } from 'react'
import type { KnowledgeGraphData, GraphNode } from '../../localData'
import type { SearchResult } from '../../services/KnowledgeGraph'
import { KnowledgeGraph } from '../../services/KnowledgeGraph'
import { Search } from 'lucide-react'

const NODE_TYPE_LABELS: Record<GraphNode['type'], string> = {
  priority: 'Priority', commitment: 'Commitment', decision: 'Decision',
  reflection: 'Reflection', timeline: 'Timeline', secret: 'Secret',
  recommendation: 'Recommendation', recovery: 'Recovery', memory: 'Memory', understanding: 'Understanding',
  mission: 'Mission', mission_step: 'Mission Step',
}

type Props = {
  graph: KnowledgeGraphData
  onSelectNode: (nodeId: string) => void
  onClose: () => void
}

export default function KnowledgeSearch({ graph, onSelectNode, onClose }: Props) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const results: SearchResult[] = deferredQuery.length >= 2
    ? KnowledgeGraph.search(graph, deferredQuery)
    : []

  const directResults = results.filter((r) => r.matchType === 'direct')
  const relatedResults = results.filter((r) => r.matchType === 'related')

  return (
    <section className="knowledge-search panel" aria-label="Knowledge Search">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">KNOWLEDGE SEARCH</p>
          <h2>Search All Records</h2>
        </div>
        <button className="closeButton" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="ks-search-bar">
        <Search size={16} className="ks-search-icon" />
        <input
          type="search"
          className="ks-input"
          placeholder="Search priorities, commitments, decisions, reflections…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Knowledge search query"
          autoFocus
        />
      </div>

      {query.length >= 2 && results.length === 0 && (
        <p className="ks-no-results">No records or relationships found for "{query}".</p>
      )}

      {directResults.length > 0 && (
        <div className="ks-section">
          <p className="eyebrow">DIRECT MATCHES ({directResults.length})</p>
          <ul className="ks-result-list">
            {directResults.map((r) => (
              <ResultCard key={r.node.id} result={r} onSelect={onSelectNode} />
            ))}
          </ul>
        </div>
      )}

      {relatedResults.length > 0 && (
        <div className="ks-section">
          <p className="eyebrow">RELATED RECORDS ({relatedResults.length})</p>
          <ul className="ks-result-list">
            {relatedResults.map((r) => (
              <ResultCard key={r.node.id} result={r} onSelect={onSelectNode} />
            ))}
          </ul>
        </div>
      )}

      {query.length < 2 && (
        <p className="ks-hint">Enter at least 2 characters to search across all encrypted records.</p>
      )}
    </section>
  )
}

function ResultCard({ result, onSelect }: { result: SearchResult; onSelect: (id: string) => void }) {
  return (
    <li className="ks-result-item">
      <div className="ks-result-header">
        <span className={`kg-type-badge kg-type-badge--${result.node.type}`}>{NODE_TYPE_LABELS[result.node.type]}</span>
        {result.matchType === 'related' && result.relatedVia && (
          <span className="ks-via">via {result.relatedVia.title}</span>
        )}
      </div>
      <button
        className="ks-result-title"
        onClick={() => onSelect(result.node.id)}
        aria-label={`View ${result.node.title}`}
      >
        {result.node.title}
      </button>
    </li>
  )
}
