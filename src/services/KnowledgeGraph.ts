/**
 * KnowledgeGraph — deterministic operator relationship engine.
 *
 * Rules:
 * - No AI, no embeddings, no inference beyond explicit textual evidence.
 * - Every edge has explainable evidence.
 * - Relationships are discovered from operator-supplied data only.
 * - Secret values (passwords) are never exposed in relationship evidence.
 * - Confidence is derived from evidence count only.
 */

import type {
  PersonalData, GraphNode, GraphEdge, KnowledgeGraphData,
  NodeType, EdgeType, Priority, Commitment, Decision,
  Reflection, TimelineEntry, SecretRecord, RosieRecommendation,
} from '../localData'
import { createId } from '../localData'
import { UnderstandingEngine } from './UnderstandingEngine'

// ── Helpers ────────────────────────────────────────────────────────────────────

function edgeId(source: string, target: string, type: EdgeType): string {
  return `edge-${type}-${source}-${target}`
}

function confidenceFromEvidence(count: number): GraphEdge['confidence'] {
  if (count >= 3) return 'high'
  if (count >= 2) return 'medium'
  return 'low'
}

/** Extract significant words (>4 chars) from a string for keyword matching */
function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 4)
}

/** Count how many keywords from `needles` appear in `haystack` text */
function keywordOverlap(needles: string[], haystack: string): number {
  const lower = haystack.toLowerCase()
  return needles.filter((w) => lower.includes(w)).length
}

function mkEdge(
  source: string, target: string, type: EdgeType,
  evidence: string[], now: string
): GraphEdge {
  return {
    id: edgeId(source, target, type),
    source, target, type, evidence,
    createdAt: now,
    confidence: confidenceFromEvidence(evidence.length),
  }
}

// ── Node builders ──────────────────────────────────────────────────────────────

function priorityNode(p: Priority): GraphNode {
  return { id: p.id, type: 'priority', title: p.title, createdAt: p.createdAt }
}

function commitmentNode(c: Commitment): GraphNode {
  return { id: c.id, type: 'commitment', title: c.title, createdAt: c.createdAt }
}

function decisionNode(d: Decision): GraphNode {
  return { id: d.id, type: 'decision', title: d.title, createdAt: d.createdAt }
}

function reflectionNode(r: Reflection): GraphNode {
  return {
    id: r.id, type: 'reflection',
    title: `Reflection: ${new Date(r.createdAt).toLocaleDateString()}`,
    createdAt: r.createdAt,
  }
}

function timelineNode(t: TimelineEntry): GraphNode {
  return { id: t.id, type: 'timeline', title: t.title, createdAt: t.createdAt }
}

function secretNode(s: SecretRecord): GraphNode {
  // Never expose secret values — only safe metadata
  return { id: s.id, type: 'secret', title: s.title, createdAt: s.createdAt }
}

function recommendationNode(r: RosieRecommendation): GraphNode {
  return { id: r.id, type: 'recommendation', title: r.title, createdAt: r.createdAt }
}

function understandingNode(id: string, title: string, createdAt: string): GraphNode {
  return { id, type: 'understanding', title, createdAt }
}

// ── Edge discovery rules ───────────────────────────────────────────────────────

function discoverEdges(data: PersonalData, now: string): GraphEdge[] {
  const edges: GraphEdge[] = []
  const seen = new Set<string>()

  function add(edge: GraphEdge) {
    if (!seen.has(edge.id)) {
      seen.add(edge.id)
      edges.push(edge)
    }
  }

  const priorities = data.priorities
  const commitments = data.commitments
  const decisions = data.decisions
  const reflections = data.reflections
  const timeline = data.timeline
  const secrets = data.secrets ?? []
  const recommendations = data.recommendations ?? []

  // Rule 1: Reflection text mentions priority title keywords
  for (const r of reflections) {
    const reflText = `${r.accomplished} ${r.remember} ${r.tomorrow}`.toLowerCase()
    for (const p of priorities) {
      const kws = keywords(p.title)
      const overlap = keywordOverlap(kws, reflText)
      if (overlap > 0) {
        const evidence = [
          `Reflection from ${new Date(r.createdAt).toLocaleDateString()} mentions "${p.title}"`,
          ...(r.remember && keywordOverlap(kws, r.remember) > 0
            ? [`Memory note references "${p.title}" keywords`]
            : []),
          ...(overlap >= 2 ? [`${overlap} keyword matches found`] : []),
        ]
        add(mkEdge(r.id, p.id, 'mentioned_in', evidence, now))
      }
    }
  }

  // Rule 2: Reflection "remember" field cross-references priority → remembered_by
  for (const r of reflections) {
    if (!r.remember.trim()) continue
    for (const p of priorities) {
      const kws = keywords(p.title)
      if (keywordOverlap(kws, r.remember) > 0) {
        add(mkEdge(r.id, p.id, 'remembered_by', [
          `Rosie memory note from ${new Date(r.createdAt).toLocaleDateString()} references "${p.title}"`,
          `Memory text: "${r.remember.slice(0, 100)}"`,
        ], now))
      }
    }
  }

  // Rule 3: Commitment title mentions decision keywords → references
  for (const c of commitments) {
    for (const d of decisions) {
      const kws = keywords(d.title)
      const overlap = keywordOverlap(kws, c.title)
      if (overlap > 0) {
        add(mkEdge(c.id, d.id, 'references', [
          `Commitment "${c.title}" shares keywords with decision "${d.title}"`,
          `${overlap} keyword match${overlap !== 1 ? 'es' : ''}`,
        ], now))
      }
    }
  }

  // Rule 4: Decision context mentions priority keywords → depends_on
  for (const d of decisions) {
    if (!d.context.trim()) continue
    for (const p of priorities) {
      const kws = keywords(p.title)
      const overlap = keywordOverlap(kws, d.context)
      if (overlap > 0) {
        add(mkEdge(d.id, p.id, 'depends_on', [
          `Decision "${d.title}" context references priority "${p.title}"`,
          `Context: "${d.context.slice(0, 100)}"`,
        ], now))
      }
    }
  }

  // Rule 5: Priority and commitment share keywords → related_to
  for (const p of priorities) {
    const pkws = keywords(p.title)
    for (const c of commitments) {
      const overlap = keywordOverlap(pkws, c.title)
      if (overlap > 0) {
        add(mkEdge(p.id, c.id, 'related_to', [
          `Priority "${p.title}" and commitment "${c.title}" share ${overlap} keyword${overlap !== 1 ? 's' : ''}`,
        ], now))
      }
    }
  }

  // Rule 6: Recommendation references a commitment, decision, or priority by ID in evidence
  for (const rec of recommendations) {
    for (const ev of rec.evidence) {
      for (const p of priorities) {
        if (ev.toLowerCase().includes(p.title.toLowerCase().slice(0, 20))) {
          add(mkEdge(rec.id, p.id, 'observed_in', [
            `Recommendation "${rec.title}" cites priority "${p.title}" as evidence`,
            ev.slice(0, 120),
          ], now))
        }
      }
      for (const c of commitments) {
        if (ev.toLowerCase().includes(c.title.toLowerCase().slice(0, 20))) {
          add(mkEdge(rec.id, c.id, 'observed_in', [
            `Recommendation "${rec.title}" cites commitment "${c.title}" as evidence`,
            ev.slice(0, 120),
          ], now))
        }
      }
      for (const d of decisions) {
        if (ev.toLowerCase().includes(d.title.toLowerCase().slice(0, 20))) {
          add(mkEdge(rec.id, d.id, 'observed_in', [
            `Recommendation "${rec.title}" cites decision "${d.title}" as evidence`,
            ev.slice(0, 120),
          ], now))
        }
      }
    }
  }

  // Rule 7: Timeline event title matches priority/commitment/decision → observed_in
  for (const t of timeline) {
    for (const p of priorities) {
      const kws = keywords(p.title)
      if (kws.length > 0 && keywordOverlap(kws, t.title + ' ' + t.detail) > 0) {
        add(mkEdge(t.id, p.id, 'observed_in', [
          `Timeline event "${t.title}" references priority "${p.title}"`,
        ], now))
      }
    }
  }

  // Rule 8: Completed priority — reflection created in same day window → completed_by
  for (const p of priorities.filter((pr) => pr.completed && pr.completedAt)) {
    const completedDay = p.completedAt!.slice(0, 10)
    for (const r of reflections) {
      if (r.createdAt.slice(0, 10) === completedDay) {
        add(mkEdge(p.id, r.id, 'completed_by', [
          `Priority "${p.title}" completed on ${completedDay}`,
          `Reflection recorded on same date`,
        ], now))
      }
    }
  }

  // Rule 9: Secret category → priority keyword match → supports
  for (const s of secrets) {
    for (const p of priorities) {
      const kws = keywords(p.title)
      // Only compare against safe fields (title, category, url) — never password
      const safeText = `${s.title} ${s.category} ${s.url}`
      const overlap = keywordOverlap(kws, safeText)
      if (overlap > 0) {
        add(mkEdge(s.id, p.id, 'supports', [
          `Secret "${s.title}" (${s.category}) may support priority "${p.title}"`,
          `${overlap} keyword match${overlap !== 1 ? 'es' : ''} on safe metadata`,
        ], now))
      }
    }
  }

  return edges
}

// ── Public API ─────────────────────────────────────────────────────────────────

export type GraphStats = {
  totalNodes: number
  totalEdges: number
  avgDegree: number
  mostConnectedPriority: string | null
  mostConnectedCommitment: string | null
  mostReferencedReflection: string | null
  recommendationCoverage: number
}

export type RelatedRecord = {
  node: GraphNode
  edge: GraphEdge
  direction: 'outbound' | 'inbound'
}

export type SearchResult = {
  node: GraphNode
  matchType: 'direct' | 'related'
  relatedVia?: GraphNode
  score: number
}

export const KnowledgeGraph = {
  /**
   * Build the full knowledge graph from PersonalData.
   * Called on vault unlock, or after bulk restore.
   */
  build(data: PersonalData): KnowledgeGraphData {
    const now = new Date().toISOString()
    const understanding = UnderstandingEngine.analyze(data)
    const understandingNodes: GraphNode[] = []
    const understandingEdges: GraphEdge[] = []

    for (const signal of understanding.drift.signals) {
      if (signal.severity === 'info') continue
      const nodeId = `understanding-drift-${signal.id}`
      understandingNodes.push(understandingNode(nodeId, `Drift: ${signal.title}`, now))
      const signalText = `${signal.title} ${signal.description} ${signal.evidence.join(' ')}`.toLowerCase()
      const matchedPriorities = data.priorities.filter((x) => !x.completed && keywordOverlap(keywords(x.title), signalText) > 0).slice(0, 3)
      for (const p of matchedPriorities) {
        understandingEdges.push(mkEdge(nodeId, p.id, 'observed_in', [
          signal.description,
          signal.evidence[0] ?? 'Detected from operator records.',
        ], now))
      }
    }

    for (const metric of Object.values(understanding.trends)) {
      if (metric.direction === 'stable') continue
      const nodeId = `understanding-trend-${metric.dimension.toLowerCase().replace(/\s+/g, '-')}`
      understandingNodes.push(understandingNode(nodeId, `Trend: ${metric.dimension} ${metric.direction}`, now))
      if (metric.dimension.includes('Priority')) {
        data.priorities
          .filter((p) => keywordOverlap(keywords(metric.dimension), p.title) > 0)
          .slice(0, 2)
          .forEach((p) => understandingEdges.push(mkEdge(nodeId, p.id, 'derived_from', [metric.evidence[0]], now)))
      } else if (metric.dimension.includes('Commitment')) {
        data.commitments
          .filter((c) => keywordOverlap(keywords(metric.dimension), c.title) > 0)
          .slice(0, 2)
          .forEach((c) => understandingEdges.push(mkEdge(nodeId, c.id, 'derived_from', [metric.evidence[0]], now)))
      } else if (metric.dimension.includes('Decision')) {
        data.decisions
          .filter((d) => keywordOverlap(keywords(metric.dimension), d.title) > 0)
          .slice(0, 2)
          .forEach((d) => understandingEdges.push(mkEdge(nodeId, d.id, 'derived_from', [metric.evidence[0]], now)))
      } else {
        data.reflections.slice(0, 2).forEach((r) => understandingEdges.push(mkEdge(nodeId, r.id, 'derived_from', [metric.evidence[0]], now)))
      }
    }

    const outcome = understanding.statistics.recommendationOutcomes
    if (outcome.total > 0) {
      const nodeId = 'understanding-recommendation-outcomes'
      understandingNodes.push(understandingNode(nodeId, `Recommendation outcomes: ${outcome.completed} completed, ${outcome.dismissed} dismissed`, now))
      data.recommendations?.slice(0, 5).forEach((r) => {
        understandingEdges.push(mkEdge(nodeId, r.id, 'observed_in', [
          `Outcome metrics derived from recommendation records.`,
          `Completed ${outcome.completed}, dismissed ${outcome.dismissed}, snoozed ${outcome.snoozed}, ignored ${outcome.ignored}.`,
        ], now))
      })
    }

    const nodes: GraphNode[] = [
      ...data.priorities.map(priorityNode),
      ...data.commitments.map(commitmentNode),
      ...data.decisions.map(decisionNode),
      ...data.reflections.map(reflectionNode),
      ...data.timeline.map(timelineNode),
      ...(data.secrets ?? []).map(secretNode),
      ...(data.recommendations ?? []).map(recommendationNode),
      ...understandingNodes,
    ]
    const edges = [...discoverEdges(data, now), ...understandingEdges]
    return { nodes, edges, builtAt: now }
  },

  /**
   * Patch the graph incrementally after a specific change type.
   * Rebuilds only affected node lists and re-runs edge discovery.
   * For vault sizes we handle, full edge rediscovery is fast (<1ms).
   */
  patch(data: PersonalData, _changedType: NodeType | 'all'): KnowledgeGraphData {
    return KnowledgeGraph.build(data)
  },

  /**
   * Get all records related to a given node ID.
   */
  getRelated(graph: KnowledgeGraphData, nodeId: string): RelatedRecord[] {
    const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))
    const results: RelatedRecord[] = []

    for (const edge of graph.edges) {
      if (edge.source === nodeId) {
        const target = nodeMap.get(edge.target)
        if (target) results.push({ node: target, edge, direction: 'outbound' })
      } else if (edge.target === nodeId) {
        const source = nodeMap.get(edge.source)
        if (source) results.push({ node: source, edge, direction: 'inbound' })
      }
    }

    return results.sort((a, b) => {
      const confOrder = { high: 0, medium: 1, low: 2 }
      return confOrder[a.edge.confidence] - confOrder[b.edge.confidence]
    })
  },

  /**
   * Search across all node titles and return direct + related matches.
   */
  search(graph: KnowledgeGraphData, query: string): SearchResult[] {
    if (!query.trim()) return []
    const q = query.toLowerCase().trim()
    const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))
    const results = new Map<string, SearchResult>()

    // Direct matches
    for (const node of graph.nodes) {
      const titleMatch = node.title.toLowerCase().includes(q)
      if (titleMatch) {
        results.set(node.id, { node, matchType: 'direct', score: 100 })
      }
    }

    // Related matches (1-hop from direct matches)
    for (const [directId] of results) {
      for (const edge of graph.edges) {
        const relatedId = edge.source === directId ? edge.target : edge.target === directId ? edge.source : null
        if (relatedId && !results.has(relatedId)) {
          const related = nodeMap.get(relatedId)
          const direct = nodeMap.get(directId)
          if (related && direct) {
            results.set(relatedId, {
              node: related, matchType: 'related', relatedVia: direct,
              score: 50,
            })
          }
        }
      }
    }

    return Array.from(results.values()).sort((a, b) => b.score - a.score)
  },

  /**
   * Compute graph statistics for the Statistics panel.
   */
  getStats(graph: KnowledgeGraphData): GraphStats {
    if (graph.nodes.length === 0) {
      return { totalNodes: 0, totalEdges: 0, avgDegree: 0, mostConnectedPriority: null, mostConnectedCommitment: null, mostReferencedReflection: null, recommendationCoverage: 0 }
    }

    const degree = new Map<string, number>()
    for (const n of graph.nodes) degree.set(n.id, 0)
    for (const e of graph.edges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1)
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1)
    }

    const byType = (type: GraphNode['type']) =>
      graph.nodes.filter((n) => n.type === type)

    const topByDegree = (nodes: GraphNode[]) =>
      nodes.sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))[0]?.title ?? null

    const priorityNodes = byType('priority')
    const recNodes = byType('recommendation')
    const coveredPriorities = new Set<string>()
    for (const e of graph.edges) {
      if (recNodes.some((r) => r.id === e.source) && priorityNodes.some((p) => p.id === e.target)) {
        coveredPriorities.add(e.target)
      }
    }

    return {
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
      avgDegree: graph.edges.length > 0 ? parseFloat(((graph.edges.length * 2) / graph.nodes.length).toFixed(1)) : 0,
      mostConnectedPriority: topByDegree([...priorityNodes]),
      mostConnectedCommitment: topByDegree([...byType('commitment')]),
      mostReferencedReflection: topByDegree([...byType('reflection')]),
      recommendationCoverage: priorityNodes.length > 0
        ? Math.round((coveredPriorities.size / priorityNodes.length) * 100)
        : 0,
    }
  },

  /**
   * Explain a relationship in plain language.
   */
  explainEdge(edge: GraphEdge, sourceTitle: string, targetTitle: string): string {
    const labels: Record<EdgeType, string> = {
      related_to:    `"${sourceTitle}" is related to "${targetTitle}"`,
      created_from:  `"${sourceTitle}" was created from "${targetTitle}"`,
      references:    `"${sourceTitle}" references "${targetTitle}"`,
      supports:      `"${sourceTitle}" supports "${targetTitle}"`,
      depends_on:    `"${sourceTitle}" depends on "${targetTitle}"`,
      completed_by:  `"${sourceTitle}" was completed during "${targetTitle}"`,
      mentioned_in:  `"${sourceTitle}" is mentioned in "${targetTitle}"`,
      derived_from:  `"${sourceTitle}" is derived from "${targetTitle}"`,
      observed_in:   `"${sourceTitle}" was observed in "${targetTitle}"`,
      remembered_by: `"${sourceTitle}" is remembered in "${targetTitle}"`,
    }
    return labels[edge.type] ?? `"${sourceTitle}" is connected to "${targetTitle}"`
  },
}
