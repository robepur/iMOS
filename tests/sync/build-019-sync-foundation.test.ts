import { afterEach, describe, expect, it } from 'vitest'
import http from 'node:http'
import { URL } from 'node:url'
import { createLocalReferenceSyncService } from '../../src/services/LocalReferenceSyncService'
import { createSyncEnvelopeService } from '../../src/services/SyncEnvelopeService'
import { createSyncProtocolService } from '../../src/services/SyncProtocolService'
import { createSyncTransportAdapter } from '../../src/services/SyncTransportAdapter'
import { createSyncQuarantineService } from '../../src/services/SyncQuarantineService'
import { SyncService } from '../../src/services/SyncService'
import {
  generateLocalDeviceIdentity,
  InMemoryDevicePrivateKeyStore,
} from '../../src/services/DeviceIdentityService'
import { DeviceTrustRegistry } from '../../src/services/DeviceTrustRegistry'
import { createInitialData, normalizePersonalData } from '../../src/localData'

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => { body += String(chunk) })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function startReferenceServer(input?: { malformedContentType?: boolean; redirect?: boolean }): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const reference = createLocalReferenceSyncService()
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const requestUrl = new URL(req.url ?? '/', 'http://localhost')
      if (input?.redirect && requestUrl.pathname === '/sync/v1/envelopes') {
        res.statusCode = 302
        res.setHeader('location', '/elsewhere')
        res.end()
        return
      }
      if (req.method === 'POST' && requestUrl.pathname === '/sync/v1/envelopes') {
        const raw = await readBody(req)
        const envelope = JSON.parse(raw)
        const result = reference.upload(envelope)
        res.statusCode = 200
        res.setHeader('content-type', input?.malformedContentType ? 'text/plain' : 'application/json')
        res.end(JSON.stringify(result.kind === 'ack' ? result.ack : result))
        return
      }
      if (req.method === 'GET' && requestUrl.pathname.startsWith('/sync/v1/envelopes/')) {
        const [, , , , namespaceRaw, objectIdRaw] = requestUrl.pathname.split('/')
        const requestId = requestUrl.searchParams.get('requestId') ?? `request:${crypto.randomUUID()}`
        const result = reference.download({
          requestId,
          namespace: decodeURIComponent(namespaceRaw),
          objectId: decodeURIComponent(objectIdRaw),
        })
        res.statusCode = 200
        res.setHeader('content-type', input?.malformedContentType ? 'text/plain' : 'application/json')
        res.end(JSON.stringify(result))
        return
      }
      res.statusCode = 404
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: 'not_found' }))
    })
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('Unable to resolve local test server address.')
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => new Promise<void>((resolveClose, rejectClose) => {
          server.close((error) => {
            if (error) rejectClose(error)
            else resolveClose()
          })
        }),
      })
    })
  })
}

const activeClosers: Array<() => Promise<void>> = []
afterEach(async () => {
  while (activeClosers.length > 0) {
    const close = activeClosers.pop()
    if (close) await close()
  }
})

describe('Build 019 sync foundation', () => {
  it('enforces deny-by-default until explicit operator enable and local endpoint configuration', async () => {
    const adapter = createSyncTransportAdapter()
    const envelope = {
      protocolVersion: '1.0.0',
      envelopeVersion: '1.0.0',
      schemaVersion: '1.0.0',
      cryptoSuiteVersion: '1.0.0',
      namespace: 'sync:operator',
      objectId: 'obj:item',
      objectVersion: '1',
      encryptedPayload: 'ZGF0YQ==',
      iv: 'aXY=',
      encryptedMetadata: 'bWV0YQ==',
      authTag: 'dGFn',
      ciphertextDigest: 'digest',
      signerDeviceId: 'device:test',
      signature: 'sig',
      requestId: 'request-1',
      replayId: 'replay-1',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      tombstone: false,
    } as const
    await expect(adapter.upload(envelope)).rejects.toThrow('Sync endpoint not configured')
    adapter.configureLocalEndpoint('http://127.0.0.1:9999')
    await expect(adapter.upload(envelope)).rejects.toThrow('disabled')
  })

  it('rejects non-local endpoint and keeps local-only test networking', () => {
    const adapter = createSyncTransportAdapter()
    expect(() => adapter.configureLocalEndpoint('https://example.com')).toThrow('local-only')
    expect(() => adapter.configureLocalEndpoint('http://localhost:8765')).not.toThrow()
  })

  it('encrypts, signs, uploads, downloads, and decrypts through local reference service', async () => {
    const server = await startReferenceServer()
    activeClosers.push(server.close)

    const store = new InMemoryDevicePrivateKeyStore()
    const identity = await generateLocalDeviceIdentity('Build 019 Primary', new Date(), { store })
    const trust = new DeviceTrustRegistry(identity.publicIdentity)
    const envelopeService = createSyncEnvelopeService()
    const protocolService = createSyncProtocolService()
    const quarantine = createSyncQuarantineService()
    const adapter = createSyncTransportAdapter()
    adapter.configureLocalEndpoint(server.baseUrl)
    adapter.setEnabled(true)
    const service = new SyncService(
      envelopeService,
      protocolService,
      quarantine,
      adapter,
      identity.publicIdentity,
      identity.privateHandle,
      trust,
      store,
    )
    const key = await envelopeService.createDataKey()
    const ack = await service.uploadPlaintext({
      namespace: 'sync:operator',
      objectId: 'obj:decision-1',
      objectVersion: '1',
      plaintext: '{"decision":"stay local"}',
      encryptionKey: key,
    })
    expect('accepted' in ack && ack.accepted).toBe(true)

    const downloaded = await service.downloadAndDecrypt({
      namespace: 'sync:operator',
      objectId: 'obj:decision-1',
      decryptionKey: key,
    })
    expect(downloaded.result.kind).toBe('found')
    expect(downloaded.plaintext).toBe('{"decision":"stay local"}')
    expect(downloaded.quarantined).toBeUndefined()
  })

  it('fails closed on malformed response content-type', async () => {
    const server = await startReferenceServer({ malformedContentType: true })
    activeClosers.push(server.close)

    const adapter = createSyncTransportAdapter()
    adapter.configureLocalEndpoint(server.baseUrl)
    adapter.setEnabled(true)
    await expect(adapter.download({
      requestId: 'request-malformed',
      namespace: 'sync:operator',
      objectId: 'obj:missing',
    })).rejects.toThrow('Unexpected response content type')
  })

  it('rejects redirect responses', async () => {
    const server = await startReferenceServer({ redirect: true })
    activeClosers.push(server.close)

    const adapter = createSyncTransportAdapter()
    adapter.configureLocalEndpoint(server.baseUrl)
    adapter.setEnabled(true)
    const envelope = {
      protocolVersion: '1.0.0',
      envelopeVersion: '1.0.0',
      schemaVersion: '1.0.0',
      cryptoSuiteVersion: '1.0.0',
      namespace: 'sync:operator',
      objectId: 'obj:item',
      objectVersion: '1',
      encryptedPayload: 'ZGF0YQ==',
      iv: 'aXY=',
      encryptedMetadata: 'bWV0YQ==',
      authTag: 'dGFn',
      ciphertextDigest: 'digest',
      signerDeviceId: 'device:test',
      signature: 'sig',
      requestId: 'request-redirect',
      replayId: 'replay-redirect',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      tombstone: false,
    } as const
    await expect(adapter.upload(envelope)).rejects.toThrow('Redirect rejected')
  })

  it('blocks replayed signed requests', async () => {
    const store = new InMemoryDevicePrivateKeyStore()
    const identity = await generateLocalDeviceIdentity('Replay Device', new Date(), { store })
    const protocol = createSyncProtocolService()
    const now = new Date()
    const request = await protocol.createSignedRequest({
      method: 'upload',
      namespace: 'sync:operator',
      objectId: 'obj:replay',
      objectVersion: '1',
      signerDeviceId: identity.publicIdentity.deviceId,
      requestId: 'request-replay',
      replayId: 'replay-once',
      ciphertextDigest: 'digest',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 60_000).toISOString(),
      privateHandle: identity.privateHandle,
      store,
    })
    const first = await protocol.verifySignedRequest({
      request,
      signerIdentity: identity.publicIdentity,
      now,
    })
    const second = await protocol.verifySignedRequest({
      request,
      signerIdentity: identity.publicIdentity,
      now,
    })
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.error.code).toBe('replay_detected')
  })

  it('preserves local-only defaults and additive migration compatibility', () => {
    const initial = createInitialData()
    expect(initial.syncOperatorControlState?.enabled).toBe(false)
    expect(initial.syncOperatorControlState?.localEndpointConfigured).toBe(false)
    expect(initial.syncQuarantine).toEqual([])

    const normalized = normalizePersonalData({
      ...initial,
      syncOperatorControlState: { enabled: true, localEndpointConfigured: true, configuredAt: new Date().toISOString() },
      syncQuarantine: [{
        id: 'sync-quarantine:1',
        reason: 'malformed_response',
        requestId: 'request-1',
        namespace: 'sync:operator',
        objectId: 'obj:1',
        createdAt: new Date().toISOString(),
        detail: 'bad payload',
      }],
    })
    expect(normalized.syncOperatorControlState?.enabled).toBe(true)
    expect(normalized.syncQuarantine?.length).toBe(1)
  })
})

