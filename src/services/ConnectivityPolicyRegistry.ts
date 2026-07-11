import type {
  AdapterDeclaration,
  AdapterRegistrationResult,
  CapabilityDeclaration,
  CapabilityRegistrationResult,
  ConnectivityRegistrySnapshot,
  ConnectivityRule,
  RegistryValidationResult,
} from '../types/connectivity'

const SEMVER = /^\d+\.\d+\.\d+$/

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.+$/g, '')
}

function freeze<T>(value: T): T {
  if (!value || typeof value !== 'object') return value
  const obj = value as Record<string, unknown>
  for (const key of Object.keys(obj)) {
    const child = obj[key]
    if (child && typeof child === 'object') freeze(child)
  }
  return Object.freeze(value)
}

function cloneAdapter(adapter: AdapterDeclaration): AdapterDeclaration {
  return {
    id: adapter.id,
    version: adapter.version,
    enabled: adapter.enabled,
    policyVersion: adapter.policyVersion,
    registryVersion: adapter.registryVersion,
  }
}

function cloneRule(rule: ConnectivityRule): ConnectivityRule {
  return {
    id: rule.id,
    purpose: rule.purpose,
    dataClassifications: [...rule.dataClassifications],
    origins: rule.origins.map(origin => ({ ...origin })),
    pathPatterns: rule.pathPatterns.map(pattern => pattern.kind === 'exact' ? { ...pattern } : { ...pattern }),
    methods: [...rule.methods],
    redirectPolicy: { ...rule.redirectPolicy },
    timeoutPolicy: { ...rule.timeoutPolicy },
  }
}

function cloneCapability(capability: CapabilityDeclaration): CapabilityDeclaration {
  return {
    id: capability.id,
    version: capability.version,
    adapterId: capability.adapterId,
    enabled: capability.enabled,
    rules: capability.rules.map(cloneRule),
  }
}

function isAdapterMalformed(adapter: AdapterDeclaration): boolean {
  if (!adapter.id.startsWith('adapter:')) return true
  if (!SEMVER.test(adapter.version)) return true
  if (!SEMVER.test(adapter.policyVersion)) return true
  if (!SEMVER.test(adapter.registryVersion)) return true
  if (typeof adapter.enabled !== 'boolean') return true
  return false
}

function validateRule(rule: ConnectivityRule): boolean {
  if (typeof rule.id !== 'string' || rule.id.trim().length === 0) return false
  if (!Array.isArray(rule.origins) || rule.origins.length === 0) return false
  if (!Array.isArray(rule.pathPatterns) || rule.pathPatterns.length === 0) return false
  if (!Array.isArray(rule.methods) || rule.methods.length === 0) return false
  if (!Array.isArray(rule.dataClassifications) || rule.dataClassifications.length === 0) return false
  if (typeof rule.timeoutPolicy.defaultMs !== 'number' || typeof rule.timeoutPolicy.maxMs !== 'number') return false
  if (rule.timeoutPolicy.defaultMs <= 0 || rule.timeoutPolicy.maxMs <= 0) return false
  if (rule.timeoutPolicy.defaultMs > rule.timeoutPolicy.maxMs) return false
  if (rule.redirectPolicy.mode !== 'deny' && rule.redirectPolicy.mode !== 'revalidate') return false
  for (const origin of rule.origins) {
    if (!origin.hostname || typeof origin.hostname !== 'string') return false
    const host = normalizeHostname(origin.hostname)
    if (!host) return false
    if (/[\u0000-\u001F\u007F\s\\/@]/.test(host)) return false
    if (/^\*+$/.test(host)) return false
    if (origin.protocol !== 'https' && origin.protocol !== 'http') return false
    if (origin.port !== undefined && (!Number.isInteger(origin.port) || origin.port <= 0 || origin.port > 65535)) return false
  }
  for (const pattern of rule.pathPatterns) {
    if (pattern.kind === 'exact') {
      if (!pattern.path.startsWith('/')) return false
    } else if (pattern.kind === 'prefix') {
      if (!pattern.pathPrefix.startsWith('/')) return false
    } else {
      return false
    }
  }
  return true
}

function capabilitySignatures(capability: CapabilityDeclaration): Set<string> {
  const signatures = new Set<string>()
  for (const rule of capability.rules) {
    for (const origin of rule.origins) {
      for (const pattern of rule.pathPatterns) {
        for (const method of rule.methods) {
          const path = pattern.kind === 'exact' ? `exact:${pattern.path}` : `prefix:${pattern.pathPrefix}`
          for (const dataClass of rule.dataClassifications) {
            signatures.add(
              [
                rule.purpose,
                dataClass,
                origin.protocol,
                normalizeHostname(origin.hostname),
                origin.port ?? '',
                method,
                path,
              ].join('|'),
            )
          }
        }
      }
    }
  }
  return signatures
}

function isCapabilityMalformed(capability: CapabilityDeclaration): boolean {
  if (!capability.id.startsWith('cap:')) return true
  if (!capability.adapterId.startsWith('adapter:')) return true
  if (!SEMVER.test(capability.version)) return true
  if (typeof capability.enabled !== 'boolean') return true
  if (!Array.isArray(capability.rules) || capability.rules.length === 0) return true
  const ids = new Set<string>()
  const signatures = new Set<string>()
  for (const rule of capability.rules) {
    if (!validateRule(rule)) return true
    if (ids.has(rule.id)) return true
    ids.add(rule.id)
    for (const origin of rule.origins) {
      for (const pattern of rule.pathPatterns) {
        for (const method of rule.methods) {
          const path = pattern.kind === 'exact' ? pattern.path : `prefix:${pattern.pathPrefix}`
          const signature = `${rule.purpose}|${origin.protocol}|${origin.hostname}|${origin.port ?? ''}|${path}|${method}`
          if (signatures.has(signature)) return true
          signatures.add(signature)
        }
      }
    }
  }
  return false
}

export class ConnectivityPolicyRegistry {
  private readonly adapters = new Map<string, AdapterDeclaration>()
  private readonly capabilities = new Map<string, CapabilityDeclaration>()

  registerAdapter(input: AdapterDeclaration): AdapterRegistrationResult {
    const adapter = cloneAdapter(input)
    if (this.adapters.has(adapter.id)) return { ok: false, reason: 'duplicate_adapter' }
    if (isAdapterMalformed(adapter)) return { ok: false, reason: 'malformed_adapter' }
    if (!SEMVER.test(adapter.version)) return { ok: false, reason: 'invalid_version' }
    this.adapters.set(adapter.id, adapter)
    return { ok: true, adapter: cloneAdapter(adapter) }
  }

  registerCapability(input: CapabilityDeclaration): CapabilityRegistrationResult {
    const capability = cloneCapability(input)
    if (this.capabilities.has(capability.id)) return { ok: false, reason: 'duplicate_capability' }
    if (!this.adapters.has(capability.adapterId)) return { ok: false, reason: 'unknown_adapter' }
    if (isCapabilityMalformed(capability)) return { ok: false, reason: 'malformed_capability' }
    if (!SEMVER.test(capability.version)) return { ok: false, reason: 'invalid_version' }
    const nextSignatures = capabilitySignatures(capability)
    for (const existing of this.capabilities.values()) {
      if (existing.adapterId !== capability.adapterId) continue
      const existingSignatures = capabilitySignatures(existing)
      for (const signature of nextSignatures) {
        if (existingSignatures.has(signature)) return { ok: false, reason: 'registry_conflict' }
      }
    }
    this.capabilities.set(capability.id, capability)
    return { ok: true, capability: cloneCapability(capability) }
  }

  enableCapability(capabilityId: string): boolean {
    const capability = this.capabilities.get(capabilityId)
    if (!capability) return false
    capability.enabled = true
    return true
  }

  disableCapability(capabilityId: string): boolean {
    const capability = this.capabilities.get(capabilityId)
    if (!capability) return false
    capability.enabled = false
    return true
  }

  enableAdapter(adapterId: string): boolean {
    const adapter = this.adapters.get(adapterId)
    if (!adapter) return false
    adapter.enabled = true
    return true
  }

  disableAdapter(adapterId: string): boolean {
    const adapter = this.adapters.get(adapterId)
    if (!adapter) return false
    adapter.enabled = false
    return true
  }

  validate(): RegistryValidationResult {
    const reasons = new Set<RegistryValidationResult['reasons'][number]>()
    for (const adapter of this.adapters.values()) {
      if (isAdapterMalformed(adapter)) reasons.add('malformed_adapter')
    }
    for (const capability of this.capabilities.values()) {
      if (!this.adapters.has(capability.adapterId)) reasons.add('capability_without_adapter')
      if (isCapabilityMalformed(capability)) reasons.add('malformed_capability')
    }
    return { valid: reasons.size === 0, reasons: [...reasons].sort() }
  }

  snapshot(): ConnectivityRegistrySnapshot {
    const adapters = [...this.adapters.values()].map(cloneAdapter).sort((a, b) => a.id.localeCompare(b.id))
    const capabilities = [...this.capabilities.values()].map(cloneCapability).sort((a, b) => a.id.localeCompare(b.id))
    const snapshot: ConnectivityRegistrySnapshot = {
      adapters,
      capabilities,
      validation: this.validate(),
    }
    return freeze(snapshot)
  }
}

export function createConnectivityPolicyRegistry() {
  return new ConnectivityPolicyRegistry()
}
