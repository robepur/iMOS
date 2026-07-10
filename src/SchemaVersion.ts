import type { PersonalData } from './localData'
import { normalizePersonalData } from './localData'
import { SCHEMA_VERSION } from './constants'

export { SCHEMA_VERSION }

/**
 * Migration pipeline. Accepts any raw unknown payload from LocalStorage
 * and returns a fully normalized, current-schema PersonalData object.
 *
 * Compatible with vaults from Builds 003 – 012.
 * Never discards operator data.
 */
export function migrateToLatest(raw: unknown): PersonalData {
  if (!raw || typeof raw !== 'object') {
    return normalizePersonalData(_emptyData())
  }
  const obj = raw as Record<string, unknown>
  // Ensure version field is present — older builds may not have it
  const withVersion = { ...obj, version: obj['version'] ?? 1 } as PersonalData
  return normalizePersonalData(withVersion)
}

function _emptyData(): PersonalData {
  return {
    version: SCHEMA_VERSION as 1,
    priorities: [],
    commitments: [],
    decisions: [],
    timeline: [],
    reflections: [],
    secrets: [],
  }
}

export function isCompatibleVersion(version: unknown): boolean {
  return version === SCHEMA_VERSION
}
