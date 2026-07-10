// Application-wide constants. No magic numbers or magic strings elsewhere.

export const SCHEMA_VERSION = 1

export const STORAGE_KEYS = {
  VAULT: 'imos.vault.v1',
  LEGACY: 'imos.personal.v1',
  RECOVERY_AUDIT: 'imos.recovery.audit.v1',
} as const

export const CRYPTO = {
  ITERATIONS: 310_000,
  MIN_PASSPHRASE_LENGTH: 12,
  SALT_BYTES: 16,
  IV_BYTES: 12,
} as const

export const LIMITS = {
  ROSIE_MEMORY_ITEMS: 5,
  TIMELINE_SIDEBAR_ITEMS: 8,
  RECOVERY_AUDIT_ITEMS: 100,
  CLIPBOARD_CLEAR_MS: 30_000,
} as const

export const PRIORITY_LEVELS = ['critical', 'high', 'normal', 'low'] as const

export const REVIEW_PERIOD_LABELS: Record<string, string> = {
  today: 'Today',
  week: 'Last 7 Days',
  month: 'Last 30 Days',
  quarter: 'Last 90 Days',
  all: 'All Time',
}

export const TIMELINE_TYPE_LABELS: Record<string, string> = {
  all: 'All Types',
  priority: 'Priority',
  commitment: 'Commitment',
  decision: 'Decision',
  reflection: 'Reflection',
  secret: 'Secret',
  recovery: 'Recovery',
  system: 'System',
}

export const APP_NAME = 'iMOS'
export const APP_FULL_NAME = 'Individual Mission Operating System'
export const BUILD = '008'
