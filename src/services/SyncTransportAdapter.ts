import type {
  AdapterDeclaration,
  CapabilityDeclaration,
  ConnectivityAuditEvent,
  ConnectivityRequestDescriptor,
} from '../types/connectivity'
import type {
  EncryptedSyncEnvelope,
  SyncDownloadResult,
  SyncOperatorControlState,
  SyncTransportAuditEvent,
  SyncUploadAcknowledgment,
} from '../types/sync'
import { evaluateConnectivityPolicy, evaluateRedirectTarget } from './ConnectivityPolicyEvaluator'
import { ConnectivityPolicyRegistry } from './ConnectivityPolicyRegistry'

const SYNC_ADAPTER: AdapterDeclaration = {
  id: 'adapter:phase4-sync',
  version: '1.0.0',
  enabled: false,
  policyVersion: '1.0.0',
  registryVersion: '1.0.0',
}

const SYNC_CAPABILITY: CapabilityDeclaration = {
  id: 'cap:phase4-sync',
  version: '1.0.0',
  adapterId: 'adapter:phase4-sync',
  enabled: false,
  rules: [
    {
      id: 'sync-write',
      purpose: 'sync_metadata_write',
      dataClassifications: ['synchronized_encrypted', 'audit'],
      origins: [{ protocol: 'http', hostname: '127.0.0.1' }, { protocol: 'http', hostname: 'localhost' }],
      pathPatterns: [{ kind: 'prefix', pathPrefix: '/sync/v1' }],
      methods: ['POST', 'PUT', 'DELETE'],
      redirectPolicy: { mode: 'deny' },
      timeoutPolicy: { defaultMs: 3000, maxMs: 7000 },
    },
    {
      id: 'sync-read',
      purpose: 'sync_metadata_read',
      dataClassifications: ['synchronized_encrypted', 'audit'],
      origins: [{ protocol: 'http', hostname: '127.0.0.1' }, { protocol: 'http', hostname: 'localhost' }],
      pathPatterns: [{ kind: 'prefix', pathPrefix: '/sync/v1' }],
      methods: ['GET'],
      redirectPolicy: { mode: 'deny' },
      timeoutPolicy: { defaultMs: 3000, maxMs: 7000 },
    },
  ],
}

function ensureJsonContentType(value: string | null): boolean {
  if (!value) return false
  const normalized = value.split(';', 1)[0].trim().toLowerCase()
  return normalized === 'application/json'
}

type TransportResponse = SyncUploadAcknowledgment | SyncDownloadResult | { kind: 'conflict'; conflict: unknown }

export class SyncTransportAdapter {
  private readonly registry = new ConnectivityPolicyRegistry()
  private readonly audit: SyncTransportAuditEvent[] = []
  private endpointBaseUrl: string | null = null
  private controlState: SyncOperatorControlState = {
    enabled: false,
    localEndpointConfigured: false,
  }

  constructor() {
    this.registry.registerAdapter(SYNC_ADAPTER)
    this.registry.registerCapability(SYNC_CAPABILITY)
  }

  private pushAudit(event: Omit<SyncTransportAuditEvent, 'id' | 'createdAt'>): void {
    this.audit.unshift({
      id: `sync-audit:${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      ...event,
    })
    if (this.audit.length > 500) this.audit.length = 500
  }

  configureLocalEndpoint(baseUrl: string): void {
    const parsed = new URL(baseUrl)
    const host = parsed.hostname.toLowerCase()
    if (parsed.protocol !== 'http:' || (host !== '127.0.0.1' && host !== 'localhost')) {
      throw new Error('Sync endpoint must be local-only (http://localhost or http://127.0.0.1).')
    }
    this.endpointBaseUrl = `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`
    this.controlState = {
      ...this.controlState,
      localEndpointConfigured: true,
      configuredAt: new Date().toISOString(),
    }
    this.pushAudit({
      action: 'sync_local_endpoint_configured',
      reason: 'Local reference endpoint configured.',
    })
  }

  clearEndpoint(): void {
    this.endpointBaseUrl = null
    this.controlState = {
      ...this.controlState,
      localEndpointConfigured: false,
      configuredAt: undefined,
    }
    this.pushAudit({
      action: 'sync_local_endpoint_cleared',
      reason: 'Local reference endpoint cleared.',
    })
  }

  setEnabled(enabled: boolean): void {
    this.controlState = { ...this.controlState, enabled }
    if (enabled) {
      this.registry.enableAdapter(SYNC_ADAPTER.id)
      this.registry.enableCapability(SYNC_CAPABILITY.id)
      this.pushAudit({ action: 'sync_capability_enabled', reason: 'Operator enabled sync transport capability.' })
      return
    }
    this.registry.disableCapability(SYNC_CAPABILITY.id)
    this.registry.disableAdapter(SYNC_ADAPTER.id)
    this.pushAudit({ action: 'sync_capability_disabled', reason: 'Operator disabled sync transport capability.' })
  }

  status(): SyncOperatorControlState {
    return { ...this.controlState }
  }

  getAuditEvents(): SyncTransportAuditEvent[] {
    return this.audit.map(item => ({ ...item }))
  }

  private requestDescriptor(input: {
    requestId: string
    method: ConnectivityRequestDescriptor['method']
    url: string
  }): ConnectivityRequestDescriptor {
    return {
      requestId: input.requestId,
      capabilityId: SYNC_CAPABILITY.id,
      adapterId: SYNC_ADAPTER.id,
      method: input.method,
      url: input.url,
      purpose: input.method === 'GET' ? 'sync_metadata_read' : 'sync_metadata_write',
      dataClassification: 'synchronized_encrypted',
      timeoutMs: 3000,
    }
  }

  private validateDecision(
    request: ConnectivityRequestDescriptor,
    action: SyncTransportAuditEvent['action'],
  ): { ok: true; timeoutMs: number } | { ok: false; reason: string } {
    const decision = evaluateConnectivityPolicy(request, this.registry.snapshot())
    if (!decision.allowed) {
      this.pushAudit({
        action,
        requestId: request.requestId,
        reason: `Denied by policy: ${decision.reason}`,
      })
      return { ok: false, reason: decision.reason }
    }
    return { ok: true, timeoutMs: decision.timeoutMs }
  }

  async upload(envelope: EncryptedSyncEnvelope): Promise<SyncUploadAcknowledgment | { kind: 'conflict'; conflict: unknown }> {
    if (!this.endpointBaseUrl) throw new Error('Sync endpoint not configured.')
    if (!this.controlState.enabled) throw new Error('Sync transport capability is disabled.')
    const url = `${this.endpointBaseUrl}/sync/v1/envelopes`
    const descriptor = this.requestDescriptor({
      requestId: envelope.requestId,
      method: 'POST',
      url,
    })
    const decision = this.validateDecision(descriptor, 'sync_upload_denied')
    if (!decision.ok) throw new Error(`Transport denied: ${decision.reason}`)
    this.pushAudit({
      action: 'sync_upload_authorized',
      requestId: envelope.requestId,
      namespace: envelope.namespace,
      objectId: envelope.objectId,
      reason: 'Upload request authorized.',
    })
    const result = await this.executeRequest(
      descriptor,
      { method: 'POST', body: JSON.stringify(envelope), headers: { 'content-type': 'application/json' } },
      decision.timeoutMs,
    )
    if ('accepted' in result) {
      this.pushAudit({
        action: 'sync_upload_acknowledged',
        requestId: envelope.requestId,
        namespace: envelope.namespace,
        objectId: envelope.objectId,
        reason: 'Upload acknowledged.',
      })
      return result
    }
    this.pushAudit({
      action: 'sync_conflict_detected',
      requestId: envelope.requestId,
      namespace: envelope.namespace,
      objectId: envelope.objectId,
      reason: 'Upload conflict returned by transport.',
    })
    return result as { kind: 'conflict'; conflict: unknown }
  }

  async download(input: {
    requestId: string
    namespace: string
    objectId: string
  }): Promise<SyncDownloadResult> {
    if (!this.endpointBaseUrl) throw new Error('Sync endpoint not configured.')
    if (!this.controlState.enabled) throw new Error('Sync transport capability is disabled.')
    const namespace = encodeURIComponent(input.namespace)
    const objectId = encodeURIComponent(input.objectId)
    const url = `${this.endpointBaseUrl}/sync/v1/envelopes/${namespace}/${objectId}?requestId=${encodeURIComponent(input.requestId)}`
    const descriptor = this.requestDescriptor({
      requestId: input.requestId,
      method: 'GET',
      url,
    })
    const decision = this.validateDecision(descriptor, 'sync_download_denied')
    if (!decision.ok) throw new Error(`Transport denied: ${decision.reason}`)
    this.pushAudit({
      action: 'sync_download_authorized',
      requestId: input.requestId,
      namespace: input.namespace as SyncTransportAuditEvent['namespace'],
      objectId: input.objectId as SyncTransportAuditEvent['objectId'],
      reason: 'Download request authorized.',
    })
    const result = await this.executeRequest(
      descriptor,
      { method: 'GET', headers: { 'content-type': 'application/json' } },
      decision.timeoutMs,
    )
    return result as SyncDownloadResult
  }

  private async executeRequest(
    descriptor: ConnectivityRequestDescriptor,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<TransportResponse> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      // Build 019: this is the only approved network primitive in src/, constrained by policy evaluation.
      const response = await fetch(descriptor.url, {
        ...init,
        signal: controller.signal,
        redirect: 'manual',
      })
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location) throw new Error('Redirect rejected: missing location.')
        const redirectDecision = evaluateRedirectTarget(descriptor, location, this.registry.snapshot())
        if (!redirectDecision.allowed) throw new Error(`Redirect rejected: ${redirectDecision.reason}`)
      }
      if (!ensureJsonContentType(response.headers.get('content-type'))) {
        throw new Error('Unexpected response content type.')
      }
      const payload = await response.json()
      if (!response.ok) throw new Error(`Sync request failed with ${response.status}.`)
      return payload as TransportResponse
    } finally {
      clearTimeout(timeout)
    }
  }
}

export function createSyncTransportAdapter(): SyncTransportAdapter {
  return new SyncTransportAdapter()
}

export function toConnectivityAudit(_: ConnectivityAuditEvent): SyncTransportAuditEvent {
  return {
    id: `sync-audit:${crypto.randomUUID()}`,
    action: 'sync_validation_failed',
    reason: 'Connectivity audit translation is not persisted for Build 019.',
    createdAt: new Date().toISOString(),
  }
}

