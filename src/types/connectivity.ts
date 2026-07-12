export type CapabilityId = `cap:${string}`
export type AdapterId = `adapter:${string}`
export type CapabilityVersion = `${number}.${number}.${number}`
export type AdapterVersion = `${number}.${number}.${number}`
export type RegistryVersion = `${number}.${number}.${number}`
export type PolicyVersion = `${number}.${number}.${number}`

export type ConnectivityRequestPurpose =
  | 'sync_metadata_read'
  | 'sync_metadata_write'
  | 'external_read'
  | 'external_write_prepare'
  | 'health_probe'

export type ConnectivityDataClassification =
  | 'vault_private'
  | 'synchronized_encrypted'
  | 'connector_transient'
  | 'externally_sourced'
  | 'derived_cognitive'
  | 'public'
  | 'secret_credential'
  | 'audit'
  | 'media_cache'

export type AllowedHttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS'

export type AllowedProtocol = 'https' | 'http'

export type AllowedOrigin = {
  protocol: AllowedProtocol
  hostname: string
  port?: number
}

export type AllowedPathPattern =
  | {
    kind: 'exact'
    path: string
  }
  | {
    kind: 'prefix'
    pathPrefix: string
  }

export type TimeoutPolicy = {
  defaultMs: number
  maxMs: number
}

export type RedirectPolicy =
  | { mode: 'deny' }
  | { mode: 'revalidate' }

export type AuditAttribution = {
  requestId: string
  operatorIdHash?: string
  capabilityId: CapabilityId
  adapterId: AdapterId
  policyVersion: PolicyVersion
  registryVersion: RegistryVersion
}

export type ConnectivityRule = {
  id: string
  purpose: ConnectivityRequestPurpose
  dataClassifications: ConnectivityDataClassification[]
  origins: AllowedOrigin[]
  pathPatterns: AllowedPathPattern[]
  methods: AllowedHttpMethod[]
  redirectPolicy: RedirectPolicy
  timeoutPolicy: TimeoutPolicy
}

export type CapabilityDeclaration = {
  id: CapabilityId
  version: CapabilityVersion
  adapterId: AdapterId
  enabled: boolean
  rules: ConnectivityRule[]
}

export type AdapterDeclaration = {
  id: AdapterId
  version: AdapterVersion
  enabled: boolean
  policyVersion: PolicyVersion
  registryVersion: RegistryVersion
}

export type ConnectivityRequestDescriptor = {
  requestId: string
  capabilityId: CapabilityId
  adapterId: AdapterId
  method: AllowedHttpMethod
  url: string
  /** Build 019 local reference mode: false by default for strict deny-local baseline. */
  allowLocalAddress?: boolean
  purpose: ConnectivityRequestPurpose
  dataClassification: ConnectivityDataClassification
  timeoutMs?: number
  isRedirectTarget?: boolean
  parentRequestId?: string
}

export type PolicyRejectionReason =
  | 'registry_invalid'
  | 'malformed_request'
  | 'invalid_url'
  | 'malformed_percent_encoding'
  | 'unsupported_protocol'
  | 'protocol_relative_url'
  | 'url_contains_credentials'
  | 'url_contains_fragment'
  | 'local_address_not_allowed'
  | 'unknown_adapter'
  | 'adapter_disabled'
  | 'unknown_capability'
  | 'capability_disabled'
  | 'capability_adapter_mismatch'
  | 'purpose_not_allowed'
  | 'data_classification_not_allowed'
  | 'origin_not_allowed'
  | 'port_not_allowed'
  | 'path_not_allowed'
  | 'path_traversal_detected'
  | 'encoded_path_bypass_detected'
  | 'method_not_allowed'
  | 'timeout_invalid'
  | 'redirect_disallowed'
  | 'redirect_revalidation_required'

export type PolicyDecision =
  | {
    allowed: true
    reason: 'authorized'
    attribution: AuditAttribution
    normalizedUrl: string
    normalizedOrigin: string
    normalizedPath: string
    timeoutMs: number
    requiresRedirectRevalidation: boolean
  }
  | {
    allowed: false
    reason: PolicyRejectionReason
    attribution?: AuditAttribution
    normalizedUrl?: string
    normalizedOrigin?: string
    normalizedPath?: string
  }

export type CancellationState =
  | 'none'
  | 'operator_cancelled'
  | 'capability_revoked'
  | 'adapter_disabled'
  | 'shutdown'
  | 'timeout'

export type AdapterRegistrationResult =
  | { ok: true; adapter: AdapterDeclaration }
  | { ok: false; reason: 'duplicate_adapter' | 'malformed_adapter' | 'invalid_version' | 'registry_conflict' }

export type CapabilityRegistrationResult =
  | { ok: true; capability: CapabilityDeclaration }
  | { ok: false; reason: 'duplicate_capability' | 'malformed_capability' | 'invalid_version' | 'unknown_adapter' | 'registry_conflict' }

export type RegistryValidationResult = {
  valid: boolean
  reasons: Array<
    | 'duplicate_adapter'
    | 'duplicate_capability'
    | 'capability_without_adapter'
    | 'malformed_adapter'
    | 'malformed_capability'
    | 'registry_conflict'
  >
}

export type ConnectivityRegistrySnapshot = {
  adapters: AdapterDeclaration[]
  capabilities: CapabilityDeclaration[]
  validation: RegistryValidationResult
}

export type ConnectivityAuditEventAction =
  | 'authorization_granted'
  | 'authorization_denied'
  | 'adapter_registration_rejected'
  | 'capability_enabled'
  | 'capability_disabled'
  | 'cancellation_requested'
  | 'timeout_decision'
  | 'redirect_authorized'
  | 'redirect_rejected'

export type ConnectivityAuditEvent = {
  action: ConnectivityAuditEventAction
  requestId: string
  capabilityId?: CapabilityId
  adapterId?: AdapterId
  reason: string
  method?: AllowedHttpMethod
  redactedUrl?: string
  purpose?: ConnectivityRequestPurpose
  dataClassification?: ConnectivityDataClassification
  policyVersion?: PolicyVersion
  registryVersion?: RegistryVersion
  cancellationState?: CancellationState
}
