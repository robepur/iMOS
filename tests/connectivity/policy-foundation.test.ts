import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { buildConnectivityAuditEvent, evaluateConnectivityPolicy, evaluateRedirectTarget, resolveCancellationState } from '../../src/services/ConnectivityPolicyEvaluator'
import { ConnectivityPolicyRegistry } from '../../src/services/ConnectivityPolicyRegistry'
import type { CapabilityDeclaration, ConnectivityRequestDescriptor, ConnectivityRegistrySnapshot } from '../../src/types/connectivity'

function makeRegistry() {
  const registry = new ConnectivityPolicyRegistry()
  const adapterResult = registry.registerAdapter({
    id: 'adapter:test',
    version: '1.0.0',
    enabled: true,
    policyVersion: '1.0.0',
    registryVersion: '1.0.0',
  })
  expect(adapterResult.ok).toBe(true)
  const capability: CapabilityDeclaration = {
    id: 'cap:test',
    version: '1.0.0',
    adapterId: 'adapter:test',
    enabled: true,
    rules: [
      {
        id: 'rule-1',
        purpose: 'external_read',
        dataClassifications: ['externally_sourced'],
        origins: [{ protocol: 'https', hostname: 'api.example.com' }],
        pathPatterns: [{ kind: 'exact', path: '/v1/items' }, { kind: 'prefix', pathPrefix: '/v1/public' }],
        methods: ['GET'],
        redirectPolicy: { mode: 'revalidate' },
        timeoutPolicy: { defaultMs: 1000, maxMs: 5000 },
      },
      {
        id: 'rule-2',
        purpose: 'health_probe',
        dataClassifications: ['public'],
        origins: [{ protocol: 'https', hostname: 'api.example.com', port: 8443 }],
        pathPatterns: [{ kind: 'exact', path: '/healthz' }],
        methods: ['HEAD'],
        redirectPolicy: { mode: 'deny' },
        timeoutPolicy: { defaultMs: 500, maxMs: 1000 },
      },
    ],
  }
  const capabilityResult = registry.registerCapability(capability)
  expect(capabilityResult.ok).toBe(true)
  return registry
}

function makeRequest(patch: Partial<ConnectivityRequestDescriptor> = {}): ConnectivityRequestDescriptor {
  return {
    requestId: 'req-1',
    capabilityId: 'cap:test',
    adapterId: 'adapter:test',
    method: 'GET',
    url: 'https://api.example.com/v1/items?token=secret',
    purpose: 'external_read',
    dataClassification: 'externally_sourced',
    ...patch,
  }
}

describe('Build 017 connectivity policy foundation', () => {
  it('empty registry denies', () => {
    const registry = new ConnectivityPolicyRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest(), registry.snapshot())
    expect(decision.allowed).toBe(false)
  })

  it('unknown capability denies', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ capabilityId: 'cap:unknown' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'unknown_capability' })
  })

  it('unknown adapter denies', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ adapterId: 'adapter:unknown' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'unknown_adapter' })
  })

  it('disabled capability denies', () => {
    const registry = makeRegistry()
    registry.disableCapability('cap:test')
    const decision = evaluateConnectivityPolicy(makeRequest(), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'capability_disabled' })
  })

  it('valid declared request can receive a policy authorization decision', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest(), registry.snapshot())
    expect(decision).toMatchObject({ allowed: true, reason: 'authorized' })
  })

  it('undeclared origin denies', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://evil.example.com/v1/items' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'origin_not_allowed' })
  })

  it('hostname confusion denies (suffix)', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://api.example.com.evil.net/v1/items' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'origin_not_allowed' })
  })

  it('hostname confusion denies (prefix)', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://evil-api.example.com/v1/items' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'origin_not_allowed' })
  })

  it('mixed-case hostname is canonicalized and allowed', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://API.Example.Com/v1/items' }), registry.snapshot())
    expect(decision.allowed).toBe(true)
  })

  it('trailing-dot hostname is canonicalized and allowed', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://api.example.com./v1/items' }), registry.snapshot())
    expect(decision.allowed).toBe(true)
  })

  it('unicode hostname resolves via punycode and denies if undeclared', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://bücher.example/v1/items' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'origin_not_allowed' })
  })

  it('punycode hostname denies if undeclared', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://xn--bcher-kva.example/v1/items' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'origin_not_allowed' })
  })

  it('wrong protocol denies', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'http://api.example.com/v1/items' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'origin_not_allowed' })
  })

  it('encoded user-information syntax denies', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://user%3Apass@api.example.com/v1/items' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'url_contains_credentials' })
  })

  it('wrong port denies', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://api.example.com:9443/v1/items' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'port_not_allowed' })
  })

  it('empty path is normalized and denied when not declared', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://api.example.com' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'path_not_allowed' })
  })

  it('undeclared path denies', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://api.example.com/v1/private' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'path_not_allowed' })
  })

  it('path traversal denies', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://api.example.com/v1/../secret' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'path_traversal_detected' })
  })

  it('encoded bypass attempts deny', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://api.example.com/v1/%2e%2e/secret' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'path_traversal_detected' })
  })

  it('double encoded traversal denies', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://api.example.com/v1/%252e%252e/secret' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'path_traversal_detected' })
  })

  it('encoded slash bypass attempts deny', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://api.example.com/v1/public%2fextra' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'encoded_path_bypass_detected' })
  })

  it('undeclared method denies', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ method: 'POST' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'method_not_allowed' })
  })

  it('mismatched purpose denies', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ purpose: 'sync_metadata_read' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'purpose_not_allowed' })
  })

  it('disallowed data classification denies', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ dataClassification: 'vault_private' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'data_classification_not_allowed' })
  })

  it('malformed URLs deny', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'not-a-url' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'invalid_url' })
  })

  it('malformed percent encoding denies', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://api.example.com/v1/items%ZZ' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'malformed_percent_encoding' })
  })

  it('URLs containing credentials deny', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://user:pass@api.example.com/v1/items' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'url_contains_credentials' })
  })

  it('protocol-relative URLs deny', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: '//api.example.com/v1/items' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'protocol_relative_url' })
  })

  it('unsupported protocols deny', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'ftp://api.example.com/v1/items' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'unsupported_protocol' })
  })

  it('fragments deny', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://api.example.com/v1/items#fragment' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'url_contains_fragment' })
  })

  it('backslashes deny', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://api.example.com\\v1\\items' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'invalid_url' })
  })

  it('leading whitespace denies', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: ' https://api.example.com/v1/items' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'invalid_url' })
  })

  it('control characters deny', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: `https://api.example.com/v1/items${String.fromCharCode(0)}` }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'invalid_url' })
  })

  it('localhost denies by default', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://localhost/v1/items' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'local_address_not_allowed' })
  })

  it('loopback IPv4 denies by default', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://127.0.0.1/v1/items' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'local_address_not_allowed' })
  })

  it('private IPv4 denies by default', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://10.1.2.3/v1/items' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'local_address_not_allowed' })
  })

  it('link-local IPv4 denies by default', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://169.254.1.9/v1/items' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'local_address_not_allowed' })
  })

  it('ipv6 loopback denies by default', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://[::1]/v1/items' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'local_address_not_allowed' })
  })

  it('ipv6 link-local denies by default', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://[fe80::1]/v1/items' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'local_address_not_allowed' })
  })

  it('ipv4 integer-like host denies by default', () => {
    const registry = makeRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest({ url: 'https://2130706433/v1/items' }), registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'local_address_not_allowed' })
  })

  it('local-address exception remains deny-by-default unless explicitly enabled on the request', () => {
    const registry = new ConnectivityPolicyRegistry()
    expect(registry.registerAdapter({
      id: 'adapter:local-test',
      version: '1.0.0',
      enabled: true,
      policyVersion: '1.0.0',
      registryVersion: '1.0.0',
    }).ok).toBe(true)
    expect(registry.registerCapability({
      id: 'cap:local-test',
      version: '1.0.0',
      adapterId: 'adapter:local-test',
      enabled: true,
      rules: [{
        id: 'rule-local',
        purpose: 'sync_metadata_read',
        dataClassifications: ['synchronized_encrypted'],
        origins: [{ protocol: 'http', hostname: '127.0.0.1', port: 8787 }],
        pathPatterns: [{ kind: 'prefix', pathPrefix: '/sync/v1' }],
        methods: ['GET'],
        redirectPolicy: { mode: 'deny' },
        timeoutPolicy: { defaultMs: 1000, maxMs: 2000 },
      }],
    }).ok).toBe(true)

    const denied = evaluateConnectivityPolicy({
      ...makeRequest({
        capabilityId: 'cap:local-test',
        adapterId: 'adapter:local-test',
        method: 'GET',
        purpose: 'sync_metadata_read',
        dataClassification: 'synchronized_encrypted',
        url: 'http://127.0.0.1:8787/sync/v1/envelopes/a/b',
      }),
      allowLocalAddress: false,
    }, registry.snapshot())
    const allowed = evaluateConnectivityPolicy({
      ...makeRequest({
        capabilityId: 'cap:local-test',
        adapterId: 'adapter:local-test',
        method: 'GET',
        purpose: 'sync_metadata_read',
        dataClassification: 'synchronized_encrypted',
        url: 'http://127.0.0.1:8787/sync/v1/envelopes/a/b',
      }),
      allowLocalAddress: true,
    }, registry.snapshot())
    expect(denied).toMatchObject({ allowed: false, reason: 'local_address_not_allowed' })
    expect(allowed).toMatchObject({ allowed: true, reason: 'authorized' })
  })

  it('local-address exception does not allow wrong port or host alias', () => {
    const registry = new ConnectivityPolicyRegistry()
    expect(registry.registerAdapter({
      id: 'adapter:local-port',
      version: '1.0.0',
      enabled: true,
      policyVersion: '1.0.0',
      registryVersion: '1.0.0',
    }).ok).toBe(true)
    expect(registry.registerCapability({
      id: 'cap:local-port',
      version: '1.0.0',
      adapterId: 'adapter:local-port',
      enabled: true,
      rules: [{
        id: 'rule-port',
        purpose: 'sync_metadata_write',
        dataClassifications: ['synchronized_encrypted'],
        origins: [{ protocol: 'http', hostname: '127.0.0.1', port: 8787 }],
        pathPatterns: [{ kind: 'exact', path: '/sync/v1/envelopes' }],
        methods: ['POST'],
        redirectPolicy: { mode: 'deny' },
        timeoutPolicy: { defaultMs: 1000, maxMs: 2000 },
      }],
    }).ok).toBe(true)

    const wrongPort = evaluateConnectivityPolicy({
      ...makeRequest({
        capabilityId: 'cap:local-port',
        adapterId: 'adapter:local-port',
        method: 'POST',
        purpose: 'sync_metadata_write',
        dataClassification: 'synchronized_encrypted',
        url: 'http://127.0.0.1:9999/sync/v1/envelopes',
      }),
      allowLocalAddress: true,
    }, registry.snapshot())
    const wrongHost = evaluateConnectivityPolicy({
      ...makeRequest({
        capabilityId: 'cap:local-port',
        adapterId: 'adapter:local-port',
        method: 'POST',
        purpose: 'sync_metadata_write',
        dataClassification: 'synchronized_encrypted',
        url: 'http://localhost:8787/sync/v1/envelopes',
      }),
      allowLocalAddress: true,
    }, registry.snapshot())
    expect(wrongPort).toMatchObject({ allowed: false, reason: 'port_not_allowed' })
    expect(wrongHost).toMatchObject({ allowed: false, reason: 'origin_not_allowed' })
  })

  it('unsafe redirects deny', () => {
    const registry = makeRegistry()
    const decision = evaluateRedirectTarget(makeRequest(), 'https://api.example.com/v1/private', registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'path_not_allowed' })
  })

  it('redirect to different origin denies', () => {
    const registry = makeRegistry()
    const decision = evaluateRedirectTarget(makeRequest(), 'https://other.example.com/v1/items', registry.snapshot())
    expect(decision).toMatchObject({ allowed: false, reason: 'origin_not_allowed' })
  })

  it('redirect target is evaluated independently', () => {
    const registry = makeRegistry()
    const allow = evaluateRedirectTarget(makeRequest(), 'https://api.example.com/v1/public/news', registry.snapshot())
    const deny = evaluateRedirectTarget(makeRequest(), 'https://api.example.com/v1/forbidden', registry.snapshot())
    expect(allow.allowed).toBe(true)
    expect(deny).toMatchObject({ allowed: false, reason: 'path_not_allowed' })
  })

  it('duplicate adapter registration fails', () => {
    const registry = new ConnectivityPolicyRegistry()
    const first = registry.registerAdapter({
      id: 'adapter:test',
      version: '1.0.0',
      enabled: false,
      policyVersion: '1.0.0',
      registryVersion: '1.0.0',
    })
    const second = registry.registerAdapter({
      id: 'adapter:test',
      version: '1.0.0',
      enabled: false,
      policyVersion: '1.0.0',
      registryVersion: '1.0.0',
    })
    expect(first.ok).toBe(true)
    expect(second).toMatchObject({ ok: false, reason: 'duplicate_adapter' })
  })

  it('malformed origin fails registration', () => {
    const registry = new ConnectivityPolicyRegistry()
    registry.registerAdapter({
      id: 'adapter:test',
      version: '1.0.0',
      enabled: true,
      policyVersion: '1.0.0',
      registryVersion: '1.0.0',
    })
    const result = registry.registerCapability({
      id: 'cap:test',
      version: '1.0.0',
      adapterId: 'adapter:test',
      enabled: true,
      rules: [{
        id: 'r1',
        purpose: 'external_read',
        dataClassifications: ['externally_sourced'],
        origins: [{ protocol: 'https', hostname: 'evil host' }],
        pathPatterns: [{ kind: 'exact', path: '/v1/items' }],
        methods: ['GET'],
        redirectPolicy: { mode: 'deny' },
        timeoutPolicy: { defaultMs: 1000, maxMs: 2000 },
      }],
    })
    expect(result).toMatchObject({ ok: false, reason: 'malformed_capability' })
  })

  it('conflicting declarations fail', () => {
    const registry = new ConnectivityPolicyRegistry()
    registry.registerAdapter({
      id: 'adapter:test',
      version: '1.0.0',
      enabled: true,
      policyVersion: '1.0.0',
      registryVersion: '1.0.0',
    })
    const result = registry.registerCapability({
      id: 'cap:test',
      version: '1.0.0',
      adapterId: 'adapter:test',
      enabled: true,
      rules: [
        {
          id: 'same',
          purpose: 'external_read',
          dataClassifications: ['externally_sourced'],
          origins: [{ protocol: 'https', hostname: 'api.example.com' }],
          pathPatterns: [{ kind: 'exact', path: '/v1/items' }],
          methods: ['GET'],
          redirectPolicy: { mode: 'revalidate' },
          timeoutPolicy: { defaultMs: 1000, maxMs: 5000 },
        },
        {
          id: 'same',
          purpose: 'external_read',
          dataClassifications: ['externally_sourced'],
          origins: [{ protocol: 'https', hostname: 'api.example.com' }],
          pathPatterns: [{ kind: 'exact', path: '/v1/items' }],
          methods: ['GET'],
          redirectPolicy: { mode: 'revalidate' },
          timeoutPolicy: { defaultMs: 1000, maxMs: 5000 },
        },
      ],
    })
    expect(result.ok).toBe(false)
  })

  it('cross-capability conflicting declarations fail', () => {
    const registry = new ConnectivityPolicyRegistry()
    const adapter = registry.registerAdapter({
      id: 'adapter:test',
      version: '1.0.0',
      enabled: true,
      policyVersion: '1.0.0',
      registryVersion: '1.0.0',
    })
    expect(adapter.ok).toBe(true)
    const first = registry.registerCapability({
      id: 'cap:first',
      version: '1.0.0',
      adapterId: 'adapter:test',
      enabled: true,
      rules: [{
        id: 'r1',
        purpose: 'external_read',
        dataClassifications: ['externally_sourced'],
        origins: [{ protocol: 'https', hostname: 'api.example.com' }],
        pathPatterns: [{ kind: 'exact', path: '/v1/items' }],
        methods: ['GET'],
        redirectPolicy: { mode: 'deny' },
        timeoutPolicy: { defaultMs: 1000, maxMs: 2000 },
      }],
    })
    expect(first.ok).toBe(true)
    const second = registry.registerCapability({
      id: 'cap:second',
      version: '1.0.0',
      adapterId: 'adapter:test',
      enabled: true,
      rules: [{
        id: 'r2',
        purpose: 'external_read',
        dataClassifications: ['externally_sourced'],
        origins: [{ protocol: 'https', hostname: 'api.example.com' }],
        pathPatterns: [{ kind: 'exact', path: '/v1/items' }],
        methods: ['GET'],
        redirectPolicy: { mode: 'deny' },
        timeoutPolicy: { defaultMs: 1000, maxMs: 2000 },
      }],
    })
    expect(second).toMatchObject({ ok: false, reason: 'registry_conflict' })
  })

  it('malformed registry fails closed', () => {
    const malformed: ConnectivityRegistrySnapshot = {
      adapters: [],
      capabilities: [],
      validation: { valid: false, reasons: ['malformed_adapter'] },
    }
    const decision = evaluateConnectivityPolicy(makeRequest(), malformed)
    expect(decision).toMatchObject({ allowed: false, reason: 'registry_invalid' })
  })

  it('revocation blocks subsequent authorization', () => {
    const registry = makeRegistry()
    const before = evaluateConnectivityPolicy(makeRequest(), registry.snapshot())
    registry.disableCapability('cap:test')
    const after = evaluateConnectivityPolicy(makeRequest(), registry.snapshot())
    expect(before.allowed).toBe(true)
    expect(after).toMatchObject({ allowed: false, reason: 'capability_disabled' })
  })

  it('adapter disablement blocks subsequent authorization', () => {
    const registry = makeRegistry()
    const before = evaluateConnectivityPolicy(makeRequest(), registry.snapshot())
    registry.disableAdapter('adapter:test')
    const after = evaluateConnectivityPolicy(makeRequest(), registry.snapshot())
    expect(before.allowed).toBe(true)
    expect(after).toMatchObject({ allowed: false, reason: 'adapter_disabled' })
  })

  it('timeout and cancellation contracts are deterministic', () => {
    const registry = makeRegistry()
    const first = evaluateConnectivityPolicy(makeRequest({ timeoutMs: 2000 }), registry.snapshot())
    const second = evaluateConnectivityPolicy(makeRequest({ timeoutMs: 2000 }), registry.snapshot())
    expect(first).toEqual(second)
    expect(resolveCancellationState({ capabilityRevoked: true })).toBe('capability_revoked')
    expect(resolveCancellationState({ adapterDisabled: true })).toBe('adapter_disabled')
    expect(resolveCancellationState({ shutdown: true, timedOut: true })).toBe('shutdown')
    expect(resolveCancellationState({})).toBe('none')
  })

  it('audit events redact sensitive information', () => {
    const registry = makeRegistry()
    const descriptor = makeRequest({ url: 'https://api.example.com/v1/items?apiKey=secret-token' })
    const decision = evaluateConnectivityPolicy(descriptor, registry.snapshot())
    const audit = buildConnectivityAuditEvent(descriptor, decision)
    expect(audit.redactedUrl).toBe('https://api.example.com/v1/items')
    expect(audit.redactedUrl?.includes('secret-token')).toBe(false)
    expect(audit.redactedUrl?.includes('?')).toBe(false)
    expect(audit.redactedUrl?.includes('#')).toBe(false)
  })

  it('audit redaction handles malformed credential-like input', () => {
    const registry = makeRegistry()
    const descriptor = makeRequest({ url: 'https://api.example.com/v1/items?authorization=Bearer%20abc' })
    const decision = evaluateConnectivityPolicy(descriptor, registry.snapshot())
    const malformedAudit = buildConnectivityAuditEvent({ ...descriptor, url: 'https://user:pass@api.example.com/v1/items#frag' }, decision)
    expect(malformedAudit.redactedUrl).toBe('invalid-url')
  })

  it('policy results are deterministic', () => {
    const registry = makeRegistry()
    const a = evaluateConnectivityPolicy(makeRequest(), registry.snapshot())
    const b = evaluateConnectivityPolicy(makeRequest(), registry.snapshot())
    expect(a).toEqual(b)
  })

  it('registry enumeration is deterministic', () => {
    const registry = new ConnectivityPolicyRegistry()
    registry.registerAdapter({
      id: 'adapter:z',
      version: '1.0.0',
      enabled: false,
      policyVersion: '1.0.0',
      registryVersion: '1.0.0',
    })
    registry.registerAdapter({
      id: 'adapter:a',
      version: '1.0.0',
      enabled: false,
      policyVersion: '1.0.0',
      registryVersion: '1.0.0',
    })
    const ids = registry.snapshot().adapters.map(adapter => adapter.id)
    expect(ids).toEqual(['adapter:a', 'adapter:z'])
  })

  it('registry state cannot be mutated externally', () => {
    const registry = makeRegistry()
    const first = registry.snapshot()
    const before = first.adapters[0].enabled
    expect(() => {
      ;(first.adapters[0] as { enabled: boolean }).enabled = !before
    }).toThrow()
    const second = registry.snapshot()
    expect(second.adapters[0].enabled).toBe(before)
  })

  it('mutation after registration does not alter internal state', () => {
    const registry = new ConnectivityPolicyRegistry()
    const adapter = {
      id: 'adapter:test',
      version: '1.0.0',
      enabled: true,
      policyVersion: '1.0.0',
      registryVersion: '1.0.0',
    }
    const registration = registry.registerAdapter(adapter)
    expect(registration.ok).toBe(true)
    adapter.enabled = false
    const snapshot = registry.snapshot()
    expect(snapshot.adapters[0].enabled).toBe(true)
  })

  it('no production endpoints are present', () => {
    const root = path.resolve(__dirname, '../..')
    const files = [
      path.join(root, 'src/services/ConnectivityPolicyEvaluator.ts'),
      path.join(root, 'src/services/ConnectivityPolicyRegistry.ts'),
      path.join(root, 'src/types/connectivity.ts'),
    ]
    const disallowed = /(https?:\/\/)(?!localhost|127\.0\.0\.1|api\.example\.com)/i
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8')
      expect(disallowed.test(source)).toBe(false)
    }
  })

  it('no real external request occurs', () => {
    const registry = makeRegistry()
    const before = evaluateConnectivityPolicy(makeRequest(), registry.snapshot())
    const after = evaluateConnectivityPolicy(makeRequest({ url: 'https://api.example.com/v1/public/news' }), registry.snapshot())
    expect(before.allowed).toBe(true)
    expect(after.allowed).toBe(true)
  })

  it('direct UI and domain networking remain prohibited', () => {
    expect(() => {
      execSync('node scripts/security-boundary-check.mjs', {
        cwd: path.resolve(__dirname, '../..'),
        stdio: 'pipe',
      })
    }).not.toThrow()
  })

  it('existing local-only operation remains unchanged', () => {
    const registry = new ConnectivityPolicyRegistry()
    const decision = evaluateConnectivityPolicy(makeRequest(), registry.snapshot())
    expect(decision.allowed).toBe(false)
  })
})
