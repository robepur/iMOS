import { useMemo } from 'react'
import type { PersonalData } from '../localData'

export function useSecrets(data: PersonalData | null) {
  return useMemo(() => ({
    records: data?.secrets ?? [],
    count: data?.secrets?.length ?? 0,
  }), [data])
}
