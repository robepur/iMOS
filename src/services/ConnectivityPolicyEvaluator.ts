import type {
  AdapterDeclaration,
  AuditAttribution,
  CancellationState,
  CapabilityDeclaration,
  ConnectivityAuditEvent,
  ConnectivityRequestDescriptor,
  ConnectivityRule,
  PolicyDecision,
  PolicyRejectionReason,
} from '../types/connectivity'
import type { ConnectivityRegistrySnapshot } from '../types/connectivity'

function normalizeHostname(hostname: string): string {
  const trimmed = hostname.trim().toLowerCase().replace(/\.+$/g, '')
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) return trimmed.slice(1, -1)
  return trimmed
}

function hasMalformedPercentEncoding(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value[i] !== '%') continue
    const a = value[i + 1]
    const b = value[i + 2]
    if (!a || !b) return true
    if (!/[0-9a-f]/i.test(a) || !/[0-9a-f]/i.test(b)) return true
  }
  return false
}

function isIpv4Literal(hostname: string): boolean {
  return /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
}

function parseIpv4(hostname: string): number[] | null {
  if (!isIpv4Literal(hostname)) return null
  const parts = hostname.split('.').map(Number)
  if (parts.length !== 4) return null
  for (const part of parts) {
    if (!Number.isInteger(part) || part < 0 || part > 255) return null
  }
  return parts
}

function isPrivateOrLocalIpv4(parts: number[]): boolean {
  const [a, b] = parts
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

function isPrivateOrLocalIpv6(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === '::1' || host === '::') return true
  if (/^fe[89ab]/.test(host)) return true
  if (host.startsWith('fc') || host.startsWith('fd')) return true
  if (host.includes('.') && host.includes(':')) {
    const ipv4Tail = host.slice(host.lastIndexOf(':') + 1)
    const parsed = parseIpv4(ipv4Tail)
    if (parsed && isPrivateOrLocalIpv4(parsed)) return true
  }
  return false
}

function isLocalAddress(hostname: string): boolean {
  const host = normalizeHostname(hostname)
  if (!host) return true
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (/^(0x[0-9a-f]+|\d+)$/i.test(host)) return true
  const ipv4 = parseIpv4(host)
  if (ipv4 && isPrivateOrLocalIpv4(ipv4)) return true
  if (host.includes(':') && isPrivateOrLocalIpv6(host)) return true
  return false
}

function defaultPort(protocol: string): number {
  if (protocol === 'https:') return 443
  if (protocol === 'http:') return 80
  return -1
}

function normalizePath(pathname: string): { ok: true; value: string } | { ok: false; reason: PolicyRejectionReason } {
  if (!pathname.startsWith('/')) return { ok: false, reason: 'path_not_allowed' }
  if (/%2f|%5c/i.test(pathname)) return { ok: false, reason: 'encoded_path_bypass_detected' }
  const rawSegments = pathname.split('/')
  const cleanSegments: string[] = []
  for (const segment of rawSegments) {
    if (segment.length === 0) continue
    let decoded = segment
    for (let i = 0; i < 3; i++) {
      try {
        const next = decodeURIComponent(decoded)
        if (next === decoded) break
        decoded = next
      } catch {
        return { ok: false, reason: 'invalid_url' }
      }
    }
    if (decoded === '.' || decoded === '..') return { ok: false, reason: 'path_traversal_detected' }
    if (decoded.includes('/') || decoded.includes('\\')) return { ok: false, reason: 'encoded_path_bypass_detected' }
    cleanSegments.push(decoded)
  }
  return { ok: true, value: `/${cleanSegments.join('/')}`.replace(/\/+/g, '/') || '/' }
}

function normalizeUrl(rawUrl: string, allowLocalAddress = false): {
  ok: true
  url: URL
  normalizedOrigin: string
  normalizedPath: string
} | {
  ok: false
  reason: PolicyRejectionReason
} {
  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) return { ok: false, reason: 'malformed_request' }
  if (rawUrl !== rawUrl.trim()) return { ok: false, reason: 'invalid_url' }
  if (rawUrl.trim().startsWith('//')) return { ok: false, reason: 'protocol_relative_url' }
  if (/[\u0000-\u001F\u007F]/.test(rawUrl)) return { ok: false, reason: 'invalid_url' }
  if (rawUrl.includes('\\')) return { ok: false, reason: 'invalid_url' }
  if (hasMalformedPercentEncoding(rawUrl)) return { ok: false, reason: 'malformed_percent_encoding' }
  if (/\/(?:\.|%2e)(?:\.|%2e)?(?:\/|$)/i.test(rawUrl)) return { ok: false, reason: 'path_traversal_detected' }
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { ok: false, reason: 'invalid_url' }
  }
  if (url.username || url.password) return { ok: false, reason: 'url_contains_credentials' }
  if (url.hash) return { ok: false, reason: 'url_contains_fragment' }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, reason: 'unsupported_protocol' }
  const normalized = normalizePath(url.pathname)
  if (!normalized.ok) return normalized
  const host = normalizeHostname(url.hostname)
  if (!host) return { ok: false, reason: 'invalid_url' }
  if (!allowLocalAddress && isLocalAddress(host)) return { ok: false, reason: 'local_address_not_allowed' }
  const port = url.port ? Number(url.port) : defaultPort(url.protocol)
  if (!Number.isInteger(port) || port <= 0) return { ok: false, reason: 'invalid_url' }
  return {
    ok: true,
    url,
    normalizedOrigin: `${url.protocol}//${host}:${port}`,
    normalizedPath: normalized.value,
  }
}

function matchesRule(
  descriptor: ConnectivityRequestDescriptor,
  normalizedOrigin: string,
  normalizedPath: string,
  capability: CapabilityDeclaration,
): { ok: true; rule: ConnectivityRule } | { ok: false; reason: PolicyRejectionReason } {
  const requestOrigin = new URL(normalizedOrigin)
  const requestHost = normalizeHostname(requestOrigin.hostname)
  const requestProtocol = requestOrigin.protocol.slice(0, -1)
  const requestPort = requestOrigin.port
    ? Number(requestOrigin.port)
    : defaultPort(requestOrigin.protocol)

  const methodMatchesAny = capability.rules.some(rule => rule.methods.includes(descriptor.method))
  if (!methodMatchesAny) return { ok: false, reason: 'method_not_allowed' }

  const purposeMatchesAny = capability.rules.some(rule => rule.purpose === descriptor.purpose)
  if (!purposeMatchesAny) return { ok: false, reason: 'purpose_not_allowed' }

  const dataMatchesAny = capability.rules.some(rule => rule.dataClassifications.includes(descriptor.dataClassification))
  if (!dataMatchesAny) return { ok: false, reason: 'data_classification_not_allowed' }

  const originMatchesAny = capability.rules.some((rule) =>
    rule.origins.some((origin) => {
      const allowedPort = origin.port ?? (origin.protocol === 'https' ? 443 : 80)
      const allowedHost = normalizeHostname(origin.hostname)
      return origin.protocol === requestProtocol && allowedHost === requestHost && allowedPort === requestPort
    }),
  )
  if (!originMatchesAny) {
    const hostnameProtocolMatch = capability.rules.some((rule) =>
      rule.origins.some((origin) =>
        origin.protocol === requestProtocol
        && normalizeHostname(origin.hostname) === requestHost,
      ),
    )
    if (hostnameProtocolMatch) return { ok: false, reason: 'port_not_allowed' }
    return { ok: false, reason: 'origin_not_allowed' }
  }

  for (const rule of capability.rules) {
    if (!rule.methods.includes(descriptor.method)) continue
    if (rule.purpose !== descriptor.purpose) continue
    if (!rule.dataClassifications.includes(descriptor.dataClassification)) continue
    const originAllowed = rule.origins.some((origin) => {
      const allowedPort = origin.port ?? (origin.protocol === 'https' ? 443 : 80)
      return (
        origin.protocol === requestProtocol
        && normalizeHostname(origin.hostname) === requestHost
        && allowedPort === requestPort
      )
    })
    if (!originAllowed) continue
    const pathAllowed = rule.pathPatterns.some((pattern) => {
      if (pattern.kind === 'exact') {
        const normalized = normalizePath(pattern.path)
        return normalized.ok && normalized.value === normalizedPath
      }
      const normalizedPrefix = normalizePath(pattern.pathPrefix)
      if (!normalizedPrefix.ok) return false
      return normalizedPath === normalizedPrefix.value || normalizedPath.startsWith(`${normalizedPrefix.value}/`)
    })
    if (!pathAllowed) continue
    return { ok: true, rule }
  }

  return { ok: false, reason: 'path_not_allowed' }
}

function findAdapter(snapshot: ConnectivityRegistrySnapshot, adapterId: string): AdapterDeclaration | null {
  return snapshot.adapters.find(adapter => adapter.id === adapterId) ?? null
}

function findCapability(snapshot: ConnectivityRegistrySnapshot, capabilityId: string): CapabilityDeclaration | null {
  return snapshot.capabilities.find(capability => capability.id === capabilityId) ?? null
}

function buildAttribution(
  descriptor: ConnectivityRequestDescriptor,
  adapter: AdapterDeclaration,
): AuditAttribution {
  return {
    requestId: descriptor.requestId,
    capabilityId: descriptor.capabilityId,
    adapterId: descriptor.adapterId,
    policyVersion: adapter.policyVersion,
    registryVersion: adapter.registryVersion,
  }
}

export function evaluateConnectivityPolicy(
  descriptor: ConnectivityRequestDescriptor,
  snapshot: ConnectivityRegistrySnapshot,
): PolicyDecision {
  if (!snapshot.validation.valid) return { allowed: false, reason: 'registry_invalid' }
  if (!descriptor?.requestId || !descriptor.capabilityId || !descriptor.adapterId || !descriptor.method || !descriptor.url) {
    return { allowed: false, reason: 'malformed_request' }
  }

  const normalized = normalizeUrl(descriptor.url, descriptor.allowLocalAddress === true)
  if (!normalized.ok) return { allowed: false, reason: normalized.reason }

  const adapter = findAdapter(snapshot, descriptor.adapterId)
  if (!adapter) return { allowed: false, reason: 'unknown_adapter', normalizedUrl: normalized.url.toString(), normalizedOrigin: normalized.normalizedOrigin, normalizedPath: normalized.normalizedPath }
  if (!adapter.enabled) return { allowed: false, reason: 'adapter_disabled', attribution: buildAttribution(descriptor, adapter), normalizedUrl: normalized.url.toString(), normalizedOrigin: normalized.normalizedOrigin, normalizedPath: normalized.normalizedPath }

  const capability = findCapability(snapshot, descriptor.capabilityId)
  if (!capability) return { allowed: false, reason: 'unknown_capability', attribution: buildAttribution(descriptor, adapter), normalizedUrl: normalized.url.toString(), normalizedOrigin: normalized.normalizedOrigin, normalizedPath: normalized.normalizedPath }
  if (!capability.enabled) return { allowed: false, reason: 'capability_disabled', attribution: buildAttribution(descriptor, adapter), normalizedUrl: normalized.url.toString(), normalizedOrigin: normalized.normalizedOrigin, normalizedPath: normalized.normalizedPath }
  if (capability.adapterId !== adapter.id) return { allowed: false, reason: 'capability_adapter_mismatch', attribution: buildAttribution(descriptor, adapter), normalizedUrl: normalized.url.toString(), normalizedOrigin: normalized.normalizedOrigin, normalizedPath: normalized.normalizedPath }

  const match = matchesRule(descriptor, normalized.normalizedOrigin, normalized.normalizedPath, capability)
  if (!match.ok) {
    return {
      allowed: false,
      reason: match.reason,
      attribution: buildAttribution(descriptor, adapter),
      normalizedUrl: normalized.url.toString(),
      normalizedOrigin: normalized.normalizedOrigin,
      normalizedPath: normalized.normalizedPath,
    }
  }

  if (descriptor.timeoutMs !== undefined) {
    if (!Number.isInteger(descriptor.timeoutMs) || descriptor.timeoutMs <= 0 || descriptor.timeoutMs > match.rule.timeoutPolicy.maxMs) {
      return {
        allowed: false,
        reason: 'timeout_invalid',
        attribution: buildAttribution(descriptor, adapter),
        normalizedUrl: normalized.url.toString(),
        normalizedOrigin: normalized.normalizedOrigin,
        normalizedPath: normalized.normalizedPath,
      }
    }
  }

  if (descriptor.isRedirectTarget && match.rule.redirectPolicy.mode === 'deny') {
    return {
      allowed: false,
      reason: 'redirect_disallowed',
      attribution: buildAttribution(descriptor, adapter),
      normalizedUrl: normalized.url.toString(),
      normalizedOrigin: normalized.normalizedOrigin,
      normalizedPath: normalized.normalizedPath,
    }
  }

  return {
    allowed: true,
    reason: 'authorized',
    attribution: buildAttribution(descriptor, adapter),
    normalizedUrl: normalized.url.toString(),
    normalizedOrigin: normalized.normalizedOrigin,
    normalizedPath: normalized.normalizedPath,
    timeoutMs: descriptor.timeoutMs ?? match.rule.timeoutPolicy.defaultMs,
    requiresRedirectRevalidation: match.rule.redirectPolicy.mode === 'revalidate',
  }
}

export function evaluateRedirectTarget(
  original: ConnectivityRequestDescriptor,
  redirectUrl: string,
  snapshot: ConnectivityRegistrySnapshot,
): PolicyDecision {
  const next: ConnectivityRequestDescriptor = {
    ...original,
    parentRequestId: original.requestId,
    requestId: `${original.requestId}:redirect`,
    url: redirectUrl,
    isRedirectTarget: true,
  }
  return evaluateConnectivityPolicy(next, snapshot)
}

export function resolveCancellationState(input: {
  operatorCancelled?: boolean
  capabilityRevoked?: boolean
  adapterDisabled?: boolean
  shutdown?: boolean
  timedOut?: boolean
}): CancellationState {
  if (input.shutdown) return 'shutdown'
  if (input.adapterDisabled) return 'adapter_disabled'
  if (input.capabilityRevoked) return 'capability_revoked'
  if (input.operatorCancelled) return 'operator_cancelled'
  if (input.timedOut) return 'timeout'
  return 'none'
}

function redactUrl(rawUrl: string): string {
  const normalized = normalizeUrl(rawUrl)
  if (!normalized.ok) return 'invalid-url'
  return `${normalized.url.protocol}//${normalized.url.hostname}${normalized.url.port ? `:${normalized.url.port}` : ''}${normalized.url.pathname}`
}

export function buildConnectivityAuditEvent(
  descriptor: ConnectivityRequestDescriptor,
  decision: PolicyDecision,
): ConnectivityAuditEvent {
  if (decision.allowed) {
    return {
      action: descriptor.isRedirectTarget ? 'redirect_authorized' : 'authorization_granted',
      requestId: descriptor.requestId,
      capabilityId: descriptor.capabilityId,
      adapterId: descriptor.adapterId,
      reason: decision.reason,
      method: descriptor.method,
      redactedUrl: redactUrl(descriptor.url),
      purpose: descriptor.purpose,
      dataClassification: descriptor.dataClassification,
      policyVersion: decision.attribution.policyVersion,
      registryVersion: decision.attribution.registryVersion,
    }
  }
  return {
    action: descriptor.isRedirectTarget ? 'redirect_rejected' : 'authorization_denied',
    requestId: descriptor.requestId,
    capabilityId: descriptor.capabilityId,
    adapterId: descriptor.adapterId,
    reason: decision.reason,
    method: descriptor.method,
    redactedUrl: redactUrl(descriptor.url),
    purpose: descriptor.purpose,
    dataClassification: descriptor.dataClassification,
    policyVersion: decision.attribution?.policyVersion,
    registryVersion: decision.attribution?.registryVersion,
  }
}
