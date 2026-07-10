import { useMemo } from 'react'
import type { PersonalData } from '../localData'
import { UnderstandingEngine } from '../services/UnderstandingEngine'
import type { OperatorUnderstanding } from '../services/UnderstandingEngine'

export type UseUnderstandingReturn = {
  understanding: OperatorUnderstanding | null
}

export function useUnderstanding(data: PersonalData | null): UseUnderstandingReturn {
  const understanding = useMemo<OperatorUnderstanding | null>(() => {
    if (!data) return null
    return UnderstandingEngine.analyze(data)
  }, [data])

  return { understanding }
}
