import { useMemo } from 'react'
import type { PersonalData } from '../localData'
import { isOverdue } from '../utils/date'

export function usePriorities(data: PersonalData | null) {
  return useMemo(() => {
    if (!data) return { activePriorities: [], primary: undefined, criticalCount: 0, overdueCount: 0 }
    const activePriorities = data.priorities.filter((p) => !p.completed)
    const primary = activePriorities.find((p) => p.primary) ?? activePriorities[0]
    const criticalCount = activePriorities.filter((p) => p.level === 'critical').length
    const overdueCount = activePriorities.filter((p) => isOverdue(p.due)).length
    return { activePriorities, primary, criticalCount, overdueCount }
  }, [data])
}
