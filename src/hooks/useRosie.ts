import { useMemo } from 'react'
import type { PersonalData, ReviewPeriod } from '../localData'
import { RosieEngine } from '../services/RosieEngine'
import { usePriorities } from './usePriorities'

export function useRosie(data: PersonalData | null, period?: ReviewPeriod) {
  const { primary } = usePriorities(data)

  const greeting = useMemo(() => RosieEngine.getGreeting(), [])
  const recommendation = useMemo(() => RosieEngine.getRecommendation(primary), [primary])
  const memory = useMemo(() => data ? RosieEngine.getMemory(data, period) : [], [data, period])
  const execSummary = useMemo(() => data && period ? RosieEngine.getExecutiveSummary(data, period) : [], [data, period])
  const briefLine = useMemo(() => data ? RosieEngine.getBriefLine(data) : '', [data])

  return { greeting, recommendation, memory, execSummary, briefLine }
}
