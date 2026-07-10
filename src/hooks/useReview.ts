import { useState } from 'react'
import type { ReviewPeriod } from '../localData'

export type ReviewTab = 'dashboard' | 'timeline' | 'commitments' | 'decisions' | 'reflections' | 'statistics'

export function useReview() {
  const [period, setPeriod] = useState<ReviewPeriod>('week')
  const [tab, setTab] = useState<ReviewTab>('dashboard')
  return { period, setPeriod, tab, setTab }
}
