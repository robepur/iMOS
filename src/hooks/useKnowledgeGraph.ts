import { useMemo, useCallback } from 'react'
import type { PersonalData, KnowledgeGraphData, NodeType } from '../localData'
import { KnowledgeGraph } from '../services/KnowledgeGraph'
import type { RelatedRecord, SearchResult, GraphStats } from '../services/KnowledgeGraph'

export type UseKnowledgeGraphReturn = {
  graph: KnowledgeGraphData
  getRelated: (nodeId: string) => RelatedRecord[]
  search: (query: string) => SearchResult[]
  getStats: () => GraphStats
  patch: (data: PersonalData, changedType: NodeType | 'all') => KnowledgeGraphData
}

const EMPTY_GRAPH: KnowledgeGraphData = { nodes: [], edges: [], builtAt: '' }

export function useKnowledgeGraph(data: PersonalData | null): UseKnowledgeGraphReturn {
  const graph = useMemo<KnowledgeGraphData>(() => {
    if (!data) return EMPTY_GRAPH
    return KnowledgeGraph.build(data)
  }, [data])

  const getRelated = useCallback((nodeId: string): RelatedRecord[] => {
    return KnowledgeGraph.getRelated(graph, nodeId)
  }, [graph])

  const search = useCallback((query: string): SearchResult[] => {
    return KnowledgeGraph.search(graph, query)
  }, [graph])

  const getStats = useCallback((): GraphStats => {
    return KnowledgeGraph.getStats(graph)
  }, [graph])

  const patch = useCallback((patchData: PersonalData, changedType: NodeType | 'all'): KnowledgeGraphData => {
    return KnowledgeGraph.patch(patchData, changedType)
  }, [])

  return { graph, getRelated, search, getStats, patch }
}
