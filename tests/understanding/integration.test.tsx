import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { OperatorUnderstanding } from '../../src/services/UnderstandingEngine'
import UnderstandingDashboard from '../../src/features/understanding/UnderstandingDashboard'
import { createInitialData } from '../../src/localData'
import { KnowledgeGraph } from '../../src/services/KnowledgeGraph'
import { UnderstandingEngine } from '../../src/services/UnderstandingEngine'

function makeUnderstanding(): OperatorUnderstanding {
  const data = createInitialData()
  const u = UnderstandingEngine.analyze(data)
  return {
    ...u,
    patterns: {
      ...u.patterns,
      repeatedRecommendationDismissals: [{ category: 'priority', count: 2, evidence: 'Two dismissals' }],
    },
  }
}

describe('Build 011 integration', () => {
  it('renders dashboard using repeatedRecommendationDismissals', () => {
    render(<UnderstandingDashboard understanding={makeUnderstanding()} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Patterns' }))
    expect(screen.getByText('REPEATED RECOMMENDATION DISMISSALS')).toBeInTheDocument()
    expect(screen.getByText('priority')).toBeInTheDocument()
  })

  it('builds safe understanding graph nodes without secret value leakage', () => {
    const data = createInitialData()
    data.secrets = [{ id: 's1', title: 'Bank', category: 'finance', username: 'u', password: 'super-secret-password', url: 'bank.local', notes: '', favorite: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]
    const graph = KnowledgeGraph.build(data)

    expect(graph.nodes.some((n) => n.type === 'understanding')).toBe(true)
    const evidenceBlob = graph.edges.flatMap((e) => e.evidence).join(' ')
    expect(evidenceBlob).not.toContain('super-secret-password')
  })
})
